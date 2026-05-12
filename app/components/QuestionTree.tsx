import Link from 'next/link'
import type { ProgramQuestionWithArchived, ProfileAnswer } from '@/lib/database.types'
import { SignificanceStars } from '@/components/SignificanceStars'
import { ThemeTag } from '@/components/ThemeTag'
import { cn } from '@/lib/utils'

interface QuestionTreeProps {
  programId: string
  questions: ProgramQuestionWithArchived[]
  answerMap: Record<string, ProfileAnswer>
  selectedQuestionId: string | null
  currentTab?: string
}

/**
 * Left panel of the split-screen workspace.
 * Server component — selection state lives in the URL (?q=archivedQuestionId).
 * Groups questions by section, shows theme tag + significance + answered indicator.
 */
export function QuestionTree({
  programId,
  questions,
  answerMap,
  selectedQuestionId,
  currentTab,
}: QuestionTreeProps) {
  const sections = questions.reduce<Record<string, ProgramQuestionWithArchived[]>>((acc, q) => {
    const section = q.section ?? 'General'
    if (!acc[section]) acc[section] = []
    acc[section].push(q)
    return acc
  }, {})

  const sectionEntries = Object.entries(sections)
  const answeredTotal = questions.filter((q) => answerMap[q.archived_question_id]).length

  function buildHref(archivedQuestionId: string) {
    const params = new URLSearchParams()
    params.set('q', archivedQuestionId)
    if (currentTab) params.set('tab', currentTab)
    return `/workspace/${programId}?${params.toString()}`
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
        <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
          Questions
        </p>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
          {answeredTotal} of {questions.length} answered
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        {sectionEntries.length === 0 ? (
          <p className="px-3 py-4 text-xs text-neutral-500 dark:text-neutral-500">
            No questions yet.
          </p>
        ) : (
          sectionEntries.map(([section, qs]) => (
            <div key={section} className="mb-3">
              <div className="px-3 py-1.5 flex items-center justify-between">
                <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-500 uppercase tracking-wider">
                  {section}
                </p>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-600 tabular-nums">
                  {qs.filter((q) => answerMap[q.archived_question_id]).length}/{qs.length}
                </span>
              </div>
              <div className="space-y-0.5">
                {qs.map((q) => {
                  const answered = !!answerMap[q.archived_question_id]
                  const active = q.archived_question_id === selectedQuestionId
                  const sig = q.archived_question?.significance_score ?? 0
                  return (
                    <Link
                      key={q.id}
                      href={buildHref(q.archived_question_id)}
                      className={cn(
                        'block px-3 py-2 rounded-md transition-colors group border-l-2 pl-[10px]',
                        active
                          ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-500'
                          : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/60 border-transparent'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            'mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0',
                            answered ? 'bg-success-500' : 'bg-neutral-300 dark:bg-neutral-700'
                          )}
                          aria-label={answered ? 'Answered' : 'Unanswered'}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              'text-xs leading-snug line-clamp-2',
                              active
                                ? 'text-neutral-900 dark:text-white font-medium'
                                : 'text-neutral-700 dark:text-neutral-300'
                            )}
                          >
                            {q.asked_as}
                          </p>
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <ThemeTag theme={q.archived_question?.theme} />
                            {sig > 0 && <SignificanceStars score={sig} size="xs" />}
                            {!q.is_required && (
                              <span className="text-[9px] text-neutral-400 dark:text-neutral-600 italic">
                                Optional
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
