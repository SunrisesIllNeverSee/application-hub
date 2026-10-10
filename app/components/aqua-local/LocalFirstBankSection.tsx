'use client'

// IN-01 — local-first replacement for the hosted answer-list surfaces
// (/answers and /profile/answers). Under NEXT_PUBLIC_AQUA_LOCAL_FIRST the
// answer bank reads from the on-device IndexedDB vault; legacy hosted
// profile_answers render in a separate section with an explicit,
// user-initiated import into the vault (GET /api/answers/export is
// read-only; legacy-import.ts dedups by source_id).

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { ProfileAnswerWithQuestion } from '@/lib/database.types'
import { cn } from '@/lib/utils'
import { ThemeTag } from '@/components/ThemeTag'
import { UnlockPanel } from '@/components/aqua-local/UnlockPanel'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import { loadBank } from '@/lib/aqua-local-client/session'
import type { BankEntry } from '@/lib/aqua-local-client/session'
import {
  runLegacyImport,
  type LegacyImportResult,
} from '@/lib/aqua-local/legacy-import.ts'

export function LocalFirstBankSection({
  hosted,
}: {
  hosted: ProfileAnswerWithQuestion[]
}) {
  const vault = useVault()
  const [bank, setBank] = useState<BankEntry[]>([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<LegacyImportResult | null>(null)

  const refresh = useCallback(async () => {
    const secret = vault.getSecret()
    if (!secret || vault.status !== 'unlocked') return
    try {
      const storage = await vault.ensureStorage()
      setBank(await loadBank(storage))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the vault')
    }
  }, [vault])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await vault.ensureStorage()
      } catch {
        if (!cancelled) setError('IndexedDB is not available in this browser')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (vault.status === 'unlocked') void refresh()
  }, [vault.status, refresh])

  const handleImport = async () => {
    const secret = vault.getSecret()
    if (!secret) return
    setImporting(true)
    setError('')
    setImportResult(null)
    try {
      const storage = await vault.ensureStorage()
      // F-B8: bind the export payload to the session user — a foreign
      // account's payload is refused by importLegacyAnswers.
      const { createClient } = await import('@/lib/supabase/client')
      const { data: { user } } = await createClient().auth.getUser()
      const result = await runLegacyImport(storage, secret, async () => {
        const res = await fetch('/api/answers/export', { credentials: 'include' })
        if (!res.ok) throw new Error(`Export failed (${res.status})`)
        return res.json()
      }, { expectedUserId: user?.id })
      setImportResult(result)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const unlocked = vault.status === 'unlocked'

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-brand-500/20 bg-brand-50/40 dark:bg-brand-950/20 px-4 py-3 text-sm text-brand-700 dark:text-brand-300">
        Local-first mode — your answer bank lives in the encrypted vault on this
        device and is never sent to the server.{' '}
        <Link href="/aqua-local" className="font-medium underline underline-offset-2">
          Open the vault →
        </Link>
      </div>

      {error && (
        <p className="rounded-lg border border-danger-500/20 bg-danger-50/10 p-3 text-sm text-danger-600 dark:text-danger-400">
          {error}
        </p>
      )}

      {!unlocked && vault.status !== 'unsupported' && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">
            Vault locked
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
            Unlock to see your on-device answers. Your hosted legacy answers are
            listed separately below.
          </p>
          <UnlockPanel vaultHasData={vault.vaultHasData} onUnlock={vault.unlock} />
        </div>
      )}

      {unlocked && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
              On-device answer bank
            </h2>
            <Link
              href="/aqua-local"
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
            >
              Manage in Local vault →
            </Link>
          </div>
          {bank.length === 0 ? (
            <div className="card p-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
              No answers in the vault yet — save an answer from a question or
              import your hosted answers below.
            </div>
          ) : (
            <div className="space-y-3">
              {bank.map((entry) => (
                <VaultAnswerRow key={entry.answer.id} entry={entry} />
              ))}
            </div>
          )}
        </section>
      )}

      {hosted.length > 0 && (
        <section>
          <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                Hosted (legacy — import to device)
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {hosted.length} answer{hosted.length !== 1 ? 's' : ''} stored on the server
                from before local-first mode. Import copies them into your vault;
                nothing is deleted or sent anywhere new.
              </p>
            </div>
            <button
              onClick={handleImport}
              disabled={!unlocked || importing}
              title={unlocked ? 'Copy hosted answers into the device vault' : 'Unlock the vault first'}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
            >
              {importing ? 'Importing…' : 'Import to device vault'}
            </button>
          </div>

          {importResult && (
            <p className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
              Imported {importResult.imported}
              {importResult.skipped_duplicates > 0 &&
                ` · ${importResult.skipped_duplicates} already on device (skipped)`}
              {importResult.sha_mismatches.length > 0 &&
                ` · ${importResult.sha_mismatches.length} integrity mismatch (flagged, not imported)`}
              {importResult.blank_skipped.length > 0 &&
                ` · ${importResult.blank_skipped.length} blank (skipped)`}
            </p>
          )}

          <div className="space-y-3">
            {hosted.map((answer) => (
              <div key={answer.id} className="card overflow-hidden opacity-80">
                <div className="px-5 py-3 bg-neutral-50 dark:bg-neutral-800/40 border-b border-neutral-100 dark:border-neutral-800">
                  <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    {answer.archived_question?.text ?? answer.question_text ?? 'Question not found'}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-neutral-400 dark:text-neutral-500">
                    {answer.archived_question?.theme && (
                      <ThemeTag theme={answer.archived_question.theme} />
                    )}
                    <span>{answer.word_count ?? 0} words</span>
                    <span className="ml-auto">hosted legacy row</span>
                  </div>
                </div>
                <div className="px-5 py-2.5 text-[11px] text-neutral-400 dark:text-neutral-600">
                  Body not shown — import to the vault to keep working with this answer on device.
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function VaultAnswerRow({ entry }: { entry: BankEntry }) {
  const latest = entry.versions.at(-1) ?? null
  return (
    <div className="card px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
            {latest?.record.title || entry.answer.scope.question_occurrence_id}
          </p>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1 font-mono truncate">
            {entry.answer.scope.application_id} · {entry.answer.scope.question_occurrence_id}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {latest?.approval === 'approved' && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-400">
              Approved
            </span>
          )}
          <span
            className={cn(
              'text-[11px] text-neutral-400 dark:text-neutral-500',
              !latest && 'italic',
            )}
          >
            {entry.versions.length} version{entry.versions.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-neutral-400 dark:text-neutral-600">
        Encrypted on device — edit and decrypt in the{' '}
        <Link href="/aqua-local" className="text-brand-600 dark:text-brand-400 hover:underline">
          Local vault
        </Link>
        .
      </p>
    </div>
  )
}
