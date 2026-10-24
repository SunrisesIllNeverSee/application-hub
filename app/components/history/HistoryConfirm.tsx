'use client'

// M09b — "Confirm submitted history". After a Restore that brought in
// companion history records (aqua-companion import-history → export-backup),
// the user confirms which answers they actually submitted. Each confirmation
// is a human approval written by the vault (repo.ts recordHistoryAttestation:
// hash-bound, effective_at = submission date, statement encrypted). Nothing
// is preselected; answers with placeholders or an unknown date cannot be
// selected, and the vault refuses placeholders even if the UI were bypassed.
// Records the importer split with LOW confidence carry a warning and stay
// unselectable until the user marks them as checked against what they sent.
// Everything happens on this device; there is no server call here.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import { currentResolvedUid } from '@/lib/aqua-local-client/session'
import { LOCAL_ACTOR_ID } from '@/lib/aqua-local-client/review'
import {
  canConfirm,
  confirmHistorySelection,
  listHistoryCandidates,
  DEFAULT_ATTESTATION_STATEMENT,
  type ConfirmResult,
  type HistoryGroup,
  type HistoryItem,
} from '@/lib/aqua-local/history-review'
import { HISTORY_META_LEGACY_NOTE, LOW_CONFIDENCE_REASON } from '@/lib/aqua-local/history'
import { UnlockPanel } from '@/components/aqua-local/UnlockPanel'
import { Notice } from '@/components/review/ui'

type Load = { kind: 'loading' } | { kind: 'ready'; groups: HistoryGroup[] } | { kind: 'error'; message: string }

