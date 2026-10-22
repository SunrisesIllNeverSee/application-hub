'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { BankEntry, BankVersion } from '@/lib/aqua-local-client/session'
import type { VersionMethod } from '@/lib/aqua-local'

// LF-10 Answer Bank: local answers with immutable versions, approval state,
// and provenance badges. Bodies stay encrypted until the user picks one to
// view/edit (decrypt-after-unlock UX handled by the parent via onEdit/onView).

const METHOD_BADGE: Record<VersionMethod, { label: string; className: string }> = {
  manual: { label: 'Manual', className: 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400' },
  byok: { label: 'AI · your key', className: 'border-brand-300 text-brand-600 dark:border-brand-700 dark:text-brand-400' },
  app_provider: { label: 'AI · hosted', className: 'border-brand-300 text-brand-600 dark:border-brand-700 dark:text-brand-400' },
  imported: { label: 'Imported', className: 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400' },
}

function MethodBadge({ method, provider, model }: { method: VersionMethod; provider?: string | null; model?: string | null }) {
  const b = METHOD_BADGE[method]
  return (
    <span
      title={provider || model ? `${provider ?? ''}${provider && model ? ' / ' : ''}${model ?? ''}` : undefined}
      className={cn('inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium', b.className)}
    >
      {b.label}
    </span>
  )
}

function ApprovalBadge({ approval, restored, actorClass }: { approval: BankVersion['approval']; restored?: boolean; actorClass?: string }) {
  // IR-019: a backup-restored decision is honest provenance — it displays
  // but never reads as a live approval; packets require a fresh decision.
  if (restored) {
    return (
      <span className="inline-block rounded-full border border-amber-300 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-700 dark:text-amber-400" title="Restored from a backup — requires a fresh local decision before packet use">
        Restored
      </span>
    )
  }
  if (approval === 'approved') {
    // IR-017: agent-classed decisions are review, not human approval.
    return actorClass === 'human' ? (
      <span className="inline-block rounded-full border border-success-300 px-2 py-0.5 text-[10px] font-medium text-success-700 dark:border-success-800 dark:text-success-400">
        Approved
      </span>
    ) : (
      <span className="inline-block rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:border-neutral-700 dark:text-neutral-400" title="Agent-reviewed — a human approval is required before this version can enter a packet">
        Agent-reviewed
      </span>
    )
  }
  if (approval === 'rejected') {
    return (
      <span
        className="inline-block rounded-full border border-danger-500/30 px-2 py-0.5 text-[10px] font-medium text-danger-600 dark:text-danger-400"
        title={actorClass === 'agent' ? 'Agent-rejected — automated review, not a human decision' : undefined}
      >
        {actorClass === 'agent' ? 'Agent-rejected' : 'Rejected'}
      </span>
    )
  }
  return (
    <span className="inline-block rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:border-neutral-700 dark:text-neutral-500">
      Draft
    </span>
  )
}

function scopeLabel(entry: BankEntry): string {
  const s = entry.answer.scope
  const app =
    s.application_id === 'local-onboarding'
      ? 'Local onboarding'
      : (entry.intake_label ?? s.application_id)
  // Intake-scoped entries carry the extracted question text — the opaque
  // occurrence id alone can't tell the user which question a slot is for.
  const q = entry.question_text
  return q ? `${app} · ${q.length > 80 ? q.slice(0, 80) + '…' : q}` : `${app} · ${s.question_occurrence_id}`
}

export function AnswerBankList({
  bank,
  onEdit,
  onNewVersion,
  onApprove,
  approvingId,
}: {
  bank: BankEntry[]
  /** Decrypt + open editor parented at this version. */
  onEdit: (entry: BankEntry, version: BankVersion) => void
  /** Write the FIRST version on a versionless slot (e.g. an intake
      question waiting to be answered). */
  onNewVersion?: (entry: BankEntry) => void
  /** M09 W5: hash-bound — `sha256` is the hash shown to the user. */
  onApprove: (versionId: string, sha256: string, decision: 'approved' | 'rejected') => void
  approvingId: string | null
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  // Explicit confirm step: the first click shows the exact hash being approved.
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (bank.length === 0) {
    // LF-15 empty state.
    return (
      <div className="mt-3 rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
        Your Answer Bank is empty. Save your first answer below — it will be
        encrypted on this device and never sent to a server.
      </div>
    )
  }

  return (
    <ul className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {bank.map((entry) => {
        const latest = entry.versions.at(-1)
        const open = openId === entry.answer.id
        return (
          <li key={entry.answer.id} className="p-3">
            <button
              className="flex w-full items-start justify-between gap-3 text-left"
              onClick={() => setOpenId(open ? null : entry.answer.id)}
            >
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {latest?.record.title ||
                    (entry.question_text
                      ? `Unwritten — ${entry.question_text.length > 70 ? entry.question_text.slice(0, 70) + '…' : entry.question_text}`
                      : 'Unwritten answer')}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {scopeLabel(entry)} · {entry.versions.length} version
                  {entry.versions.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {latest && <ApprovalBadge approval={latest.approval} restored={latest.restored} actorClass={latest.actor_class} />}
                {latest && (
                  <MethodBadge
                    method={latest.record.method}
                    provider={latest.provenance?.provider}
                    model={latest.provenance?.model}
                  />
                )}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  className={cn('text-neutral-400 transition-transform', open && 'rotate-180')}>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </button>

            {open && entry.versions.length === 0 && (
              <div className="mt-3 rounded-lg border border-dashed border-neutral-300 p-3 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                {entry.question_text ? (
                  <p className="mb-2 text-neutral-700 dark:text-neutral-300">{entry.question_text}</p>
                ) : null}
                No versions yet.
                {onNewVersion && (
                  <button
                    onClick={() => onNewVersion(entry)}
                    className="btn-secondary ml-2 px-3 py-1 text-xs"
                  >
                    Write answer
                  </button>
                )}
              </div>
            )}
            {open && entry.versions.length > 0 && (
              <ul className="mt-3 space-y-2">
                {[...entry.versions].reverse().map((bv, i) => {
                  const v = bv.record
                  const isLatest = i === 0
                  return (
                    <li
                      key={v.id}
                      className="rounded-lg border border-neutral-200 p-3 text-xs dark:border-neutral-800"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-neutral-800 dark:text-neutral-200">
                          v{entry.versions.length - i} · {v.title || 'Untitled'}
                        </span>
                        {isLatest && (
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                            latest
                          </span>
                        )}
                        <ApprovalBadge approval={bv.approval} restored={bv.restored} actorClass={bv.actor_class} />
                        <MethodBadge
                          method={v.method}
                          provider={bv.provenance?.provider}
                          model={bv.provenance?.model}
                        />
                      </div>
                      <p className="mt-1.5 text-neutral-500 dark:text-neutral-400">
                        sha256 <code className="break-all">{v.sha256}</code>
                      </p>
                      <p className="mt-0.5 text-neutral-400 dark:text-neutral-500">
                        {new Date(v.created_at).toLocaleString()}
                        {v.parent_version_id && ' · child version (prior approval stays on parent)'}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => onEdit(entry, bv)}
                          className="btn-secondary px-3 py-1 text-xs"
                        >
                          {bv.approval === 'approved' ? 'Edit (new child version)' : 'Edit'}
                        </button>
                        {(bv.approval !== 'approved' || bv.restored || bv.actor_class !== 'human') && confirmId !== v.id && (
                          <button
                            onClick={() => setConfirmId(v.id)}
                            disabled={approvingId === v.id}
                            className="btn-secondary px-3 py-1 text-xs text-success-700 dark:text-success-400"
                          >
                            {approvingId === v.id ? 'Approving…' : 'Approve'}
                          </button>
                        )}
                      </div>
                      {confirmId === v.id && (
                        <div className="mt-2 space-y-2 rounded-md border border-success-500/40 p-2" role="region" aria-label="Confirm approval">
                          <p className="text-neutral-700 dark:text-neutral-300">
                            Approve v{entry.versions.length - i} exactly as stored? Bound to sha256{' '}
                            <code className="break-all font-semibold">{v.sha256.slice(0, 12)}</code>
                            <code className="break-all">{v.sha256.slice(12)}</code>. A later edit needs a new approval.
                          </p>
                          <div className="flex gap-2">
                            <button onClick={() => setConfirmId(null)} className="btn-secondary px-3 py-1 text-xs">
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                setConfirmId(null)
                                onApprove(v.id, v.sha256, 'approved')
                              }}
                              disabled={approvingId === v.id}
                              className="btn-primary px-3 py-1 text-xs"
                            >
                              Confirm approval · {v.sha256.slice(0, 12)}…
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
