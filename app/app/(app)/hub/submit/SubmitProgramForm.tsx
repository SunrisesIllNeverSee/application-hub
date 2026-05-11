'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

const KIND_OPTIONS = [
  { value: 'accelerator', label: 'Accelerator' },
  { value: 'vc', label: 'Venture Capital' },
  { value: 'grant', label: 'Grant' },
  { value: 'fellowship', label: 'Fellowship' },
  { value: 'job_fulltime', label: 'Job — Full-time' },
  { value: 'job_internship', label: 'Job — Internship' },
  { value: 'job_contract', label: 'Job — Contract' },
  { value: 'school_undergrad', label: 'School — Undergraduate' },
  { value: 'school_grad', label: 'School — Graduate' },
  { value: 'school_professional', label: 'School — Professional (MBA / JD / MD)' },
  { value: 'other', label: 'Other' },
] as const

type KindValue = (typeof KIND_OPTIONS)[number]['value']

const KIND_VALUES = new Set<KindValue>(KIND_OPTIONS.map((o) => o.value))

interface NoticeState {
  tone: 'success' | 'info' | 'error'
  message: string
  href?: string
  hrefLabel?: string
}

const NOTES_MAX = 2000

interface SubmitProgramFormProps {
  /** Default kind preselected when the form mounts. Falls back to 'accelerator'. */
  defaultKind?: string
}

export function SubmitProgramForm({ defaultKind }: SubmitProgramFormProps = {}) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [, startTransition] = useTransition()

  const initialKind: KindValue =
    defaultKind && KIND_VALUES.has(defaultKind as KindValue)
      ? (defaultKind as KindValue)
      : 'accelerator'

  const [programUrl, setProgramUrl] = useState('')
  const [kind, setKind] = useState<KindValue>(initialKind)
  const [notes, setNotes] = useState('')
  const [notice, setNotice] = useState<NoticeState | null>(null)

  function isValidHttpUrl(value: string): boolean {
    try {
      const u = new URL(value)
      return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
      return false
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setNotice(null)

    const trimmedUrl = programUrl.trim()
    if (!trimmedUrl) {
      setNotice({ tone: 'error', message: 'Program URL is required.' })
      return
    }
    if (!isValidHttpUrl(trimmedUrl)) {
      setNotice({
        tone: 'error',
        message: 'Please enter a valid http or https URL.',
      })
      return
    }
    if (notes.length > NOTES_MAX) {
      setNotice({
        tone: 'error',
        message: `Notes must be ${NOTES_MAX} characters or fewer.`,
      })
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/import/submit-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_url: trimmedUrl,
          kind,
          notes: notes.trim() ? notes.trim() : undefined,
        }),
      })

      let data: Record<string, unknown> = {}
      try {
        data = await res.json()
      } catch {
        // ignore JSON parse failure; fall through to status-based handling
      }

      if (!res.ok) {
        const message =
          typeof data.error === 'string'
            ? data.error
            : 'Submission failed — please try again.'
        setNotice({ tone: 'error', message })
        return
      }

      const status = typeof data.status === 'string' ? data.status : 'queued'

      if (status === 'already_in_archive') {
        const slug = typeof data.program_slug === 'string' ? data.program_slug : null
        setNotice({
          tone: 'info',
          message: 'Good news — this program is already in the archive.',
          href: slug ? `/hub/${slug}` : undefined,
          hrefLabel: 'View program',
        })
        return
      }

      if (status === 'already_queued') {
        const queueId = typeof data.queue_id === 'string' ? data.queue_id : null
        setNotice({
          tone: 'info',
          message: "This URL has already been submitted. We'll review it soon.",
        })
        if (queueId) {
          startTransition(() => router.refresh())
        }
        return
      }

      const queueId = typeof data.queue_id === 'string' ? data.queue_id : ''
      // Clear form and redirect to ?queued= so the page can show a success banner
      setProgramUrl('')
      setNotes('')
      setKind(initialKind)
      startTransition(() => {
        router.push(`/hub/submit?queued=${encodeURIComponent(queueId)}`)
        router.refresh()
      })
    } catch (err) {
      console.error('[SubmitProgramForm] submit error:', err)
      setNotice({
        tone: 'error',
        message: 'Network error — please try again in a moment.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const noticeClasses =
    notice?.tone === 'error'
      ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-900/50'
      : notice?.tone === 'success'
        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-900/50'
        : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-900/50'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="program_url">
          Program URL
        </label>
        <input
          id="program_url"
          name="program_url"
          type="url"
          required
          value={programUrl}
          onChange={(e) => setProgramUrl(e.target.value)}
          className="input"
          placeholder="https://program.example.com/apply"
          disabled={isSubmitting}
          autoComplete="off"
        />
      </div>

      <div>
        <label className="label" htmlFor="kind">
          Type
        </label>
        <select
          id="kind"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as KindValue)}
          className="input"
          disabled={isSubmitting}
        >
          {KIND_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="notes">
          Notes{' '}
          <span className="font-normal text-neutral-400">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          className="input resize-none"
          placeholder="What questions did they ask? Anything we should know?"
          disabled={isSubmitting}
          maxLength={NOTES_MAX}
        />
        <p
          className={`mt-1 text-xs ${
            notes.length > NOTES_MAX
              ? 'text-red-600 dark:text-red-400'
              : 'text-neutral-400 dark:text-neutral-600'
          }`}
        >
          {notes.length.toLocaleString()} / {NOTES_MAX.toLocaleString()} characters
        </p>
      </div>

      {notice && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${noticeClasses}`}>
          <span>{notice.message}</span>
          {notice.href && notice.hrefLabel && (
            <>
              {' '}
              <a
                href={notice.href}
                className="font-medium underline hover:no-underline"
              >
                {notice.hrefLabel}
              </a>
            </>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !programUrl.trim()}
        className="btn-primary w-full sm:w-auto"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Submitting…
          </span>
        ) : (
          'Submit for review'
        )}
      </button>
    </form>
  )
}
