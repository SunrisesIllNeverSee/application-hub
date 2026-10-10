'use client'

import { useState, useTransition, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { ProfileAnswer, AnswerConfidence } from '@/lib/database.types'
import { WordCount } from './WordCount'
import { StressTestPanel } from './StressTestPanel'
import { countWords, cn } from '@/lib/utils'
import { LOCAL_FIRST } from '@/lib/aqua-local-client/flag'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import {
  scopeForQuestion,
  loadScopeEntry,
  saveScopedVersion,
} from '@/lib/aqua-local-client/session'
import type { BankVersion } from '@/lib/aqua-local-client/session'

interface DraftResponse {
  draft: string
  question_theme: string
  word_limit: number
  drafts_remaining?: number | 'unlimited'
  integration_type?: string
}

interface DraftFeedback {
  type: 'error' | 'info'
  message: string
  actionHref?: string
  actionLabel?: string
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

// Local-first mode (LF-25, IN-01): private answer content stays on the
// device. Saves write NEW immutable versions into the IndexedDB vault via
// repo.createVersion — never Supabase, never fake-saved. When the vault is
// locked the editor says so honestly instead of silently keeping text in
// component state.

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
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error' | 'local-only' | 'locked'>('idle')
  const [isDrafting, setIsDrafting] = useState(false)
  const [draftFeedback, setDraftFeedback] = useState<DraftFeedback | null>(null)
  const [copied, setCopied] = useState(false)
  // IN-01: latest vault version for this question scope (+ its approval).
  const [localVersion, setLocalVersion] = useState<BankVersion | null>(null)

  const supabase = createClient()
  const vault = useVault()
  const storageRef = useRef<import('@/lib/aqua-local-client/session').VaultStorage | null>(null)
  const questionText = initialAnswer?.question_text ?? ''

  // IN-01 load path: under local-first, open the vault lazily and — when
  // already unlocked — read the latest version for this question scope.
  // When the scope has no vault versions yet, fall back to prefilling from
  // the hosted legacy row (never written back server-side).
  useEffect(() => {
    if (!LOCAL_FIRST || !vault.enabled) return
    let cancelled = false
    ;(async () => {
      try {
        const storage = await vault.ensureStorage()
        if (cancelled) return
        storageRef.current = storage
        const secret = vault.getSecret()
        if (!secret) return // locked — honest inline state shows below
        const scoped = await loadScopeEntry(
          storage,
          secret,
          scopeForQuestion(archivedQuestionId, programId),
        )
        if (cancelled) return
        if (scoped.latest) {
          setLocalVersion(scoped.latest.version)
          setContent(scoped.latest.body)
        }
      } catch {
        // Vault open/decrypt failures leave the editor in its prefilled
        // state — the save path reports honestly rather than fake-saving.
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivedQuestionId, programId, vault.enabled, vault.status])

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
    setDraftFeedback(null)
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
        const err = await res.json().catch(() => ({} as Record<string, unknown>))

        if (err?.provider_required) {
          setDraftFeedback({
            type: 'error',
            message: 'Connect Anthropic in Profile -> Integrations, then come back here to draft.',
            actionHref: '/profile/integrations',
            actionLabel: 'Open integrations',
          })
          return
        }

        if (err?.code === 'draft_limit_reached') {
          setDraftFeedback({
            type: 'error',
            message:
              typeof err?.error === 'string'
                ? err.error
                : 'Monthly draft limit reached. Connect your own key to keep drafting.',
            actionHref: '/profile/integrations',
            actionLabel: 'Use your own key',
          })
          return
        }

        throw new Error(
          typeof err?.error === 'string' ? err.error : `Draft request failed (${res.status})`
        )
      }
      const data: DraftResponse = await res.json()
      setContent(data.draft)
      setIsEditing(true)
      if (data.integration_type === 'byok_anthropic') {
        setDraftFeedback({
          type: 'info',
          message: 'Drafted with your connected Anthropic key.',
        })
      } else if (typeof data.drafts_remaining === 'number') {
        setDraftFeedback({
          type: 'info',
          message: `${data.drafts_remaining} hosted draft${data.drafts_remaining === 1 ? '' : 's'} remaining this month.`,
        })
      } else if (data.drafts_remaining === 'unlimited') {
        setDraftFeedback({
          type: 'info',
          message: 'Hosted drafting is available for this account.',
        })
      }
    } catch (e) {
      setDraftFeedback({
        type: 'error',
        message: e instanceof Error ? e.message : 'Draft failed',
      })
    } finally {
      setIsDrafting(false)
    }
  }, [archivedQuestionId, programId])

  const handleSave = useCallback(async () => {
    if (!content.trim()) return

    // Local-first (IN-01): the answer body NEVER goes to Supabase. Save =
    // a new immutable vault version (parent-linked to the shown version),
    // written through repo.createVersion inside the question's exact
    // occurrence scope. A locked vault gets an honest 'locked' state —
    // no silent in-memory-only keep, no fake-save.
    if (LOCAL_FIRST) {
      startTransition(async () => {
      // ensureStorage() re-resolves the uid-keyed DB — a mid-session account
      // switch drops the prior user's handle AND secret (review fix).
      const storage = await vault.ensureStorage().catch(() => null)
      const secret = vault.getSecret()
      if (!secret || !storage) {
        setSaveState('locked')
        setTimeout(() => setSaveState('idle'), 5000)
        return
      }
      try {
          const record = await saveScopedVersion(
            storage,
            secret,
            scopeForQuestion(archivedQuestionId, programId),
            {
              title: questionText || `Answer — ${archivedQuestionId}`,
              body: content,
              method: 'manual',
            },
          )
          setLocalVersion({
            record,
            approval: null,
            provenance: null,
          })
          setSaveState('saved')
          setIsEditing(false)
          setTimeout(() => setSaveState('idle'), 2000)
        } catch {
          setSaveState('error')
          setTimeout(() => setSaveState('idle'), 3000)
        }
      })
      return
    }

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
  }, [content, confidence, wordCount, archivedQuestionId, programId, initialAnswer, supabase, vault, questionText])

  if (!isEditing && !compact) {
    return (
      <>
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
              <div className="flex items-center gap-2">
                <WordCount current={wordCount} limit={wordLimit} charCurrent={charCount} charLimit={charLimit} />
                {LOCAL_FIRST && localVersion?.approval === 'approved' && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-400">
                    Approved
                  </span>
                )}
                {LOCAL_FIRST && localVersion && localVersion.approval !== 'approved' && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                    Vault v{localVersion.record.id.slice(0, 8)}
                  </span>
                )}
              </div>
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
      {/* Stress test — only when answer is saved and has content */}
      {initialAnswer?.id && content.trim() && (
        <StressTestPanel
          answerId={initialAnswer.id}
          programId={programId}
          compact={compact}
        />
      )}
      </>
    )
  }

  return (
    <div className="space-y-3">
      {LOCAL_FIRST && vault.status !== 'unlocked' && (
        <div className="rounded-lg border border-warning-500/30 bg-warning-50/40 dark:bg-warning-950/20 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
          Vault locked —{' '}
          <Link href="/aqua-local" className="font-medium underline underline-offset-2">
            unlock to save on device
          </Link>
          . Your edits are held in this editor only until the vault is unlocked.
        </div>
      )}
      {LOCAL_FIRST && vault.status === 'unlocked' && (
        <div className="rounded-lg border border-brand-500/20 bg-brand-50/40 dark:bg-brand-950/20 px-3 py-2 text-xs text-brand-700 dark:text-brand-300">
          Local-first mode: saving writes a new encrypted version to your device vault — never to the server.
        </div>
      )}
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
        autoFocus={!compact}
      />

      <WordCount
        current={wordCount}
        limit={wordLimit}
        charCurrent={charCount}
        charLimit={charLimit}
      />

      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Confidence toggle — hidden under local-first: vault versions
            carry no confidence field (approval is the lifecycle marker). */}
        {!LOCAL_FIRST && (
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
        )}

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
        {!!content.trim() && (
          <button
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy to clipboard'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-colors border',
              copied
                ? 'border-success-300 dark:border-success-800 text-success-700 dark:text-success-400'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
            )}
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
                Copied
              </>
            ) : (
              <>
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
                Copy
              </>
            )}
          </button>
        )}
      </div>

      {draftFeedback && (
        <div
          className={cn(
            'rounded-lg border px-3 py-2 text-xs flex items-center justify-between gap-3 flex-wrap',
            draftFeedback.type === 'error'
              ? 'border-danger-500/20 bg-danger-50/10 text-danger-600 dark:text-danger-400'
              : 'border-brand-500/20 bg-brand-50/40 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300'
          )}
        >
          <span>{draftFeedback.message}</span>
          {draftFeedback.actionHref && draftFeedback.actionLabel && (
            <a
              href={draftFeedback.actionHref}
              className="font-medium underline underline-offset-2"
            >
              {draftFeedback.actionLabel}
            </a>
          )}
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-2 justify-end">
        {saveState === 'saved' && (
          <span className="text-xs text-success-600 dark:text-success-400">Saved</span>
        )}
        {saveState === 'error' && (
          <span className="text-xs text-danger-600 dark:text-danger-500">Save failed — check console</span>
        )}
        {saveState === 'locked' && (
          <span className="text-xs text-warning-600 dark:text-warning-400">
            Vault locked — unlock at{' '}
            <Link href="/aqua-local" className="font-medium underline underline-offset-2">
              Local vault
            </Link>{' '}
            to save on device
          </span>
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
          {isPending ? 'Saving…' : LOCAL_FIRST ? 'Save to vault' : 'Save answer'}
        </button>
      </div>
      {/* Stress test — only when a saved answer exists */}
      {initialAnswer?.id && content.trim() && (
        <StressTestPanel
          answerId={initialAnswer.id}
          programId={programId}
          compact={compact}
        />
      )}
    </div>
  )
}
