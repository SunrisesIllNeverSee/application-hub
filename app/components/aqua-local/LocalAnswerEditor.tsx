'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { countWords } from '@/lib/utils'
import { WordCount } from '../WordCount'
import type { SaveVersionInput } from '@/app/(app)/aqua-local/vault-session'
import type { VersionRecord } from '@/lib/aqua-local'

// LF-11 local answer editor. Every save writes a NEW immutable version into
// the vault (parent-linked when editing). Editing an approved version yields
// a child version — the approval stays bound to the old sha256. Blank bodies
// are refused by the repo layer and surfaced here honestly.

export interface EditTarget {
  /** null → create a new answer (scope inputs shown). */
  answer_id: string | null
  parent_version_id: string | null
  parentWasApproved: boolean
  scope?: { application_id: string; question_occurrence_id: string }
  title: string
  body: string
}

export function LocalAnswerEditor({
  target,
  saving,
  error,
  lastSaved,
  onSave,
  onCancel,
}: {
  target: EditTarget
  saving: boolean
  error: string
  lastSaved: VersionRecord | null
  onSave: (input: SaveVersionInput) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(target.title)
  const [body, setBody] = useState(target.body)
  const [applicationId, setApplicationId] = useState(
    target.scope?.application_id ?? '',
  )
  const [occurrenceId, setOccurrenceId] = useState(
    target.scope?.question_occurrence_id ?? '',
  )

  useEffect(() => {
    setTitle(target.title)
    setBody(target.body)
    setApplicationId(target.scope?.application_id ?? '')
    setOccurrenceId(target.scope?.question_occurrence_id ?? '')
  }, [target])

  const isNew = target.answer_id === null
  const scopeMissing = isNew && (!applicationId.trim() || !occurrenceId.trim())

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {isNew ? 'New answer' : target.parent_version_id ? 'Edit — saves as new child version' : 'Edit answer'}
        </h3>
        {target.parentWasApproved && (
          <span className="rounded-full border border-amber-300 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-700 dark:text-amber-400">
            Parent approved — approval stays on the old sha
          </span>
        )}
      </div>

      {isNew && (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            placeholder="application_id (e.g. local-onboarding)"
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <input
            placeholder="question_occurrence_id"
            value={occurrenceId}
            onChange={(e) => setOccurrenceId(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>
      )}

      <input
        placeholder="Answer title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      />

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your answer here. It is encrypted locally before it is saved — it never leaves this device."
        rows={7}
        className="w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      />

      <WordCount current={countWords(body)} />

      {error && (
        <p className="rounded-lg border border-danger-500/20 bg-danger-50/10 px-3 py-2 text-xs text-danger-600 dark:text-danger-400">
          {error}
        </p>
      )}
      {lastSaved && (
        <p className="rounded-lg border border-success-300 bg-success-50/40 px-3 py-2 text-xs text-success-700 dark:border-success-800 dark:bg-success-950/20 dark:text-success-400">
          Saved immutable version <code>{lastSaved.id.slice(0, 8)}…</code> · sha256{' '}
          <code className="break-all">{lastSaved.sha256}</code>
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="btn-secondary px-3 py-1.5 text-xs">
          Cancel
        </button>
        <button
          onClick={() =>
            onSave({
              answer_id: target.answer_id,
              scope:
                isNew
                  ? { application_id: applicationId.trim(), question_occurrence_id: occurrenceId.trim() }
                  : target.scope,
              parent_version_id: target.parent_version_id,
              title: title.trim(),
              body,
              method: 'manual',
            })
          }
          disabled={saving || !body.trim() || scopeMissing}
          className={cn('btn-primary px-4 py-1.5 text-xs', (saving || !body.trim() || scopeMissing) && 'opacity-60')}
        >
          {saving ? 'Encrypting & saving…' : 'Save as new version'}
        </button>
      </div>
    </div>
  )
}
