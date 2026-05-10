'use client'

import { useState, useTransition, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ProfileAnswer, AnswerConfidence } from '@/lib/database.types'
import { WordCount } from './WordCount'
import { countWords, cn } from '@/lib/utils'

interface DraftResponse {
  draft: string
  question_theme: string
  word_limit: number
}

interface AnswerEditorProps {
  archivedQuestionId: string
  programId?: string
  wordLimit?: number
  charLimit?: number
  initialAnswer: ProfileAnswer | null
  compact?: boolean
}

const CONFIDENCE_OPTIONS: { value: AnswerConfidence; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'solid', label: 'Solid' },
  { value: 'locked', label: 'Locked' },
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
  const [confidence, setConfidence] = useState<AnswerConfidence>(
    initialAnswer?.confidence ?? 'draft'
  )
  const [isEditing, setIsEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle')
  const [isDrafting, setIsDrafting] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const supabase = createClient()

  const wordCount = countWords(content)
  const charCount = content.length

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard access denied — fail silently
    }
  }, [content])

  const handleDraft = useCallback(async () => {
    setIsDrafting(true)
    setDraftError(null)
    try {
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archived_question_id: archivedQuestionId,
          ...(programId ? { program_id: programId } : {}),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? `Draft request failed (${res.status})`)
      }
      const data: DraftResponse = await res.json()
      setContent(data.draft)
      setIsEditing(true)
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : 'Draft failed')
      setTimeout(() => setDraftError(null), 4000)
    } finally {
      setIsDrafting(false)
    }
  }, [archivedQuestionId, programId])

  const handleSave = useCallback(async () => {
    if (!content.trim()) return

    startTransition(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setSaveState('error')
        setTimeout(() => setSaveState('idle'), 3000)
        return
      }

      const payload = {
        user_id: user.id,
        archived_question_id: archivedQuestionId,
        content,
        answer_content: content,
        confidence,
        word_count: wordCount,
        updated_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        ...(initialAnswer?.id ? { id: initialAnswer.id } : {}),
      }

      const { error } = await supabase
        .from('profile_answers')
        .upsert(payload, { onConflict: 'user_id,archived_question_id' })

      if (error) {
        setSaveState('error')
        setTimeout(() => setSaveState('idle'), 3000)
      } else {
        setSaveState('saved')
        setIsEditing(false)
        setTimeout(() => setSaveState('idle'), 2000)
      }
    })
  }, [content, confidence, wordCount, archivedQuestionId, initialAnswer, supabase])

  if (!isEditing && !compact) {
    return (
      <div className="space-y-2">
        {content ? (
          <div className="group relative">
            {/* Copy button — top-right, visible on hover */}
            <button
              onClick={handleCopy}
              title={copied ? 'Copied!' : 'Copy to clipboard'}
              className={cn(
                'absolute top-0 right-0 flex items-center gap-1 px-2 py-1 rounded text-xs transition-all',
                copied
                  ? 'text-success-600 dark:text-success-400 opacity-100'
                  : 'text-neutral-400 dark:text-neutral-600 opacity-0 group-hover:opacity-100 hover:text-neutral-600 dark:hover:text-neutral-400'
              )}
              aria-label="Copy answer to clipboard"
            >
              {copied ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Copied!
                </>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path
                    d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>

            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap pr-8">
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
        {/* Confidence toggle */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Confidence</span>
          <div className="flex rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            {CONFIDENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setConfidence(opt.value)}
                className={cn(
                  'px-3 py-1 text-xs transition-colors',
                  confidence === opt.value
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium'
                    : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* AI draft button */}
        <button
          onClick={handleDraft}
          disabled={isDrafting}
          title="AI-draft an answer using your profile answers as context"
          className={cn(
            'ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-colors',
            isDrafting
              ? 'border border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-600 cursor-wait opacity-70'
              : 'border border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950'
          )}
        >
          {isDrafting ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="animate-spin">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {isDrafting ? 'Drafting…' : 'Draft with AI'}
        </button>
        {draftError && (
          <span className="text-xs text-danger-600 dark:text-danger-500">{draftError}</span>
        )}
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 justify-end">
        {saveState === 'saved' && (
          <span className="text-xs text-success-600 dark:text-success-400">Saved</span>
        )}
        {saveState === 'error' && (
          <span className="text-xs text-danger-600 dark:text-danger-500">Save failed — check console</span>
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
