'use client'

// M09 W5 — /review/[instanceId] client shell. Requires the unlocked vault
// (shared VaultProvider from the (app) layout); handles flag-off, locked,
// unsupported, missing-instance and empty states honestly.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import { getInstance } from '@/lib/aqua-local-client/review'
import type { PublicOccurrence } from '@/lib/aqua-local-client/review'
import { UnlockPanel } from '@/components/aqua-local/UnlockPanel'
import { ReviewBoard } from './ReviewBoard'
import { Notice } from './ui'

export interface PublicReviewCatalog {
  program_id: string
  program_name: string
  org_name: string | null
  deadline: string | null
  questions: PublicOccurrence[]
  canonical_texts: Record<string, string>
}

type InstanceState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'ready'; programId: string | null; questionCount: number }
  | { kind: 'error'; message: string }

export function ReviewWorkspace({ instanceId, catalog }: { instanceId: string; catalog: PublicReviewCatalog | null }) {
  const vault = useVault()
  const [inst, setInst] = useState<InstanceState>({ kind: 'loading' })

  useEffect(() => {
    if (vault.enabled && vault.status === 'idle') void vault.ensureStorage().catch(() => {})
  }, [vault])

  useEffect(() => {
    if (vault.status !== 'unlocked') return
    const secret = vault.getSecret()
    if (!secret) return
    let cancelled = false
    void (async () => {
      try {
        const storage = await vault.ensureStorage()
        const view = await getInstance(storage, secret, instanceId)
        if (!cancelled) setInst({ kind: 'ready', programId: view.record.program_id ?? null, questionCount: view.record.question_refs.length })
      } catch (e) {
        if (cancelled) return
        if (e instanceof Error && e.name === 'VaultNotFoundError') setInst({ kind: 'missing' })
        else setInst({ kind: 'error', message: e instanceof Error ? e.message : 'Could not read the vault' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [vault, vault.status, instanceId])

  // Public catalog data only applies when it is THIS instance's program.
  const programId = inst.kind === 'ready' ? inst.programId : null
  const supplied = useMemo(() => {
    if (!catalog || !programId || catalog.program_id !== programId) return {}
    return {
      program_name: catalog.program_name,
      org_name: catalog.org_name,
      deadline: catalog.deadline,
      catalog_questions: catalog.questions,
      canonical_texts: catalog.canonical_texts,
    }
  }, [catalog, programId])

  if (!vault.enabled) {
    return (
      <Shell>
        <Notice tone="neutral">The local-first vault is not enabled on this deployment, so there is nothing to review here.</Notice>
      </Shell>
    )
  }
  if (vault.status === 'unsupported') {
    return (
      <Shell>
        <Notice tone="danger">This browser cannot open the local vault (IndexedDB unavailable). Answers stay on the device where they were written.</Notice>
      </Shell>
    )
  }
  if (vault.status !== 'unlocked') {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-white">Review answers</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Your answers are encrypted on this device. Unlock the vault to review them.</p>
        <UnlockPanel vaultHasData={vault.vaultHasData} onUnlock={vault.unlock} />
      </Shell>
    )
  }
  if (inst.kind === 'loading') {
    return (
      <Shell>
        <p className="text-sm text-neutral-500" role="status">Opening this application from your vault…</p>
      </Shell>
    )
  }
  if (inst.kind === 'missing') {
    return (
      <Shell>
        <Notice tone="warning">
          This application review is not in this device&apos;s vault. Reviews live only on the device (and vault) where they were created.
        </Notice>
        <p className="mt-3 text-sm">
          <Link href="/applications" className="text-brand-600 underline underline-offset-2 dark:text-brand-400">
            Go to your applications
          </Link>
        </p>
      </Shell>
    )
  }
  if (inst.kind === 'error') {
    return (
      <Shell>
        <Notice tone="danger">{inst.message}</Notice>
      </Shell>
    )
  }
  if (inst.questionCount === 0) {
    return (
      <Shell>
        <Notice tone="neutral">This application has no questions yet, so there is nothing to review.</Notice>
      </Shell>
    )
  }
  const catalogMismatch = !!catalog && !!programId && catalog.program_id !== programId
  return (
    <div className="mx-auto max-w-7xl">
      {inst.programId && !catalog && (
        <div className="mb-3">
          <Notice tone="warning">
            Question wording is loaded from the public catalog.{' '}
            <Link className="underline" href={`/review/${encodeURIComponent(instanceId)}?program=${encodeURIComponent(inst.programId)}`}>
              Reload with this application&apos;s questions
            </Link>
            .
          </Notice>
        </div>
      )}
      {catalogMismatch && (
        <div className="mb-3">
          <Notice tone="warning">The program in the link does not match this application; its public question data was ignored.</Notice>
        </div>
      )}
      <ReviewBoard instanceId={instanceId} supplied={supplied} backHref={inst.programId ? `/workspace/${inst.programId}` : null} />
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl">{children}</div>
}
