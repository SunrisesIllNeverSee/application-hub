import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ComposeMessage } from '@/components/ComposeMessage'
import { MessageActions } from '@/components/MessageActions'

export const metadata = { title: 'Messages' }
export const dynamic = 'force-dynamic'

interface MessageRow {
  id: string
  from_user_id: string
  to_user_id: string | null
  subject: string
  body: string
  is_read: boolean
  created_at: string
  submission_id: string | null
  parent_id: string | null
  from_user?: { email: string | null } | { email: string | null }[] | null
  to_user?: { email: string | null } | { email: string | null }[] | null
}

interface Props {
  searchParams: Promise<{ box?: string; id?: string }>
}

function pickEmail(rel: MessageRow['from_user']): string | null {
  if (!rel) return null
  const r = Array.isArray(rel) ? rel[0] : rel
  return (r && 'email' in r ? r.email : null) ?? null
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatFullTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default async function MessagesPage({ searchParams }: Props) {
  const { box: boxParam, id: selectedId } = await searchParams
  const box = boxParam === 'sent' ? 'sent' : 'inbox'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  let query = supabase
    .from('community_messages')
    .select(`
      id, from_user_id, to_user_id, subject, body, is_read, created_at, submission_id, parent_id,
      from_user:from_user_id(email),
      to_user:to_user_id(email)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  query = box === 'inbox'
    ? query.eq('to_user_id', user.id)
    : query.eq('from_user_id', user.id)

  const { data } = await query
  const messages = ((data ?? []) as unknown as MessageRow[]).map((r) => ({
    ...r,
    from_email: pickEmail(r.from_user),
    to_email: pickEmail(r.to_user),
  }))

  const total = messages.length

  // Default selection: first unread, else most recent
  const resolvedId =
    selectedId ||
    messages.find((m) => !m.is_read && box === 'inbox')?.id ||
    messages[0]?.id ||
    null
  const selected = resolvedId ? messages.find((m) => m.id === resolvedId) ?? null : null

  const unreadCount = box === 'inbox' ? messages.filter((m) => !m.is_read).length : 0

  return (
    <div className="-mx-4 md:-mx-6 -my-4 md:-my-8 h-[calc(100vh-3.5rem)] md:h-screen flex flex-col">
      {/* Slim header */}
      <div className="flex-shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-semibold text-neutral-900 dark:text-white">Messages</h1>
            <div className="flex items-center gap-1 text-xs">
              <Link
                href="/community/messages?box=inbox"
                className={cn(
                  'px-2.5 py-1 rounded-md',
                  box === 'inbox'
                    ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                )}
              >
                Inbox {unreadCount > 0 && <span className="ml-1 text-[10px]">({unreadCount})</span>}
              </Link>
              <Link
                href="/community/messages?box=sent"
                className={cn(
                  'px-2.5 py-1 rounded-md',
                  box === 'sent'
                    ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                )}
              >
                Sent
              </Link>
            </div>
          </div>
          <ComposeMessage>
            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded-md bg-brand-600 hover:bg-brand-700 text-white"
            >
              Compose
            </button>
          </ComposeMessage>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Left: message list */}
        <aside className="md:w-72 md:flex-shrink-0 md:border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 md:h-full md:overflow-y-auto">
          {total === 0 ? (
            <div className="p-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
              {box === 'inbox' ? 'No messages yet.' : 'You haven’t sent any messages.'}
            </div>
          ) : (
            <ul>
              {messages.map((m) => {
                const isSelected = m.id === resolvedId
                const otherEmail =
                  box === 'inbox' ? m.from_email : m.to_email
                const isUnread = box === 'inbox' && !m.is_read
                const preview = m.body.replace(/\s+/g, ' ').slice(0, 80)
                return (
                  <li key={m.id}>
                    <Link
                      href={`/community/messages?box=${box}&id=${m.id}`}
                      className={cn(
                        'block px-4 py-3 border-b border-neutral-200 dark:border-neutral-800',
                        isSelected
                          ? 'bg-brand-50 dark:bg-brand-900/20 border-l-2 border-l-brand-500'
                          : 'hover:bg-neutral-100 dark:hover:bg-neutral-900'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span
                          className={cn(
                            'text-xs truncate flex-1 min-w-0',
                            isUnread
                              ? 'font-semibold text-neutral-900 dark:text-white'
                              : 'text-neutral-700 dark:text-neutral-300'
                          )}
                        >
                          {otherEmail ?? (box === 'inbox' ? 'System' : 'Unknown')}
                        </span>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-600 flex-shrink-0">
                          {formatTime(m.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isUnread && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                        )}
                        <p
                          className={cn(
                            'text-sm truncate flex-1 min-w-0',
                            isUnread
                              ? 'font-semibold text-neutral-900 dark:text-white'
                              : 'text-neutral-600 dark:text-neutral-400'
                          )}
                        >
                          {m.subject}
                        </p>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-500 truncate mt-0.5">
                        {preview}
                      </p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        {/* Right: detail */}
        <section className="flex-1 flex flex-col min-h-0 min-w-0">
          {selected ? (
            <MessageDetail
              message={selected}
              currentUserId={user.id}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
              {total === 0
                ? 'No messages to display.'
                : 'Select a message to view.'}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function MessageDetail({
  message,
  currentUserId,
}: {
  message: MessageRow & { from_email: string | null; to_email: string | null }
  currentUserId: string
}) {
  const isFromMe = message.from_user_id === currentUserId
  const isUnread = !message.is_read
  const isRecipient = message.to_user_id === currentUserId
  const replyToUserId = isFromMe ? message.to_user_id : message.from_user_id
  const recipientEmail = isFromMe ? message.to_email : message.from_email

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
      <div className="max-w-3xl">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white mb-1 break-words">
              {message.subject}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {message.from_email ?? 'System'}
              </span>
              <span className="mx-1">→</span>
              <span>{message.to_email ?? '—'}</span>
              <span className="mx-2">·</span>
              <span>{formatFullTime(message.created_at)}</span>
            </p>
          </div>
          <MessageActions
            messageId={message.id}
            isFromMe={isFromMe}
            isUnread={isUnread}
            replyToUserId={replyToUserId}
            replySubject={message.subject}
            recipientEmail={recipientEmail}
            submissionId={message.submission_id}
            autoMarkRead={isRecipient && isUnread}
          />
        </div>

        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <p className="text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap break-words">
            {message.body}
          </p>
        </div>

        {message.submission_id && (
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            Re: submission{' '}
            <span className="font-mono">{message.submission_id.slice(0, 8)}</span>
          </p>
        )}
      </div>
    </div>
  )
}
