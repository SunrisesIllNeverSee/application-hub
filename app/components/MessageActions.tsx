'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ComposeMessage } from './ComposeMessage'

interface MessageActionsProps {
  messageId: string
  isFromMe: boolean
  isUnread: boolean
  // For reply context
  replyToUserId?: string | null
  replySubject?: string
  recipientEmail?: string | null
  submissionId?: string | null
  // Auto-mark-read: when current user is recipient + message is unread
  autoMarkRead?: boolean
}

export function MessageActions({
  messageId,
  isFromMe,
  isUnread,
  replyToUserId,
  replySubject,
  recipientEmail,
  submissionId,
  autoMarkRead,
}: MessageActionsProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  // Auto mark-read on mount when applicable
  useEffect(() => {
    if (!autoMarkRead) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/community/messages/${messageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_read: true }),
        })
        if (!cancelled && res.ok) router.refresh()
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [messageId, autoMarkRead, router])

  async function setRead(value: boolean) {
    setBusy(true)
    try {
      const res = await fetch(`/api/community/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: value }),
      })
      if (res.ok) router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this message?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/community/messages/${messageId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        // Drop ?id= from URL and refresh
        router.push(window.location.pathname + window.location.search.replace(/[?&]id=[^&]*/, '').replace(/^&/, '?'))
        router.refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  const subject = replySubject
    ? (replySubject.startsWith('Re:') ? replySubject : `Re: ${replySubject}`)
    : ''

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {replyToUserId && (
        <ComposeMessage
          toUserId={replyToUserId}
          parentId={messageId}
          defaultSubject={subject}
          recipientEmail={recipientEmail ?? undefined}
          submissionId={submissionId ?? undefined}
        >
          <button
            type="button"
            disabled={busy}
            className="px-2.5 py-1 text-xs rounded-md bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
          >
            Reply
          </button>
        </ComposeMessage>
      )}

      {!isFromMe && (
        <button
          type="button"
          onClick={() => setRead(isUnread)}
          disabled={busy}
          className="px-2.5 py-1 text-xs rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
        >
          {isUnread ? 'Mark read' : 'Mark unread'}
        </button>
      )}

      {isFromMe && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="px-2.5 py-1 text-xs rounded-md border border-neutral-200 dark:border-neutral-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
        >
          Delete
        </button>
      )}
    </div>
  )
}
