'use client'

import { useEffect, useState } from 'react'

type Recommendation = {
  id: string
  entity_name: string
  fit_score: number
  significance_score: number
  reasoning_snippet: string
  deadline: string | null
}

type SmartMatcherFeedProps = {
  vertical?: string
  compact?: boolean
}

export function SmartMatcherFeed({ vertical = 'founder', compact = false }: SmartMatcherFeedProps) {
  const [items, setItems] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const resp = await fetch('/api/hub/smart-matcher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vertical_filter: vertical, match_limit: compact ? 3 : 8 }),
        })
        const payload = await resp.json()
        if (!resp.ok) throw new Error(payload.error ?? 'Smart Matcher failed')
        if (!cancelled) setItems(payload.recommendations ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [vertical, compact])

  if (loading) {
    return <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">Finding best fits for your persona...</div>
  }

  if (error) {
    return <div className="rounded-lg border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-100">
      <div className="border-b border-neutral-800 px-4 py-3">
        <p className="text-sm font-semibold">Smart Matcher</p>
        <p className="text-xs text-neutral-500">Programs ranked by persona, significance, and deadline signal.</p>
      </div>
      <div className="divide-y divide-neutral-800">
        {items.map((item) => (
          <div key={item.id} className="p-4 transition-colors hover:bg-neutral-900/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-neutral-100">{item.entity_name}</h3>
                <p className="mt-1 text-xs leading-5 text-neutral-400">{item.reasoning_snippet}</p>
                <p className="mt-2 text-xs text-neutral-500">{item.deadline ? new Date(item.deadline).toLocaleDateString() : 'Rolling or unknown deadline'}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-brand-300">{Number(item.fit_score ?? 0).toFixed(0)}</p>
                <p className="text-[10px] uppercase tracking-wide text-neutral-500">fit</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-neutral-500">significance boost {Number(item.significance_score ?? 0).toFixed(2)}</span>
              <button className="btn-secondary px-3 py-1.5 text-xs">Pre-fill This Program</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="p-4 text-sm text-neutral-500">No recommendations yet.</div>}
      </div>
    </div>
  )
}
