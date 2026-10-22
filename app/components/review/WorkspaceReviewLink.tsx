'use client'

// M09 W5 — workspace → review board entry point. Finds this program's
// private application instance in the vault (metadata only, no decryption)
// or creates one on demand. The instance adopts the workspace's existing
// answer scope (application_id = program_id), so answers already written in
// the workspace editor appear on the board and the packet panel keeps
// working unchanged.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import { createInstance, listInstances } from '@/lib/aqua-local-client/review'

export function WorkspaceReviewLink({
  programId,
  questions,
}: {
  programId: string
  questions: Array<{ archived_question_id: string; order_index: number | null }>
}) {
  const vault = useVault()
  const router = useRouter()
  const [instanceId, setInstanceId] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (vault.status !== 'unlocked') {
      setInstanceId(undefined)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const storage = await vault.ensureStorage()
        const found = (await listInstances(storage)).find((i) => i.program_id === programId)
        if (!cancelled) setInstanceId(found?.instance_id ?? null)
      } catch {
        if (!cancelled) setInstanceId(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [vault, vault.status, programId])

  const href = (id: string) => `/review/${encodeURIComponent(id)}?program=${encodeURIComponent(programId)}`

  if (!vault.enabled) return null
  if (vault.status !== 'unlocked') {
    return (
      <span className="hidden text-[11px] text-neutral-400 md:inline" title="Unlock your vault to review answers">
        Review (vault locked)
      </span>
    )
  }
  if (instanceId === undefined) return null
  if (instanceId) {
    return (
      <a href={href(instanceId)} data-testid="workspace-review-link" className="btn-secondary px-3 py-1.5 text-xs">
        Review answers
      </a>
    )
  }
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        data-testid="workspace-start-review"
        disabled={busy || questions.length === 0}
        onClick={async () => {
          const secret = vault.getSecret()
          if (!secret) return
          setBusy(true)
          setError('')
          try {
            const storage = await vault.ensureStorage()
            const rec = await createInstance(storage, secret, {
              program_id: programId,
              application_id: programId,
              source: { kind: 'catalog' },
              question_refs: questions.map((q, i) => ({
                question_occurrence_id: q.archived_question_id,
                canonical_question_id: q.archived_question_id,
                order: q.order_index ?? i,
              })),
            })
            router.push(href(rec.instance_id))
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not start the review')
            setBusy(false)
          }
        }}
        className="btn-secondary px-3 py-1.5 text-xs"
      >
        {busy ? 'Starting…' : 'Start answer review'}
      </button>
      {error && <span className="mt-1 text-[10px] text-danger-600">{error}</span>}
    </span>
  )
}
