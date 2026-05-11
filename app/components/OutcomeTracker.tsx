'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

type OutcomeStatus = 'accepted' | 'waitlisted' | 'rejected' | 'submitted'

interface Props {
  applicationId: string
  currentStatus: string
  programName: string
}

interface OutcomeButton {
  value: OutcomeStatus
  label: string
  activeClass: string
  inactiveClass: string
}

const OUTCOME_BUTTONS: OutcomeButton[] = [
  {
    value: 'accepted',
    label: 'Accepted',
    activeClass: 'bg-success-500 text-white border-success-500',
    inactiveClass: 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-success-400 hover:text-success-600 dark:hover:text-success-400',
  },
  {
    value: 'waitlisted',
    label: 'Waitlisted',
    activeClass: 'bg-warning-400 text-white border-warning-400',
    inactiveClass: 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-warning-400 hover:text-warning-600 dark:hover:text-warning-400',
  },
  {
    value: 'rejected',
    label: 'Rejected',
    activeClass: 'bg-neutral-500 text-white border-neutral-500',
    inactiveClass: 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300',
  },
  {
    value: 'submitted',
    label: 'Withdrawn',
    activeClass: 'bg-neutral-400 text-white border-neutral-400',
    inactiveClass: 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300',
  },
]

export function OutcomeTracker({ applicationId, currentStatus, programName }: Props) {
  const [status, setStatus] = useState<string>(currentStatus)
  const [isPublic, setIsPublic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleOutcome(newStatus: OutcomeStatus) {
    if (saving) return
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/applications/${applicationId}/outcome`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, is_public_result: isPublic }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Failed to save outcome')
        return
      }

      setStatus(newStatus)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  async function handlePublicToggle(checked: boolean) {
    setIsPublic(checked)

    // If there's already an outcome status logged, also persist the public flag change immediately
    const outcomeStatuses: string[] = ['accepted', 'waitlisted', 'rejected']
    if (outcomeStatuses.includes(status)) {
      try {
        await fetch(`/api/applications/${applicationId}/outcome`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: status as OutcomeStatus, is_public_result: checked }),
        })
      } catch {
        // silent — UI reflects checkbox state optimistically
      }
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          Log Outcome
        </h3>
        <span className="text-xs text-neutral-400 dark:text-neutral-500">— {programName}</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {OUTCOME_BUTTONS.map((btn) => (
          <button
            key={btn.value}
            disabled={saving}
            onClick={() => handleOutcome(btn.value)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
              status === btn.value ? btn.activeClass : btn.inactiveClass
            )}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          id={`public-result-${applicationId}`}
          type="checkbox"
          checked={isPublic}
          onChange={(e) => handlePublicToggle(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-neutral-300 dark:border-neutral-600 text-brand-600 focus:ring-brand-500 cursor-pointer"
        />
        <label
          htmlFor={`public-result-${applicationId}`}
          className="text-xs text-neutral-500 dark:text-neutral-400 cursor-pointer select-none"
        >
          Share anonymously for community stats
        </label>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
