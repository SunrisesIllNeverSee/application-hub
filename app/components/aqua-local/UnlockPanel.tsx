'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

// LF-10/LF-15 locked state. The secret is passed UP to the page on success and
// held in memory only — it is never written to storage or sent anywhere.
export function UnlockPanel({
  vaultHasData,
  onUnlock,
}: {
  /** null while we don't yet know whether the vault has any records. */
  vaultHasData: boolean | null
  onUnlock: (secret: string) => Promise<void>
}) {
  const [secret, setSecret] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const firstRun = vaultHasData === false
  const mismatch = firstRun && secret !== confirm

  const submit = async () => {
    if (!secret || mismatch) return
    setBusy(true)
    setError('')
    try {
      await onUnlock(secret)
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'VaultDecryptError'
          ? 'Wrong secret — the vault refused to decrypt.'
          : e instanceof Error
            ? e.message
            : 'Unlock failed',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
      <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
        {firstRun ? 'Create your vault secret' : 'Vault locked'}
      </h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {firstRun
          ? 'This secret encrypts every answer in your local vault. It is never stored and never leaves this device — if you lose it, the answers cannot be recovered.'
          : 'Enter your vault secret to decrypt answers on this device. The key is held in memory only and never sent to a server.'}
      </p>
      <input
        type="password"
        autoComplete="off"
        placeholder="Vault secret"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !firstRun && submit()}
        className="mt-4 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      />
      {firstRun && (
        <input
          type="password"
          autoComplete="off"
          placeholder="Confirm secret"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className={cn(
            'mt-2 w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-neutral-900 dark:text-neutral-100',
            mismatch ? 'border-danger-500 dark:border-danger-600' : 'border-neutral-200 dark:border-neutral-700',
          )}
        />
      )}
      {mismatch && <p className="mt-2 text-xs text-danger-600 dark:text-danger-400">Secrets do not match.</p>}
      {error && (
        <p className="mt-3 rounded-lg border border-danger-500/20 bg-danger-50/10 px-3 py-2 text-xs text-danger-600 dark:text-danger-400">
          {error}
        </p>
      )}
      <button
        onClick={submit}
        disabled={busy || !secret || mismatch}
        className="btn-primary mt-4 px-4 py-2 text-sm"
      >
        {busy ? 'Unlocking…' : firstRun ? 'Create vault' : 'Unlock vault'}
      </button>
    </section>
  )
}
