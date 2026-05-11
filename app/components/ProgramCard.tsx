import Link from 'next/link'
import type { ProgramWithFit } from '@/lib/database.types'
import {
  formatCheckSize,
  formatEquity,
  formatDeadline,
  formatProgramStartDate,
  getApplicantSignal,
  getHeatSignal,
  programTypeLabel,
  cn,
} from '@/lib/utils'
import { ScoreTooltip } from '@/components/ScoreTooltip'

interface ProgramCardProps {
  program: ProgramWithFit
  rank?: number
}

const TYPE_COLORS: Record<string, string> = {
  accel: 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300',
  accelerator: 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300',
  grant: 'bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-400',
  fellowship: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  vc: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  vc_fund: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  corp: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  uni: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  other: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300',
}

const STATUS_PILL: Record<string, string> = {
  open: 'bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-400',
  closing_soon: 'bg-warning-50 dark:bg-warning-500/10 text-warning-700 dark:text-warning-400',
  closed: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400',
  rolling: 'bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-400',
}

const APP_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  saved: { label: 'Saved', className: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400' },
  drafting: { label: 'In progress', className: 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' },
  submitted: { label: 'Submitted', className: 'bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-400' },
  accepted: { label: 'Accepted', className: 'bg-success-100 dark:bg-success-500/20 text-success-800 dark:text-success-300' },
  rejected: { label: 'Rejected', className: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400' },
  waitlisted: { label: 'Waitlisted', className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
}

export function ProgramCard({ program, rank }: ProgramCardProps) {
  const deadline = formatDeadline(program.deadline_at)
  const fitScore = program.fit?.fit_score
  const appStatus = program.application?.status
  const heat = getHeatSignal(program.heat_score, program.program_value_score)
  const applicants = getApplicantSignal(program.applicant_count, program.cohort_size)
  const cohortStart = formatProgramStartDate(program.program_start_date)

  return (
    <Link
      href={`/hub/${program.slug}`}
      className="card p-4 sm:p-5 flex items-center gap-3 sm:gap-4 hover:shadow-card-hover transition-all duration-150 block group"
    >
      {/* Rank */}
      {rank != null && (
        <div className="flex-shrink-0 w-6 text-center">
          <span className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 tabular-nums">
            {rank}
          </span>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Top row: type badge + status pill + app status */}
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
              TYPE_COLORS[program.type] ?? 'bg-neutral-100 text-neutral-600'
            )}
          >
            {programTypeLabel(program.type)}
          </span>

          {/* Open/Closed/Rolling status pill — always visible */}
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium',
              STATUS_PILL[deadline.status]
            )}
          >
            {deadline.status === 'open' || deadline.status === 'rolling' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
            ) : deadline.status === 'closing_soon' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-warning-500" />
            ) : null}
            {deadline.status === 'rolling' ? 'Rolling' : deadline.status === 'open' ? 'Open' : deadline.status === 'closing_soon' ? 'Closing soon' : 'Closed'}
          </span>

          {/* Application status badge — only if user has started */}
          {appStatus && APP_STATUS_BADGE[appStatus] && (
            <span
              className={cn(
                'hidden sm:inline-flex px-2 py-0.5 rounded-md text-xs font-medium',
                APP_STATUS_BADGE[appStatus].className
              )}
            >
              {APP_STATUS_BADGE[appStatus].label}
            </span>
          )}
        </div>

        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate">
          {program.name}
        </h3>

        {/* Second row: deadline countdown + equity + value */}
        <div className="mt-1.5 flex items-center gap-3 flex-wrap">
          {/* Deadline always shown inline under name */}
          <span
            className={cn(
              'text-xs font-medium',
              deadline.urgent
                ? 'text-warning-600 dark:text-warning-400'
                : deadline.status === 'closed'
                ? 'text-neutral-400 dark:text-neutral-500'
                : 'text-neutral-600 dark:text-neutral-400'
            )}
          >
            {deadline.label}
          </span>

          <span className="text-neutral-300 dark:text-neutral-700 text-xs">·</span>

          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {formatEquity(program.equity_taken)}
          </span>

          {program.check_size_max && (
            <>
              <span className="text-neutral-300 dark:text-neutral-700 text-xs">·</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {formatCheckSize(program.check_size_max)}
              </span>
            </>
          )}

          {(program.cohort_name || cohortStart) && (
            <>
              <span className="text-neutral-300 dark:text-neutral-700 text-xs">·</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {program.cohort_name ?? cohortStart}
                {program.cohort_name && cohortStart ? ` · starts ${cohortStart}` : ''}
              </span>
            </>
          )}
        </div>

        <div className="mt-1.5 flex items-center gap-3 flex-wrap">
          <span
            className={cn(
              'inline-flex items-center text-xs font-medium',
              heat.tone === 'success'
                ? 'text-success-600 dark:text-success-400'
                : heat.tone === 'brand'
                ? 'text-brand-600 dark:text-brand-400'
                : 'text-neutral-500 dark:text-neutral-400'
            )}
          >
            {heat.label}
            <span className="ml-1 font-normal text-neutral-400 dark:text-neutral-500">
              {heat.detail}
            </span>
            <ScoreTooltip
              label="Heat Score"
              description="Program desirability signal based on prestige, cohort size, and follow-on rate. Provisional until validated with longitudinal data."
              scoreId="heat"
            />
          </span>

          <span className="text-neutral-300 dark:text-neutral-700 text-xs">·</span>

          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {applicants.label}
            <span className="ml-1 text-neutral-400 dark:text-neutral-500">
              {applicants.detail}
            </span>
          </span>
        </div>
      </div>

      {/* Right side: fit score */}
      <div className="flex-shrink-0 flex items-center gap-3">
        {fitScore != null && (
          <div className="text-right">
            <p className="inline-flex items-center text-xs text-neutral-400 dark:text-neutral-500 mb-0.5">
              Fit
              <ScoreTooltip
                label="Fit Score"
                description="How well your profile aligns to this program's DNA across coverage, theme alignment, criteria match, and answer quality."
                scoreId="fit"
              />
            </p>
            <p
              className={cn(
                'text-sm font-semibold tabular-nums',
                fitScore >= 0.7
                  ? 'text-success-600 dark:text-success-400'
                  : fitScore >= 0.5
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-neutral-500 dark:text-neutral-400'
              )}
            >
              {Math.round(fitScore * 100)}%
            </p>
          </div>
        )}

        <svg
          width="14"
          height="14"
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
      </div>
    </Link>
  )
}
