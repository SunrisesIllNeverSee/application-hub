'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { BankEntry, BankVersion } from '@/app/(app)/aqua-local/vault-session'
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

function ApprovalBadge({ approval }: { approval: BankVersion['approval'] }) {
  if (approval === 'approved') {
    return (
      <span className="inline-block rounded-full border border-success-300 px-2 py-0.5 text-[10px] font-medium text-success-700 dark:border-success-800 dark:text-success-400">
        Approved
      </span>
    )
  }
  if (approval === 'rejected') {
    return (
      <span className="inline-block rounded-full border border-danger-500/30 px-2 py-0.5 text-[10px] font-medium text-danger-600 dark:text-danger-400">
        Rejected
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
    s.application_id === 'local-onboarding' ? 'Local onboarding' : s.application_id
  return `${app} · ${s.question_occurrence_id}`
}

export function AnswerBankList({
  bank,
  onEdit,
  onApprove,
  approvingId,
}: {
  bank: BankEntry[]
  /** Decrypt + open editor parented at this version. */
  onEdit: (entry: BankEntry, version: BankVersion) => void
  onApprove: (versionId: string, decision: 'approved' | 'rejected') => void
  approvingId: string | null
}) {
  const [openId, setOpenId] = useState<string | null>(null)

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
                  {latest?.record.title || 'Untitled answer'}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {scopeLabel(entry)} · {entry.versions.length} version
                  {entry.versions.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {latest && <ApprovalBadge approval={latest.approval} />}
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

            {open && (
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
                        <ApprovalBadge approval={bv.approval} />
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
                        {bv.approval !== 'approved' && (
                          <button
                            onClick={() => onApprove(v.id, 'approved')}
                            disabled={approvingId === v.id}
                            className="btn-secondary px-3 py-1 text-xs text-success-700 dark:text-success-400"
                          >
                            {approvingId === v.id ? 'Approving…' : 'Approve'}
                          </button>
                        )}
                      </div>
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
