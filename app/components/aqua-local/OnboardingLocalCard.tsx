'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ONBOARDING_APPLICATION_ID } from '@/app/(app)/aqua-local/vault-session'
import type { BankEntry } from '@/app/(app)/aqua-local/vault-session'

// LF-12 local onboarding. In local-first mode there is no server
// profile_answers row — onboarding answers are written straight into the
// vault under the reserved `local-onboarding` application scope. This card
// renders the real flow: three prompts, each persisted as its own answer
// (re-saving a completed prompt creates a new child version).

const PROMPTS = [
  {
    occurrence: 'onboarding:about-you',
    label: 'Tell us about yourself',
    hint: 'Background, current role, what you work on day to day.',
  },
  {
    occurrence: 'onboarding:venture',
    label: 'What are you building?',
    hint: 'Product, stage, traction, and the problem you solve.',
  },
  {
    occurrence: 'onboarding:why-fund-you',
    label: 'Why should a funder choose you?',
    hint: 'Concrete evidence — metrics, team, unfair advantages.',
  },
] as const

export function OnboardingLocalCard({
  bank,
  unlocked,
  onSave,
  saving,
}: {
  bank: BankEntry[]
  unlocked: boolean
  onSave: (input: {
    occurrence: string
    answer_id: string | null
    parent_version_id: string | null
    title: string
    body: string
  }) => void
  saving: boolean
}) {
  const [openPrompt, setOpenPrompt] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const doneByOccurrence = new Map<string, BankEntry>()
  for (const entry of bank) {
    if (entry.answer.scope.application_id === ONBOARDING_APPLICATION_ID) {
      doneByOccurrence.set(entry.answer.scope.question_occurrence_id, entry)
    }
  }
  const doneCount = PROMPTS.filter((p) => doneByOccurrence.has(p.occurrence)).length

  const start = (occurrence: string) => {
    setOpenPrompt(occurrence)
    // Saved bodies are encrypted; to revise the actual prior text the user
    // edits via the Answer Bank (which decrypts on demand). A fresh draft
    // here still chains correctly as a child version on save.
    setDraft('')
  }

  return (
    <section className="mt-6 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Local onboarding</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {doneCount}/{PROMPTS.length} complete — in local-first mode these answers are stored
            only in your vault on this device. Nothing here is uploaded or used to fill a
            server profile.
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium',
            doneCount === PROMPTS.length
              ? 'border-success-300 text-success-700 dark:border-success-800 dark:text-success-400'
              : 'border-neutral-300 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400',
          )}
        >
          {doneCount === PROMPTS.length ? 'Complete' : 'On-device only'}
        </span>
      </div>

      <ul className="mt-4 space-y-2">
        {PROMPTS.map((p) => {
          const existing = doneByOccurrence.get(p.occurrence)
          const open = openPrompt === p.occurrence
          return (
            <li key={p.occurrence} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{p.label}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{p.hint}</p>
                </div>
                {existing ? (
                  <span className="shrink-0 text-xs text-success-600 dark:text-success-400">
                    Saved · {existing.versions.length} version{existing.versions.length === 1 ? '' : 's'}
                  </span>
                ) : (
                  <button
                    onClick={() => start(p.occurrence)}
                    disabled={!unlocked}
                    className="btn-secondary shrink-0 px-3 py-1 text-xs"
                  >
                    Answer
                  </button>
                )}
                {existing && !open && (
                  <button
                    onClick={() => start(p.occurrence)}
                    disabled={!unlocked}
                    className="btn-secondary shrink-0 px-3 py-1 text-xs"
                  >
                    Update
                  </button>
                )}
              </div>
              {open && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={4}
                    placeholder="Your answer — encrypted and stored on this device only."
                    className="w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setOpenPrompt(null); setDraft('') }} className="btn-secondary px-3 py-1 text-xs">
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const latest = existing?.versions.at(-1)
                        onSave({
                          occurrence: p.occurrence,
                          answer_id: existing?.answer.id ?? null,
                          parent_version_id: latest?.record.id ?? null,
                          title: p.label,
                          body: draft,
                        })
                        setOpenPrompt(null)
                        setDraft('')
                      }}
                      disabled={saving || !draft.trim()}
                      className={cn('btn-primary px-3 py-1 text-xs', (saving || !draft.trim()) && 'opacity-60')}
                    >
                      {saving ? 'Saving…' : existing ? 'Save new version' : 'Save to vault'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {!unlocked && (
        <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
          Unlock the vault above to fill these in.
        </p>
      )}
    </section>
  )
}
