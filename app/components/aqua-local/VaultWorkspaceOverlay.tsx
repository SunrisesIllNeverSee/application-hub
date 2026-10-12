'use client'

import { useEffect, useState } from 'react'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import { LOCAL_FIRST } from '@/lib/aqua-local-client/flag'
import { readBody } from '@/lib/aqua-local-client/session'
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
