'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { ApplicantMode } from '@/lib/database.types'
import {
  APPLICANT_MODES,
  modeLabel,
  modeContextLabel,
  isModeDeeplyCurated,
  modeCommunityLabel,
  modeCommunityDescription,
  defaultSubmitKindForMode,
} from '@/lib/applicantMode'

interface ModeSelectorProps {
  /** The user's currently active identity. */
  activeIdentity: ApplicantMode
  /** The set of identities the user has claimed; modes outside this set still
   * render (so users can discover and add new identities), but selecting one
   * will auto-add it to their identities[] via the API. */
  identities?: ApplicantMode[]
  /** Compact = single-line segmented control. Default = with subtitle row. */
  variant?: 'compact' | 'default'
}

export function ModeSelector({
  activeIdentity,
  identities,
  variant = 'default',
}: ModeSelectorProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const claimed = new Set<ApplicantMode>(identities ?? [activeIdentity])

  async function switchMode(mode: ApplicantMode) {
    if (mode === activeIdentity || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/profile/identity', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_identity: mode, add_to_identities: true }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `Switch failed (${res.status})`)
      }
      // Clear type filter params on mode switch so the new mode's filter applies cleanly
    startTransition(() => router.push('/applications'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Switch failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div
        role="tablist"
        aria-label="Active applicant mode"
        className="flex w-full overflow-x-auto items-center gap-1 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 p-1"
      >
        {APPLICANT_MODES.map((mode) => {
          const active = mode === activeIdentity
          const isClaimed = claimed.has(mode)
          const sparse = !isModeDeeplyCurated(mode)
          return (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={active}
              aria-busy={busy && !active}
              disabled={busy}
              onClick={() => switchMode(mode)}
              className={cn(
                'group relative flex flex-shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors',
                active
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100',
                busy && !active && 'opacity-60 cursor-wait'
              )}
            >
              <span>{modeLabel(mode)}</span>
              {!isClaimed && (
                <span
                  aria-label="not yet claimed"
                  title="Click to add this identity"
                  className="ml-0.5 text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500"
                >
                  +
                </span>
              )}
              {sparse && (
                <span
                  aria-label={modeCommunityDescription(mode)}
                  title={modeCommunityDescription(mode)}
                  className="ml-0.5 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                >
                  {modeCommunityLabel(mode)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {variant === 'default' && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Viewing as <span className="font-medium text-neutral-700 dark:text-neutral-300">{modeLabel(activeIdentity)}</span>{' '}
          · {modeContextLabel(activeIdentity)} programs
          {!isModeDeeplyCurated(activeIdentity) && (
            <> · <a
              href={`/applications/submit?kind=${defaultSubmitKindForMode(activeIdentity)}`}
              className="text-amber-600 dark:text-amber-400 hover:underline font-medium"
            >
              Submit a program, earn days
            </a></>
          )}
        </p>
      )}

      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  )
}
