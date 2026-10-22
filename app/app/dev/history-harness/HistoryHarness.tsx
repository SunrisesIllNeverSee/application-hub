'use client'

import { useCallback, useEffect, useState } from 'react'
import { createMemoryStorage } from '@/lib/aqua-local/vault'
import type { VaultStorage } from '@/lib/aqua-local'
import { FixedVaultProvider } from '@/lib/aqua-local-client/VaultProvider'
import { seedSyntheticHistory } from '@/lib/history-ui/synthetic-seed'
import { HistoryConfirm } from '@/components/history/HistoryConfirm'

// Synthetic vault secret for the in-memory harness vault (never a real one).
const HARNESS_SECRET = 'harness-synthetic-secret'

export function HistoryHarness() {
  const [storage, setStorage] = useState<VaultStorage | null>(null)
  const [error, setError] = useState('')

  const reset = useCallback(async () => {
    setStorage(null)
    setError('')
    try {
      const s = createMemoryStorage()
      await seedSyntheticHistory(s, HARNESS_SECRET)
      setStorage(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void reset()
  }, [reset])

  return (
    <div className="min-h-screen bg-white px-4 py-4 dark:bg-neutral-950 md:px-6">
      <div className="mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-warning-300 bg-warning-50 px-3 py-2 text-xs text-warning-800 dark:border-warning-700 dark:bg-warning-900/30 dark:text-warning-300">
        <span>
          Dev harness — in-memory vault seeded with <strong>synthetic</strong> submitted history. Not available in production. Reload resets it.
        </span>
        <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => void reset()}>
          Reset vault
        </button>
      </div>
      {error && <p className="text-sm text-danger-600">{error}</p>}
      {!storage ? (
        <p className="mx-auto max-w-4xl text-sm text-neutral-500" role="status">Seeding synthetic vault…</p>
      ) : (
        <FixedVaultProvider storage={storage} secret={HARNESS_SECRET}>
          <HistoryConfirm />
        </FixedVaultProvider>
      )}
    </div>
  )
}
