'use client'

// M09 W6 — small shared pieces for the application journey screens.

import { useEffect, type ReactNode } from 'react'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import { UnlockPanel } from '@/components/aqua-local/UnlockPanel'
import { cn } from '@/lib/utils'

export interface JourneyEnv {
  /** '/apply' in the app, '/dev/journey' in the dev harness */
  basePath: string
  /** W5 review surface for an instance (catalog-backed instances pass the
      program id so the board can show the public question wording) */
  reviewHref: (instanceId: string, programId?: string | null) => string
  /** dev harness only: shows the review stand-in (never in production) */
  harness?: boolean
}

export const PROD_ENV: JourneyEnv = {
  basePath: '/apply',
  reviewHref: reviewHrefFor,
}

/** /review/<id>[?program=<program_id>] — the W5 route contract. */
export function reviewHrefFor(instanceId: string, programId?: string | null): string {
  return `/review/${encodeURIComponent(instanceId)}${programId ? `?program=${encodeURIComponent(programId)}` : ''}`
}

const STEPS = [
  ['A', 'Choose'],
  ['B', 'Review'],
  ['C', 'Create'],
  ['D', 'Populate'],
  ['E', 'Review answers'],
  ['F', 'Prepare'],
  ['G', 'Freeze & export'],
  ['H', 'Record submission'],
] as const

export type StepLetter = (typeof STEPS)[number][0]

export function StepTracker({ current, done = [] }: { current: StepLetter; done?: StepLetter[] }) {
  return (
    <ol aria-label="Application steps" className="flex flex-wrap gap-1.5 text-[11px]">
      {STEPS.map(([k, label]) => {
        const isCur = k === current
        const isDone = done.includes(k)
        return (
          <li
            key={k}
            aria-current={isCur ? 'step' : undefined}
            className={cn(
              'flex items-center gap-1 rounded-full border px-2 py-0.5',
              isCur
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                : isDone
                  ? 'border-success-500/40 text-success-700 dark:text-success-400'
                  : 'border-neutral-200 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400',
            )}
          >
            <span className="font-semibold">{k}</span>
            <span className="hidden sm:inline">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function Chip({ children, tone = 'neutral', title }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger'; title?: string }) {
  const tones: Record<string, string> = {
    neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
    brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
    success: 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400',
    warning: 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400',
    danger: 'bg-danger-50 text-danger-700 dark:bg-danger-500/10 dark:text-danger-400',
  }
  return (
    <span title={title} className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium', tones[tone])}>
      {children}
    </span>
  )
}

const STATUS_TONE: Record<string, 'neutral' | 'brand' | 'success' | 'warning' | 'danger'> = {
  gap: 'neutral',
  suggested: 'brand',
  under_review: 'warning',
  needs_evidence: 'warning',
  needs_revision: 'warning',
  approved: 'success',
  included_in_packet: 'success',
  rejected: 'danger',
  superseded: 'neutral',
}

export function StatusChip({ status }: { status: string }) {
  return <Chip tone={STATUS_TONE[status] ?? 'neutral'}>{status.replace(/_/g, ' ')}</Chip>
}

export function Section({ id, step, title, children, aside }: { id?: string; step?: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} className="card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {step ? <span className="mr-2 text-brand-600 dark:text-brand-400">Step {step}</span> : null}
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Notice({ tone = 'neutral', children }: { tone?: 'neutral' | 'warning' | 'danger' | 'success'; children: ReactNode }) {
  const tones: Record<string, string> = {
    neutral: 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
    warning: 'border-warning-500/30 bg-warning-50/50 text-warning-800 dark:border-warning-800/40 dark:bg-warning-950/20 dark:text-warning-300',
    danger: 'border-danger-500/30 bg-danger-50/40 text-danger-700 dark:border-danger-800/40 dark:bg-danger-950/20 dark:text-danger-300',
    success: 'border-success-500/30 bg-success-50/40 text-success-800 dark:border-success-800/40 dark:bg-success-950/20 dark:text-success-300',
  }
  return <div role={tone === 'danger' ? 'alert' : undefined} className={cn('rounded-lg border p-3 text-xs leading-relaxed', tones[tone])}>{children}</div>
}

/** Opens the vault lazily; shows the unlock panel until unlocked. */
export function VaultUnlock({ reason }: { reason: string }) {
  const vault = useVault()
  useEffect(() => {
    if (vault.status === 'idle') void vault.ensureStorage().catch(() => {})
  }, [vault, vault.status])
  if (vault.status === 'off') {
    return <Notice tone="warning">The private application workspace needs the local vault, which is not enabled on this deployment.</Notice>
  }
  if (vault.status === 'unsupported') {
    return <Notice tone="danger">This browser cannot run the local vault (IndexedDB unavailable), so private applications cannot be created here.</Notice>
  }
  return (
    <div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{reason}</p>
      <UnlockPanel vaultHasData={vault.vaultHasData} onUnlock={vault.unlock} />
    </div>
  )
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  return iso.slice(0, 16).replace('T', ' ')
}
