import { createClient } from '@/lib/supabase/server'
import { ThemeTag } from '@/components/ThemeTag'
import { AnswerEditor } from '@/components/AnswerEditor'
import type { ProfileAnswer } from '@/lib/database.types'
import { SignificanceStars } from '@/components/SignificanceStars'
import { QuestionsArchiveView } from '@/components/QuestionsArchiveView'
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
  searchParams: Promise<{ view?: string; theme?: string; sort?: string }>
}

export default async function QuestionsPage({ searchParams }: PageProps) {
  const { view: rawView, theme: rawTheme, sort: rawSort } = await searchParams
  const view: View = rawView === 'archive' ? 'archive' : 'bank'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

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
              view === 'bank'
                ? 'border-brand-600 dark:border-brand-400 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            )}
          >
            My Questions
          </Link>
          <Link
            href="/questions?view=archive"
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              view === 'archive'
                ? 'border-brand-600 dark:border-brand-400 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            )}
          >
            Full Archive
          </Link>
        </div>
      </div>

      {view === 'archive' ? (
        <QuestionsArchiveView theme={rawTheme ?? ''} sort={rawSort ?? 'significance'} />
      ) : (
        <BankView userId={user.id} />
      )}
    </div>
  )
}

async function BankView({ userId }: { userId: string }) {
  const supabase = await createClient()

  // Run daily drip (server-side, idempotent)
  await supabase.rpc('run_daily_drip', { p_user_id: userId })

  // Fetch unlocked questions with archived question data
  const { data: unlockedRows } = await supabase
    .from('user_question_unlocks')
    .select('*, archived_question:archived_questions(*)')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false })

  const unlocked: UnlockedQuestion[] = (unlockedRows ?? []) as UnlockedQuestion[]
  const unlockedIds = new Set(unlocked.map(u => u.archived_question_id))

  // Fetch user's existing answers
  const { data: answerRows } = await supabase
    .from('profile_answers')
    .select('*')
    .eq('user_id', userId)

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

  const locked: LockedQuestion[] = (lockedRows ?? []) as LockedQuestion[]

  // Check subscription tier
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('tier')
    .eq('user_id', userId)
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

  return (
    <div>
      {/* Status row */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2">
            <span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">{answeredCount}</span>
              {' '}answered · {' '}
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">{unlocked.length}</span>
              {' '}unlocked
            </span>
            {isPro ? (
              <span className="text-brand-600 dark:text-brand-400 font-medium">{totalQuestions} questions — Pro</span>
            ) : (
              <span>{unlocked.length}/{FREE_CAP} free · +3 tomorrow</span>
            )}
          </div>
          <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-brand-500 transition-all"
              style={{ width: `${Math.min(100, (answeredCount / Math.max(1, unlocked.length)) * 100)}%` }}
            />
          </div>
        </div>
        {newToday > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            {newToday} new today
          </span>
        )}
      </div>

      {/* Empty state */}
      {unlocked.length === 0 && (
        <div className="card p-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-neutral-400">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-2">Loading your questions…</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Refresh the page to see your unlocked questions.</p>
        </div>
      )}

      {/* Unlocked questions by theme */}
      {unlocked.length > 0 && (
        <div className="space-y-8 mb-12">
          {THEME_ORDER.map(theme => {
            const qs = byTheme[theme]
            if (!qs || qs.length === 0) return null
            return (
              <section key={theme}>
                <div className="flex items-center gap-3 mb-4">
                  <ThemeTag theme={theme as never} size="lg" />
                  <span className="text-xs text-neutral-400 dark:text-neutral-500">
                    {qs.filter(q => answerMap[q.archived_question_id]).length}/{qs.length} answered
                  </span>
                </div>
                <div className="space-y-4">
                  {qs.map(u => {
                    const q = u.archived_question
                    const existingAnswer = answerMap[q.id]
                    const isNew = Date.now() - new Date(u.unlocked_at).getTime() < 24 * 60 * 60 * 1000
                    return (
                      <div key={u.id} className="card overflow-hidden">
                        <div className="px-5 py-3 bg-neutral-50 dark:bg-neutral-800/40 border-b border-neutral-100 dark:border-neutral-800">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed flex-1">
                              {q.text}
                            </p>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isNew && (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
                                  New
                                </span>
                              )}
                              <SignificanceStars score={q.significance_score} size="xs" />
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {q.typical_word_limit && (
                              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                                {q.typical_word_limit} words
                              </span>
                            )}
                            {q.asked_by_count > 0 && (
                              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                                Asked by {q.asked_by_count} programs
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="p-5">
                          <AnswerEditor
                            archivedQuestionId={q.id}
                            initialAnswer={existingAnswer ?? null}
                            compact
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* Locked previews */}
      {!isPro && locked.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Coming up
            </h2>
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              {totalQuestions - unlocked.length} more questions · unlocks 3/day or upgrade to Pro
            </span>
          </div>
          <div className="space-y-2">
            {locked.slice(0, 8).map(q => (
              <div
                key={q.id}
                className="card px-5 py-3 flex items-center gap-3 opacity-50"
              >
                <ThemeTag theme={q.theme as never} />
                <p className="text-sm text-neutral-600 dark:text-neutral-400 flex-1 line-clamp-1 blur-sm select-none">
                  {q.text}
                </p>
                <span className="text-xs text-neutral-400 dark:text-neutral-500 flex-shrink-0">
                  Unlocks tomorrow
                </span>
              </div>
            ))}
          </div>

          {/* Pro upsell */}
          <div className="mt-6 card p-5 border border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Unlock all {totalQuestions} questions now
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Pro unlocks your full arsenal immediately. No waiting.
                </p>
              </div>
              <Link
                href="/profile/settings"
                className="btn-primary w-full sm:w-auto flex-shrink-0"
              >
                Upgrade to Pro →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
