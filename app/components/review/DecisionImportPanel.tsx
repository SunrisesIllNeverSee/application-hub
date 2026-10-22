'use client'

// M09 W5 — "Import decisions". Parses a decision file exported from the
// offline review HTML, matches every decision to the CURRENT stored version
// by id + sha256 (stale ones are listed and never applied), shows the plan,
// and writes ONLY after the user confirms in-app:
//   approve          → approveAsHuman(..., via: 'decision_file')
//   needs_revision / needs_evidence → recordReview (human)
//   comment          → addVersionComment(..., via: 'decision_file')
// Nothing is ever applied automatically.
//
// M09 hardening M2: approve / needs_revision rows start UNTICKED; each
// approve row shows a locally decrypted excerpt of the exact answer plus its
// full sha256. A file whose export nonce this vault did not issue is a
// "foreign file": nothing is preselected and applying needs an extra
// explicit confirmation.

import { useEffect, useRef, useState } from 'react'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import { currentResolvedUid } from '@/lib/aqua-local-client/session'
import { LOCAL_ACTOR_ID, type InstanceQuestionRow } from '@/lib/aqua-local-client/review'
import { parseDecisionFile, planDecisionImport, type ImportPlan, type PlanItem } from '@/lib/review-ui/decision-file'
import { applyDecisionPlan, currentStates, decisionFileOrigin, readDecisionExcerpts, type ApplyResult } from '@/lib/review-ui/load'
import { Notice, Pill } from './ui'
import type { Tone } from '@/lib/review-ui/view-model'

const DECISION_LABEL: Record<string, string> = {
  approve: 'Approve',
  needs_revision: 'Needs revision',
  needs_evidence: 'Needs evidence',
  comment: 'Comment only',
}

function statusTone(i: PlanItem): Tone {
  if (i.status === 'ready') return 'success'
  if (i.status === 'already_approved') return 'neutral'
  return 'warning'
}

