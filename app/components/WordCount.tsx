'use client'

import { cn } from '@/lib/utils'

interface WordCountProps {
  current: number
  limit?: number
  charCurrent?: number
  charLimit?: number
  className?: string
}

export function WordCount({ current, limit, charCurrent, charLimit, className }: WordCountProps) {
  const wordState = limit
    ? current > limit
      ? 'over'
      : current > limit * 0.9
      ? 'warning'
      : 'ok'
    : 'ok'

  const charState = charLimit && charCurrent != null
    ? charCurrent > charLimit
      ? 'over'
      : charCurrent > charLimit * 0.9
      ? 'warning'
      : 'ok'
    : 'ok'

  const overallState =
    wordState === 'over' || charState === 'over'
      ? 'over'
      : wordState === 'warning' || charState === 'warning'
      ? 'warning'
      : 'ok'

  const colorClass = {
    ok: 'text-neutral-400 dark:text-neutral-500',
    warning: 'text-warning-600 dark:text-warning-500',
    over: 'text-danger-600 dark:text-danger-500',
  }[overallState]

  return (
    <div className={cn('flex items-center gap-3 text-xs', colorClass, className)}>
      {/* Word count */}
      <span>
        <span className={cn('font-medium tabular-nums', wordState !== 'ok' && colorClass)}>
          {current}
        </span>
        {limit ? (
          <span className="text-neutral-400 dark:text-neutral-600"> / {limit} words</span>
        ) : (
          <span className="text-neutral-400 dark:text-neutral-600"> words</span>
        )}
      </span>

      {/* Char count */}
      {charCurrent != null && charLimit && (
        <>
          <span className="text-neutral-300 dark:text-neutral-700">·</span>
          <span>
            <span className={cn('font-medium tabular-nums', charState !== 'ok' && colorClass)}>
              {charCurrent}
            </span>
            <span className="text-neutral-400 dark:text-neutral-600"> / {charLimit} chars</span>
          </span>
        </>
      )}

      {/* Visual bar */}
      {limit && (
        <div className="flex-1 max-w-16 bg-neutral-200 dark:bg-neutral-700 rounded-full h-1">
          <div
            className={cn(
              'h-1 rounded-full transition-all',
              overallState === 'over'
                ? 'bg-danger-500'
                : overallState === 'warning'
                ? 'bg-warning-500'
                : 'bg-success-500'
            )}
            style={{ width: `${Math.min(100, (current / limit) * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}
