'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'

interface ScoreTooltipProps {
  label: string
  description: string
  scoreId: string
}

export function ScoreTooltip({ label, description, scoreId }: ScoreTooltipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onOutside)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onOutside)
    }
  }, [open, close])

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label={`About ${label}`}
        aria-expanded={open}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-neutral-300 dark:border-neutral-600 text-neutral-400 dark:text-neutral-500 hover:border-brand-400 hover:text-brand-500 dark:hover:border-brand-500 dark:hover:text-brand-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ml-1 flex-shrink-0"
      >
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 16v-4m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg p-3"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2.5 h-2.5 overflow-hidden">
            <div className="w-2 h-2 bg-white dark:bg-neutral-900 border-b border-r border-neutral-200 dark:border-neutral-700 rotate-45 -mt-1 mx-auto" />
          </div>
          <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-100 mb-1">
            {label}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-2">
            {description}
          </p>
          <Link
            href={`/about/scoring#${scoreId}`}
            className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium transition-colors"
          >
            Learn more
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              className="inline ml-1 align-middle"
              aria-hidden="true"
            >
              <path
                d="M5 12h14M12 5l7 7-7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      )}
    </div>
  )
}
