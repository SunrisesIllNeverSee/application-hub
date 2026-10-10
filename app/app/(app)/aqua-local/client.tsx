'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { UnlockPanel } from '@/components/aqua-local/UnlockPanel'
import { VaultStatusBanner } from '@/components/aqua-local/VaultStatusBanner'
import { AnswerBankList } from '@/components/aqua-local/AnswerBankList'
import { LocalAnswerEditor, type EditTarget } from '@/components/aqua-local/LocalAnswerEditor'
import { OnboardingLocalCard } from '@/components/aqua-local/OnboardingLocalCard'
import {
  getStorage,
  tryUnlock,
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
} from './vault-session'
import type { BankEntry, BankVersion, VaultStorage } from './vault-session'
import type { VersionRecord } from '@/lib/aqua-local'

// LF-10/11/12/15 — local-first surface. All private content lives in the
// browser IndexedDB vault (`aqua-local`). The vault secret is kept in a ref —
// memory only, never persisted, never sent anywhere.

type Phase = 'init' | 'unsupported' | 'locked' | 'unlocked'

export default function AquaLocal() {
  const [phase, setPhase] = useState<Phase>('init')
  const [vaultHasData, setVaultHasData] = useState<boolean | null>(null)
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

  const storageRef = useRef<VaultStorage | null>(null)
  const secretRef = useRef<string | null>(null)

  const refreshBank = useCallback(async () => {
    const s = storageRef.current
    if (!s) return
    const entries = await loadBank(s)
    setBank(entries)
    const hasVersions = entries.some((e) => e.versions.length > 0)
    const last = lastBackupAt()
    setBackupDue(hasVersions && (last === null || Date.now() - last > BACKUP_REMINDER_MS))
  }, [])

  useEffect(() => {
    if (typeof indexedDB === 'undefined') {
      setPhase('unsupported')
      return
    }
    getStorage()
      .then(async (s) => {
        storageRef.current = s
        const versions = await s.getAll('versions')
        setVaultHasData(versions.length > 0)
        setPhase('locked')
      })
      .catch(() => setPhase('unsupported'))
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

  const handleUnlock = async (secret: string) => {
    const s = storageRef.current ?? (await getStorage())
    storageRef.current = s
    await tryUnlock(s, secret) // throws VaultDecryptError on wrong secret
    secretRef.current = secret
    setPhase('unlocked')
    await refreshBank()
  }

  const lock = () => {
    secretRef.current = null
    setTarget(null)
    setBank([])
    setPhase('locked')
    setVaultHasData(true) // a locked vault that exists still prompts for the secret
  }

  const requireSecret = (): string => {
    const secret = secretRef.current
    if (!secret) {
      setPhase('locked')
      throw new VaultDecryptError('vault is locked — unlock to continue')
    }
    return secret
  }

  const handleEdit = async (entry: BankEntry, version: BankVersion) => {
    try {
      const { title, body } = await readBody(storageRef.current!, requireSecret(), version.record.id)
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
      const record = await saveVersion(storageRef.current!, requireSecret(), input)
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
      await approve(storageRef.current!, versionId, decision)
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
      const name = await downloadBackup(storageRef.current!, requireSecret())
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

      {phase === 'init' && (
        <p className="mt-6 text-sm text-neutral-400">Opening vault…</p>
      )}

      {phase === 'unsupported' && (
        <p className="mt-6 rounded-lg border border-danger-500/20 bg-danger-50/10 p-4 text-sm text-danger-600 dark:text-danger-400">
          This browser does not support IndexedDB — the local vault cannot run here.
          Your answers have not been stored anywhere.
        </p>
      )}

      {phase === 'locked' && (
        <UnlockPanel vaultHasData={vaultHasData} onUnlock={handleUnlock} />
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
