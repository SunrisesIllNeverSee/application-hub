'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { Tone } from '@/lib/review-ui/view-model'

// M09 W5 — small presentational primitives shared by the review card,
// board and dialogs. Colors come from the existing Tailwind palette
// (success / warning / danger / brand / neutral) used across the app.

export const TONE_CLASS: Record<Tone, string> = {
  success: 'border-success-500/40 bg-success-50 text-success-700 dark:border-success-500/40 dark:bg-success-700/15 dark:text-success-400',
  warning: 'border-warning-300 bg-warning-50 text-warning-800 dark:border-warning-700/60 dark:bg-warning-900/30 dark:text-warning-300',
  danger: 'border-danger-500/40 bg-danger-50 text-danger-600 dark:border-danger-500/40 dark:bg-danger-600/15 dark:text-danger-500',
  info: 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
  neutral: 'border-neutral-300 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300',
}

export function Pill({ tone, children, title, className }: { tone: Tone; children: ReactNode; title?: string; className?: string }) {
  return (
    <span
      title={title}
      className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4', TONE_CLASS[tone], className)}
    >
      {children}
    </span>
  )
}

export function Section({
  title,
  label,
  variant = 'default',
  children,
  testId,
}: {
  title: string
  /** Extra label shown next to the title (e.g. "not evidence"). */
  label?: ReactNode
  variant?: 'default' | 'recommendation'
  children: ReactNode
  testId?: string
}) {
  return (
    <section
      data-testid={testId}
      aria-label={title}
      className={cn(
        'rounded-lg p-3 sm:p-4',
        variant === 'recommendation'
          ? 'border-2 border-dashed border-brand-300 bg-brand-50/60 dark:border-brand-700 dark:bg-brand-900/20'
          : 'border border-neutral-200 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900/40',
      )}
    >
      <h3 className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {title}
        {label}
      </h3>
      {children}
    </section>
  )
}

export function Field({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-xs text-neutral-500 dark:text-neutral-400">{term}</dt>
      <dd className="text-sm text-neutral-900 dark:text-neutral-100">{children}</dd>
    </div>
  )
}

export function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-xs text-neutral-500 dark:text-neutral-400">{empty}</p>
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-800 dark:text-neutral-200">
      {items.map((i, n) => (
        <li key={n}>{i}</li>
      ))}
    </ul>
  )
}

export function Notice({ tone, children, testId }: { tone: Tone; children: ReactNode; testId?: string }) {
  return (
    <div role="status" data-testid={testId} className={cn('rounded-lg border px-3 py-2 text-xs', TONE_CLASS[tone])}>
      {children}
    </div>
  )
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const INPUT_CLASS =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'
