import Link from 'next/link'
import type { ProfileAnswerWithQuestion } from '@/lib/database.types'
import { themeLabel } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface AnswerFileTreeProps {
  answersByTheme: Record<string, ProfileAnswerWithQuestion[]>
  selectedAnswerId: string | null
}

/**
 * VS Code-style left panel. Themes act as folders; each answer is a
 * "captured moment" file with confidence badge + last-updated.
 *
 * Selection state lives in the URL (?id=<answer_id>) so deep links and
 * back/forward navigation work without any client state.
 */
export function AnswerFileTree({ answersByTheme, selectedAnswerId }: AnswerFileTreeProps) {
  const themes = Object.keys(answersByTheme).filter((t) => answersByTheme[t].length > 0)

  const totalAnswers = Object.values(answersByTheme).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
        <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
          Captured moments
        </p>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
          {totalAnswers} {totalAnswers === 1 ? 'answer' : 'answers'} across {themes.length} {themes.length === 1 ? 'theme' : 'themes'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0 text-sm">
        {themes.length === 0 ? (
          <p className="px-3 py-4 text-xs text-neutral-500 dark:text-neutral-500">
            No answers yet. Browse the question bank to start capturing.
          </p>
        ) : (
          themes.map((theme) => (
            <details key={theme} open className="group/folder">
              <summary className="px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/40 rounded-md list-none">
                <span className="text-neutral-400 dark:text-neutral-600 group-open/folder:rotate-90 transition-transform inline-block">
                  ▸
                </span>
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex-1">
                  {themeLabel(theme)}
                </span>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-600 tabular-nums">
                  {answersByTheme[theme].length}
                </span>
              </summary>
              <div className="space-y-px ml-3">
                {answersByTheme[theme].map((a) => (
                  <AnswerFileNode key={a.id} answer={a} active={a.id === selectedAnswerId} />
                ))}
              </div>
            </details>
          ))
        )}
      </div>
    </div>
  )
}

function AnswerFileNode({
  answer,
  active,
}: {
  answer: ProfileAnswerWithQuestion
  active: boolean
}) {
  const text = answer.archived_question?.text ?? 'Question not found'
  const preview = text.length > 60 ? text.slice(0, 60) + '…' : text
  const confidence = answer.confidence ?? 'draft'
  const dot =
    confidence === 'locked'
      ? 'bg-brand-500'
      : confidence === 'solid'
      ? 'bg-success-500'
      : 'bg-neutral-400 dark:bg-neutral-600'

  const updated = answer.last_updated
    ? new Date(answer.last_updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : ''

  return (
    <Link
      href={`/answers?id=${answer.id}`}
      className={cn(
        'block px-3 py-1.5 rounded-md border-l-2 pl-[10px] transition-colors',
        active
          ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-500'
          : 'border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800/40'
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dot)} />
        <p
          className={cn(
            'text-xs flex-1 leading-snug line-clamp-2',
            active ? 'text-neutral-900 dark:text-white font-medium' : 'text-neutral-600 dark:text-neutral-400'
          )}
        >
          {preview}
        </p>
      </div>
      {updated && (
        <p className="text-[10px] text-neutral-400 dark:text-neutral-600 mt-0.5 ml-3 tabular-nums">
          {updated} · {answer.word_count ?? 0}w
        </p>
      )}
    </Link>
  )
}
