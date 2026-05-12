'use client'

import { useState } from 'react'

export function ExtensionTokenCard() {
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchToken() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/token')
      if (!res.ok) throw new Error('Failed to fetch token')
      const { access_token } = await res.json()
      setToken(access_token)
    } catch {
      setError('Could not retrieve token. Try refreshing the page.')
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    if (!token) return
    await navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Appfeeder Extension
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Pre-fill accelerator applications from your answer bank.
          Paste this token into the extension popup.
        </p>
      </div>

      {!token ? (
        <button
          onClick={fetchToken}
          disabled={loading}
          className="btn-secondary text-sm"
        >
          {loading ? 'Loading…' : 'Show session token'}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-neutral-100 dark:bg-neutral-900 rounded px-3 py-2 truncate text-neutral-700 dark:text-neutral-300 select-all">
              {token}
            </code>
            <button onClick={copy} className="btn-secondary text-xs shrink-0">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-neutral-400">
            Token expires with your session. Refresh this page to get a new one.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </section>
  )
}
