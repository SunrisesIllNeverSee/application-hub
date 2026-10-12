'use client'

// IRM-007 — vault-authored shell projection note.
//
// Under local-first mode, server-rendered surfaces (/dash, /today, persona,
// smart-matcher) read hosted profile_answers — but local-first answers live
// only in the encrypted IndexedDB vault. This client note makes the split
// honest: it shows the on-device bank's real counts (record metadata only —
// answer titles/scopes are plaintext, bodies stay ciphertext) and labels the
// hosted-derived metrics as excluding vault content.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import { LOCAL_FIRST } from '@/lib/aqua-local-client/flag'
import type { AnswerRecord, VersionRecord, ApprovalRecord } from '@/lib/aqua-local/schema'

interface BankCounts {
  answers: number
  versions: number
  approved: number
}

export function VaultShellNote({ className }: { className?: string }) {
  const vault = useVault()
  const [counts, setCounts] = useState<BankCounts | null>(null)

  useEffect(() => {
    if (!LOCAL_FIRST || vault.status !== 'unlocked') return
    let cancelled = false
    ;(async () => {
      try {
        const storage = await vault.ensureStorage()
        const [answers, versions, approvals] = await Promise.all([
          storage.getAll<AnswerRecord>('answers'),
          storage.getAll<VersionRecord>('versions'),
          storage.getAll<ApprovalRecord>('approvals'),
        ])
        const approved = new Set(
          approvals
            .filter((a) => a.decision === 'approved')
            .map((a) => a.version_id),
        ).size
        if (!cancelled) {
          setCounts({ answers: answers.length, versions: versions.length, approved })
        }
      } catch {
        /* read-side overlay — silent */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [vault, vault.status])

  if (!LOCAL_FIRST) return null

  if (vault.status !== 'unlocked') {
    return (
      <p className={className ?? 'mt-3 text-xs text-neutral-400 dark:text-neutral-500'}>
        <span className="font-medium text-neutral-500 dark:text-neutral-400">Local-first mode</span>
        {' — '}metrics here reflect hosted records only.{' '}
        <Link href="/aqua-local" className="text-brand-600 underline dark:text-brand-400">
          Unlock your vault
        </Link>{' '}
        to see on-device counts.
      </p>
    )
  }

  if (!counts) return null

  return (
    <div
      className={
        className ??
        'mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-emerald-200/60 bg-emerald-50/50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300'
      }
    >
      <span className="font-medium">Local-first vault</span>
      <span className="tabular-nums">
        {counts.answers} answer{counts.answers === 1 ? '' : 's'} · {counts.versions} version
        {counts.versions === 1 ? '' : 's'} · {counts.approved} approved
      </span>
      <span className="text-emerald-600/80 dark:text-emerald-400/70">
        Hosted metrics on this page don&apos;t include your on-device bank.
      </span>
      <Link href="/aqua-local" className="font-medium underline">
        Open vault
      </Link>
    </div>
  )
}
