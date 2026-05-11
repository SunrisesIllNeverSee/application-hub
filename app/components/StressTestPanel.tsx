'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface FollowUp {
  id: string
  focus: string
  prompt: string
  expected_evidence: string[]
  risk_if_unanswered: string
}

interface StressTestResult {
  answer_id: string
  question_text: string
  theme: string | null
  depth: string
  word_count: number
  signals: {
    numeric_claims: string[]
    likely_urls: string[]
  }
  follow_ups: FollowUp[]
}

interface Props {
  answerId: string
  programId?: string
  compact?: boolean
}

export function StressTestPanel({ answerId, programId, compact = false }: Props) {
  const [state, setState] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = React.useState<StressTestResult | null>(null)
  const [open, setOpen] = React.useState(false)
  const [depth, setDepth] = React.useState<'light' | 'medium' | 'deep'>('medium')
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())

  async function run() {
    setState('loading')
    setOpen(true)
    try {
      const res = await fetch('/api/stress-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer_id: answerId, program_id: programId, depth }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data: StressTestResult = await res.json()
      setResult(data)
      setState('done')
      // Auto-expand all follow-ups
      setExpanded(new Set(data.follow_ups.map(f => f.id)))
    } catch {
      setState('error')
    }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  return (
    <div className={cn('border-t border-neutral-100 dark:border-neutral-800 pt-3', compact ? 'mt-3' : 'mt-4')}>
      {/* Trigger row */}
      <div className="flex items-center gap-2 flex-wrap">
        {state === 'idle' || state === 'error' ? (
          <>
            <div className="flex items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              {(['light', 'medium', 'deep'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDepth(d)}
                  className={cn(
                    'px-2.5 py-1 text-xs transition-colors',
                    depth === d
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
            <button
              onClick={run}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-warning-500">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Stress test this answer
            </button>
            {state === 'error' && (
              <span className="text-xs text-red-500">Failed — try again</span>
            )}
          </>
        ) : state === 'loading' ? (
          <div className="flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
            <span className="w-3 h-3 rounded-full border border-neutral-300 dark:border-neutral-600 border-t-brand-500 animate-spin inline-block" />
            Generating follow-ups…
          </div>
        ) : (
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              className={cn('transition-transform', open ? 'rotate-90' : '')}>
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {open ? 'Hide' : 'Show'} stress test
            {result && <span className="ml-1 text-neutral-400 dark:text-neutral-500">({result.follow_ups.length} follow-ups)</span>}
          </button>
        )}
      </div>

      {/* Results */}
      {open && result && state === 'done' && (
        <div className="mt-3 space-y-2">
          {/* Signal summary */}
          {(result.signals.numeric_claims.length > 0 || result.word_count > 0) && (
            <div className="flex items-center gap-3 text-xs text-neutral-400 dark:text-neutral-500 pb-2 flex-wrap">
              <span>{result.word_count} words</span>
              {result.signals.numeric_claims.length > 0 && (
                <span className="text-success-600 dark:text-success-400">
                  {result.signals.numeric_claims.length} metric{result.signals.numeric_claims.length !== 1 ? 's' : ''} found
                </span>
              )}
              {result.signals.likely_urls.length > 0 && (
                <span className="text-brand-600 dark:text-brand-400">
                  {result.signals.likely_urls.length} link{result.signals.likely_urls.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {/* Follow-up questions */}
          {result.follow_ups.map((f, i) => (
            <div key={f.id}
              className="rounded-lg border border-neutral-100 dark:border-neutral-800 overflow-hidden">
              <button
                onClick={() => toggleExpand(f.id)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-0.5">
                    {f.focus}
                  </p>
                  <p className="text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed">
                    {f.prompt}
                  </p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  className={cn('text-neutral-300 dark:text-neutral-600 flex-shrink-0 mt-1 transition-transform',
                    expanded.has(f.id) ? 'rotate-90' : '')}>
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {expanded.has(f.id) && (
                <div className="px-4 pb-4 pt-0 ml-8 space-y-3">
                  {f.expected_evidence.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">Expected evidence</p>
                      <ul className="space-y-1">
                        {f.expected_evidence.map((e, j) => (
                          <li key={j} className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                            <span className="mt-0.5 text-success-500 flex-shrink-0">✓</span>
                            {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex items-start gap-2 p-2.5 rounded-md bg-warning-50 dark:bg-warning-900/10">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      className="text-warning-500 mt-0.5 flex-shrink-0">
                      <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="text-xs text-warning-700 dark:text-warning-400">
                      <span className="font-medium">Risk: </span>{f.risk_if_unanswered}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Re-run */}
          <div className="pt-1">
            <button
              onClick={run}
              className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              ↺ Run again with different depth
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
