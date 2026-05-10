'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type AppStatus = 'saved' | 'drafting' | 'submitted' | 'accepted' | 'rejected' | 'waitlisted'

interface Props {
  programId: string
  initialStatus: AppStatus | null
  programName: string
}

const STATUS_OPTIONS: { value: AppStatus; label: string; emoji: string }[] = [
  { value: 'drafting', label: 'In progress', emoji: '✏️' },
  { value: 'submitted', label: 'Submitted', emoji: '📬' },
  { value: 'accepted', label: 'Accepted!', emoji: '🎉' },
  { value: 'waitlisted', label: 'Waitlisted', emoji: '⏳' },
  { value: 'rejected', label: 'Rejected', emoji: '❌' },
]

export function ApplicationStatusTracker({ programId, initialStatus, programName }: Props) {
  const [status, setStatus] = useState<AppStatus | null>(initialStatus)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)

  async function updateStatus(newStatus: AppStatus) {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    await supabase
      .from('user_applications')
      .upsert(
        {
          user_id: user.id,
          program_id: programId,
          status: newStatus,
          submitted_at: newStatus === 'submitted' ? new Date().toISOString() : undefined,
        },
        { onConflict: 'user_id,program_id' }
      )

    setStatus(newStatus)
    setSaving(false)
    setExpanded(false)
  }

  const currentOption = STATUS_OPTIONS.find((o) => o.value === status)

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
          status === 'submitted' || status === 'accepted'
            ? 'bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-400 hover:bg-success-100 dark:hover:bg-success-500/20'
            : status === 'drafting'
            ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50'
            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
        )}
      >
        <span>{currentOption?.emoji ?? '📋'}</span>
        <span>{currentOption ? currentOption.label : 'Mark status'}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="opacity-60">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    )
  }

  return (
    <div className="inline-flex flex-col gap-1 p-1 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-lg">
      <p className="text-xs text-neutral-500 dark:text-neutral-400 px-2 pt-1 pb-0.5">
        Update status for {programName}
      </p>
      {STATUS_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          disabled={saving}
          onClick={() => updateStatus(opt.value)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left',
            status === opt.value
              ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
          )}
        >
          <span>{opt.emoji}</span>
          <span>{opt.label}</span>
          {status === opt.value && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="ml-auto text-brand-600">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          )}
        </button>
      ))}
      <button
        onClick={() => setExpanded(false)}
        className="text-xs text-neutral-400 dark:text-neutral-500 px-3 py-1.5 hover:text-neutral-600 dark:hover:text-neutral-300 text-left"
      >
        Cancel
      </button>
    </div>
  )
}
