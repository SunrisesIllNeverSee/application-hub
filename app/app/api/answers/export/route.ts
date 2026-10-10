import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canonicalJson, sha256Hex } from '@/lib/aqua-local/crypto.ts'

// ============================================================
// GET /api/answers/export
// ============================================================
// LF-24 — user-scoped legacy answer export for local-first mode.
//
// Returns ONLY the caller's own profile_answers rows, shaped for
// import into the aqua-local vault (lib/aqua-local/legacy-import.ts).
//
// Security:
//   - Auth: session cookie required (401 otherwise).
//   - Scope is the SESSION user id — never a body/query param. There
//     is no way to request another user's rows; a `user_id` query param
//     that disagrees with the session is refused with 403 rather than
//     silently ignored.
//   - READ-ONLY: this endpoint never creates/updates/deletes rows.
//
// Per-row `sha256` is computed server-side over the same canonical
// content the vault will store ({ title, body } via canonicalJson), so
// the importer can verify integrity after transfer.
// ============================================================

const EXPORT_FORMAT = 'aqua-legacy-answers'
const EXPORT_FORMAT_VERSION = 1

export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Cross-account guard: the session is the only scope. If a caller tries
  // to pass a foreign user_id explicitly, refuse loudly instead of
  // silently narrowing to the session user.
  const requestedUserId = new URL(req.url).searchParams.get('user_id')
  if (requestedUserId && requestedUserId !== user.id) {
    return NextResponse.json(
      { error: 'Forbidden: export is scoped to the authenticated user only' },
      { status: 403 },
    )
  }

  const { data: rows, error } = await supabase
    .from('profile_answers')
    .select(
      'id, archived_question_id, question_text, answer_content, content, version, word_count, confidence, created_at, last_updated',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const answers = await Promise.all(
    (rows ?? []).map(async (r) => {
      const body: string = r.answer_content ?? r.content ?? ''
      const title: string = r.question_text ?? ''
      // Same canonical form the vault records in VersionRecord.sha256.
      const sha256 = await sha256Hex(canonicalJson({ title, body }))
      return {
        source_id: r.id,
        archived_question_id: r.archived_question_id,
        question_text: title,
        answer_content: body,
        version: r.version,
        word_count: r.word_count,
        confidence: r.confidence,
        created_at: r.created_at,
        last_updated: r.last_updated,
        sha256,
      }
    }),
  )

  return NextResponse.json({
    format: EXPORT_FORMAT,
    format_version: EXPORT_FORMAT_VERSION,
    user_id: user.id,
    exported_at: new Date().toISOString(),
    answers,
  })
}
