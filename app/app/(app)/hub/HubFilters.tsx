'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { cn } from '@/lib/utils'

const SORT_OPTIONS = [
  { value: 'composite', label: 'Best fit' },
  { value: 'heat', label: 'Trending' },
  { value: 'deadline', label: 'Deadline' },
]

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'accel', label: 'Accelerator' },
  { value: 'grant', label: 'Grant' },
  { value: 'fellowship', label: 'Fellowship' },
  { value: 'vc', label: 'VC Fund' },
  { value: 'corp', label: 'Corporate' },
  { value: 'uni', label: 'University' },
  { value: 'job', label: 'Job' },
  { value: 'other', label: 'Other' },
]

interface HubFiltersProps {
  currentSort: string
  currentType?: string
  currentRolling?: string
}

export function HubFilters({ currentSort, currentType, currentRolling }: HubFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === null || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  return (
    <div className="space-y-5">
      {/* Sort */}
      <div>
        <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
          Sort by
        </p>
        <div className="space-y-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateParam('sort', opt.value)}
              className={cn(
                'w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors',
                currentSort === opt.value
                  ? 'bg-brand-600 text-white font-medium'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Type */}
      <div>
        <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
          Type
        </p>
        <div className="space-y-1">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateParam('type', opt.value || null)}
              className={cn(
                'w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors',
                (currentType ?? '') === opt.value
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rolling toggle */}
      <div>
        <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
          Availability
        </p>
        <button
          onClick={() =>
            updateParam('rolling', currentRolling === 'true' ? null : 'true')
          }
          className={cn(
            'w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2',
            currentRolling === 'true'
              ? 'bg-success-500/10 text-success-600 dark:text-success-400 font-medium'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          )}
        >
          <span
            className={cn(
              'w-2 h-2 rounded-full flex-shrink-0',
              currentRolling === 'true' ? 'bg-success-500' : 'bg-neutral-300 dark:bg-neutral-600'
            )}
          />
          Rolling admissions only
        </button>
      </div>
    </div>
  )
}