export function DecisionImportPanel({
  instanceId,
  rows,
  onClose,
  onApplied,
}: {
  instanceId: string
  rows: InstanceQuestionRow[]
  onClose: () => void
  onApplied: () => Promise<void> | void
}) {
  const vault = useVault()
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<ApplyResult[] | null>(null)
  const [foreignAck, setForeignAck] = useState(false)
  const [excerpts, setExcerpts] = useState<Map<string, string | null>>(new Map())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input,button')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const qIndex = new Map(rows.map((r, i) => [r.question_occurrence_id, { n: i + 1, text: r.text }]))

  async function onFile(f: File | null) {
    setErrors([])
    setWarnings([])
    setPlan(null)
    setResults(null)
    setForeignAck(false)
    setExcerpts(new Map())
    if (!f) return
    const parsed = parseDecisionFile(await f.text())
    if (!parsed.ok) {
      setErrors(parsed.errors)
      return
    }
    setWarnings(parsed.warnings)
    let storage
    try {
      storage = await vault.ensureStorage()
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Vault unavailable'])
      return
    }
    const origin = await decisionFileOrigin(storage, instanceId, parsed.file.export_nonce)
    const p = planDecisionImport(parsed.file, instanceId, currentStates(rows), { origin })
    if (!p.ok) {
      setErrors(p.errors)
      return
    }
    // Decrypt the approve excerpts BEFORE showing the plan, so an approve row
    // is never displayed (or ticked) without the answer it would approve.
    const secret = vault.getSecret()
    if (secret) {
      const ids = p.items.filter((i) => i.entry.decision === 'approve').map((i) => i.entry.version_id)
      setExcerpts(await readDecisionExcerpts(storage, secret, ids))
    }
    setPlan(p)
    // Approve / needs_revision rows and everything in a foreign file start unticked.
    setSelected(new Set(p.items.filter((i) => i.preselected).map((i) => i.entry.version_id)))
  }

  async function apply() {
    if (!plan) return
    const secret = vault.getSecret()
    if (!secret) {
      setErrors(['Vault is locked — unlock to apply decisions.'])
      return
    }
    setBusy(true)
    try {
      const storage = await vault.ensureStorage()
      const r = await applyDecisionPlan(storage, secret, plan, currentResolvedUid() || LOCAL_ACTOR_ID, selected, { foreignConfirmed: foreignAck })
      setResults(r)
      await onApplied()
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Import failed'])
    } finally {
      setBusy(false)
    }
  }

  const chosen = plan ? plan.items.filter((i) => i.applicable && selected.has(i.entry.version_id)) : []
  const foreign = plan?.origin === 'foreign'

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        data-testid="import-dialog"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-neutral-900 sm:rounded-2xl"
      >
        <h2 id="import-title" className="text-base font-semibold text-neutral-900 dark:text-white">
          Import decisions
        </h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Choose a decision file downloaded from an exported review. Nothing is applied until you confirm below. Decisions are matched to the current version by id and sha256; anything that changed since the export is shown as stale and skipped.
        </p>
        <label className="mt-3 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
          Decision file (.json)
          <input type="file" accept="application/json,.json" data-testid="import-file" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs" />
        </label>

        {errors.length > 0 && (
          <div className="mt-3">
            <Notice tone="danger" testId="import-errors">
              <ul className="list-disc pl-4">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </Notice>
          </div>
        )}
        {warnings.length > 0 && <p className="mt-2 text-[11px] text-neutral-500">{warnings.join(' ')}</p>}

        {plan && !results && (
          <div className="mt-4 space-y-2">
            {foreign && (
              <Notice tone="warning" testId="import-foreign">
                <p className="font-semibold">Foreign file — this decision file was not exported by this vault.</p>
                <p className="mt-1">
                  It has no export code this vault issued for this application, so it may have been made elsewhere or by someone else. Nothing is preselected. Read every decision before ticking it.
                </p>
                <label className="mt-2 flex items-start gap-2">
                  <input type="checkbox" data-testid="import-foreign-ack" className="mt-0.5 h-4 w-4" checked={foreignAck} onChange={(e) => setForeignAck(e.target.checked)} />
                  <span>I checked this file and want to import decisions from it anyway.</span>
                </label>
              </Notice>
            )}
            <p className="text-sm text-neutral-800 dark:text-neutral-200" data-testid="import-summary">
              {plan.items.length} decision{plan.items.length === 1 ? '' : 's'} in file · {plan.applicable} can be applied · {plan.stale} stale (will not be applied)
            </p>
            <ul className="space-y-2" data-testid="import-plan">
              {plan.items.map((i) => {
                const q = qIndex.get(i.entry.question_occurrence_id)
                return (
                  <li key={i.entry.version_id} className="rounded-lg border border-neutral-200 p-2.5 dark:border-neutral-800" data-status={i.status}>
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        disabled={!i.applicable}
                        checked={i.applicable && selected.has(i.entry.version_id)}
                        onChange={(e) => {
                          const next = new Set(selected)
                          if (e.target.checked) next.add(i.entry.version_id)
                          else next.delete(i.entry.version_id)
                          setSelected(next)
                        }}
                        aria-label={`Apply decision for question ${q?.n ?? '?'}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200">Q{q?.n ?? '?'}</span>
                          <Pill tone="info">{DECISION_LABEL[i.entry.decision]}</Pill>
                          <Pill tone={statusTone(i)}>{i.status.replace(/_/g, ' ')}</Pill>
                          <span className="text-neutral-500">
                            {i.version_number ? `v${i.version_number}` : 'unknown version'}
                            {i.entry.decision === 'approve' ? '' : ` · sha256 ${i.entry.version_sha256.slice(0, 12)}…`}
                          </span>
                        </span>
                        {q?.text && <span className="mt-0.5 block truncate text-xs text-neutral-600 dark:text-neutral-400">{q.text}</span>}
                        {i.entry.decision === 'approve' && (
                          <span className="mt-1 block rounded border border-neutral-200 bg-neutral-50 p-2 text-xs dark:border-neutral-800 dark:bg-neutral-950" data-testid="import-approve-detail">
                            <span className="block font-medium text-neutral-700 dark:text-neutral-300">You would approve exactly this answer:</span>
                            <span className="mt-0.5 block whitespace-pre-wrap text-neutral-800 dark:text-neutral-200" data-testid="import-excerpt">
                              {excerpts.has(i.entry.version_id)
                                ? excerpts.get(i.entry.version_id) ?? '(this version could not be decrypted on this device)'
                                : '(unlock the vault to see the answer)'}
                            </span>
                            <span className="mt-1 block break-all font-mono text-[11px] text-neutral-500" data-testid="import-full-hash">sha256 {i.entry.version_sha256}</span>
                          </span>
                        )}
                        {i.entry.comment && (
                          <span className="mt-0.5 block text-xs italic text-neutral-700 dark:text-neutral-300">
                            <span className="not-italic text-neutral-500">Imported comment: </span>“{i.entry.comment}”
                          </span>
                        )}
                        <span className="mt-0.5 block text-[11px] text-neutral-500">{i.message}</span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {results && (
          <div className="mt-4 space-y-2" data-testid="import-results">
            <Notice tone={results.every((r) => r.ok) ? 'success' : 'warning'}>
              Applied {results.filter((r) => r.ok).length} of {results.length} confirmed decision{results.length === 1 ? '' : 's'}
              {results.some((r) => !r.ok) ? ' — the rest were refused by the vault (shown below).' : '.'}
            </Notice>
            <ul className="space-y-1 text-xs">
              {results.map((r) => (
                <li key={r.item.entry.version_id} className={r.ok ? 'text-neutral-700 dark:text-neutral-300' : 'text-danger-600'}>
                  Q{qIndex.get(r.item.entry.question_occurrence_id)?.n ?? '?'} · {DECISION_LABEL[r.item.entry.decision]} ·{' '}
                  {r.ok ? `wrote ${r.wrote.join(' + ') || 'nothing'}` : `refused: ${r.error}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary px-3 py-1.5 text-xs">
            {results ? 'Close' : 'Cancel'}
          </button>
          {plan && !results && (
            <button type="button" data-testid="import-confirm" disabled={busy || chosen.length === 0 || (foreign && !foreignAck)} onClick={() => void apply()} className="btn-primary px-3 py-1.5 text-xs">
              {busy ? 'Applying…' : `Confirm and apply ${chosen.length} decision${chosen.length === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
