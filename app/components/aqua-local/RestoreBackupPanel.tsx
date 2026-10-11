'use client'

import { useRef, useState } from 'react'
import {
  previewBackup,
  restoreBackup,
  tryUnlock,
  VaultBackupVersionError,
  VaultDecryptError,
  VaultTamperError,
} from '@/lib/aqua-local-client/session'
import type { BackupPreview, ImportResult } from '@/lib/aqua-local-client/session'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'

// F-RESTORE — user-facing Restore Backup workflow (owner-approved gap close).
// Uses only the existing encrypted import engine (lib/aqua-local/backup.ts).
// The backup file and the secret NEVER leave the device — every step is a
// local IndexedDB/crypto operation; there is no server call in this panel.
//
// Journey: pick .json backup → enter backup secret → integrity + account
// check → preview what would be restored → confirm → records recovered.
// Duplicate-safe: records that already exist are reported as skipped,
// never overwritten.

type PanelState = 'pick' | 'preview' | 'done'

const STORE_LABELS: Record<string, string> = {
  answers: 'answers',
  versions: 'versions',
  approvals: 'approvals',
  packets: 'packets',
  provenance: 'provenance receipts',
  imports: 'import receipts',
  signoffs: 'sign-offs',
  catalog_cache: 'catalog entries',
  events: 'audit events',
}

function describeError(e: unknown): string {
  if (e instanceof VaultDecryptError) {
    return 'Wrong secret or corrupted file — the backup refused to decrypt.'
  }
  if (e instanceof VaultTamperError) {
    return `Backup file failed its integrity check (${e.message}). It may be corrupted or not an AQUA backup.`
  }
  if (e instanceof VaultBackupVersionError) {
    return 'This backup was made by a newer version of AQUA and cannot be restored here.'
  }
  return e instanceof Error ? e.message : 'Restore failed'
}

export function RestoreBackupPanel({ onRestored }: { onRestored?: () => void }) {
  const vault = useVault()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [secret, setSecret] = useState('')
  const [state, setState] = useState<PanelState>('pick')
  const [preview, setPreview] = useState<BackupPreview | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileTextRef = useRef<string>('')

  const canCheck = !!file && secret.length > 0 && !busy

  async function handleCheck() {
    if (!file || !secret) return
    setBusy(true)
    setError('')
    setPreview(null)
    setResult(null)
    try {
      const text = await file.text()
      fileTextRef.current = text
      const storage = await vault.ensureStorage()

      // Account compatibility: when this vault already holds versions, the
      // backup secret must be the vault's secret — imported bodies are
      // re-encrypted under it, so a mismatch would make the vault's own
      // records unreadable under one secret or the other.
      const existing = await storage.getAll('versions')
      if (existing.length > 0) {
        try {
          await tryUnlock(storage, secret)
        } catch {
          setError(
            "This backup's secret does not match this vault's secret. A backup restores only into a vault that shares its secret.",
          )
          return
        }
      }

      const p = await previewBackup(storage, secret, text)
      setPreview(p)
      setState('preview')
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm() {
    if (!preview || !fileTextRef.current || !secret) return
    setBusy(true)
    setError('')
    try {
      const storage = await vault.ensureStorage()
      const r = await restoreBackup(storage, secret, fileTextRef.current)
      setResult(r)
      setState('done')
      // Open the session with the backup secret so restored content is
      // immediately readable (empty vault: secret becomes the vault secret;
      // non-empty: it already matched, verified above).
      await vault.unlock(secret)
      onRestored?.()
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setState('pick')
    setPreview(null)
    setResult(null)
    setError('')
    setFile(null)
    fileTextRef.current = ''
    if (fileRef.current) fileRef.current.value = ''
  }

  const storeLines = preview
    ? Object.entries(preview.stores)
        .filter(([, s]) => s.total > 0)
        .map(([name, s]) => ({
          label: STORE_LABELS[name] ?? name,
          ...s,
        }))
    : []

  return (
    <section className="mt-6 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Restore backup</h2>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Recover answers and version history from an encrypted AQUA backup file.
            The file and your secret never leave this device.
          </p>
        </div>
        {state !== 'pick' && (
          <button onClick={reset} className="text-xs text-neutral-500 underline underline-offset-2">
            Start over
          </button>
        )}
      </div>

      {state !== 'done' && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">
              Backup file (.json)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setPreview(null)
                setState('pick')
              }}
              className="block w-full text-xs text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-xs file:text-neutral-700 hover:file:bg-neutral-200 dark:text-neutral-300 dark:file:bg-neutral-800 dark:file:text-neutral-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">
              Backup secret
            </label>
            <input
              type="password"
              autoComplete="off"
              placeholder="The secret used when the backup was exported"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>
          {state === 'pick' && (
            <button
              onClick={handleCheck}
              disabled={!canCheck}
              className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
            >
              {busy ? 'Checking…' : 'Check backup'}
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-danger-500/20 bg-danger-50/10 px-3 py-2 text-xs text-danger-600 dark:text-danger-400">
          {error}
        </p>
      )}

      {state === 'preview' && preview && (
        <div className="mt-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
          <p className="text-sm text-neutral-800 dark:text-neutral-200">
            Backup is valid — exported{' '}
            {new Date(preview.exported_at).toLocaleString()}.
          </p>
          <ul className="mt-2 space-y-0.5 text-xs text-neutral-600 dark:text-neutral-300">
            {storeLines.map((s) => (
              <li key={s.label}>
                {s.insert} {s.label}
                {s.skip > 0 && (
                  <span className="text-neutral-400">
                    {' '}
                    · {s.skip} already on this device (skipped, not overwritten)
                  </span>
                )}
              </li>
            ))}
          </ul>
          {preview.version_titles.length > 0 && (
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              Versions: {preview.version_titles.slice(0, 5).join(' · ')}
              {preview.version_titles.length > 5 &&
                ` · +${preview.version_titles.length - 5} more`}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleConfirm}
              disabled={busy || preview.total_insert === 0}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {busy
                ? 'Restoring…'
                : preview.total_insert === 0
                  ? 'Everything already on this device'
                  : `Restore ${preview.total_insert} record${preview.total_insert === 1 ? '' : 's'}`}
            </button>
            <button onClick={reset} className="btn-secondary px-3 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {state === 'done' && result && (
        <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          <p className="font-medium">Restore complete.</p>
          <p className="mt-1 text-xs">
            Recovered {Object.entries(result.counts).reduce((n, [, c]) => n + c, 0)} records
            {result.skipped_duplicates > 0 &&
              ` · ${result.skipped_duplicates} already on this device were skipped`}
            . Reload the page — everything stays on this device.
          </p>
        </div>
      )}
    </section>
  )
}
