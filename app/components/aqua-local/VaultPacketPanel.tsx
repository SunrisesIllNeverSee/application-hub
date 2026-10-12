'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import {
  freezeApplicationPacket,
  getPacketState,
  advancePacketState,
  exportPacket,
  listPackets,
  attestPacket,
  generateSignerKeyPair,
  verifyManifestSignature,
  PacketFreezeError,
  compareApprovals,
  type AnswerRecord,
  type ApprovalRecord,
  type VersionRecord,
  type PacketRecord,
  type PacketStateRecord,
} from '@/lib/aqua-local'
import type { VaultStorage } from '@/lib/aqua-local-client/session'

// LF-20..23 / Journey D — local application packet flow. Coverage → select
// approved vault versions → freeze (manifest + sha256) → user sign-off →
// local export. NOTHING is transmitted; the state machine has no external
// submission state (submitted_external_observed is unreachable by design).

export interface PacketQuestion {
  archived_question_id: string
  asked_as: string | null
  is_required: boolean | null
  order_index: number | null
}

interface VersionChoice {
  id: string
  title: string
  created_at: string
  /** 'agent'/'restored' are honest labels for decisions that cannot satisfy
      the freeze gate — they display but never qualify. */
  decision: 'approved' | 'rejected' | 'agent' | 'restored' | null
  method: string
}

interface RowState {
  occurrenceId: string
  text: string
  required: boolean
  versions: VersionChoice[]
  selected: string // version_id or ''
  skipReason: string
}

