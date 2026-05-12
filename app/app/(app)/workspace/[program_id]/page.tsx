import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type {
  Program,
  ProgramQuestionWithArchived,
  ProfileAnswer,
  UserApplication,
  UserProgramFit,
} from '@/lib/database.types'
import { AnswerEditor } from '@/components/AnswerEditor'
import { ThemeTag } from '@/components/ThemeTag'
import { ApplicationStatusTracker } from '@/components/ApplicationStatusTracker'
import { OutcomeTracker } from '@/components/OutcomeTracker'
import { ScoreTooltip } from '@/components/ScoreTooltip'
import { SignificanceStars } from '@/components/SignificanceStars'
import { QuestionTree } from '@/components/QuestionTree'
import { CompiledOutput } from '@/components/CompiledOutput'
import { formatDeadline, formatProgramStartDate, cn } from '@/lib/utils'

interface Props {
  params: Promise<{ program_id: string }>
  searchParams: Promise<{ q?: string; tab?: string }>
}

export async function generateMetadata({ params }: Props) {
  const { program_id } = await params
  const supabase = await createClient()
  const { data: program } = await supabase
    .from('programs')
    .select('name')
    .eq('id', program_id)
    .single<Pick<Program, 'name'>>()

  return {
    title: program ? program.name : 'Application',
  }
}

