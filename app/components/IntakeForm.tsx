'use client'

import { useState } from 'react'
import Link from 'next/link'

// The pound-out loop in one card:
//   paste the application form → source archived, program indexed, questions
//   indexed + embedded, application opened → bank fill runs automatically →
//   review in the workspace.
//
// POST /api/applications/intake  then  POST /api/applications/[id]/fill

type IntakeResult = {
  program_id: string
  program_slug: string
  program_was_new: boolean
  application_id: string | null
  question_count: number
  new_questions: number
  reused_questions: number
  extraction: 'ai' | 'regex'
  workspace_url: string
}

type FillResult = {
  total: number
  direct: number
  borrowed_written: number
  gaps: string[]
  coverage_pct: number
}

export function IntakeForm() {
  const [open, setOpen] = useState(false)
  const [programName, setProgramName] = useState('')
  const [programUrl, setProgramUrl] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [intake, setIntake] = useState<IntakeResult | null>(null)
  const [fill, setFill] = useState<FillResult | null>(null)

  async function handleSubmit() {
    setBusy(true)
    setError(null)
    setIntake(null)
    setFill(null)

    try {
      const intakeRes = await fetch('/api/applications/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_name: programName,
          program_url: programUrl || undefined,
          text,
        }),
      })
      const intakeData = await intakeRes.json()
      if (!intakeRes.ok) {
        setError(intakeData.error ?? 'Intake failed')
        return
      }
      setIntake(intakeData)

      if (intakeData.application_id) {
        const fillRes = await fetch(`/api/applications/${intakeData.application_id}/fill`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (fillRes.ok) setFill(await fillRes.json())
      }
    } catch {
      setError('Network error — try again')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="card w-full p-4 mb-6 text-left hover:shadow-card-hover transition-shadow border-dashed"
      >
        <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
          + New application
        </span>
        <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
          Paste the form — questions get indexed, your bank fills it
        </span>
      </button>
    )
  }

  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">New application intake</h2>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          Close
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 mb-3">
        <input
          value={programName}
          onChange={(e) => setProgramName(e.target.value)}
          placeholder="Program name (e.g. Hannah Grey)"
          className="input text-sm"
          disabled={busy}
        />
        <input
          value={programUrl}
          onChange={(e) => setProgramUrl(e.target.value)}
          placeholder="Application URL (optional)"
          className="input text-sm"
          disabled={busy}
        />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the full application form or question list here…"
        rows={8}
        className="input w-full text-sm font-mono mb-3"
        disabled={busy}
      />

      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={busy || programName.trim().length < 2 || text.length < 50}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Index + fill from bank'}
        </button>
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
          Source archived · program indexed · questions embedded · bank fill
        </span>
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger-600 dark:text-danger-400">{error}</p>
      )}

      {intake && (
        <div className="mt-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 p-4 text-sm">
          <p className="text-neutral-700 dark:text-neutral-300">
            <strong>{intake.program_slug}</strong> — {intake.question_count} questions indexed
            ({intake.new_questions} new to the archive, {intake.reused_questions} matched existing)
            · extracted by {intake.extraction === 'ai' ? 'AI' : 'structure parser'}
          </p>
          {fill && (
            <p className="mt-1.5 text-neutral-700 dark:text-neutral-300">
              Bank fill: <strong>{fill.coverage_pct}% covered</strong> — {fill.direct} direct
              answer{fill.direct === 1 ? '' : 's'}, {fill.borrowed_written} borrowed as drafts
              {fill.gaps.length > 0 && `, ${fill.gaps.length} to work through`}
            </p>
          )}
          <Link
            href={intake.workspace_url}
            className="mt-3 inline-block btn-primary text-sm"
          >
            Open in workspace →
          </Link>
        </div>
      )}
    </div>
  )
}
