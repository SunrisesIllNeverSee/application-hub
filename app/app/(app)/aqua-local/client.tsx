'use client'

import { useCallback, useEffect, useState } from 'react'
import { UnlockPanel } from '@/components/aqua-local/UnlockPanel'
import { VaultStatusBanner } from '@/components/aqua-local/VaultStatusBanner'
import { AnswerBankList } from '@/components/aqua-local/AnswerBankList'
import { LocalAnswerEditor, type EditTarget } from '@/components/aqua-local/LocalAnswerEditor'
import { OnboardingLocalCard } from '@/components/aqua-local/OnboardingLocalCard'
import {
  loadBank,
  saveVersion,
  readBody,
  approve,
  downloadBackup,
  lastBackupAt,
  BACKUP_REMINDER_MS,
  ONBOARDING_APPLICATION_ID,
  VaultBlankBodyError,
  VaultDecryptError,
} from '@/lib/aqua-local-client/session'
import type { BankEntry, BankVersion } from '@/lib/aqua-local-client/session'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import type { VersionRecord } from '@/lib/aqua-local'

// LF-10/11/12/15 — local-first surface. All private content lives in the
// browser IndexedDB vault (`aqua-local`). IN-01: storage + secret now come
// from the shared VaultProvider mounted at the (app) layout, so unlocking
// here unlocks every other surface (and vice versa) for the session. The
// secret is still memory-only — never persisted, never sent anywhere.

