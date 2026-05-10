import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Program } from '@/lib/database.types'
import { programTypeLabel } from '@/lib/utils'
import { cn } from '@/lib/utils'

export const metadata = {
  title: 'Program Timeline',
}

function getStatus(program: Program): 'open' | 'closing_soon' | 'closed' | 'rolling' {
  if (program.is_rolling) return 'rolling'
  if (!program.deadline_at) return 'rolling'
  const now = new Date()
  const deadline = new Date(program.deadline_at)
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) return 'closed'
  if (daysLeft <= 14) return 'closing_soon'
  return 'open'
}

function getDaysLeft(deadline: string | null): number | null {
  if (!deadline) return null
  const now = new Date()
  const d = new Date(deadline)
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_STYLES = {
  open: 'bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-400 border-success-200 dark:border-success-800',
  closing_soon: 'bg-warning-50 dark:bg-warning-500/10 text-warning-700 dark:text-warning-400 border-warning-200 dark:border-warning-800',
  closed: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700',
  rolling: 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 border-brand-200 dark:border-brand-800',
}

const STATUS_LABELS = {
  open: 'Open',
  closing_soon: 'Closing soon',
  closed: 'Closed',
  rolling: 'Rolling',
}

const STATUS_DOT = {
  open: 'bg-success-500',
  closing_soon: 'bg-warning-500',
  closed: 'bg-neutral-400',
  rolling: 'bg-brand-500',
}

export default async function TimelinePage() {
  const supabase = createClient()

  const { data: programs } = await supabase
    .from('programs')
    .select('*')
    .order('deadline_at', { ascending: true, nullsFirst: false })
    .returns<Program[]>()

  const all = programs ?? []

  // Separate into groups
  const rolling = all.filter((p) => p.is_rolling || !p.deadline_at)
  const withDeadline = all.filter((p) => !p.is_rolling && p.deadline_at)
  const open = withDeadline.filter((p) => {
    const days = getDaysLeft(p.deadline_at)
    return days !== null && days > 14
  })
  const closingSoon = withDeadline.filter((p) => {
    const days = getDaysLeft(p.deadline_at)
    return days !== null && days >= 0 && days <= 14
  })
  const closed = withDeadline.filter((p) => {
    const days = getDaysLeft(p.deadline_at)
    return days !== null && days < 0
  })

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Deadline Timeline</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Track open windows, closing deadlines, and rolling programs
          </p>
        </div>
        <Link href="/hub" className="btn-secondary text-sm">
          ← Directory view
        </Link>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-8 flex-wrap">
        {(Object.entries(STATUS_LABELS) as [keyof typeof STATUS_LABELS, string][]).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400">
            <span className={cn('w-2 h-2 rounded-full', STATUS_DOT[key])} />
            {label}
          </div>
        ))}
      </div>

      {/* Closing Soon — most urgent first */}
      {closingSoon.length > 0 && (
        <Section title="Closing Soon" subtitle={`${closingSoon.length} program${closingSoon.length !== 1 ? 's' : ''} closing within 14 days`}>
          {closingSoon.map((p) => (
            <TimelineRow key={p.id} program={p} status="closing_soon" />
          ))}
        </Section>
      )}

      {/* Open */}
      {open.length > 0 && (
        <Section title="Open" subtitle={`${open.length} program${open.length !== 1 ? 's' : ''} with upcoming deadlines`}>
          {open.map((p) => (
            <TimelineRow key={p.id} program={p} status="open" />
          ))}
        </Section>
      )}

      {/* Rolling */}
      {rolling.length > 0 && (
        <Section title="Rolling Admissions" subtitle="Always accepting — apply any time">
          {rolling.map((p) => (
            <TimelineRow key={p.id} program={p} status="rolling" />
          ))}
        </Section>
      )}

      {/* Closed */}
      {closed.length > 0 && (
        <Section title="Closed" subtitle="Deadlines have passed — bookmark for next cycle">
          {closed.map((p) => (
            <TimelineRow key={p.id} program={p} status="closed" dimmed />
          ))}
        </Section>
      )}

      {all.length === 0 && (
        <div className="card p-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
          No programs seeded yet. Run the seed SQL files to populate the archive.
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-8">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function TimelineRow({
  program,
  status,
  dimmed = false,
}: {
  program: Program
  status: keyof typeof STATUS_STYLES
  dimmed?: boolean
}) {
  const daysLeft = getDaysLeft(program.deadline_at)

  return (
    <Link
      href={`/hub/${program.slug}`}
      className={cn(
        'card px-5 py-4 flex items-center gap-4 hover:shadow-card-hover transition-shadow',
        dimmed && 'opacity-60'
      )}
    >
      {/* Status dot */}
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_DOT[status])} />

      {/* Program info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-neutral-900 dark:text-white truncate">
            {program.name}
          </span>
          <span className="text-xs text-neutral-400 dark:text-neutral-500 flex-shrink-0">
            {programTypeLabel(program.type)}
          </span>
        </div>
        {program.industry_tags?.length > 0 && (
          <div className="mt-1 flex gap-1.5 flex-wrap">
            {program.industry_tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Timeline bar (for programs with deadlines) */}
      {daysLeft !== null && daysLeft >= 0 && (
        <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0 w-32">
          <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
            <div
              className={cn('h-1.5 rounded-full', STATUS_DOT[status])}
              style={{ width: `${Math.min(100, Math.max(4, (daysLeft / 90) * 100))}%` }}
            />
          </div>
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            {daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
          </span>
        </div>
      )}

      {/* Deadline / status badge */}
      <div className="flex-shrink-0">
        {status === 'closed' ? (
          <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border', STATUS_STYLES[status])}>
            Closed
          </span>
        ) : status === 'rolling' ? (
          <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border', STATUS_STYLES[status])}>
            Rolling
          </span>
        ) : program.deadline_at ? (
          <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border', STATUS_STYLES[status])}>
            {formatDate(program.deadline_at)}
          </span>
        ) : null}
      </div>

      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-neutral-300 dark:text-neutral-600 flex-shrink-0">
        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}
