import { createClient } from '@/lib/supabase/server'
import { ThemeTag } from '@/components/ThemeTag'
import { AnswerEditor } from '@/components/AnswerEditor'
import { SignificanceStars } from '@/components/SignificanceStars'
import { QuestionsArchiveView } from '@/components/QuestionsArchiveView'
import type { ProfileAnswer } from '@/lib/database.types'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Questions' }

// Theme display order — high signal first
const THEME_ORDER = [
  'team', 'traction', 'problem', 'solution',
  'market', 'vision', 'technical', 'business_model',
  'fundraising', 'impact', 'personal', 'fit',
]

interface UnlockedQuestion {
  id: string
  archived_question_id: string
  unlocked_at: string
  source: string
  archived_question: {
    id: string
    text: string
    theme: string
    significance_score: number
    typical_word_limit: number | null
    asked_by_count: number
  }
}

interface LockedQuestion {
  id: string
  text: string
  theme: string
  significance_score: number
}

type View = 'bank' | 'archive'

interface PageProps {
  searchParams: Promise<{ view?: string; theme?: string; sort?: string; q?: string }>
}

export default async function QuestionsPage({ searchParams }: PageProps) {
  const { view: rawView, theme: rawTheme, sort: rawSort, q: selectedQ } = await searchParams
  const view: View = rawView === 'archive' ? 'archive' : 'bank'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  if (view === 'archive') {
    return (
      <div>
        {/* Tab header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
                Questions
              </h1>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Your ammunition. Answer once, apply everywhere.
              </p>
            </div>
          </div>

          {/* View tabs */}
          <div className="mt-5 flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
            <Link
              href="/questions"
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
              )}
            >
              My Questions
            </Link>
            <Link
              href="/questions?view=archive"
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                'border-brand-600 dark:border-brand-400 text-brand-600 dark:text-brand-400'
              )}
            >
              Full Archive
            </Link>
          </div>
        </div>
        <QuestionsArchiveView theme={rawTheme ?? ''} sort={rawSort ?? 'significance'} />
      </div>
    )
  }

  // Bank view (Prism layout)

  // Run daily drip (server-side, idempotent)
  await supabase.rpc('run_daily_drip', { p_user_id: user.id })

  // Fetch unlocked questions with archived question data
  const { data: unlockedRows } = await supabase
    .from('user_question_unlocks')
    .select('*, archived_question:archived_questions(*)')
    .eq('user_id', user.id)
    .order('unlocked_at', { ascending: false })

  const unlocked: UnlockedQuestion[] = (unlockedRows ?? []) as UnlockedQuestion[]
  const unlockedIds = new Set(unlocked.map(u => u.archived_question_id))

  // Fetch user's existing answers
  const { data: answerRows } = await supabase
    .from('profile_answers')
    .select('*')
    .eq('user_id', user.id)

  const answerMap: Record<string, ProfileAnswer> = Object.fromEntries(
    (answerRows ?? []).map(a => [a.archived_question_id, a])
  )

  // Fetch a sample of locked questions for preview
  const { data: lockedRows } = await supabase
    .from('archived_questions')
    .select('id, text, theme, significance_score')
    .not('id', 'in', `(${Array.from(unlockedIds).join(',') || '00000000-0000-0000-0000-000000000000'})`)
    .order('significance_score', { ascending: false })
    .limit(20)

  const _locked: LockedQuestion[] = (lockedRows ?? []) as LockedQuestion[]

  // Check subscription tier
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('tier')
    .eq('user_id', user.id)
    .single()

  const isPro = subscription?.tier === 'pro' || subscription?.tier === 'team'
  const FREE_CAP = 30
  const totalQuestions = 225

  // Group unlocked by theme
  const byTheme: Record<string, UnlockedQuestion[]> = {}
  for (const u of unlocked) {
    const theme = u.archived_question?.theme ?? 'other'
    if (!byTheme[theme]) byTheme[theme] = []
    byTheme[theme].push(u)
  }

  // Sort within each theme by significance
  for (const theme of Object.keys(byTheme)) {
    byTheme[theme].sort((a, b) =>
      (b.archived_question?.significance_score ?? 0) - (a.archived_question?.significance_score ?? 0)
    )
  }

  const answeredCount = unlocked.filter(u => answerMap[u.archived_question_id]).length
  const newToday = unlocked.filter(u => {
    const age = Date.now() - new Date(u.unlocked_at).getTime()
    return age < 24 * 60 * 60 * 1000
  }).length

  // Determine selected question:
  // default to first unanswered, or first overall
  const firstUnanswered = unlocked.find(u => !answerMap[u.archived_question_id])
  const defaultQ = firstUnanswered?.archived_question_id ?? unlocked[0]?.archived_question_id ?? null
  const resolvedQ = selectedQ ?? defaultQ

  const selectedUnlock = resolvedQ
    ? unlocked.find(u => u.archived_question_id === resolvedQ) ?? null
    : null

  return (
    <div className="-mx-4 md:-mx-6 -my-4 md:-my-8 h-[calc(100vh-3.5rem)] md:h-screen flex flex-col">
      {/* Slim header */}
      <div className="flex-shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-base font-semibold text-neutral-900 dark:text-white">Questions</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Your ammunition. Answer once, apply everywhere.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/questions"
              className="px-3 py-1 text-xs font-medium rounded-md bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400"
            >
              My Questions
            </Link>
            <Link
              href="/questions?view=archive"
              className="px-3 py-1 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              Full Archive
            </Link>
          </div>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Left: scrollable question list grouped by theme */}
        <aside className="md:w-72 md:flex-shrink-0 md:border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 md:h-full md:overflow-y-auto">
          <QuestionSidebar
            unlocked={unlocked}
            byTheme={byTheme}
            answerMap={answerMap}
            answeredCount={answeredCount}
            newToday={newToday}
            isPro={isPro}
            totalQuestions={totalQuestions}
            FREE_CAP={FREE_CAP}
            selectedQ={resolvedQ}
          />
        </aside>

        {/* Right: question workspace */}
        <section className="flex-1 flex flex-col min-h-0 min-w-0">
          {selectedUnlock ? (
            <QuestionWorkspace
              unlock={selectedUnlock}
              existingAnswer={answerMap[selectedUnlock.archived_question_id] ?? null}
            />
          ) : unlocked.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div>
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-neutral-400">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-2">Loading your questions...</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Refresh the page to see your unlocked questions.</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
              Select a question from the list to answer it.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function QuestionSidebar({
  unlocked,
  byTheme,
  answerMap,
  answeredCount,
  newToday,
  isPro,
  totalQuestions,
  FREE_CAP,
  selectedQ,
}: {
  unlocked: UnlockedQuestion[]
  byTheme: Record<string, UnlockedQuestion[]>
  answerMap: Record<string, ProfileAnswer>
  answeredCount: number
  newToday: number
  isPro: boolean
  totalQuestions: number
  FREE_CAP: number
  selectedQ: string | null
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="flex-shrink-0 px-3 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2">
          <span>
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">{answeredCount}</span>
            {' '}answered / {' '}
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">{unlocked.length}</span>
            {' '}unlocked
          </span>
          {newToday > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
              <span className="text-brand-600 dark:text-brand-400 font-medium">{newToday} new</span>
            </span>
          )}
        </div>
        <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full bg-brand-500 transition-all"
            style={{ width: `${Math.min(100, (answeredCount / Math.max(1, unlocked.length)) * 100)}%` }}
          />
        </div>
        {!isPro && (
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
            {unlocked.length}/{FREE_CAP} free &middot; +3 tomorrow &middot;{' '}
            <Link href="/profile/settings" className="text-brand-600 dark:text-brand-400 hover:underline">Pro = {totalQuestions}</Link>
          </p>
        )}
      </div>

      {/* Question list grouped by theme */}
      <div className="flex-1 overflow-y-auto">
        {THEME_ORDER.map(theme => {
          const qs = byTheme[theme]
          if (!qs || qs.length === 0) return null
          const answeredInTheme = qs.filter(q => answerMap[q.archived_question_id]).length
          return (
            <div key={theme}>
              {/* Theme group header */}
              <div className="flex items-center gap-2 px-3 py-2 sticky top-0 bg-neutral-50 dark:bg-neutral-950/40 border-b border-neutral-100 dark:border-neutral-800/60 z-10">
                <ThemeTag theme={theme as never} />
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 ml-auto">
                  {answeredInTheme}/{qs.length}
                </span>
              </div>
              {/* Question rows */}
              {qs.map(u => {
                const q = u.archived_question
                const isAnswered = !!answerMap[q.id]
                const isSelected = selectedQ === q.id
                const isNew = Date.now() - new Date(u.unlocked_at).getTime() < 24 * 60 * 60 * 1000
                return (
                  <Link
                    key={u.id}
                    href={`/questions?q=${q.id}`}
                    className={cn(
                      'flex items-start gap-2 px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-800/40 transition-colors',
                      isSelected
                        ? 'bg-brand-50 dark:bg-brand-900/20 border-l-2 border-brand-500'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/50'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed line-clamp-1">
                        {q.text}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <SignificanceStars score={q.significance_score} size="xs" />
                        {isNew && (
                          <span className="inline-flex px-1 py-px rounded text-[9px] font-medium bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
                            New
                          </span>
                        )}
                      </div>
                    </div>
                    {isAnswered && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-success-500 flex-shrink-0 mt-0.5">
                        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function QuestionWorkspace({
  unlock,
  existingAnswer,
}: {
  unlock: UnlockedQuestion
  existingAnswer: ProfileAnswer | null
}) {
  const q = unlock.archived_question
  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
      <div className="max-w-3xl">
        {/* Question header */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <ThemeTag theme={q.theme as never} />
          <SignificanceStars score={q.significance_score} size="xs" />
          {q.asked_by_count > 0 && (
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
              Asked by {q.asked_by_count} program{q.asked_by_count === 1 ? '' : 's'}
            </span>
          )}
          {q.typical_word_limit && (
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
              {q.typical_word_limit} words typical
            </span>
          )}
        </div>

        <h2 className="text-base font-medium text-neutral-900 dark:text-white leading-relaxed mb-4">
          {q.text}
        </h2>

        {/* Answer editor */}
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="p-4">
            <AnswerEditor
              archivedQuestionId={q.id}
              initialAnswer={existingAnswer}
              compact
            />
          </div>
        </div>
      </div>
    </div>
  )
}
