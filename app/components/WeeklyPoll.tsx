'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

const POLLS = [
  {
    question: 'What are you primarily applying for?',
    options: ['Accelerator', 'Fellowship', 'Grant', 'Job'],
  },
  {
    question: 'How many apps this week?',
    options: ['0', '1–2', '3+', 'Too many'],
  },
  {
    question: 'Biggest challenge right now?',
    options: ['Finding programs', 'Writing answers', 'Time', 'Motivation'],
  },
  {
    question: 'How did you hear about us?',
    options: ['Friend', 'Social', 'Search', 'Conference'],
  },
]

function getWeekNumber(d: Date): number {
  const oneJan = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7)
}

export default function WeeklyPoll() {
  const weekNum = getWeekNumber(new Date())
  const poll = POLLS[weekNum % POLLS.length]
  const storageKey = `poll_week_${weekNum}`

  const [selected, setSelected] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) setSelected(saved)
    } catch {
      // localStorage not available
    }
  }, [storageKey])

  function handleSelect(option: string) {
    setSelected(option)
    try {
      localStorage.setItem(storageKey, option)
    } catch {
      // ignore
    }
  }

  if (!mounted) return null

  return (
    <div>
      <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2.5 leading-snug">
        {poll.question}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {poll.options.map((opt) => (
          <button
            key={opt}
            onClick={() => handleSelect(opt)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
              selected === opt
                ? 'bg-brand-600 border-brand-600 text-white'
                : 'bg-transparent border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-brand-400 dark:hover:border-brand-600 hover:text-brand-600 dark:hover:text-brand-400'
            )}
          >
            {opt}
          </button>
        ))}
      </div>
      {selected && (
        <p className="mt-2 text-[10px] text-neutral-400 dark:text-neutral-500">
          Thanks for voting
        </p>
      )}
    </div>
  )
}
