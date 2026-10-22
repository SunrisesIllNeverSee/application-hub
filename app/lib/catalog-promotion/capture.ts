// Server-captured source evidence (capture_method = 'url_fetch').
//
// The server fetches the URL itself (W2's SSRF-guarded fetchPublicApplication)
// and stores a bounded snapshot built ONLY from the items W2's classifier
// marks public: program title/organization/description, published deadlines
// and the exact question wording. Text found after a question or values
// already filled into the page are classified private and never stored.
// Pure (no network): callers pass in the fetch result.

import { classifyExtraction } from '../catalog/index.ts'
import type { PublicApplicationSnapshot } from '../catalog/fetch-public.ts'
import { checkPublicUrl } from './privacy.ts'
import { LIMITS } from './schema.ts'

export type ServerCapturedSource = {
  url: string
  final_url: string
  capture_method: 'url_fetch'
  snapshot_text: string
  content_sha256: string
  fetched_at: string
  reuse: 'allowed' | 'unknown'
  robots_disallow: boolean | null
  reuse_signals: string[]
}

export type CaptureRefusal = { ok: false; status: number; error: string; detail?: Record<string, unknown> }

/** Public-only text of a fetched page, bounded to the snapshot limit. */
export function serverSnapshotText(snap: PublicApplicationSnapshot): string {
  const s = snap.source
  const c = classifyExtraction(snap.extraction, {
    provenance: 'public_source', reuse: s.reuse, final_url: s.final_url, fetched_at: s.fetched_at, content_sha256: s.content_sha256,
  })
  const p = c.public
  const lines: string[] = []
  if (p.program.title) lines.push(p.program.title)
  if (p.program.organization) lines.push(p.program.organization)
  if (p.program.description) lines.push(p.program.description)
  for (const d of p.deadlines) lines.push(d.text)
  let section: string | null = null
  for (const q of p.questions) {
    if (q.section && q.section !== section) { section = q.section; lines.push(q.section) }
    lines.push(q.asked_as)
  }
  const text = lines.join('\n')
  return text.length > LIMITS.snapshot ? text.slice(0, LIMITS.snapshot) : text
}

/** Turns a fetch result into the catalog_sources row, or a refusal. */
export function captureFromFetch(requestedUrl: string, snap: PublicApplicationSnapshot): { ok: true; source: ServerCapturedSource } | CaptureRefusal {
  const s = snap.source
  if (s.reuse === 'disallowed') {
    return { ok: false, status: 422, error: 'source_reuse_disallowed', detail: { reuse_signals: s.reuse_signals.slice(0, 50) } }
  }
  const final = checkPublicUrl(s.final_url)
  if (!final.ok) return { ok: false, status: 422, error: 'source_final_url_not_public', detail: { code: final.kind } }
  return {
    ok: true,
    source: {
      url: requestedUrl,
      final_url: final.url.toString(),
      capture_method: 'url_fetch',
      snapshot_text: serverSnapshotText(snap),
      content_sha256: s.content_sha256,
      fetched_at: s.fetched_at,
      reuse: s.reuse,
      robots_disallow: s.reuse === 'allowed' ? false : null,
      reuse_signals: s.reuse_signals.slice(0, 50).map((x) => x.slice(0, 200)),
    },
  }
}

export type RecheckOutcome = {
  verification_status: 'unverified' | 'verified' | 'stale' | 'failed'
  reuse?: 'disallowed'
  robots_disallow?: true
  last_check: Record<string, unknown>
}

/** Decides the source review signals after a curator re-fetch. */
export function recheckOutcome(
  stored: { content_sha256: string | null; verification_status: string },
  result: { ok: true; snap: PublicApplicationSnapshot } | { ok: false; code: string },
  now: Date = new Date(),
): RecheckOutcome {
  const at = now.toISOString()
  if (!result.ok) return { verification_status: 'failed', last_check: { ok: false, at, code: result.code } }
  const s = result.snap.source
  const changed = s.content_sha256 !== stored.content_sha256
  const base: Record<string, unknown> = {
    ok: true, at, changed, observed_sha256: s.content_sha256, final_url: s.final_url, reuse: s.reuse,
    reuse_signals: s.reuse_signals.slice(0, 50),
  }
  if (s.reuse === 'disallowed') return { verification_status: 'failed', reuse: 'disallowed', robots_disallow: true, last_check: base }
  if (changed) return { verification_status: 'stale', last_check: base }
  const prev = stored.verification_status
  return {
    verification_status: prev === 'failed' || prev === 'stale' ? 'unverified' : (prev as RecheckOutcome['verification_status']),
    last_check: base,
  }
}