export function VaultPacketPanel({
  programId,
  programName,
  questions,
}: {
  programId: string
  programName: string
  questions: PacketQuestion[]
}) {
  const vault = useVault()
  const [rows, setRows] = useState<RowState[]>([])
  const [packets, setPackets] = useState<(PacketRecord & { state?: string })[]>([])
  const [frozenId, setFrozenId] = useState<string | null>(null)
  const [manifestSha, setManifestSha] = useState<string | null>(null)
  const [packetState, setPacketState] = useState<PacketStateRecord | null>(null)
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [verifyResult, setVerifyResult] = useState('')

  const loadRows = useCallback(async (storage: VaultStorage) => {
    const [answers, versions, approvals] = await Promise.all([
      storage.getAll<AnswerRecord>('answers'),
      storage.getAll<VersionRecord>('versions'),
      storage.getAll<ApprovalRecord>('approvals'),
    ])
    const appAnswers = answers.filter((a) => a.scope.application_id === programId)
    // IR-030: mirror the freeze gate — 'approved' only counts when the
    // latest decision is human and not backup-restored; everything else
    // keeps its real decision so the UI can label it.
    const latestDecision = new Map<string, 'approved' | 'rejected' | 'agent' | 'restored' | null>()
    // IR-007: LF-18 authoritative ordering — seq beats legacy timestamps.
    const sorted = [...approvals].sort(compareApprovals)
    for (const ap of sorted) {
      if (ap.decision !== 'approved' && ap.decision !== 'rejected') continue
      if (ap.restored_from_backup) latestDecision.set(ap.version_id, 'restored')
      else if (ap.actor_class !== 'human') latestDecision.set(ap.version_id, 'agent')
      else latestDecision.set(ap.version_id, ap.decision)
    }
    const next: RowState[] = questions.map((q) => {
      const occ = q.archived_question_id
      const answerIds = new Set(
        appAnswers
          .filter((a) => a.scope.question_occurrence_id === occ)
          .map((a) => a.id),
      )
      const vs = versions
        .filter((v) => answerIds.has(v.answer_id))
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
        .map((v) => ({
          id: v.id,
          title: v.title,
          created_at: v.created_at,
          decision: latestDecision.get(v.id) ?? null,
          method: v.method,
        }))
      // IR-030: never auto-prefer a version that can't freeze — only
      // human-approved, non-restored versions qualify.
      const preferred =
        [...vs].reverse().find((v) => v.decision === 'approved') ?? null
      return {
        occurrenceId: occ,
        text: q.asked_as ?? occ,
        required: Boolean(q.is_required),
        versions: vs,
        selected: preferred?.id ?? '',
        skipReason: '',
      }
    })
    setRows(next)

    const existing = await listPackets(storage, programId)
    const withState = await Promise.all(
      existing.map(async (p) => ({
        ...p,
        state: (await getPacketState(storage, p.id))?.state,
      })),
    )
    setPackets(withState)
  }, [programId, questions])

  useEffect(() => {
    if (vault.status !== 'unlocked') return
    ;(async () => {
      try {
        await loadRows(await vault.ensureStorage())
      } catch {
        setError('Could not read vault')
      }
    })()
  }, [vault.status, vault, loadRows])

  const coverage = useMemo(() => {
    const covered = rows.filter((r) => r.selected || r.skipReason.trim()).length
    const approved = rows.filter(
      (r) => r.selected && r.versions.find((v) => v.id === r.selected)?.decision === 'approved',
    ).length
    return { covered, approved, total: rows.length }
  }, [rows])

  async function handleFreeze() {
    const secret = vault.getSecret()
    if (!secret) { setError('Vault is locked — unlock to freeze a packet.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const storage = await vault.ensureStorage()
      const selections = rows
        .filter((r) => r.versions.length > 0 || r.skipReason.trim())
        .map((r) => ({
          question_occurrence_id: r.occurrenceId,
          version_id: r.selected || null,
          skip_reason: r.selected ? null : r.skipReason.trim() || null,
          question_text_snapshot: r.text,
        }))
      const { packet, record } = await freezeApplicationPacket(storage, secret, {
        application_id: programId,
        selections,
      })
      setFrozenId(record.id)
      setManifestSha(record.manifest_sha256)
      setPacketState(await getPacketState(storage, record.id))
      setNotice(`Packet frozen: ${packet.packet_id} · manifest sha256 ${record.manifest_sha256.slice(0, 16)}…`)
      await loadRows(storage)
    } catch (e) {
      if (e instanceof PacketFreezeError) setError(e.reasons.join('\n'))
      else setError(e instanceof Error ? e.message : 'Freeze failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleSign() {
    if (!frozenId || !manifestSha) return
    setBusy(true); setError(''); setVerifyResult('')
    try {
      const storage = await vault.ensureStorage()
      const kp = await generateSignerKeyPair()
      // IR-016: signer class reflects the ACTUAL session — an anonymous
      // vault must not claim authenticated-account backing.
      const { createClient } = await import('@/lib/supabase/client')
      // getUser() validates server-side — getSession() can return a
      // cached-but-revoked session claiming 'authenticated-account'.
      const { data: { user } } = await createClient().auth.getUser()
      await attestPacket(storage, {
        packet_id: frozenId,
        signer_class: user ? 'authenticated-account' : 'local-only',
        user_ack: ack === true,
        privateKey: kp.privateKey,
        pubkey_b64: kp.pubkey_b64,
        manifest_sha256: manifestSha,
      })
      setPacketState(await getPacketState(storage, frozenId))
      const pkt = await storage.get<{ signature_b64: string | null; pubkey_b64: string | null }>(
        'signoffs', frozenId)
      if (pkt?.signature_b64 && pkt.pubkey_b64) {
        const ok = await verifyManifestSignature(pkt.pubkey_b64, manifestSha, pkt.signature_b64)
        setVerifyResult(ok ? 'Signature verified against the manifest digest.' : 'Signature present but verification failed.')
      } else {
        setVerifyResult('Recorded as honest unsigned sign-off.')
      }
      setNotice('Packet signed.')
      await loadRows(storage)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-off failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleExport() {
    if (!frozenId) return
    setBusy(true); setError('')
    try {
      const storage = await vault.ensureStorage()
      const secret = vault.getSecret()
      const doc = await exportPacket(storage, frozenId, secret)
      const blob = new Blob([doc], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${programName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-packet-${frozenId}.json`
      a.click()
      URL.revokeObjectURL(url)
      setPacketState(await getPacketState(storage, frozenId))
      setNotice('Packet exported — this file was written locally; nothing was submitted anywhere.')
      await loadRows(storage)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleDiscard() {
    if (!frozenId) return
    try {
      const storage = await vault.ensureStorage()
      // IR-011: discarding is NOT an export — never write a false export.
      await advancePacketState(storage, frozenId, 'discarded')
    } catch { /* state-only best effort */ }
    setFrozenId(null); setManifestSha(null); setPacketState(null); setAck(false); setVerifyResult('')
  }

  if (vault.status !== 'unlocked') {
    return (
      <div className="rounded-lg border border-warning-500/30 bg-warning-50/40 p-4 text-sm text-warning-700 dark:border-warning-800/40 dark:bg-warning-950/20 dark:text-warning-300">
        Unlock your local vault to build the application packet — packet contents never leave this device.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Application packet — built on this device
        </h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Select the approved vault version for each question, freeze the packet, sign it, and
          export it locally. Nothing is submitted externally — the packet state machine has no
          submission step.
        </p>
      </div>

      {!frozenId && (
        <>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Coverage: {coverage.covered}/{coverage.total} questions addressed ·{' '}
            {coverage.approved} approved selections
          </p>
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div
                key={r.occurrenceId}
                className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
              >
                <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                  {i + 1}. {r.text}
                  {r.required && <span className="ml-1 text-danger-500">*</span>}
                </p>
                {r.versions.length === 0 ? (
                  <div className="mt-2">
                    <input
                      value={r.skipReason}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x) =>
                            x.occurrenceId === r.occurrenceId
                              ? { ...x, skipReason: e.target.value }
                              : x,
                          ),
                        )
                      }
                      placeholder="No vault answer for this question — explain the skip (required)"
                      className="input w-full text-xs"
                    />
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={r.selected}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x) =>
                            x.occurrenceId === r.occurrenceId
                              ? { ...x, selected: e.target.value }
                              : x,
                          ),
                        )
                      }
                      className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                    >
                      <option value="" disabled>— choose a version —</option>
                      {r.versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.title || 'untitled'} · {v.method} ·{' '}
                          {v.decision === 'agent' ? 'agent-reviewed' : v.decision === 'restored' ? 'restored' : (v.decision ?? 'unapproved')} · {v.created_at.slice(0, 10)}
                        </option>
                      ))}
                    </select>
                    {r.versions.find((v) => v.id === r.selected)?.decision !== 'approved' && (
                      <span className="shrink-0 text-[10px] text-warning-600 dark:text-warning-400">
                        not approved — freeze will refuse
                      </span>
                    )}
                  </div>
                )}
                {r.versions.length > 0 && r.selected === '' && (
                  <input
                    value={r.skipReason}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x) =>
                          x.occurrenceId === r.occurrenceId
                            ? { ...x, skipReason: e.target.value }
                            : x,
                        ),
                      )
                    }
                    placeholder="Skipping this question — explain why (required if no version selected)"
                    className="input mt-2 w-full text-xs"
                  />
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => void handleFreeze()}
            disabled={busy || rows.length === 0}
            className="btn-primary px-4 py-2 text-xs disabled:opacity-50"
          >
            {busy ? 'Freezing…' : 'Freeze packet'}
          </button>
        </>
      )}

      {frozenId && packetState && (
        <div className="space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Packet {frozenId} — <span className="uppercase">{packetState.state}</span>
          </p>
          <p className="break-all font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
            manifest sha256: {manifestSha}
          </p>

          {packetState.state === 'prepared' && (
            <label className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-400">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-neutral-300 dark:border-neutral-600"
              />
              I have reviewed the selected versions and sign off on this packet. The signature is
              generated and stored on this device.
            </label>
          )}

          {verifyResult && (
            <p className="text-xs text-success-700 dark:text-success-400">{verifyResult}</p>
          )}

          <div className="flex items-center gap-2">
            {packetState.state === 'prepared' && (
              <button
                onClick={() => void handleSign()}
                disabled={busy || !ack}
                className="btn-primary px-4 py-2 text-xs disabled:opacity-50"
              >
                {busy ? 'Signing…' : 'Sign packet'}
              </button>
            )}
            {(packetState.state === 'prepared' || packetState.state === 'signed') && (
              <button
                onClick={() => void handleExport()}
                disabled={busy}
                className="btn-secondary px-4 py-2 text-xs"
              >
                {busy ? 'Exporting…' : 'Export packet (local file)'}
              </button>
            )}
            <button
              onClick={() => void handleDiscard()}
              className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {error && (
        <pre className="whitespace-pre-wrap rounded-lg border border-danger-500/20 bg-danger-50/10 p-3 text-xs text-danger-600 dark:text-danger-400">
          {error}
        </pre>
      )}
      {notice && (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
          {notice}
        </p>
      )}

      {packets.length > 0 && (
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          <p className="font-medium text-neutral-700 dark:text-neutral-300">Packet history</p>
          <ul className="mt-1 space-y-1">
            {packets.map((p) => (
              <li key={p.id}>
                <code>{p.id}</code> · frozen {p.frozen_at.slice(0, 16)} · state {p.state}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
