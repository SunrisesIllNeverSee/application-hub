'use client'

// AM-0032 — vault-side intelligence card.
//
// The hosted AQUAscore on this page is computed from hosted data only —
// it cannot see vault answers (they never upload). This card computes the
// SAME scoring formula over vault-derived inputs on-device and labels the
// result explicitly as vault-only: a functioning user-facing number, not a
// disclaimer. The two scores stay separate — merging them would
// double-count hosted data and fabricate a unified value neither dataset
// supports.

import { useEffect, useState } from 'react'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import { LOCAL_FIRST } from '@/lib/aqua-local-client/flag'
import { computeVaultScore, type VaultScoreBreakdown } from '@/lib/aqua-local-client/local-score'

export function VaultScoreCard({ className }: { className?: string }) {
  const vault = useVault()
  const [score, setScore] = useState<VaultScoreBreakdown | null>(null)

  useEffect(() => {
    if (!LOCAL_FIRST || vault.status !== 'unlocked') return
    let cancelled = false
    ;(async () => {
      try {
        const storage = await vault.ensureStorage()
        const secret = vault.getSecret()
        if (!secret) return
        const s = await computeVaultScore(storage, secret)
        if (!cancelled) setScore(s)
      } catch {
        /* read-side overlay — silent */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [vault, vault.status])

  if (!LOCAL_FIRST || vault.status !== 'unlocked' || !score) return null

  return (
    <div
      className={
        className ??
        'rounded-lg border border-brand-200/60 bg-brand-50/50 px-4 py-3 text-xs text-brand-900 dark:border-brand-800/50 dark:bg-brand-950/30 dark:text-brand-200'
      }
    >
      <p className="font-medium">
        Local vault score {score.composite}
        <span className="ml-2 font-normal text-neutral-500 dark:text-neutral-400">
          vault data only — your hosted score above excludes vault content by design
        </span>
      </p>
      <p className="mt-1 text-neutral-600 dark:text-neutral-400">
        {score.answeredCount} answered slot{score.answeredCount === 1 ? '' : 's'} ·{' '}
        {score.approvedCount} human-approved · pillars A{score.applications} Q{score.questions} A
        {score.answers}. Same formula as AQUAscore — vault fields map where the data honestly
        supports them (no themes/types/stress-tests under local-first).
      </p>
    </div>
  )
}
