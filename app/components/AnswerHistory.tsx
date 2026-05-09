'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface AnswerVersion {
  id: string
  content: string
  word_count: number
  source: 'ai_generated' | 'human_written' | 'curated'
  created_at: string
}

const SOURCE_LABELS = {
  ai_generated: 'AI',
  human_written: 'You',
  curated: 'Curated',
}

const SOURCE_COLORS = {
  ai_generated: 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10',
  human_written: 'text-success-700 dark:text-success-400 bg-success-50 dark:bg-success-500/10',
  curated: 'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10',
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/**
 * Minimal word-level diff — highlights words added/removed between two versions.
 * Returns an array of {text, type} segments.
 */
function diffWords(
  oldText: string,
  newText: string
): { text: string; type: 'same' | 'added' | 'removed' }[] {
  const oldWords = oldText.split(/\s+/)
  const newWords = newText.split(/\s+/)

  // LCS-based diff (simple O(n*m) — fine for answer-sized text)
  const m = oldWords.length
  const n = newWords.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const segments: { text: string; type: 'same' | 'added' | 'removed' }[] = []
  let i = m, j = n
  const ops: { text: string; type: 'same' | 'added' | 'removed' }[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      ops.unshift({ text: oldWords[i - 1], type: 'same' })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ text: newWords[j - 1], type: 'added' })
      j--
    } else {
      ops.unshift({ text: oldWords[i - 1], type: 'removed' })
      i--
    }
  }

  return ops
}

interface Props {
  versions: AnswerVersion[]
  onRestore?: (content: string) => void
}

export function AnswerHistory({ versions, onRestore }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [diffIndex, setDiffIndex] = useState<number | null>(null)

  if (versions.length === 0) return null

  const sorted = [...versions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <div className="mt-3 border-t border-neutral-100 dark:border-neutral-800 pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          className={cn('transition-transform', expanded && 'rotate-180')}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {versions.length} previous version{versions.length !== 1 ? 's' : ''}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {sorted.map((version, idx) => {
            const isShowingDiff = diffIndex === idx
            const prevVersion = sorted[idx + 1]
            const hasDiff = !!prevVersion

            return (
              <div
                key={version.id}
                className="rounded-lg border border-neutral-100 dark:border-neutral-800 overflow-hidden"
              >
                {/* Version header */}
                <div className="flex items-center justify-between px-3 py-2 bg-neutral-50 dark:bg-neutral-800/50">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-xs font-medium px-1.5 py-0.5 rounded',
                        SOURCE_COLORS[version.source]
                      )}
                    >
                      {SOURCE_LABELS[version.source]}
                    </span>
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">
                      {formatTimestamp(version.created_at)}
                    </span>
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">
                      {version.word_count}w
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasDiff && (
                      <button
                        onClick={() => setDiffIndex(isShowingDiff ? null : idx)}
                        className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                      >
                        {isShowingDiff ? 'Hide diff' : 'Diff'}
                      </button>
                    )}
                    {onRestore && idx > 0 && (
                      <button
                        onClick={() => onRestore(version.content)}
                        className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium transition-colors"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="px-3 py-2.5 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {isShowingDiff && prevVersion ? (
                    <DiffView oldText={prevVersion.content} newText={version.content} />
                  ) : (
                    <p className="line-clamp-3">{version.content}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const segments = diffWords(oldText, newText)

  return (
    <p className="leading-relaxed">
      {segments.map((seg, i) => (
        <span
          key={i}
          className={cn(
            seg.type === 'added' && 'bg-success-100 dark:bg-success-500/20 text-success-800 dark:text-success-300',
            seg.type === 'removed' && 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 line-through'
          )}
        >
          {seg.text}{' '}
        </span>
      ))}
    </p>
  )
}