export default function AquaLocal() {
  const vault = useVault()
  const [bank, setBank] = useState<BankEntry[]>([])
  const [offline, setOffline] = useState(false)
  const [backupDue, setBackupDue] = useState(false)
  const [backupDismissed, setBackupDismissed] = useState(false)
  const [backupBusy, setBackupBusy] = useState(false)
  const [banner, setBanner] = useState('')
  const [target, setTarget] = useState<EditTarget | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [lastSaved, setLastSaved] = useState<VersionRecord | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const phase = vault.status // 'idle' | 'unsupported' | 'locked' | 'unlocked'

  const refreshBank = useCallback(async () => {
    const secret = vault.getSecret()
    if (!secret) return
    try {
      const storage = await vault.ensureStorage()
      const entries = await loadBank(storage)
      setBank(entries)
      const hasVersions = entries.some((e) => e.versions.length > 0)
      const last = lastBackupAt()
      setBackupDue(hasVersions && (last === null || Date.now() - last > BACKUP_REMINDER_MS))
    } catch {
      setBanner('Could not read the vault')
    }
  }, [vault])

  // Lazy open: first visit to this surface opens the DB (locked state).
  // If another surface already unlocked the vault, status is already
  // 'unlocked' and this is a no-op probe.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await vault.ensureStorage()
      } catch {
        if (!cancelled) setBanner('This browser does not support IndexedDB — the local vault cannot run here.')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  useEffect(() => {
    if (phase === 'unlocked') void refreshBank()
    if (phase === 'locked') setBank([])
  }, [phase, refreshBank])

  const lock = () => {
    vault.lock()
    setTarget(null)
    setBank([])
  }

  const requireSecret = (): string => {
    const secret = vault.getSecret()
    if (!secret) {
      vault.lock()
      throw new VaultDecryptError('vault is locked — unlock to continue')
    }
    return secret
  }

  const requireStorage = async () => vault.ensureStorage()

  const handleEdit = async (entry: BankEntry, version: BankVersion) => {
    try {
      const storage = await requireStorage()
      const { title, body } = await readBody(storage, requireSecret(), version.record.id)
      setSaveError('')
      setLastSaved(null)
      setTarget({
        answer_id: entry.answer.id,
        parent_version_id: version.record.id,
        parentWasApproved: version.approval === 'approved',
        scope: entry.answer.scope,
        title,
        body,
      })
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Could not decrypt this version')
    }
  }

  const handleSave = async (input: Parameters<typeof saveVersion>[2]) => {
    setSaving(true)
    setSaveError('')
    try {
      const storage = await requireStorage()
      const record = await saveVersion(storage, requireSecret(), input)
      setLastSaved(record)
      await refreshBank()
    } catch (e) {
      setSaveError(
        e instanceof VaultBlankBodyError
          ? 'Refused: the answer body is empty or only whitespace/invisible characters.'
          : e instanceof Error
            ? e.message
            : 'Save failed',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleOnboardingSave = (input: {
    occurrence: string
    answer_id: string | null
    parent_version_id: string | null
    title: string
    body: string
  }) => {
    void handleSave({
      answer_id: input.answer_id,
      scope: {
        application_id: ONBOARDING_APPLICATION_ID,
        question_occurrence_id: input.occurrence,
      },
      parent_version_id: input.parent_version_id,
      title: input.title,
      body: input.body,
      method: 'manual',
    })
  }

  const handleApprove = async (versionId: string, decision: 'approved' | 'rejected') => {
    setApprovingId(versionId)
    try {
      const storage = await requireStorage()
      await approve(storage, versionId, decision)
      await refreshBank()
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Approval failed')
    } finally {
      setApprovingId(null)
    }
  }

  const handleBackup = async () => {
    setBackupBusy(true)
    try {
      const storage = await requireStorage()
      const name = await downloadBackup(storage, requireSecret())
      setBanner(`Encrypted backup downloaded: ${name}`)
      setBackupDue(false)
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Backup export failed')
    } finally {
      setBackupBusy(false)
    }
  }

  const unlocked = phase === 'unlocked'

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            AQUA local vault
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Local-first mode · answers are encrypted on this device and never sent to a
            server · flag-gated
          </p>
        </div>
        {unlocked && (
          <button onClick={lock} className="btn-secondary shrink-0 px-3 py-1.5 text-xs">
            Lock vault
          </button>
        )}
      </div>

      {banner && (
        <p className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
          {banner}
        </p>
      )}

      {phase === 'idle' && (
        <p className="mt-6 text-sm text-neutral-400">Opening vault…</p>
      )}

      {phase === 'unsupported' && (
        <p className="mt-6 rounded-lg border border-danger-500/20 bg-danger-50/10 p-4 text-sm text-danger-600 dark:text-danger-400">
          This browser does not support IndexedDB — the local vault cannot run here.
          Your answers have not been stored anywhere.
        </p>
      )}

      {phase === 'locked' && (
        <UnlockPanel vaultHasData={vault.vaultHasData} onUnlock={vault.unlock} />
      )}

      {unlocked && (
        <>
          <VaultStatusBanner
            offline={offline}
            backupDue={backupDue && !backupDismissed}
            backupBusy={backupBusy}
            onExportBackup={handleBackup}
            onDismissBackup={() => setBackupDismissed(true)}
          />

          <section className="mt-6 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Answer Bank</h2>
              <button
                onClick={() => {
                  setSaveError('')
                  setLastSaved(null)
                  setTarget({
                    answer_id: null,
                    parent_version_id: null,
                    parentWasApproved: false,
                    title: '',
                    body: '',
                  })
                }}
                className="btn-secondary px-3 py-1 text-xs"
              >
                New answer
              </button>
            </div>
            <AnswerBankList
              bank={bank}
              onEdit={handleEdit}
              onApprove={handleApprove}
              approvingId={approvingId}
            />

            {target && (
              <div className="mt-4">
                <LocalAnswerEditor
                  target={target}
                  saving={saving}
                  error={saveError}
                  lastSaved={lastSaved}
                  onSave={handleSave}
                  onCancel={() => setTarget(null)}
                />
              </div>
            )}
          </section>
        </>
      )}

      {/* LF-12: onboarding card is part of the surface even while locked —
          the copy explains the model; the inputs stay disabled until unlock. */}
      <OnboardingLocalCard
        bank={bank}
        unlocked={unlocked}
        saving={saving}
        onSave={handleOnboardingSave}
      />
    </div>
  )
}