export default async function WorkspaceDetailPage({ params, searchParams }: Props) {
  const { program_id } = await params
  const { q: selectedQuestionId = null, tab = 'editor' } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: program } = await supabase
    .from('programs')
    .select('*')
    .eq('id', program_id)
    .single<Program>()

  if (!program) notFound()

  const { data: questionRows } = await supabase
    .from('program_questions')
    .select('*, archived_question:archived_questions(*)')
    .eq('program_id', program.id)
    .order('order_index', { ascending: true })
    .returns<ProgramQuestionWithArchived[]>()

  const questions = questionRows ?? []
  const archivedIds = questions.map((q) => q.archived_question_id).filter(Boolean)

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

  const { data: fit } = await supabase
    .from('user_program_fit')
    .select('*')
    .eq('user_id', user.id)
    .eq('program_id', program.id)
    .single<UserProgramFit>()

  const { data: userApplication } = await supabase
    .from('user_applications')
    .select('*')
    .eq('user_id', user.id)
    .eq('program_id', program.id)
    .maybeSingle<UserApplication>()

  const answeredCount = questions.filter((q) => answerMap[q.archived_question_id]).length
  const requiredCount = questions.filter((q) => q.is_required).length
  const answeredRequired = questions.filter(
    (q) => q.is_required && answerMap[q.archived_question_id]
  ).length
  const progressPct = requiredCount > 0 ? Math.round((answeredRequired / requiredCount) * 100) : 0
  const deadline = formatDeadline(program.deadline_at)
  const cohortStart = formatProgramStartDate(program.program_start_date)

  // Resolve which question to show in the right panel.
  // Default = first unanswered required question, then first question, then null.
  const resolvedSelectedId =
    selectedQuestionId ||
    questions.find((q) => q.is_required && !answerMap[q.archived_question_id])?.archived_question_id ||
    questions[0]?.archived_question_id ||
    null

  const selectedQuestion = resolvedSelectedId
    ? questions.find((q) => q.archived_question_id === resolvedSelectedId) ?? null
    : null
  const selectedAnswer = selectedQuestion ? answerMap[selectedQuestion.archived_question_id] : null

  function tabHref(targetTab: string) {
    const sp = new URLSearchParams()
    if (resolvedSelectedId) sp.set('q', resolvedSelectedId)
    sp.set('tab', targetTab)
    return `/workspace/${program_id}?${sp.toString()}`
  }

  return (
    <div className="-mx-4 md:-mx-6 -my-4 md:-my-8 h-[calc(100vh-3.5rem)] md:h-screen flex flex-col">
      {/* Slim header bar */}
      <div className="flex-shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 md:px-6 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <Link
              href="/applications"
              className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 mb-1 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Applications
            </Link>
            <h1 className="text-base font-semibold text-neutral-900 dark:text-white truncate">{program.name}</h1>
            <div className="mt-1 flex items-center gap-3 flex-wrap text-xs text-neutral-500 dark:text-neutral-400">
              <span className={cn(deadline.urgent && 'text-warning-600 dark:text-warning-400 font-medium')}>
                {deadline.label}
              </span>
              {program.cohort_name && <span>· {program.cohort_name}</span>}
              {cohortStart && <span>· Starts {cohortStart}</span>}
              {fit && (
                <span className="inline-flex items-center">
                  · {Math.round(fit.fit_score)}% fit
                  <ScoreTooltip
                    label="Fit Score"
                    description="How well your profile aligns to this program's DNA across coverage, theme alignment, criteria match, and answer quality."
                    scoreId="fit"
                  />
                </span>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center gap-3">
            <div className="hidden md:block min-w-[160px]">
              <div className="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-500 mb-1">
                <span>Readiness</span>
                <span className="tabular-nums">
                  {answeredRequired}/{requiredCount} required
                </span>
              </div>
              <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
                <div
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    progressPct >= 80 ? 'bg-success-500' : progressPct >= 50 ? 'bg-brand-500' : 'bg-warning-500'
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
            <ApplicationStatusTracker
              programId={program.id}
              initialStatus={userApplication?.status ?? null}
              programName={program.name}
            />
          </div>
        </div>
      </div>

      {/* Split-screen body */}
      {questions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
          No questions in this application yet.
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* Left: Question tree */}
          <aside className="md:w-80 md:flex-shrink-0 md:border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 md:h-full md:overflow-hidden">
            <QuestionTree
              programId={program.id}
              questions={questions}
              answerMap={answerMap}
              selectedQuestionId={resolvedSelectedId}
              currentTab={tab !== 'editor' ? tab : undefined}
            />
          </aside>

          {/* Right: Editor + Compiled tabs */}
          <section className="flex-1 flex flex-col min-h-0 min-w-0">
            {selectedQuestion ? (
              <>
                {/* Tab bar */}
                <div className="flex-shrink-0 border-b border-neutral-200 dark:border-neutral-800 px-5 pt-3 flex items-center gap-1">
                  <Link
                    href={tabHref('editor')}
                    className={cn(
                      'px-3 py-2 text-xs font-medium rounded-t-md border-b-2 transition-colors',
                      tab !== 'compiled'
                        ? 'border-brand-500 text-brand-700 dark:text-brand-300'
                        : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                    )}
                  >
                    Editor
                  </Link>
                  <Link
                    href={tabHref('compiled')}
                    className={cn(
                      'px-3 py-2 text-xs font-medium rounded-t-md border-b-2 transition-colors',
                      tab === 'compiled'
                        ? 'border-brand-500 text-brand-700 dark:text-brand-300'
                        : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                    )}
                  >
                    Compiled output
                  </Link>
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {tab === 'compiled' ? (
                    <CompiledOutput
                      question={selectedQuestion.asked_as}
                      answer={selectedAnswer?.answer_content ?? ''}
                      wordLimit={selectedQuestion.word_limit}
                      charLimit={selectedQuestion.char_limit}
                    />
                  ) : (
                    <div className="px-6 py-5">
                      <div className="max-w-2xl">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <ThemeTag theme={selectedQuestion.archived_question?.theme} />
                          {(selectedQuestion.archived_question?.significance_score ?? 0) > 0 && (
                            <SignificanceStars
                              score={selectedQuestion.archived_question?.significance_score ?? 0}
                              size="xs"
                            />
                          )}
                          {!selectedQuestion.is_required && (
                            <span className="text-[10px] text-neutral-400 dark:text-neutral-600 italic">
                              Optional
                            </span>
                          )}
                          {selectedQuestion.section && (
                            <span className="text-[10px] text-neutral-400 dark:text-neutral-600 uppercase tracking-wider">
                              {selectedQuestion.section}
                            </span>
                          )}
                        </div>
                        <h2 className="text-sm font-medium text-neutral-900 dark:text-white leading-relaxed mb-1">
                          {selectedQuestion.asked_as}
                        </h2>
                        {(selectedQuestion.word_limit || selectedQuestion.char_limit) && (
                          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mb-4">
                            {selectedQuestion.word_limit ? `${selectedQuestion.word_limit} word limit` : ''}
                            {selectedQuestion.word_limit && selectedQuestion.char_limit ? ' · ' : ''}
                            {selectedQuestion.char_limit ? `${selectedQuestion.char_limit} character limit` : ''}
                          </p>
                        )}
                        <AnswerEditor
                          archivedQuestionId={selectedQuestion.archived_question_id}
                          programId={program.id}
                          wordLimit={selectedQuestion.word_limit ?? undefined}
                          charLimit={selectedQuestion.char_limit ?? undefined}
                          initialAnswer={selectedAnswer ?? null}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
                Select a question from the left to begin.
              </div>
            )}
          </section>
        </div>
      )}

      {/* Outcome — surfaces only when application has been submitted */}
      {userApplication && (
        <div className="flex-shrink-0 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 md:px-6 py-3">
          <OutcomeTracker
            applicationId={userApplication.id}
            currentStatus={userApplication.status}
            programName={program.name}
          />
        </div>
      )}
    </div>
  )
}
