'use client'

import { useState } from 'react'

/**
 * Client-side button that calls the FundScore API and refreshes the page
 * to show the updated score. Used in the profile persona page's boost layer.
 */
export function FundScoreScanButton({
  hasGithub,
  hasScore,
  label,
}: {
  hasGithub: boolean
  hasScore: boolean
  label: string
}) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!hasGithub) {
    return (
      <a
        href="/profile/about"
        className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 transition-colors flex-shrink-0"
      >
        Add GitHub URL →
      </a>
    )
  }

  async function scan() {
    setScanning(true)
    setError(null)
    try {
      const res = await fetch('/api/profile/fundscore', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Scan failed' }))
        setError(data.error || 'Scan failed')
        setScanning(false)
        return
      }
      // Refresh the page to show the updated score
      window.location.reload()
    } catch {
      setError('Network error')
      setScanning(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1 flex-shrink-0">
      <button
        onClick={scan}
        disabled={scanning}
        className={`text-xs font-medium transition-colors ${
          hasScore
            ? 'text-success-600 hover:text-success-700 dark:text-success-400'
            : 'text-brand-600 hover:text-brand-700 dark:text-brand-400'
        } disabled:opacity-50`}
      >
        {scanning ? 'Scanning…' : label}
        {!scanning && ' →'}
      </button>
      {error && (
        <span className="text-xs text-red-500 max-w-[200px] text-right">{error}</span>
      )}
    </div>
  )
}
