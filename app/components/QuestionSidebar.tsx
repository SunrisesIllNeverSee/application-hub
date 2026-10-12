import Link from 'next/link'
import { ThemeTag } from '@/components/ThemeTag'
import { SignificanceStars } from '@/components/SignificanceStars'
import type { ProfileAnswer } from '@/lib/database.types'
import { cn } from '@/lib/utils'

export interface UnlockedQuestion {
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

// Theme display order — high signal first
const THEME_ORDER = [
  'team', 'traction', 'problem', 'solution',
  'market', 'vision', 'technical', 'business_model',
  'fundraising', 'impact', 'personal', 'fit',
]

export function QuestionSidebar({
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