function formatDate(d: string | null): string {
  if (!d) return 'Submission date unknown'
  const dt = new Date(`${d.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

export function HistoryConfirm() {
  const vault = useVault()
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [selected, setSelected] = useState<Set<string>>(() => new Set()) // nothing preselected
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set()) // low-confidence items the user checked
  const [statement, setStatement] = useState(DEFAULT_ATTESTATION_STATEMENT)
  const [attested, setAttested] = useState(false)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<ConfirmResult[] | null>(null)

  useEffect(() => {
    if (vault.enabled && vault.status === 'idle') void vault.ensureStorage().catch(() => {})
  }, [vault])

  const refresh = useCallback(async () => {
    const secret = vault.getSecret()
    if (!secret) return
    try {
      const storage = await vault.ensureStorage()
      setLoad({ kind: 'ready', groups: await listHistoryCandidates(storage, secret) })
    } catch (e) {
      setLoad({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }, [vault])

  useEffect(() => {
    if (vault.status === 'unlocked') void refresh()
  }, [vault.status, refresh])

  const items = useMemo(() => (load.kind === 'ready' ? load.groups.flatMap((g) => g.items) : []), [load])
  const byId = useMemo(() => new Map(items.map((i) => [i.version_id, i])), [items])
  const pending = items.filter((i) => i.status === 'pending')
  const selectable = pending.filter((i) => !i.disabled_reason)
  const ready = canConfirm({ selected, attested, statement }) && !busy

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function handleConfirm() {
    const secret = vault.getSecret()
    if (!secret || !ready) return
    setBusy(true)
    setResults(null)
    try {
      const storage = await vault.ensureStorage()
      const chosen = [...selected].map((id) => byId.get(id)).filter((i): i is HistoryItem => Boolean(i))
      const r = await confirmHistorySelection(storage, secret, {
        items: chosen,
        attested,
        statement,
        actor_id: currentResolvedUid() || LOCAL_ACTOR_ID,
      })
      setResults(r)
      setSelected(new Set())
      setAttested(false)
      await refresh()
    } catch (e) {
      setResults([{ version_id: '', ok: false, error: e instanceof Error ? e.message : String(e) }])
    } finally {
      setBusy(false)
    }
  }

  if (!vault.enabled) {
    return (
      <Shell>
        <Notice tone="neutral">The local-first vault is not enabled on this deployment, so there is no submitted history to confirm.</Notice>
      </Shell>
    )
  }
  if (vault.status === 'unsupported') {
    return (
      <Shell>
        <Notice tone="danger">This browser cannot open the local vault (IndexedDB unavailable).</Notice>
      </Shell>
    )
  }
  if (vault.status !== 'unlocked') {
    return (
      <Shell>
        <Intro />
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
          Your history is encrypted on this device. Unlock the vault here, or restore the companion export first on{' '}
          <Link href="/aqua-local" className="text-brand-600 underline underline-offset-2 dark:text-brand-400">AQUA Local</Link>.
        </p>
        <UnlockPanel vaultHasData={vault.vaultHasData} onUnlock={vault.unlock} />
      </Shell>
    )
  }
  if (load.kind === 'loading') {
    return (
      <Shell>
        <Intro />
        <p className="mt-4 text-sm text-neutral-500" role="status">Reading your submitted history…</p>
      </Shell>
    )
  }
  if (load.kind === 'error') {
    return (
      <Shell>
        <Intro />
        <Notice tone="danger">{load.message}</Notice>
      </Shell>
    )
  }

  return (
    <Shell>
      <div data-testid="history-ready" data-items={items.length}>
        <Intro />
        {load.groups.length === 0 ? (
          <div className="mt-6" data-testid="history-empty">
            <Notice tone="neutral">
              No submitted-history records are in this vault. Import past applications with{' '}
              <code className="text-xs">aqua-companion import-history &lt;folder&gt;</code>, export them with{' '}
              <code className="text-xs">aqua-companion export-backup</code>, then use Restore backup on{' '}
              <Link href="/aqua-local" className="underline underline-offset-2">AQUA Local</Link>.
            </Notice>
          </div>
        ) : (
          <>
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300" data-testid="history-summary">
              {pending.length} to review · {selectable.length} can be confirmed · {items.length - pending.length} already confirmed
            </p>
            <div className="mt-5 space-y-5">
              {load.groups.map((g) => (
                <section
                  key={g.key}
                  data-testid="history-group"
                  className="rounded-lg border border-neutral-200 dark:border-neutral-800"
                >
                  <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                    <h2 className="font-medium text-neutral-900 dark:text-neutral-100" data-testid="history-group-program">{g.program}</h2>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400" data-testid="history-group-date">
                      {g.submitted_at ? `Submitted ${formatDate(g.submitted_at)}` : 'Submission date unknown'}
                    </span>
                  </header>
                  <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {g.items.map((it) => {
                      const unreviewed = it.needs_review && !reviewed.has(it.version_id)
                      const disabled = Boolean(it.disabled_reason) || it.status === 'confirmed' || busy || unreviewed
                      const open = expanded.has(it.version_id)
                      return (
                        <li key={it.version_id} className="px-4 py-3" data-testid="history-item" data-version={it.version_id} data-status={it.status} data-confidence={it.parse_confidence ?? undefined}>
                          <label className={`flex gap-3 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 shrink-0"
                              data-testid="history-select"
                              checked={selected.has(it.version_id)}
                              disabled={disabled}
                              onChange={(e) => toggle(it.version_id, e.target.checked)}
                              aria-describedby={it.disabled_reason ? `reason-${it.version_id}` : it.needs_review ? `lowconf-${it.version_id}` : undefined}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-100" data-testid="history-question">{it.question}</span>
                              <span className="mt-1 block whitespace-pre-wrap break-words text-sm text-neutral-600 dark:text-neutral-300" data-testid="history-answer">
                                {open || it.needs_review ? it.body : it.excerpt}
                              </span>
                            </span>
                          </label>
                          {it.needs_review && (
                            <div className="mt-2 ml-7 rounded border border-warning-300 bg-warning-50 px-3 py-2 text-xs text-warning-800 dark:border-warning-700 dark:bg-warning-900/30 dark:text-warning-200" data-testid="history-low-confidence">
                              <p id={`lowconf-${it.version_id}`}>{LOW_CONFIDENCE_REASON}</p>
                              <label className="mt-1.5 flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5"
                                  data-testid="history-review-check"
                                  checked={reviewed.has(it.version_id)}
                                  disabled={busy}
                                  onChange={(e) => {
                                    const on = e.target.checked
                                    setReviewed((p) => { const n = new Set(p); if (on) n.add(it.version_id); else n.delete(it.version_id); return n })
                                    if (!on) toggle(it.version_id, false)
                                  }}
                                />
                                <span>I checked the question and the full answer against what I submitted.</span>
                              </label>
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-7 text-xs">
                            {it.status === 'confirmed' ? (
                              <span className="rounded bg-success-50 px-1.5 py-0.5 text-success-700 dark:bg-success-900/30 dark:text-success-300" data-testid="history-status">
                                Confirmed as submitted{it.confirmed_effective_at ? ` · approved as of ${formatDate(it.confirmed_effective_at)}` : ''}
                              </span>
                            ) : it.disabled_reason ? (
                              <span id={`reason-${it.version_id}`} className="text-warning-700 dark:text-warning-300" data-testid="history-reason">
                                {it.disabled_reason}
                              </span>
                            ) : null}
                            {it.status === 'pending' && it.meta_hash_status === 'legacy' && (
                              <span className="text-neutral-500 dark:text-neutral-400" data-testid="history-legacy-meta">{HISTORY_META_LEGACY_NOTE}</span>
                            )}
                            {it.excerpt.endsWith('…') && (
                              <button type="button" className="text-neutral-500 underline underline-offset-2" onClick={() => setExpanded((p) => { const n = new Set(p); if (open) n.delete(it.version_id); else n.add(it.version_id); return n })}>
                                {open ? 'Show less' : 'Show full answer'}
                              </button>
                            )}
                            <span className="font-mono text-neutral-400" title="sha256 of the exact answer">sha256 {it.sha256.slice(0, 12)}…</span>
                            {it.source_file && <span className="text-neutral-400">from {it.source_file}</span>}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>

            <section className="mt-6 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800" data-testid="attest-panel">
              <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Your attestation</h2>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Confirmed answers count as approved as of their submission date. The statement is stored encrypted with each confirmation.
              </p>
              <label className="mt-3 block text-xs font-medium text-neutral-600 dark:text-neutral-300" htmlFor="attest-statement">Statement</label>
              <textarea
                id="attest-statement"
                data-testid="attest-statement"
                rows={3}
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
              <label className="mt-3 flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-200">
                <input type="checkbox" className="mt-1 h-4 w-4" data-testid="attest-check" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
                <span>I attest that I submitted the selected answers exactly as shown, on the dates listed.</span>
              </label>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  data-testid="confirm-history"
                  disabled={!ready}
                  onClick={() => void handleConfirm()}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? 'Confirming…' : `Confirm selected as submitted${selected.size ? ` (${selected.size})` : ''}`}
                </button>
                <span className="text-xs text-neutral-500 dark:text-neutral-400" data-testid="confirm-hint">
                  {selected.size === 0 ? 'Select the answers you submitted.' : !attested ? 'Tick the attestation to continue.' : !statement.trim() ? 'Write a statement.' : ''}
                </span>
              </div>
              {results && (
                <ul className="mt-4 space-y-1 text-sm" data-testid="history-results">
                  {results.map((r, i) => (
                    <li key={r.version_id || i} data-testid="history-result" data-ok={r.ok ? 'true' : 'false'} className={r.ok ? 'text-success-700 dark:text-success-300' : 'text-danger-600'}>
                      {r.ok
                        ? `Confirmed: ${byId.get(r.version_id)?.question ?? r.version_id}`
                        : `Not confirmed${r.version_id ? ` (${byId.get(r.version_id)?.question ?? r.version_id})` : ''}: ${r.error}`}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </Shell>
  )
}

function Intro() {
  return (
    <>
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-white">Confirm submitted history</h1>
      <p className="mt-1 max-w-3xl text-sm text-neutral-500 dark:text-neutral-400">
        These answers came from applications you imported with the AQUA companion. Tick only the ones you actually submitted.
        Each confirmation is your own approval, bound to the exact text shown, and counts as of the submission date.
      </p>
    </>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-4xl py-2">{children}</div>
}
