import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── Schema ───────────────────────────────────────────────────────────────────

const KIND_VALUES = [
  'accelerator',
  'vc',
  'grant',
  'fellowship',
  'job_fulltime',
  'job_internship',
  'job_contract',
  'school_undergrad',
  'school_grad',
  'school_professional',
  'other',
] as const

type OpportunityKind = (typeof KIND_VALUES)[number]

type SubmitInput = {
  program_url: string
  kind: OpportunityKind
  notes?: string
}

type ValidationError = { error: string; field?: string }
type ValidationResult =
  | { ok: true; value: SubmitInput }
  | { ok: false; error: ValidationError }

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function isKind(value: unknown): value is OpportunityKind {
  return typeof value === 'string' && (KIND_VALUES as readonly string[]).includes(value)
}

function parseBody(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: { error: 'Request body must be a JSON object.' } }
  }
  const record = body as Record<string, unknown>

  const allowedKeys = new Set(['program_url', 'kind', 'notes'])
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, error: { error: `Unknown field: ${key}`, field: key } }
    }
  }

  const { program_url, kind, notes } = record

  if (!isHttpUrl(program_url)) {
    return {
      ok: false,
      error: { error: 'program_url must be a valid http or https URL.', field: 'program_url' },
    }
  }
  if (!isKind(kind)) {
    return {
      ok: false,
      error: {
        error: `kind must be one of: ${KIND_VALUES.join(', ')}`,
        field: 'kind',
      },
    }
  }
  let notesValue: string | undefined
  if (notes !== undefined && notes !== null) {
    if (typeof notes !== 'string') {
      return { ok: false, error: { error: 'notes must be a string.', field: 'notes' } }
    }
    if (notes.length > 2000) {
      return { ok: false, error: { error: 'notes must be 2000 characters or fewer.', field: 'notes' } }
    }
    const trimmed = notes.trim()
    notesValue = trimmed.length > 0 ? trimmed : undefined
  }

  return {
    ok: true,
    value: { program_url, kind, notes: notesValue },
  }
}

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw)
    // Strip the trailing slash from the path for dedupe purposes; preserve query.
    let path = u.pathname
    if (path.length > 1 && path.endsWith('/')) {
      path = path.replace(/\/+$/, '')
    }
    u.pathname = path
    return u.toString()
  } catch {
    return raw
  }
}

const SUBMISSION_RATE_LIMIT = 10
const SUBMISSION_RATE_WINDOW_HOURS = 24

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body must be valid JSON.' }, { status: 400 })
    }

    const parsed = parseBody(rawBody)
    if (!parsed.ok) {
      return NextResponse.json(parsed.error, { status: 400 })
    }
    const { program_url, kind, notes } = parsed.value
    const normalizedUrl = normalizeUrl(program_url)

    // 1. Rate limit — max 10 submissions per user per rolling 24h
    const windowStart = new Date(
      Date.now() - SUBMISSION_RATE_WINDOW_HOURS * 60 * 60 * 1000,
    ).toISOString()
    const { count: recentCount, error: rateError } = await supabase
      .from('import_queue')
      .select('id', { count: 'exact', head: true })
      .eq('submitted_by', user.id)
      .gte('submitted_at', windowStart)

    if (rateError) {
      console.error('[/api/import/submit-url] rate-limit query failed:', rateError)
      return NextResponse.json({ error: 'Unable to verify submission quota.' }, { status: 500 })
    }
    if ((recentCount ?? 0) >= SUBMISSION_RATE_LIMIT) {
      return NextResponse.json(
        {
          error: `You can submit at most ${SUBMISSION_RATE_LIMIT} programs per ${SUBMISSION_RATE_WINDOW_HOURS} hours. Try again later.`,
          code: 'rate_limited',
        },
        { status: 429 },
      )
    }

    // 2. Dedupe against existing queue rows (match the user's URL exactly OR
    //    the normalized variant — whichever the table stores). PostgREST's
    //    `or` filter is comma-delimited which breaks URLs containing commas
    //    (e.g. ?utm=a,b), so we use `in()` with explicit candidate values.
    const urlCandidates = Array.from(new Set([program_url, normalizedUrl]))
    const { data: queuedDupe } = await supabase
      .from('import_queue')
      .select('id, status')
      .in('url', urlCandidates)
      .limit(1)
      .maybeSingle()

    if (queuedDupe?.id) {
      return NextResponse.json({
        status: 'already_queued',
        queue_id: queuedDupe.id,
      })
    }

    // 3. Dedupe against archive — does the program already live in `programs`?
    const { data: existingProgram } = await supabase
      .from('programs')
      .select('slug')
      .in('url', urlCandidates)
      .limit(1)
      .maybeSingle()

    if (existingProgram?.slug) {
      return NextResponse.json({
        status: 'already_in_archive',
        program_slug: existingProgram.slug,
      })
    }

    // 4. Insert the submission. raw_text is kept populated for backwards
    //    compatibility with the MCP server / reviewer tooling that reads it.
    const rawText = notes ? `${program_url}\n\n${notes}` : program_url

    type ImportQueueInsert = {
      raw_text: string
      submitted_by: string
      status: 'pending_review'
      url: string
      kind: OpportunityKind
      notes: string | null
      metadata: Record<string, unknown>
      submitted_at: string
    }

    const insertRow: ImportQueueInsert = {
      raw_text: rawText,
      submitted_by: user.id,
      status: 'pending_review',
      url: normalizedUrl,
      kind,
      notes: notes ?? null,
      metadata: {
        source: 'hub_submit_form',
        original_url: program_url,
      },
      submitted_at: new Date().toISOString(),
    }

    const { data: inserted, error: insertError } = await supabase
      .from('import_queue')
      // Cast through unknown because database.types.ts has not been regenerated
      // for migration 021 yet (new columns: url, kind, notes, metadata,
      // submitted_at). The runtime schema accepts them.
      .insert(insertRow as unknown as Record<string, unknown>)
      .select('id')
      .single()

    if (insertError || !inserted) {
      console.error('[/api/import/submit-url] insert failed:', insertError)
      return NextResponse.json(
        { error: 'Unable to queue submission.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      status: 'queued',
      queue_id: inserted.id,
    })
  } catch (err) {
    console.error('[/api/import/submit-url] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
