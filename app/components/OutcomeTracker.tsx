'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type OutcomeStatus = 'accepted' | 'waitlisted' | 'rejected' | 'submitted'

interface Props {
  applicationId: string
  currentStatus: string
  programName: string
  initialIsPublic?: boolean
  initialOutcomeNotes?: string | null
  initialInterviewDate?: string | null
  initialProgramFeedback?: string | null
  initialWouldRecommend?: number | null
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

export function OutcomeTracker({
  applicationId,
  currentStatus,
  programName,
  initialIsPublic = false,
  initialOutcomeNotes = null,
  initialInterviewDate = null,
  initialProgramFeedback = null,
  initialWouldRecommend = null,
}: Props) {
  const [status, setStatus] = useState<string>(currentStatus)
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [notes, setNotes] = useState<string>(initialOutcomeNotes ?? '')
  const [interviewDate, setInterviewDate] = useState<string>(initialInterviewDate ?? '')
  const [feedback, setFeedback] = useState<string>(initialProgramFeedback ?? '')
  const [recommend, setRecommend] = useState<number | null>(initialWouldRecommend ?? null)

  const hasDetails =
    (initialOutcomeNotes && initialOutcomeNotes.length > 0) ||
    (initialInterviewDate && initialInterviewDate.length > 0) ||
    (initialProgramFeedback && initialProgramFeedback.length > 0) ||
    initialWouldRecommend != null
  const [expanded, setExpanded] = useState<boolean>(Boolean(hasDetails))

  const [savedFlash, setSavedFlash] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialMount = useRef(true)

  const showInterviewDate = status === 'waitlisted' || status === 'accepted'
  const showRecommend = status === 'accepted' || status === 'rejected'

  async function patchOutcome(payload: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/applications/${applicationId}/outcome`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Failed to save')
        return false
      }
      setError(null)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1500)
      return true
    } catch {
      setError('Network error — please try again')
      return false
    }
  }

  // Debounced save when detail fields change (skip first mount)
  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false
      return
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      const payload: Record<string, unknown> = {
        outcome_notes: notes.length > 0 ? notes : null,
        program_feedback: feedback.length > 0 ? feedback : null,
        interview_date: showInterviewDate && interviewDate.length > 0 ? interviewDate : null,
        would_recommend: showRecommend ? recommend : null,
      }
      void patchOutcome(payload)
    }, 300)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, feedback, interviewDate, recommend])

  async function handleOutcome(newStatus: OutcomeStatus) {
    if (saving) return
    setSaving(true)
    setError(null)

    const ok = await patchOutcome({ status: newStatus, is_public_result: isPublic })
    if (ok) setStatus(newStatus)
    setSaving(false)
  }

  async function handlePublicToggle(checked: boolean) {
    setIsPublic(checked)
    const outcomeStatuses: string[] = ['accepted', 'waitlisted', 'rejected']
    if (outcomeStatuses.includes(status)) {
      await patchOutcome({ status: status as OutcomeStatus, is_public_result: checked })
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          Log Outcome
        </h3>
        <span className="text-xs text-neutral-400 dark:text-neutral-500">— {programName}</span>
        {savedFlash && (
          <span className="ml-auto text-[10px] text-success-600 dark:text-success-400 font-medium">Saved</span>
        )}
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

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
      >
        <Chevron open={expanded} />
        {expanded ? 'Hide details' : 'Add details'}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-neutral-200 dark:border-neutral-800 pt-3">
          <div>
            <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              Outcome notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
              maxLength={2000}
              placeholder="What happened? Any context worth saving?"
              rows={3}
              className="w-full text-xs px-2 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 text-right tabular-nums">
              {notes.length}/2000
            </p>
          </div>

          {showInterviewDate && (
            <div>
              <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                Interview date
              </label>
              <input
                type="date"
                value={interviewDate}
                onChange={(e) => setInterviewDate(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              Program feedback
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value.slice(0, 2000))}
              maxLength={2000}
              placeholder="Did the program share any feedback?"
              rows={3}
              className="w-full text-xs px-2 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 text-right tabular-nums">
              {feedback.length}/2000
            </p>
          </div>

          {showRecommend && (
            <div>
              <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                Would you recommend this program?
              </label>
              <div className="flex items-center gap-1" role="radiogroup" aria-label="Would recommend rating">
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = recommend != null && n <= recommend
                  return (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={recommend === n}
                      onClick={() => setRecommend(recommend === n ? null : n)}
                      className="p-0.5 transition-transform hover:scale-110"
                      title={`${n} star${n === 1 ? '' : 's'}`}
                    >
                      <StarIcon filled={filled} />
                    </button>
                  )
                })}
                {recommend != null && (
                  <span className="ml-2 text-[10px] text-neutral-500 dark:text-neutral-400">
                    {recommend}/5
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      className={cn('transition-transform', open ? 'rotate-90' : '')}
    >
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400">
        <path d="M12 2l2.9 6.9L22 9.6l-5.3 4.8 1.6 7.1L12 17.8 5.7 21.5l1.6-7.1L2 9.6l7.1-.7L12 2z" />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-neutral-300 dark:text-neutral-600">
      <path
        d="M12 2l2.9 6.9L22 9.6l-5.3 4.8 1.6 7.1L12 17.8 5.7 21.5l1.6-7.1L2 9.6l7.1-.7L12 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}
