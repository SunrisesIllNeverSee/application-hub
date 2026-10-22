import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimitAllow } from '@/lib/rate-limit'
import { restrictToApprovedPrograms } from '@/lib/canonical-catalog'
import { fetchPublicApplication, PublicFetchError } from '@/lib/catalog/fetch-public'
import { urlSensitivity } from '@/lib/catalog/classify'
import { buildExtractionProposal, matchProgram, searchTermsFor, type ProgramRow, type CycleRow } from '@/lib/catalog/proposal'
import type { CatalogQuestion, CatalogVariant } from '@/lib/catalog/match'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================
// POST /api/catalog/extract-url        (M09 W2 — A1 + QU website import)
// ============================================================
// Fetches ONE public application page (SSRF-guarded), extracts question
// occurrences + program identity, classifies public / private / uncertain,
// and looks up existing APPROVED programs and canonical questions. Returns a
// proposal. It WRITES NOTHING — no catalog rows, no import session, no
// snapshot. Page bodies are never logged or returned (only their SHA-256).
//
// Request:  { url: string }
// Response: 200 { proposal, writes:'none', program_match, program_candidates,
//                 program_needs_review, questions[], duplicates[],
//                 public_candidate | null, public_candidate_refused | null,
//                 uncertain[], private_summary, warnings[], source, catalog_lookup }
//           400 invalid body / url looks private   401 unauthenticated
//           422 fetch/extraction failed { error, code, status? }
//           429 rate limited
// ============================================================

const MAX_CATALOG_ROWS = 200

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!rateLimitAllow(user.id, 'catalog_extract_url')) {
      return NextResponse.json({ error: 'Too many URL extractions — try again later' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    const url = body && typeof body === 'object' ? (body as Record<string, unknown>).url : undefined
    if (typeof url !== 'string' || !url.trim() || url.length > 2048) {
      return NextResponse.json({ error: 'url must be a non-empty string (≤ 2048 chars)' }, { status: 400 })
    }
    for (const key of Object.keys(body as object)) {
      if (key !== 'url') return NextResponse.json({ error: `Unexpected field: ${key}` }, { status: 400 })
    }
    // Private links (tokens, signed URLs, Docs edit links, private hosts) are
    // never fetched: they are the user's private material, not a public source.
    const sens = urlSensitivity(url.trim())
    if (sens.length) {
      return NextResponse.json({ error: 'This link looks private and was not fetched. Use local import instead.', code: 'url_not_public', reasons: sens }, { status: 400 })
    }

    // ── 1. fetch + extract (no partial result on failure) ──
    let snapshot
    try {
      snapshot = await fetchPublicApplication(url.trim())
    } catch (err) {
      if (err instanceof PublicFetchError) {
        // M1: 'busy' = this instance's outbound concurrency cap — transient, retryable.
        return NextResponse.json({ error: err.message, code: err.code, ...(err.status ? { status: err.status } : {}) }, { status: err.code === 'busy' ? 503 : 422 })
      }
      console.error('[/api/catalog/extract-url] fetch failed:', err instanceof Error ? err.name : 'unknown')
      return NextResponse.json({ error: 'Fetch failed', code: 'network_error' }, { status: 422 })
    }
    const { source, extraction } = snapshot

    // ── 2. read-only catalog lookup (RLS-visible, approved programs only) ──
    let catalogLookup: 'ok' | 'unavailable' = 'ok'
    let programs: ProgramRow[] = []
    let cycles: CycleRow[] = []
    const catalog = new Map<string, CatalogQuestion>()
    try {
      const { data: progRows, error: progErr } = await restrictToApprovedPrograms(
        supabase.from('programs').select('id, slug, name, organization, apply_url, scrape_url'),
      ).limit(MAX_CATALOG_ROWS)
      if (progErr) throw progErr
      programs = (progRows ?? []) as ProgramRow[]
      if (programs.length) {
        const { data: cycRows } = await supabase
          .from('program_cycles')
          .select('program_id, cycle_name, apply_url, closes_at')
          .in('program_id', programs.map((p) => p.id))
          .limit(MAX_CATALOG_ROWS)
        cycles = (cycRows ?? []) as CycleRow[]
      }

      // provisional program match → that program's recorded occurrences
      const { best } = matchProgram(
        { final_url: source.final_url, title: extraction.program.title, organization: extraction.program.organization, apply_urls: extraction.program.apply_urls },
        programs, cycles,
      )
      if (best) {
        const { data: pq } = await supabase
          .from('program_questions')
          .select('asked_as, word_limit, char_limit, archived_question_id, archived_questions(id, text, typical_word_limit)')
          .eq('program_id', best.program_id)
          .limit(MAX_CATALOG_ROWS)
        for (const row of (pq ?? []) as Array<{ asked_as: string; word_limit: number | null; char_limit: number | null; archived_question_id: string; archived_questions: { id: string; text: string; typical_word_limit: number | null } | Array<{ id: string; text: string; typical_word_limit: number | null }> | null }>) {
          const aq = Array.isArray(row.archived_questions) ? row.archived_questions[0] : row.archived_questions
          if (!aq) continue
          const entry = catalog.get(aq.id) ?? { id: aq.id, text: aq.text, variants: [] as CatalogVariant[] }
          ;(entry.variants as CatalogVariant[]).push({ text: row.asked_as, word_limit: row.word_limit, char_limit: row.char_limit })
          catalog.set(aq.id, entry)
        }
      }

      // bounded text search over visible canonical questions
      const terms = searchTermsFor(extraction)
      if (terms.length) {
        const { data: aqRows } = await supabase
          .from('archived_questions')
          .select('id, text')
          .or(terms.map((t) => `text.ilike.*${t}*`).join(','))
          .limit(MAX_CATALOG_ROWS)
        for (const r of (aqRows ?? []) as Array<{ id: string; text: string }>) {
          if (!catalog.has(r.id)) catalog.set(r.id, { id: r.id, text: r.text })
        }
      }
    } catch (err) {
      catalogLookup = 'unavailable'
      console.error('[/api/catalog/extract-url] catalog lookup failed:', (err as { code?: string })?.code ?? 'unknown')
    }

    // ── 3. classify + match + candidate (pure) ──
    const { classification: _classification, ...proposal } = buildExtractionProposal({
      extraction,
      source: { provenance: 'public_source', reuse: source.reuse, final_url: source.final_url, fetched_at: source.fetched_at, content_sha256: source.content_sha256 },
      programs,
      cycles,
      catalog: [...catalog.values()],
    })
    void _classification // contains private values — never returned

    return NextResponse.json({
      ...proposal,
      catalog_lookup: catalogLookup,
      source: {
        requested_url: source.requested_url,
        final_url: source.final_url,
        status: source.status,
        fetched_at: source.fetched_at,
        content_type: source.content_type,
        bytes: source.bytes,
        content_sha256: source.content_sha256,
        redirects: source.redirects,
        reuse: source.reuse,
        reuse_signals: source.reuse_signals,
      },
    })
  } catch (err) {
    console.error('[/api/catalog/extract-url] unexpected error:', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
