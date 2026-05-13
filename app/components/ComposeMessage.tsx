'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface ComposeMessageProps {
  toUserId?: string
  submissionId?: string
  parentId?: string
  defaultSubject?: string
  contextLabel?: string
  recipientEmail?: string
  children: ReactNode
}

export function ComposeMessage({
  toUserId,
  submissionId,
  parentId,
  defaultSubject = '',
  contextLabel,
  recipientEmail,
  children,
}: ComposeMessageProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when opening fresh
  useEffect(() => {
    if (open) {
      setSubject(defaultSubject)
      setBody('')
      setError(null)
    }
  }, [open, defaultSubject])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (subject.trim().length < 1) {
      setError('Subject required')
      return
    }
    if (body.trim().length < 1) {
      setError('Message body required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/community/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          to_user_id: toUserId,
          submission_id: submissionId,
          parent_id: parentId,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error ?? 'Failed to send')
        setSubmitting(false)
        return
      }
      setOpen(false)
      setSubmitting(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      setSubmitting(false)
    }
  }

  return (
    <>
      <span onClick={() => setOpen(true)} className="inline-flex">
        {children}
      </span>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !submitting && setOpen(false)}
          />
          <div className="relative w-full max-w-md card p-6 bg-white dark:bg-neutral-900 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                  {parentId ? 'Reply' : 'New message'}
                </h2>
                {(contextLabel || recipientEmail) && (
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                    {recipientEmail && <span>To {recipientEmail}</span>}
                    {recipientEmail && contextLabel && <span> · </span>}
                    {contextLabel && <span>{contextLabel}</span>}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => !submitting && setOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                  required
                  disabled={submitting}
                  className="w-full rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">
                  Message
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={5000}
                  required
                  disabled={submitting}
                  rows={6}
                  className="w-full rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand-500 resize-y"
                />
                <p className="mt-1 text-[10px] text-neutral-400 dark:text-neutral-600">
                  {body.length} / 5000
                </p>
              </div>

              {error && (
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className="px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
                >
                  {submitting ? 'Sending…' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
