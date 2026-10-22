'use client'

import { useCallback, useEffect, useState } from 'react'
import { createMemoryStorage } from '@/lib/aqua-local/vault'
import type { VaultStorage } from '@/lib/aqua-local'
import { FixedVaultProvider } from '@/lib/aqua-local-client/VaultProvider'
import { saveProvider } from '@/lib/aqua-local-client/session'
import { seedSyntheticReview, type SyntheticSeed } from '@/lib/review-ui/synthetic-seed'
import { ReviewBoard } from '@/components/review/ReviewBoard'
import { useTheme } from '@/components/ThemeProvider'

// Synthetic vault secret for the in-memory harness vault (never a real one).
const HARNESS_SECRET = 'harness-synthetic-secret'

export function ReviewHarness() {
  const { theme, toggle } = useTheme()
  const [state, setState] = useState<{ storage: VaultStorage; seed: SyntheticSeed } | null>(null)
  const [error, setError] = useState('')

  const reset = useCallback(async () => {
    setState(null)
    setError('')
    try {
      const storage = createMemoryStorage()
      const seed = await seedSyntheticReview(storage, HARNESS_SECRET)
      // Browser tests: ?mockProvider=http://127.0.0.1:<port> configures an
      // Ollama-shaped provider pointing at a LOCAL mock, so the consented
      // "Ask agent to revise" path runs without any external network.
      const mock = new URLSearchParams(window.location.search).get('mockProvider')
      if (mock && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(mock)) {
        await saveProvider(storage, HARNESS_SECRET, { provider_id: 'ollama', base_url: mock, model_preference: 'mock-model' })
      }
      setState({ storage, seed })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void reset()
  }, [reset])

  return (
    <div className="min-h-screen bg-white px-4 py-4 dark:bg-neutral-950 md:px-6">
      <div className="mx-auto mb-4 flex max-w-7xl flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-warning-300 bg-warning-50 px-3 py-2 text-xs text-warning-800 dark:border-warning-700 dark:bg-warning-900/30 dark:text-warning-300">
        <span>
          Dev harness — in-memory vault seeded with <strong>synthetic</strong> data. Not available in production. Reload resets it.
        </span>
        <span className="flex gap-2">
          <button type="button" className="btn-secondary px-2 py-1 text-xs" data-testid="harness-theme" onClick={toggle}>
            Theme: {theme}
          </button>
          <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => void reset()}>
            Reset vault
          </button>
        </span>
      </div>
      {error && <p className="text-sm text-danger-600">{error}</p>}
      {!state ? (
        <p className="mx-auto max-w-7xl text-sm text-neutral-500" role="status" data-testid="harness-seeding">
          Seeding synthetic vault…
        </p>
      ) : (
        <div className="mx-auto max-w-7xl" data-testid="harness-ready" data-instance={state.seed.instance_id}>
          <FixedVaultProvider storage={state.storage} secret={HARNESS_SECRET}>
            <ReviewBoard instanceId={state.seed.instance_id} />
          </FixedVaultProvider>
        </div>
      )}
    </div>
  )
}
