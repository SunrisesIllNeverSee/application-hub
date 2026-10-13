'use client'

import { useEffect, useState } from 'react'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import { LOCAL_FIRST } from '@/lib/aqua-local-client/flag'
import { readBody } from '@/lib/aqua-local-client/session'
import { decryptVersionTitle } from '@/lib/aqua-local'
import type { AnswerRecord, VersionRecord, ApprovalRecord } from '@/lib/aqua-local'
import type { ProfileAnswer, ProgramQuestionWithArchived } from '@/lib/database.types'
import { QuestionTree } from '@/components/QuestionTree'
import { QuestionSidebar, type UnlockedQuestion } from '@/components/QuestionSidebar'
import { CompiledOutput } from '@/components/CompiledOutput'
import { cn } from '@/lib/utils'

const BANK_SCOPE = 'answer-bank'

// IN-01/IRM-007 — read-side vault integration for the workspace. Under
// local-first the server-rendered page only knows hosted profile_answers
// (empty for vault-only users). These client wrappers layer the vault's
// authoritative answer state over the same surfaces: answered markers,
// readiness counts, and the compiled/submit views.

/** Latest approved-or-latest version per question occurrence for one application scope. */
function useVaultOccurrences(programId: string) {
  const vault = useVault()
  const [answered, setAnswered] = useState<Record<string, VersionRecord>>({})
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    if (vault.status !== 'unlocked') {
      setAnswered({})
      setUnlocked(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const storage = await vault.ensureStorage()
        const [answers, versions] = await Promise.all([
          storage.getAll<AnswerRecord>('answers'),
          storage.getAll<VersionRecord>('versions'),
        ])
        const scoped = answers.filter((a) => a.scope.application_id === programId)
        const map: Record<string, VersionRecord> = {}
        for (const a of scoped) {
          const latest = versions
            .filter((v) => v.answer_id === a.id)
            .sort((x, y) => x.created_at.localeCompare(y.created_at) || x.id.localeCompare(y.id))
            .at(-1)
          if (latest) map[a.scope.question_occurrence_id] = latest
        }
        // IR-014: titles are ciphertext at rest — decrypt for display.
        const secret = vault.getSecret()
        if (secret) {
          for (const k of Object.keys(map)) {
            const v = map[k]
            if (v?.title_enc) {
              const title = await decryptVersionTitle(secret, v).catch(() => v.title)
              const { title_enc: _te, ...rest } = v // shallow copy — never write back plaintext
              map[k] = { ...rest, title } as typeof v
            }
          }
        }
        if (!cancelled) {
          setAnswered(map)
          setUnlocked(true)
        }
      } catch {
        if (!cancelled) setUnlocked(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [vault, programId, vault.status])

  return { answered, unlocked }
}

/** QuestionTree that merges vault-scoped answers into the hosted answer map. */
export function VaultAwareQuestionTree(props: {
  programId: string
  questions: ProgramQuestionWithArchived[]
  answerMap: Record<string, ProfileAnswer>
  selectedQuestionId: string | null
  currentTab?: string
}) {
  const { answered } = useVaultOccurrences(props.programId)
  const merged = { ...props.answerMap }
  for (const occ of Object.keys(answered)) {
    // The tree only checks truthiness — a stub row marks it answered.
    if (!merged[occ]) merged[occ] = {} as ProfileAnswer
  }
  return <QuestionTree {...props} answerMap={merged} />
}

/** /questions sidebar with vault-answered markers merged in (answer-bank scope). */
export function VaultAwareQuestionSidebar(props: {
  unlocked: UnlockedQuestion[]
  byTheme: Record<string, UnlockedQuestion[]>
  answerMap: Record<string, ProfileAnswer>
  answeredCount: number
  newToday: number
  isPro: boolean
  totalQuestions: number
  FREE_CAP: number
  selectedQ: string | null
}) {
  const { answered } = useVaultOccurrences(BANK_SCOPE)
  const merged = { ...props.answerMap }
  for (const occ of Object.keys(answered)) {
    if (!merged[occ]) merged[occ] = {} as ProfileAnswer
  }
  const vaultAnswered = props.unlocked.filter((u) => merged[u.archived_question_id]).length
  return (
    <QuestionSidebar {...props} answerMap={merged} answeredCount={vaultAnswered} />
  )
}

/**
 * SP024 — related vault answers for a question (deterministic local text
 * similarity; no embeddings egress). Surfaces reuse candidates in the editor;
 * the user chooses to reuse — nothing auto-fills.
 */
export function RelatedVaultAnswers({
  programId,
  queryText,
  currentVersionId,
  onPick,
}: {
  programId: string | null
  queryText: string
  currentVersionId?: string | null
  onPick: (body: string, title: string, derivedFrom: { version_id: string; version_sha256: string }) => void
}) {
  const vault = useVault()
  const [related, setRelated] = useState<import('@/lib/aqua-local').RelatedAnswer[]>([])

  useEffect(() => {
    if (vault.status !== 'unlocked' || !queryText.trim()) {
      setRelated([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const storage = await vault.ensureStorage()
        const secret = vault.getSecret()
        if (!secret) return
        const { findRelatedVaultAnswers } = await import('@/lib/aqua-local')
        const hits = await findRelatedVaultAnswers(storage, secret, queryText, { limit: 4 })
        if (!cancelled) setRelated(hits.filter((h) => h.version_id !== currentVersionId))
      } catch {
        if (!cancelled) setRelated([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [vault, queryText, currentVersionId])

  if (vault.status !== 'unlocked' || related.length === 0) return null

  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
        Related answers in your vault <span className="text-neutral-400">(local text match — not AI)</span>
      </p>
      <ul className="mt-2 space-y-2">
        {related.map((r) => (
          <li key={r.version_id} className="text-xs">
            <button
              onClick={() => {
                const secret = vault.getSecret()
                if (!secret) return
                void (async () => {
                  const storage = await vault.ensureStorage()
                  const { body } = await readBody(storage, secret, r.version_id)
                  onPick(body, r.title, { version_id: r.version_id, version_sha256: r.version_sha256 })
                })()
              }}
              className="group block w-full text-left"
            >
              <span className="font-medium text-brand-600 group-hover:underline dark:text-brand-400">
                {r.title || 'untitled'}
              </span>
              <span className="ml-2 text-neutral-400">{r.confidence} · {Math.round(r.similarity * 100)}%</span>
              <span className="mt-0.5 block text-neutral-500 dark:text-neutral-400 line-clamp-2">
                {r.preview}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-neutral-400 dark:text-neutral-500">
        Click to insert the answer text into the editor — saving creates a new version under this question.
      </p>
    </div>
  )
}

/** Readiness strip computed from the device vault (authoritative under flag). */
export function VaultReadiness({
  programId,
  questions,
}: {
  programId: string
  questions: { archived_question_id: string; is_required: boolean | null }[]
}) {
  const { answered, unlocked } = useVaultOccurrences(programId)
  const vault = useVault()
  const required = questions.filter((q) => q.is_required)
  const answeredRequired = required.filter((q) => answered[q.archived_question_id]).length
  const answeredTotal = questions.filter((q) => answered[q.archived_question_id]).length
  const pct = required.length > 0 ? Math.round((answeredRequired / required.length) * 100) : 0

  if (!unlocked) {
    return (
      <div className="min-w-[160px]">
        <div className="mb-1 flex items-center justify-between text-[10px] text-neutral-500">
          <span>Readiness</span>
          <span>{vault.status === 'locked' ? 'vault locked' : '…'}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-700" />
      </div>
    )
  }

  return (
    <div className="min-w-[160px]">
      <div className="mb-1 flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-500">
        <span>Readiness (device vault)</span>
        <span className="tabular-nums">
          {answeredRequired}/{required.length} required
        </span>
      </div>
      <div className="w-full rounded-full bg-neutral-200 dark:bg-neutral-700 h-1.5">
        <div
          className={cn(
            'h-1.5 rounded-full transition-all',
            pct >= 80 ? 'bg-success-500' : pct >= 50 ? 'bg-brand-500' : 'bg-warning-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-neutral-400 dark:text-neutral-500">
        {answeredTotal} vault answer{answeredTotal === 1 ? '' : 's'} on this device
      </p>
    </div>
  )
}

/** Compiled output sourced from the latest vault version under local-first. */
export function VaultCompiledOutput(props: {
  programId: string
  question: string | null
  archivedQuestionId: string
  hostedAnswer: string
  wordLimit?: number
  charLimit?: number
}) {
  const { answered } = useVaultOccurrences(props.programId)
  const vault = useVault()
  const [body, setBody] = useState('')
  const version = answered[props.archivedQuestionId] ?? null

  useEffect(() => {
    if (!version) {
      setBody('')
      return
    }
    const secret = vault.getSecret()
    if (!secret) return
    let cancelled = false
    ;(async () => {
      try {
        const storage = await vault.ensureStorage()
        const { body } = await readBody(storage, secret, version.id)
        if (!cancelled) setBody(body)
      } catch {
        if (!cancelled) setBody('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [version, vault])

  return (
    <CompiledOutput
      question={props.question ?? ''}
      answer={version ? body : props.hostedAnswer}
      wordLimit={props.wordLimit}
      charLimit={props.charLimit}
    />
  )
}
