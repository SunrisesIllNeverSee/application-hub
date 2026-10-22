'use client'

// M09 W6 — Step A (e) / "reopen historical work": every private application
// instance on this device with its lifecycle (active / queued / submitted).

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import { loadInstanceSummaries, type InstanceSummary } from '@/lib/journey/lifecycle'
import type { JourneyCatalog } from '@/lib/journey/review-model'
import { Chip, Notice, VaultUnlock, formatWhen, type JourneyEnv } from './ui'

const LIFECYCLE_TONE = { active: 'brand', queued: 'warning', submitted: 'success' } as const
const LIFECYCLE_LABEL = { active: 'active', queued: 'queued — packet ready, not submitted', submitted: 'submitted (your record)' } as const

export function InstanceList({ catalog, env }: { catalog: JourneyCatalog; env: JourneyEnv }) {
  const vault = useVault()
  const [items, setItems] = useState<InstanceSummary[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'queued' | 'submitted'>('all')

  useEffect(() => {
    if (vault.status !== 'unlocked') return
    let cancelled = false
    ;(async () => {
      try {
        const secret = vault.getSecret()
        if (!secret) return
        const list = await loadInstanceSummaries(await vault.ensureStorage(), secret, catalog)
        if (!cancelled) setItems(list)
      } catch {
        if (!cancelled) setError('Could not read your private applications.')
      }
    })()
    return () => { cancelled = true }
  }, [vault, vault.status, catalog])

  if (vault.status !== 'unlocked') return <VaultUnlock reason="Your private applications are encrypted on this device. Unlock the vault to list them." />
  if (error) return <Notice tone="danger">{error}</Notice>
  if (!items) return <p className="text-xs text-neutral-500">Loading…</p>
  if (!items.length) return <p className="text-sm text-neutral-500">No private applications yet. Start one from the catalog, a URL, pasted text or a file.</p>

  const shown = items.filter((i) => filter === 'all' || i.lifecycle === filter)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 text-xs" role="tablist" aria-label="Filter by status">
        {(['all', 'active', 'queued', 'submitted'] as const).map((f) => (
          <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
            className={`rounded-full border px-2.5 py-0.5 ${filter === f ? 'border-brand-500 text-brand-700 dark:text-brand-300' : 'border-neutral-200 text-neutral-500 dark:border-neutral-800'}`}>
            {f} ({f === 'all' ? items.length : items.filter((i) => i.lifecycle === f).length})
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {shown.map((i) => (
          <li key={i.instance_id}>
            <Link href={`${env.basePath}/${encodeURIComponent(i.instance_id)}`} data-testid="instance-link"
              className="block rounded-lg border border-neutral-200 p-3 transition-colors hover:border-brand-400 dark:border-neutral-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-neutral-900 dark:text-white">{i.title}</span>
                <Chip tone={LIFECYCLE_TONE[i.lifecycle]}>{LIFECYCLE_LABEL[i.lifecycle]}</Chip>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {i.organization ? `${i.organization} · ` : ''}{i.question_count} questions · {i.kind === 'catalog' ? 'catalog template' : `imported (${i.source_kind})`}
                {i.deadline ? ` · due ${i.deadline.slice(0, 16).replace('T', ' ')}` : ''} · created {formatWhen(i.created_at)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
