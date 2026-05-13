'use client'

import React from 'react'

type CheckResponse =
  | { status: 'beta_active' }
  | { status: 'grace_period'; ends_at: string }
  | { status: 'basic' }

const DISMISS_KEY = 'beta_end_banner_dismissed_v1'

export function BetaEndBanner() {
  const [state, setState] = React.useState<CheckResponse | null>(null)
  const [dismissed, setDismissed] = React.useState(false)

  React.useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === 'true') {
      setDismissed(true)
    }
    let cancelled = false
    fetch('/api/beta/check')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CheckResponse | null) => {
        if (!cancelled && data) setState(data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  function dismiss() {
    setDismissed(true)
    try { localStorage.setItem(DISMISS_KEY, 'true') } catch {}
  }

  if (dismissed || !state || state.status === 'beta_active') return null

  const message =
    state.status === 'grace_period'
      ? `You're in your 30-day grace period — Pro access until ${new Date(state.ends_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`
      : "Beta ended — you're on the free plan. Upgrade to keep Pro features."

  return (
    <div className="w-full bg-amber-100 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 text-sm">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-2 flex items-center justify-between gap-3">
        <span>{message}</span>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
