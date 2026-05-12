'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const TIERS = [
  { tier: 1, label: 'No real moat yet — early ideas' },
  { tier: 2, label: 'Soft advantages — brand, community, early users' },
  { tier: 3, label: 'Moderate moat — switching costs, integrations, or niche expertise' },
  { tier: 4, label: 'Strong moat — proprietary data, network effects, or patented tech' },
  { tier: 5, label: 'Deep moat — structural market position or regulatory protection' },
] as const

export function FmsQuickAssess() {
  const router = useRouter()
  const [saving, setSaving] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSelect(tier: number) {
    setSaving(tier)
    setError(null)
    try {
      const res = await fetch('/api/profile/fms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fms_tier: tier }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Failed to save. Try again.')
        setSaving(null)
        return
      }
      router.refresh()
    } catch {
      setError('Network error — please try again.')
      setSaving(null)
    }
  }

  return (
    <div className="card p-6 mb-6 border-2 border-brand-200 dark:border-brand-800">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">
        Rate your project moat
      </h3>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
        Select the tier that best describes your defensibility. This feeds your AQUAscore.
      </p>
      <div className="space-y-2">
        {TIERS.map(({ tier, label }) => (
          <button
            key={tier}
            onClick={() => handleSelect(tier)}
            disabled={saving !== null}
            className={cn(
              'w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors',
              saving === tier
                ? 'border-brand-400 bg-brand-50 dark:bg-brand-950/40 dark:border-brand-600'
                : 'border-neutral-200 dark:border-neutral-800 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50/50 dark:hover:bg-brand-950/20',
              saving !== null && saving !== tier && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
              {tier}
            </span>
            <span className="text-sm text-neutral-700 dark:text-neutral-300">{label}</span>
            {saving === tier && (
              <span className="ml-auto text-xs text-brand-600 dark:text-brand-400 animate-pulse">
                Saving…
              </span>
            )}
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
