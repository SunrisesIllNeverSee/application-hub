// Server-side review context: loads the database facts the pure check
// runner needs (service-role client; server only).

import type { SupabaseClient } from '@supabase/supabase-js'
import { runChecks, matchQuestions, type CandidateChecks, type ExistingProgram, type ExistingRevision, type SourceFacts } from './checks.ts'
import type { CandidatePayload } from './schema.ts'

export type CandidateRow = {
  id: string
  state: string
  submitted_by: string | null
  submitted_at: string
  updated_at: string
  source_id: string | null
  payload: unknown
  checks: Record<string, unknown>
  program_match_id: string | null
  published_revision_id: string | null
}

export type ReviewContext = {
  source: (SourceFacts & { id: string }) | null
  programs: ExistingProgram[]
  revisions: ExistingRevision[]
  error: { code?: string; message?: string } | null
}

export async function loadSourceFacts(admin: SupabaseClient, sourceId: string | null): Promise<ReviewContext['source']> {
  if (!sourceId) return null
  const { data } = await admin.from('catalog_sources')
    .select('id, url, final_url, capture_method, reuse, robots_disallow, verification_status, snapshot_text, last_checked_at')
    .eq('id', sourceId).maybeSingle()
  return (data as ReviewContext['source']) ?? null
}

export async function loadReviewContext(admin: SupabaseClient, candidate: Pick<CandidateRow, 'source_id'>): Promise<ReviewContext> {
  const [src, progs, revs] = await Promise.all([
    candidate.source_id
      ? admin.from('catalog_sources')
          .select('id, url, final_url, capture_method, reuse, robots_disallow, verification_status, snapshot_text')
          .eq('id', candidate.source_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin.from('programs').select('id, slug, name, organization, url, apply_url').eq('source', 'canonical').limit(5000),
    admin.from('program_template_revisions').select('program_id, revision, question_set_sha256').limit(20000),
  ])
  const error = src.error ?? progs.error ?? revs.error ?? null
  return {
    source: (src.data as ReviewContext['source']) ?? null,
    programs: (progs.data as ExistingProgram[]) ?? [],
    revisions: (revs.data as ExistingRevision[]) ?? [],
    error,
  }
}

export function checksFor(candidate: Pick<CandidateRow, 'payload' | 'program_match_id'>, ctx: ReviewContext, payload?: CandidatePayload): CandidateChecks {
  return runChecks({
    payload: payload ?? candidate.payload,
    source: ctx.source,
    programs: ctx.programs,
    revisions: ctx.revisions,
    programMatchId: candidate.program_match_id,
  })
}

/** Canonical questions currently used by canonical programs (exact/normalized matching index). */
export async function loadCanonicalQuestionIndex(admin: SupabaseClient): Promise<{ data: { id: string; text: string }[]; error: { code?: string; message?: string } | null }> {
  const { data, error } = await admin
    .from('program_questions')
    .select('archived_question_id, archived_question:archived_questions(id, text), program:programs!inner(source)')
    .eq('program.source', 'canonical')
    .limit(20000)
  if (error) return { data: [], error }
  const seen = new Map<string, string>()
  for (const row of (data ?? []) as unknown as { archived_question: { id: string; text: string } | null }[]) {
    if (row.archived_question && !seen.has(row.archived_question.id)) seen.set(row.archived_question.id, row.archived_question.text)
  }
  return { data: [...seen].map(([id, text]) => ({ id, text })), error: null }
}

export { matchQuestions }
