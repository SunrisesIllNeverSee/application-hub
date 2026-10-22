// M09 W6 — server-side public catalog read for the application journey.
// Reads ONLY public, owner-approved catalog rows (same approved-only policy
// as /applications) and hands them to the client once, so every later step
// (local matching, catalog-backed instances, Step D wording) runs on the
// device without further requests carrying the user's material.

import type { SupabaseClient } from '@supabase/supabase-js'
import { restrictToApprovedPrograms } from '@/lib/canonical-catalog'
import type { JourneyCatalog, JourneyCatalogProgram } from '@/lib/journey/review-model'

const MAX_PROGRAMS = 200

type ProgramRow = { id: string; slug: string; name: string; organization: string | null; apply_url: string | null; deadline_at: string | null }
type CycleRow = { program_id: string; cycle_id: string; cycle_name: string; opens_at: string | null; closes_at: string | null; apply_url: string | null }
type QuestionRow = {
  id: string
  program_id: string
  archived_question_id: string | null
  asked_as: string
  word_limit: number | null
  char_limit: number | null
  is_required: boolean
  order_index: number
  section: string | null
  archived_questions: { id: string; text: string } | Array<{ id: string; text: string }> | null
}

export async function loadJourneyCatalog(supabase: SupabaseClient): Promise<JourneyCatalog> {
  try {
    const { data: progRows, error } = await restrictToApprovedPrograms(
      supabase.from('programs').select('id, slug, name, organization, apply_url, deadline_at'),
    )
      .order('name', { ascending: true })
      .limit(MAX_PROGRAMS)
    if (error) throw error
    const programs = (progRows ?? []) as ProgramRow[]
    if (!programs.length) return { programs: [] }
    const ids = programs.map((p) => p.id)
    const [{ data: cycRows }, { data: qRows }] = await Promise.all([
      supabase.from('program_next_cycle').select('program_id, cycle_id, cycle_name, opens_at, closes_at, apply_url').in('program_id', ids),
      supabase
        .from('program_questions')
        .select('id, program_id, archived_question_id, asked_as, word_limit, char_limit, is_required, order_index, section, archived_questions(id, text)')
        .in('program_id', ids)
        .order('order_index', { ascending: true }),
    ])
    const cycles = new Map(((cycRows ?? []) as CycleRow[]).map((c) => [c.program_id, c]))
    const byProgram = new Map<string, JourneyCatalogProgram['questions']>()
    for (const q of (qRows ?? []) as QuestionRow[]) {
      const aq = Array.isArray(q.archived_questions) ? q.archived_questions[0] : q.archived_questions
      const list = byProgram.get(q.program_id) ?? []
      list.push({
        id: q.id,
        canonical_question_id: q.archived_question_id ?? aq?.id ?? null,
        canonical_text: aq?.text ?? null,
        asked_as: q.asked_as,
        word_limit: q.word_limit,
        char_limit: q.char_limit,
        required: !!q.is_required,
        order_index: q.order_index,
        section: q.section,
      })
      byProgram.set(q.program_id, list)
    }
    return {
      programs: programs.map((p) => {
        const c = cycles.get(p.id)
        return {
          id: p.id,
          slug: p.slug,
          name: p.name,
          organization: p.organization,
          apply_url: p.apply_url,
          deadline_at: p.deadline_at,
          cycle: c ? { cycle_id: c.cycle_id, cycle_name: c.cycle_name, opens_at: c.opens_at, closes_at: c.closes_at, apply_url: c.apply_url } : null,
          questions: byProgram.get(p.id) ?? [],
        }
      }),
    }
  } catch {
    return { programs: [], unavailable: true }
  }
}
