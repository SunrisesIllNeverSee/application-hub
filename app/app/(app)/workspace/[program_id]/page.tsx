import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type {
  Program,
  ProgramQuestionWithArchived,
  ProfileAnswer,
  UserProgramFit,
} from '@/lib/database.types'
import { AnswerEditor } from '@/components/AnswerEditor'
import { ThemeTag } from '@/components/ThemeTag'
import { formatDeadline } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props {
  params: { program_id: string }
}

export async function generateMetadata({ params }: Props) {
  const supabase = createClient()
  const { data: program } = await supabase
    .from('programs')
    .select('name')
    .eq('id', params.program_id)
    .single<Pick<Program, 'name'>>()

  return {
    title: program ? `${program.name} — Workspace` : 'Workspace',
  }
}

export default async function WorkspaceDetailPage({ params }: Props) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: program } = await supabase
    .from('programs')
    .select('*')
    .eq('id', params.program_id)
    .single<Program>()

  if (!program) notFound()

  // Questions with archived data
  const { data: questionRows } = await supabase
    .from('program_questions')
    .select('*, archived_question:archived_questions(*)')
    .eq('program_id', program.id)
    .order('display_order', { ascending: true })
    .returns<ProgramQuestionWithArchived[]>()

  // Profile answers for this user
  const archivedIds = (questionRows ?? []).map((q) => q.archived_question_id).filter(Boolean)
  let answerMap: Record<string, ProfileAnswer> = {}
  if (archivedIds.length > 0) {
    const { data: answers } = await supabase
      .from('profile_answers')
      .select('*')
      .eq('user_id', user.id)
      .in('archived_question_id', archivedIds)
      .returns<ProfileAnswer[]>()
    answerMap = Object.fromEntries((answers ?? []).map((a) => [a.archived_question_id, a]))
  }

  // Fit score
  const { data: fit } = await supabase
    .from('user_program_fit')
    .select('*')
    .eq('user_id', user.id)
    .eq('program_id', program.id)
    .single<UserProgramFit>()

  const questions = questionRows ?? []
  const answeredCount = questions.filter((q) => answerMap[q.archived_question_id]).length
  const requiredCount = questions.filter((q) => q.is_required).length
  const answeredRequired = questions.filter(
    (q) => q.is_required && answerMap[q.archived_question_id]
  ).length
  const progressPct = requiredCount > 0 ? Math.round((answeredRequired / requiredCount) * 100) : 0
  const deadline = formatDeadline(program.deadline_at)

  // Group by section
  const sections = questions.reduce<Record<string, ProgramQuestionWithArchived[]>>((acc, q) => {
    const section = q.section_name ?? 'General'
    if (!acc[section]) acc[section] = []
    acc[section].push(q)
    return acc
  }, {})

  return (
    <div className="max-w-4xl">
      {/* Back */}
      <Link
        href="/workspace"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 mb-6 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M19 12H5M12 5l-7 7 7 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        My Applications
      </Link>

      {/* Header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-white">{program.name}</h1>
            {program.description && (
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2">
                {program.description}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 text-right">
            <p
              className={cn(
                'text-sm font-medium',
                deadline.urgent
                  ? 'text-warning-600 dark:text-warning-500'
                  : 'text-neutral-600 dark:text-neutral-400'
              )}
            >
              {deadline.label}
            </p>
            {fit && (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                {Math.round(fit.fit_score * 100)}% fit
              </p>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="mt-5 pt-5 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2">
            <span>Application readiness</span>
            <span>
              {answeredRequired}/{requiredCount} required · {answeredCount}/{questions.length} total
            </span>
          </div>
          <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all',
                progressPct >= 80 ? 'bg-success-500' : progressPct >= 50 ? 'bg-brand-500' : 'bg-warning-500'
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {progressPct === 100 && (
            <p className="mt-2 text-xs text-success-600 dark:text-success-400 font-medium">
              All required questions answered. Ready to submit.
            </p>
          )}
        </div>
      </div>

      {/* Questions */}
      {questions.length === 0 ? (
        <div className="card p-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          No questions found for this program yet.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(sections).map(([section, qs]) => (
            <div key={section} className="card overflow-hidden">
              <div className="px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                <h2 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  {section}
                </h2>
                <span className="text-xs text-neutral-400 dark:text-neutral-500">
                  {qs.filter((q) => answerMap[q.archived_question_id]).length}/{qs.length} answered
                </span>
              </div>
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {qs.map((q) => {
                  const existing = answerMap[q.archived_question_id]
                  const sig = q.archived_question?.significance_score ?? 0

                  return (
                    <div key={q.id} className="p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <ThemeTag theme={q.archived_question?.theme} />
                            {!q.is_required && (
                              <span className="text-xs text-neutral-400 dark:text-neutral-500 italic">
                                Optional
                              </span>
                            )}
                            {sig > 70 && (
                              <span className="text-xs font-medium text-brand-600 dark:text-brand-400">
                                High significance
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 leading-relaxed">
                            {q.exact_phrasing}
                          </p>
                          {(q.word_limit || q.char_limit) && (
                            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                              {q.word_limit ? `${q.word_limit} word limit` : ''}
                              {q.word_limit && q.char_limit ? ' · ' : ''}
                              {q.char_limit ? `${q.char_limit} character limit` : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      <AnswerEditor
                        archivedQuestionId={q.archived_question_id}
                        programId={program.id}
                        wordLimit={q.word_limit ?? undefined}
                        charLimit={q.char_limit ?? undefined}
                        initialAnswer={existing ?? null}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
