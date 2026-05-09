import Link from 'next/link'
import type { ProgramWithFit } from '@/lib/database.types'
import { formatCurrency, formatEquity, formatDeadline, programTypeLabel, cn } from '@/lib/utils'

interface ProgramCardProps {
  program: ProgramWithFit
  rank?: number
}

const TYPE_COLORS: Record<string, string> = {
  accelerator: 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300',
  grant: 'bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-400',
  fellowship: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  vc_fund: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  incubator: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  studio: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
}

export function ProgramCard({ program, rank }: ProgramCardProps) {
  const deadline = formatDeadline(program.deadline_at)
  const fitScore = program.fit?.fit_score
  const compositeScore = program.fit?.composite_score

  const heatWidth = Math.min(100, program.heat_score)
  const heatColor =
    program.heat_score >= 80
      ? 'bg-danger-500'
      : program.heat_score >= 60
      ? 'bg-warning-500'
      : program.heat_score >= 40
      ? 'bg-brand-500'
      : 'bg-neutral-300 dark:bg-neutral-600'

  return (
    <Link
      href={`/hub/${program.slug}`}
      className="card p-5 flex items-center gap-4 hover:shadow-card-hover transition-all duration-150 block group"
    >
      {/* Rank */}
      {rank != null && (
        <div className="flex-shrink-0 w-7 text-center">
          <span className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 tabular-nums">
            {rank}
          </span>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
              TYPE_COLORS[program.type] ?? 'bg-neutral-100 text-neutral-600'
            )}
          >
            {programTypeLabel(program.type)}
          </span>
          {program.is_rolling && (
            <span className="inline-flex items-center gap-1 text-xs text-success-600 dark:text-success-400">
              <span className="w-1.5 h-1.5 rounded-full bg-success-500" />
              Rolling
            </span>
          )}
          {program.tags?.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="hidden sm:inline-flex px-2 py-0.5 rounded-md text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
            >
              {tag}
            </span>
          ))}
        </div>

        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
          {program.name}
        </h3>

        {program.description && (
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">
            {program.description}
          </p>
        )}

        {/* Heat bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="w-24 bg-neutral-200 dark:bg-neutral-700 rounded-full h-1">
            <div
              className={cn('h-1 rounded-full', heatColor)}
              style={{ width: `${heatWidth}%` }}
            />
          </div>
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            {program.heat_score} heat
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 flex items-center gap-6 text-right">
        <div className="hidden sm:block">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">Equity</p>
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            {formatEquity(program.equity_pct)}
          </p>
        </div>
        <div className="hidden sm:block">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">Value</p>
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            {formatCurrency(program.cash_value_usd)}
          </p>
        </div>
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">Deadline</p>
          <p
            className={cn(
              'text-sm font-medium',
              deadline.urgent
                ? 'text-warning-600 dark:text-warning-500'
                : 'text-neutral-700 dark:text-neutral-300'
            )}
          >
            {deadline.label}
          </p>
        </div>
        {fitScore != null && (
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">Fit</p>
            <p
              className={cn(
                'text-sm font-semibold',
                fitScore >= 0.7
                  ? 'text-success-600 dark:text-success-400'
                  : fitScore >= 0.5
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-neutral-600 dark:text-neutral-400'
              )}
            >
              {Math.round(fitScore * 100)}%
            </p>
          </div>
        )}
      </div>

      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        className="flex-shrink-0 text-neutral-300 dark:text-neutral-700 group-hover:text-neutral-400 dark:group-hover:text-neutral-500 transition-colors"
      >
        <path
          d="M9 18l6-6-6-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  )
}
