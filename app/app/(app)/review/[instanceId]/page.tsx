import { createClient } from '@/lib/supabase/server'
import type { Program, ProgramQuestionWithArchived } from '@/lib/database.types'
import { ReviewWorkspace, type PublicReviewCatalog } from '@/components/review/ReviewWorkspace'

// M09 W5 — evidence-based review board for one private application
// instance. The instance itself (and every answer) lives only in the
// browser vault; this server component reads PUBLIC catalog data only
// (program name + question wording/limits) for catalog-backed instances,
// selected by the `program` query param the workspace link supplies. The
// client verifies it matches the instance's program_id before using it.

interface Props {
  params: Promise<{ instanceId: string }>
  searchParams: Promise<{ program?: string }>
}

export const metadata = { title: 'Review answers' }

export default async function ReviewPage({ params, searchParams }: Props) {
  const { instanceId } = await params
  const { program: programId } = await searchParams

  let catalog: PublicReviewCatalog | null = null
  if (programId && /^[0-9a-f-]{8,64}$/i.test(programId)) {
    const supabase = await createClient()
    const { data: program } = await supabase
      .from('programs')
      .select('id, name, organization, deadline_at')
      .eq('id', programId)
      .maybeSingle<Pick<Program, 'id' | 'name' | 'organization' | 'deadline_at'>>()
    if (program) {
      const { data: rows } = await supabase
        .from('program_questions')
        .select('*, archived_question:archived_questions(*)')
        .eq('program_id', program.id)
        .order('order_index', { ascending: true })
        .returns<ProgramQuestionWithArchived[]>()
      const questions = rows ?? []
      catalog = {
        program_id: program.id,
        program_name: program.name,
        org_name: program.organization || null,
        deadline: program.deadline_at,
        // Workspace convention (session.ts scopeForQuestion): the occurrence
        // id is the archived_question_id.
        questions: questions.map((q) => ({
          question_occurrence_id: q.archived_question_id,
          text: q.asked_as ?? q.archived_question?.text ?? '',
          canonical_question_id: q.archived_question_id,
          word_limit: q.word_limit,
          char_limit: q.char_limit,
          required: Boolean(q.is_required),
          section_id: q.section ?? null,
        })),
        canonical_texts: Object.fromEntries(
          questions.filter((q) => q.archived_question?.text).map((q) => [q.archived_question_id, q.archived_question!.text]),
        ),
      }
    }
  }

  return <ReviewWorkspace instanceId={decodeURIComponent(instanceId)} catalog={catalog} />
}
