'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  id: string
  canRecheck: boolean
  steps: string[]
  canPublish: boolean
  reuse: string
  verificationStatus: string
  robotsDisallow: boolean | null
}

const STEP_LABEL: Record<string, string> = {
  matched: 'Mark matched',
  verified: 'Mark verified',
  approved: 'Approve',
  rejected: 'Reject',
}

export function CandidateActions({ id, canRecheck, steps, canPublish, reuse, verificationStatus, robotsDisallow }: Props) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [override, setOverride] = useState(false)
  const [srcReuse, setSrcReuse] = useState(reuse)
  const [srcStatus, setSrcStatus] = useState(verificationStatus)
  const [robots, setRobots] = useState<string>(robotsDisallow === null ? 'unknown' : robotsDisallow ? 'yes' : 'no')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  async function call(path: string, body?: unknown) {
    setMessage(null)
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const failing = Array.isArray(data.failing) && data.failing.length ? ` (${data.failing.join(', ')})` : ''
      const errs = Array.isArray(data.errors) && data.errors.length ? ` — ${data.errors.map((e: { path: string; code: string }) => `${e.path}: ${e.code}`).join('; ')}` : ''
      setMessage({ kind: 'error', text: `${data.error ?? `HTTP ${res.status}`}${failing}${errs}` })
      return
    }
    setMessage({
      kind: 'ok',
      text: data.published
        ? `Published ${data.published.program_slug} (revision ${data.published.revision})`
        : data.last_check
          ? `Source re-checked: ${data.source?.verification_status}${data.last_check.changed ? ' (content changed)' : ''}`
          : `Now ${data.candidate?.state}${data.self_approved ? ' (self-approved, recorded)' : ''}`,
    })
    startTransition(() => router.refresh())
  }

  function transition(to: string) {
    const sourceReview: Record<string, unknown> = {}
    if (srcReuse !== reuse) sourceReview.reuse = srcReuse
    if (srcStatus !== verificationStatus) sourceReview.verification_status = srcStatus
    const robotsValue = robots === 'unknown' ? null : robots === 'yes'
    if (robotsValue !== robotsDisallow) sourceReview.robots_disallow = robotsValue
    return call(`/api/catalog/candidates/${id}/transition`, {
      to,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(to === 'verified' && override ? { override: true } : {}),
      ...(Object.keys(sourceReview).length ? { source_review: sourceReview } : {}),
    })
  }

  if (!steps.length && !canPublish && !canRecheck) return null

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
      {steps.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="text-xs text-neutral-600 dark:text-neutral-400">
            Source reuse
            <select value={srcReuse} onChange={(e) => setSrcReuse(e.target.value)} className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950">
              <option value="unknown">unknown</option>
              <option value="allowed">allowed</option>
              <option value="disallowed">disallowed</option>
            </select>
          </label>
          <label className="text-xs text-neutral-600 dark:text-neutral-400">
            Robots / terms disallow
            <select value={robots} onChange={(e) => setRobots(e.target.value)} className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950">
              <option value="unknown">unknown</option>
              <option value="no">no</option>
              <option value="yes">yes</option>
            </select>
          </label>
          <label className="text-xs text-neutral-600 dark:text-neutral-400">
            Source verification
            <select value={srcStatus} onChange={(e) => setSrcStatus(e.target.value)} className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950">
              <option value="unverified">unverified</option>
              <option value="verified">verified</option>
              <option value="stale">stale</option>
              <option value="failed">failed</option>
            </select>
          </label>
        </div>
      )}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={4000}
        rows={2}
        placeholder="Review note (required to reject; at least 10 characters for an override)"
        className="block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
      />
      {steps.includes('verified') && (
        <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
          <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
          Override failing checks (records the note as the justification)
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {steps.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            onClick={() => transition(s)}
            className={
              s === 'rejected'
                ? 'rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950'
                : 'rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-white disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800'
            }
          >
            {STEP_LABEL[s] ?? s}
          </button>
        ))}
        {canRecheck && (
          <button
            type="button"
            disabled={pending}
            onClick={() => call(`/api/catalog/candidates/${id}/recheck-source`)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-white disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Re-check source
          </button>
        )}
        {canPublish && (
          <button
            type="button"
            disabled={pending}
            onClick={() => call(`/api/catalog/candidates/${id}/publish`)}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Publish to catalog
          </button>
        )}
      </div>
      {message && (
        <p role="status" className={message.kind === 'ok' ? 'text-xs text-green-700 dark:text-green-400' : 'text-xs text-red-700 dark:text-red-400'}>
          {message.text}
        </p>
      )}
    </div>
  )
}
