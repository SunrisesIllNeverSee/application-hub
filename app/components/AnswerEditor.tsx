'use client'

import { useState, useTransition, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ProfileAnswer, AnswerSource } from '@/lib/database.types'
import { WordCount } from './WordCount'
import { countWords, cn } from '@/lib/utils'

interface AnswerEditorProps {
  archivedQuestionId: string
  programId?: string
  wordLimit?: number
  charLimit?: number
  initialAnswer: ProfileAnswer | null
  compact?: boolean
}

const SOURCE_OPTIONS: { value: AnswerSource; label: string }[] = [
  { value: 'human_written', label: 'Human' },
  { value: 'ai_generated', label: 'AI' },
  { value: 'curated', label: 'Curated' },
]

export function AnswerEditor({
  archivedQuestionId,
  programId,
  wordLimit,
  charLimit,
  initialAnswer,
  compact = false,
}: AnswerEditorProps) {
  const [content, setContent] = useState(initialAnswer?.content ?? '')
  const [source, setSource] = useState<AnswerSource>(initialAnswer?.source ?? 'human_written')
  const [isCanonical, setIsCanonical] = useState(initialAnswer?.is_canonical ?? false)
  const [confidence, setConfidence] = useState(
    initialAnswer?.confidence_score != null ? Math.round(initialAnswer.confidence_score * 100) : 80
  )
  const [isEditing, setIsEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle')

  const supabase = createClient()

  const wordCount = countWords(content)
  const charCount = content.length

  const handleSave = useCallback(async () => {
    if (!content.trim()) return

    startTransition(async () => {
      const payload: Partial<ProfileAnswer> & {
        archived_question_id: string
        content: string
        source: AnswerSource
        is_canonical: boolean
        confidence_score: number
        word_count: number
      } = {
        archived_question_id: archivedQuestionId,
        content,
        source,
        is_canonical: isCanonical,
        confidence_score: confidence / 100,
        word_count: wordCount,
      }

      const { error } = await supabase.from('profile_answers').upsert(
        {
          ...payload,
          ...(initialAnswer?.id ? { id: initialAnswer.id } : {}),
        },
        { onConflict: 'user_id,archived_question_id' }
      )

      if (error) {
        setSaveState('error')
        setTimeout(() => setSaveState('idle'), 3000)
      } else {
        setSaveState('saved')
        setIsEditing(false)
        setTimeout(() => setSaveState('idle'), 2000)
      }
    })
  }, [content, source, isCanonical, confidence, wordCount, archivedQuestionId, initialAnswer, supabase])

  if (!isEditing && !compact) {
    return (
      <div className="space-y-2">
        {content ? (
          <div className="group relative">
            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
              {content}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <WordCount current={wordCount} limit={wordLimit} charCurrent={charCount} charLimit={charLimit} />
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="w-full text-left px-4 py-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700
              text-sm text-neutral-400 dark:text-neutral-500 hover:border-brand-400 hover:text-brand-500
              transition-colors"
          >
            Write your answer...
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your answer here. Be specific — concrete examples and metrics make applications stand out."
        rows={compact ? 4 : 6}
        className="w-full px-3 py-2.5 rounded-lg text-sm
          bg-white dark:bg-neutral-900
          border border-neutral-200 dark:border-neutral-700
          text-neutral-900 dark:text-neutral-100
          placeholder:text-neutral-400 dark:placeholder:text-neutral-600
          focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
          resize-y transition-colors"
        autoFocus
      />

      <WordCount
        current={wordCount}
        limit={wordLimit}
        charCurrent={charCount}
        charLimit={charLimit}
      />

      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Source toggle */}
        <div className="flex rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSource(opt.value)}
              className={cn(
                'px-3 py-1 text-xs transition-colors',
                source === opt.value
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Canonical toggle */}
        <button
          onClick={() => setIsCanonical(!isCanonical)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs border transition-colors',
            isCanonical
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
              : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600'
          )}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill={isCanonical ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Canonical
        </button>

        {/* Confidence */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Confidence</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className="w-20 accent-brand-600"
          />
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300 tabular-nums w-8">
            {confidence}%
          </span>
        </div>

        {/* Suggest from profile (future) */}
        <button
          disabled
          title="Coming soon — will pull from your answer bank"
          className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs
            border border-neutral-200 dark:border-neutral-700
            text-neutral-400 dark:text-neutral-600
            cursor-not-allowed opacity-60"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Suggest from profile
        </button>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 justify-end">
        {saveState === 'saved' && (
          <span className="text-xs text-success-600 dark:text-success-400">Saved</span>
        )}
        {saveState === 'error' && (
          <span className="text-xs text-danger-600 dark:text-danger-500">Save failed</span>
        )}

        {(isEditing || compact) && (
          <button
            onClick={() => {
              setIsEditing(false)
              if (!compact) setContent(initialAnswer?.content ?? '')
            }}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={isPending || !content.trim()}
          className="btn-primary text-xs py-1.5 px-3"
        >
          {isPending ? 'Saving…' : 'Save answer'}
        </button>
      </div>
    </div>
  )
}
