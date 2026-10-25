'use client'

// M09 W5 — evidence-based answer review card (directive §7).
//
// Four separated sections (question context / proposed final answer /
// evidence / agent recommendation) and four controls:
//   APPROVE         → approveAsHuman with the DISPLAYED version id + sha256,
//                     after an explicit confirm step
//   EDIT            → editAsChildVersion (new child; approval never carries)
//                     or "Ask agent to revise" (BYOK, consented) → a new
//                     SUGGESTED child version, never approved
//   EVIDENCE / HELP → addEvidenceRecord + linkEvidenceRecord, or a human
//                     request (requestEvidenceOrHelp) — never an approval
//   DISCUSS         → addVersionComment bound to the displayed version
// Status, recommendation, human review and approval are four separate
// labelled signals (StatusStrip) — never one badge.

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import { currentResolvedUid } from '@/lib/aqua-local-client/session'
import {
  addEvidenceRecord,
  addVersionComment,
  approveAsHuman,
  editAsChildVersion,
  linkEvidenceRecord,
  LOCAL_ACTOR_ID,
  recordAgentSuggestion,
  requestEvidenceOrHelp,
  revokeAsHuman,
  saveInstanceDraft,
  setEvidenceStatus,
} from '@/lib/aqua-local-client/review'
import type { InstanceQuestionRow } from '@/lib/aqua-local-client/review'
import { loadCard, type ReviewContext } from '@/lib/review-ui/load'
import { checkLimits, type ReviewCardVM, type Tone } from '@/lib/review-ui/view-model'
import { getAccessToken, hostedApprove, HostedApiError, type HostedWorkspaceRow } from '@/lib/aqua-hosted'
import { WordCount } from '@/components/WordCount'
import { LocalDraftAssist, type DraftAssistResult } from '@/components/aqua-local/LocalDraftAssist'
import { BulletList, Field, formatWhen, INPUT_CLASS, Notice, Pill, Section } from './ui'

type Mode = null | 'approve' | 'revoke' | 'edit' | 'revise' | 'evidence' | 'discuss'
type EvidenceMode = 'attach' | 'challenge' | 'explain' | 'more'

function actorId(): string {
  return currentResolvedUid() || LOCAL_ACTOR_ID
}

async function sha256HexOf(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function StatusStrip({ vm }: { vm: ReviewCardVM }) {
  const approvalTone: Tone =
    vm.approval.state === 'approved' ? 'success' : vm.approval.state === 'revoked' ? 'danger' : vm.approval.state === 'approved_older' ? 'warning' : 'neutral'
  const items: Array<{ k: string; v: string; tone: Tone; title?: string; testId: string }> = [
    { k: 'Status', v: vm.status.label, tone: vm.status.tone, testId: 'signal-status' },
    {
      k: 'Recommendation',
      v: vm.recommendation_badge.classification ? vm.recommendation_badge.label.replace('Agent recommendation: ', 'Agent: ') : 'None',
      tone: 'info',
      title: 'Agent/system advice — not evidence, not approval',
      testId: 'signal-recommendation',
    },
    { k: 'Human review', v: vm.human_review.label, tone: vm.human_review.decision ? 'warning' : 'neutral', testId: 'signal-review' },
    {
      k: 'Approval',
      v: vm.approval.state === 'approved' ? `Approved · sha256 ${vm.approval.bound_sha_prefix}…` : vm.approval.label,
      tone: approvalTone,
      testId: 'signal-approval',
    },
  ]
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Review signals">
      {items.map((i) => (
        <div key={i.k} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{i.k}</dt>
          <dd data-testid={i.testId}>
            <Pill tone={i.tone} title={i.title} className="max-w-full whitespace-normal text-left">
              {i.v}
            </Pill>
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function ReviewCard({
  instanceId,
  row,
  context,
  index,
  onChanged,
  headerActions,
  hosted,
}: {
  instanceId: string
  row: InstanceQuestionRow
  context: ReviewContext
  index: number
  /** Called after every vault write so the board can re-derive statuses. */
  onChanged: () => Promise<void> | void
  headerActions?: React.ReactNode
  /** The account's hosted workspace row when one exists — activates the
      opt-in "also record on the hosted workspace" approval leg. Null keeps
      approvals vault-local (the default). */
  hosted?: HostedWorkspaceRow | null
}) {
  const vault = useVault()
  const headingId = useId()
  const [vm, setVm] = useState<ReviewCardVM | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ tone: Tone; text: string } | null>(null)
  const [mode, setMode] = useState<Mode>(null)
  const [busy, setBusy] = useState(false)
  const [reviseSeed, setReviseSeed] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)

  const reload = useCallback(async () => {
    const secret = vault.getSecret()
    if (!secret) {
      setError('Vault is locked — unlock to review.')
      setLoading(false)
      return
    }
    try {
      const storage = await vault.ensureStorage()
      const next = await loadCard(storage, secret, { instance_id: instanceId, row, context, now: new Date().toISOString() })
      setVm(next)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this answer')
    } finally {
      setLoading(false)
    }
  }, [vault, instanceId, row, context])

  useEffect(() => {
    setLoading(true)
    void reload()
  }, [reload])

  // A different question resets the controls (not a re-derived row).
  useEffect(() => {
    setMode(null)
    setNotice(null)
  }, [row.question_occurrence_id])

  useEffect(() => {
    headingRef.current?.focus()
  }, [row.question_occurrence_id])

  async function run(
    label: string,
    fn: (storage: Awaited<ReturnType<typeof vault.ensureStorage>>, secret: string) => Promise<string | { tone: Tone; text: string }>,
  ) {
    const secret = vault.getSecret()
    if (!secret) {
      setNotice({ tone: 'danger', text: 'Vault is locked — unlock to continue.' })
      return
    }
    setBusy(true)
    try {
      const storage = await vault.ensureStorage()
      const out = await fn(storage, secret)
      // A partial outcome (e.g. the hosted leg failed after the vault write
      // landed) is surfaced at the tone the writer chose — never flattened
      // into a bare success.
      setNotice(typeof out === 'string' ? { tone: 'success', text: out } : out)
      setMode(null)
      await onChanged()
    } catch (e) {
      setNotice({ tone: 'danger', text: `${label} failed: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setBusy(false)
    }
  }

  if (loading && !vm) {
    return <div className="p-6 text-sm text-neutral-500" role="status">Decrypting this answer…</div>
  }
  if (error && !vm) {
    return <div className="p-6"><Notice tone="danger">{error}</Notice></div>
  }
  if (!vm) return null

  const a = vm.answer
  const ctx = vm.context

  return (
    <article aria-labelledby={headingId} className="space-y-4" data-testid="review-card" data-occ={vm.question_occurrence_id}>
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h2
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className="text-base font-semibold leading-snug text-neutral-900 focus:outline-none dark:text-white"
          >
            <span className="mr-1.5 text-neutral-400">Q{index + 1}</span>
            {ctx.original_question ?? vm.question_occurrence_id}
          </h2>
          {headerActions}
        </div>
        <StatusStrip vm={vm} />
        {vm.status.reasons.length > 0 && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{vm.status.reasons.join(' ')}</p>
        )}
      </header>

      {notice && <Notice tone={notice.tone} testId="card-notice">{notice.text}</Notice>}

      {/* 1 — Question context */}
      <Section title="Question context" testId="section-context">
        <dl className="space-y-2">
          <Field term="Program">
            {ctx.program_name ?? '—'}
            {ctx.org_name ? <span className="text-neutral-500"> · {ctx.org_name}</span> : null}
          </Field>
          <Field term="Original question">
            <span data-testid="original-question">{ctx.original_question ?? <em className="text-neutral-500">Wording unavailable — open this review from the application workspace.</em>}</span>
          </Field>
          <Field term="Canonical question">
            {ctx.canonical_question_id ? (
              <>
                <code className="break-all text-xs">{ctx.canonical_question_id}</code>
                {ctx.canonical_text && ctx.canonical_text !== ctx.original_question ? <span className="block text-neutral-600 dark:text-neutral-400">{ctx.canonical_text}</span> : null}
              </>
            ) : (
              <span className="text-neutral-500">Not matched to a canonical question</span>
            )}
          </Field>
          <Field term="Requirements">{ctx.requirements.join(' · ')}</Field>
          <Field term="Deadline">{ctx.deadline_label ?? '—'}</Field>
        </dl>
      </Section>

      {/* 2 — Proposed final answer */}
      <Section title="Proposed final answer" testId="section-answer">
        {a ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
              <span data-testid="version-number" className="font-semibold text-neutral-800 dark:text-neutral-200">
                v{a.version_number} of {a.version_count}
              </span>
              <span>
                {a.method_label}
                {a.provider ? ` · ${a.provider}${a.model ? ` / ${a.model}` : ''}` : ''}
              </span>
              <span>Last edited {formatWhen(a.created_at)}</span>
            </div>
            {a.title && <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{a.title}</p>}
            <div data-testid="answer-body" className="space-y-2 text-[15px] leading-relaxed text-neutral-900 dark:text-neutral-100">
              {a.paragraphs.map((p, i) => (
                <p key={i} className="whitespace-pre-wrap">{p}</p>
              ))}
            </div>
            <WordCount
              current={a.limits.word_count}
              limit={a.limits.word_limit ?? undefined}
              charCurrent={a.limits.char_count}
              charLimit={a.limits.char_limit ?? undefined}
            />
            {!a.limits.char_limit && <p className="text-xs text-neutral-500">{a.limits.char_count} characters</p>}
            {a.limits.over_limit && (
              <Notice tone="warning">
                Over the limit
                {a.limits.over_word_by ? ` by ${a.limits.over_word_by} word${a.limits.over_word_by === 1 ? '' : 's'}` : ''}
                {a.limits.over_char_by ? `${a.limits.over_word_by ? ' and' : ' by'} ${a.limits.over_char_by} characters` : ''}.
              </Notice>
            )}
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Version <code className="break-all">{a.version_id}</code> · sha256{' '}
              <code data-testid="answer-sha" className="break-all">{a.sha256}</code>
            </p>
            <p className="text-xs" data-testid="approval-detail">
              <span className="font-medium text-neutral-800 dark:text-neutral-200">{vm.approval.label}.</span>{' '}
              <span className="text-neutral-500 dark:text-neutral-400">{vm.approval.detail}</span>
            </p>
          </div>
        ) : (
          <p className="text-sm font-medium text-danger-600 dark:text-danger-500">No answer has been written for this question yet.</p>
        )}
      </Section>

      {/* 3 — Evidence */}
      <Section title="Evidence" testId="section-evidence">
        <EvidenceBlock vm={vm} busy={busy} onConfirm={(id) => run('Confirm evidence', async (storage) => {
          await setEvidenceStatus(storage, id, { verification: 'user_confirmed' })
          return 'Evidence marked as confirmed by you.'
        })} />
      </Section>

      {/* 4 — Agent recommendation (visually distinct) */}
      <Section
        title="Agent recommendation"
        variant="recommendation"
        testId="section-recommendation"
        label={
          <span className="rounded border border-brand-300 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-brand-700 dark:border-brand-700 dark:text-brand-300">
            Recommendation — not evidence, not approval
          </span>
        }
      >
        <RecommendationBlock vm={vm} />
      </Section>

      {/* Controls */}
      <div className="sticky bottom-0 z-10 -mx-1 rounded-lg border border-neutral-200 bg-white/95 p-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Review controls">
          {vm.approval.state === 'approved' ? (
            <button
              type="button"
              data-testid="control-revoke"
              onClick={() => setMode(mode === 'revoke' ? null : 'revoke')}
              aria-expanded={mode === 'revoke'}
              className="btn-secondary px-3 py-2 text-xs"
            >
              Revoke approval
            </button>
          ) : (
            <button
              type="button"
              data-testid="control-approve"
              disabled={!a}
              onClick={() => setMode(mode === 'approve' ? null : 'approve')}
              aria-expanded={mode === 'approve'}
              className="inline-flex items-center justify-center rounded-lg bg-success-700 px-3 py-2 text-xs font-medium text-white hover:bg-success-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Approve{a ? ` v${a.version_number}` : ''}
            </button>
          )}
          <button type="button" data-testid="control-edit" onClick={() => setMode(mode === 'edit' || mode === 'revise' ? null : 'edit')} aria-expanded={mode === 'edit' || mode === 'revise'} className="btn-secondary px-3 py-2 text-xs">
            {a ? 'Edit' : 'Write answer'}
          </button>
          <button type="button" data-testid="control-evidence" disabled={!a} onClick={() => setMode(mode === 'evidence' ? null : 'evidence')} aria-expanded={mode === 'evidence'} className="btn-secondary px-3 py-2 text-xs">
            Evidence / Help
          </button>
          <button type="button" data-testid="control-discuss" disabled={!a} onClick={() => setMode(mode === 'discuss' ? null : 'discuss')} aria-expanded={mode === 'discuss'} className="btn-secondary px-3 py-2 text-xs">
            Discuss{vm.comments.total ? ` (${vm.comments.total})` : ''}
          </button>
        </div>
      </div>

      {mode === 'approve' && a && (
        <ApproveConfirm
          vm={vm}
          busy={busy}
          hosted={hosted ?? null}
          onCancel={() => setMode(null)}
          onConfirm={(alsoHosted, hostedSecret) =>
            run('Approval', async (storage, secret) => {
              // The vault write is unchanged and stays first: it is the
              // record this board derives statuses from.
              const rec = await approveAsHuman(storage, {
                version_id: a.version_id,
                expected_sha256: a.sha256,
                actor_id: actorId(),
                via: 'review_ui',
                secret,
              })
              const base = `Approved v${a.version_number} — bound to sha256 ${rec.version_sha256.slice(0, 12)}…. Any edit creates a new version that needs a new approval.`
              if (!alsoHosted) return base
              // Hosted leg (opt-in per approval): the server re-verifies
              // the reviewed content hash against the live version row and
              // refuses on mismatch/not-found — failures surface honestly
              // and never roll back or disguise the local approval.
              try {
                const token = await getAccessToken()
                if (!token) throw new HostedApiError(0, 'not_signed_in', 'no session token for the hosted call')
                const res = await hostedApprove(
                  { version_id: a.version_id, expected_sha256: a.sha256, actor_id: actorId(), approval_secret: hostedSecret },
                  token,
                )
                return {
                  tone: 'success',
                  text: `${base} ${res.already_recorded ? 'The hosted workspace already held this approval.' : 'It was also recorded on your hosted workspace.'}`,
                }
              } catch (e) {
                const why =
                  e instanceof HostedApiError
                    ? `${e.code}${e.status ? ` (${e.status})` : ''}`
                    : e instanceof Error
                      ? e.message
                      : String(e)
                return {
                  tone: 'warning',
                  text: `${base} Recording it on the hosted workspace failed — ${why}. The vault approval above stands.`,
                }
              }
            })
          }
        />
      )}

      {mode === 'revoke' && a && (
        <div className="space-y-2 rounded-lg border border-danger-500/30 p-3" role="region" aria-label="Revoke approval">
          <p className="text-sm text-neutral-800 dark:text-neutral-200">
            Revoke your approval of v{a.version_number} (sha256 <code>{a.sha_prefix}…</code>)? The version stays; it will no longer qualify for a packet.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setMode(null)}>Cancel</button>
            <button
              type="button"
              disabled={busy}
              data-testid="confirm-revoke"
              className="inline-flex items-center rounded-lg bg-danger-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              onClick={() =>
                run('Revocation', async (storage) => {
                  await revokeAsHuman(storage, { version_id: a.version_id, expected_sha256: a.sha256, actor_id: actorId(), via: 'review_ui' })
                  return `Approval of v${a.version_number} revoked.`
                })
              }
            >
              Confirm revocation
            </button>
          </div>
        </div>
      )}

      {(mode === 'edit' || mode === 'revise') && (
        <EditPanel
          vm={vm}
          row={row}
          mode={mode}
          busy={busy}
          initialInstruction={reviseSeed}
          setMode={(m) => {
            if (m !== 'revise') setReviseSeed('')
            setMode(m)
          }}
          onSave={(title, body) =>
            run('Save', async (storage, secret) => {
              if (a) {
                // Evidence cited on the displayed version carries forward as
                // citations of the child (metadata only — not in the hash).
                const v = await editAsChildVersion(storage, secret, {
                  parent_version_id: a.version_id,
                  body,
                  title: title || undefined,
                  evidence_ids: vm.evidence.items.map((e) => e.evidence_id),
                })
                return `Saved v${a.version_count + 1} (sha256 ${v.sha256.slice(0, 12)}…). It is NOT approved${vm.approval.state === 'approved' ? ` — the approval of v${a.version_number} does not carry over` : ''}.`
              }
              const v = await saveInstanceDraft(storage, secret, instanceId, row.question_occurrence_id, { title, body })
              return `Saved v1 (sha256 ${v.sha256.slice(0, 12)}…). Review it, then approve when ready.`
            })
          }
          onRevised={(instruction, r) =>
            run('Agent revision', async (storage, secret) => {
              if (!a) throw new Error('Nothing to revise yet')
              const v = await editAsChildVersion(storage, secret, {
                parent_version_id: a.version_id,
                body: r.text,
                method: 'byok',
                provider: r.provider,
                model: r.model,
                provenance: `consent:${r.consent_id}`,
                evidence_ids: vm.evidence.items.map((e) => e.evidence_id),
              })
              await recordAgentSuggestion(storage, secret, {
                instance_id: instanceId,
                question_occurrence_id: row.question_occurrence_id,
                kind: 'draft',
                candidate_version_id: v.id,
                explanation: `Revised by ${r.provider}${r.model ? ` / ${r.model}` : ''} at your request: “${instruction}”`,
                provider: r.provider,
                model: r.model,
              })
              await addVersionComment(storage, secret, {
                version_id: a.version_id,
                expected_sha256: a.sha256,
                body: `Revision requested from agent: ${instruction}`,
                actor_class: 'human',
                actor_id: actorId(),
              })
              return `Agent revision saved as v${a.version_count + 1} — status Suggested. It is not approved; review it like any other version.`
            })
          }
        />
      )}

      {mode === 'evidence' && a && (
        <EvidencePanel
          vm={vm}
          busy={busy}
          onCancel={() => setMode(null)}
          onAttach={(input) =>
            run('Attach evidence', async (storage, secret) => {
              const rec = await addEvidenceRecord(storage, secret, {
                kind: input.kind,
                title: input.title,
                excerpt: input.excerpt || null,
                url: input.url || null,
                content_sha256: input.content_sha256,
                verification: input.confirmed ? 'user_confirmed' : 'unverified',
                freshness_checked_at: input.confirmed ? new Date().toISOString() : null,
              })
              await linkEvidenceRecord(storage, rec.evidence_id, { target_kind: 'version', target_id: a.version_id })
              return `Evidence linked to v${a.version_number}. Evidence supports review — it is not an approval.`
            })
          }
          onRequest={(kind, note) =>
            run('Request', async (storage, secret) => {
              await requestEvidenceOrHelp(storage, secret, {
                version_id: a.version_id,
                expected_sha256: a.sha256,
                kind,
                note,
                actor_id: actorId(),
              })
              return `Request recorded on v${a.version_number}. This is a request — it is NOT an approval.`
            })
          }
        />
      )}

      {mode === 'discuss' && a && (
        <DiscussPanel
          vm={vm}
          busy={busy}
          onAsk={(text) => {
            setMode('revise')
            setReviseSeed(text)
          }}
          onComment={(body, parent) =>
            run('Comment', async (storage, secret) => {
              await addVersionComment(storage, secret, {
                version_id: a.version_id,
                expected_sha256: a.sha256,
                body,
                parent_comment_id: parent,
                actor_class: 'human',
                actor_id: actorId(),
              })
              return `Comment added on v${a.version_number}.`
            })
          }
        />
      )}
      {mode !== 'discuss' && vm.comments.total > 0 && mode !== 'edit' && mode !== 'revise' && (
        <p className="text-xs text-neutral-500">
          {vm.comments.total} comment{vm.comments.total === 1 ? '' : 's'} across versions — open Discuss to read or reply.
        </p>
      )}
    </article>
  )
}

// ---------------------------------------------------------------------------

function ApproveConfirm({
  vm,
  busy,
  hosted,
  onCancel,
  onConfirm,
}: {
  vm: ReviewCardVM
  busy: boolean
  /** Non-null when the account has a hosted workspace — shows the opt-in
      leg. Absent → approvals stay vault-local only. */
  hosted: HostedWorkspaceRow | null
  onCancel: () => void
  /** `alsoHosted` = the user asked to also record the approval on the
      hosted workspace (the checkbox below is that choice). */
  onConfirm: (alsoHosted: boolean, approvalSecret: string) => void
}) {
  const a = vm.answer!
  const confirmRef = useRef<HTMLButtonElement>(null)
  const [alsoHosted, setAlsoHosted] = useState(false)  // opt-in per approval; init consent is the gate
  const [approvalSecret, setApprovalSecret] = useState('')
  const secretId = useId()
  useEffect(() => confirmRef.current?.focus(), [])
  return (
    <div role="region" aria-label="Confirm approval" data-testid="approve-confirm" className="space-y-3 rounded-lg border-2 border-success-500/50 bg-success-50/60 p-3 dark:bg-success-700/10">
      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
        Approve v{a.version_number} exactly as displayed above?
      </p>
      <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-700 dark:text-neutral-300">
        <li>
          Your approval is bound to version <code className="break-all">{a.version_id}</code> and content hash
        </li>
      </ul>
      <p className="rounded-md bg-white px-2 py-1.5 font-mono text-[11px] text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200" data-testid="approve-bound-sha">
        <span className="font-bold">{a.sha256.slice(0, 12)}</span>
        <span className="break-all">{a.sha256.slice(12)}</span>
      </p>
      <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-700 dark:text-neutral-300">
        <li>If the stored content changed since it was displayed, the vault refuses the approval.</li>
        <li>Any later edit creates a new version; this approval will not carry over to it.</li>
        {vm.recommendation_badge.classification && <li>The agent recommendation is advice only — your click here is the approval.</li>}
      </ul>
      {hosted && (
        <label className="flex items-start gap-2 rounded-md border border-neutral-200 px-2.5 py-2 text-xs text-neutral-700 dark:border-neutral-700 dark:text-neutral-300" data-testid="hosted-approve-option">
          <input
            type="checkbox"
            checked={alsoHosted}
            disabled={busy}
            onChange={(e) => {
              setAlsoHosted(e.target.checked)
              setApprovalSecret('')
            }}
            className="mt-0.5"
          />
          <span>
            Also record this approval on my <strong>hosted workspace</strong> (bound to the same version + hash). The hosted
            version must already exist there; this does not sync your vault. The server re-checks its content hash.
            Your vault approval is unaffected by the hosted result.
          </span>
        </label>
      )}
      {hosted && alsoHosted && (
        <label htmlFor={secretId} className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
          Hosted approval secret
          <input id={secretId} type="password" autoComplete="off" minLength={8} required disabled={busy}
            value={approvalSecret} onChange={(event) => setApprovalSecret(event.target.value)}
            className={`${INPUT_CLASS} mt-1 w-full`} />
        </label>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary px-3 py-1.5 text-xs">
          Cancel
        </button>
        <button
          ref={confirmRef}
          type="button"
          data-testid="confirm-approve"
          disabled={busy || (alsoHosted && approvalSecret.trim().length < 8)}
          onClick={() => {
            onConfirm(alsoHosted, approvalSecret)
            setApprovalSecret('')
          }}
          className="inline-flex items-center rounded-lg bg-success-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-success-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-500 disabled:opacity-50"
        >
          {busy ? 'Recording…' : `Confirm approval of v${a.version_number} · ${a.sha256.slice(0, 12)}…`}
        </button>
      </div>
    </div>
  )
}

function EvidenceBlock({ vm, busy, onConfirm }: { vm: ReviewCardVM; busy: boolean; onConfirm: (id: string) => void }) {
  const ev = vm.evidence
  return (
    <div className="space-y-3">
      {ev.items.length === 0 ? (
        <p data-testid="evidence-gap" className="rounded-md border border-dashed border-danger-500/40 px-3 py-2 text-sm font-medium text-danger-600 dark:text-danger-500">
          No evidence linked to this version.
        </p>
      ) : (
        <ul className="space-y-2" data-testid="evidence-list">
          {ev.items.map((it) => (
            <li key={it.evidence_id} className="rounded-md border border-neutral-200 bg-white p-2.5 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{it.title}</span>
                <span className="rounded border border-neutral-200 px-1.5 text-[10px] uppercase text-neutral-500 dark:border-neutral-700">{it.kind}</span>
                <Pill tone={it.verification === 'unverified' ? 'warning' : 'success'}>{it.verification_label}</Pill>
                <span className={cn('text-[11px]', it.stale ? 'text-warning-700 dark:text-warning-400' : 'text-neutral-500')}>{it.freshness_label}</span>
              </div>
              {it.excerpt && <blockquote className="mt-1.5 border-l-2 border-neutral-300 pl-2 text-sm text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">{it.excerpt}</blockquote>}
              {it.url && (
                <p className="mt-1 text-xs">
                  {/^https?:\/\//i.test(it.url) ? (
                    <a href={it.url} target="_blank" rel="noopener noreferrer" className="break-all text-brand-600 underline underline-offset-2 dark:text-brand-400">
                      {it.url}
                    </a>
                  ) : (
                    <code className="break-all">{it.url}</code>
                  )}
                </p>
              )}
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[10px] text-neutral-400">content sha256 {it.content_sha_prefix}…</span>
                {it.verification === 'unverified' && (
                  <button type="button" disabled={busy} onClick={() => onConfirm(it.evidence_id)} className="text-[11px] text-brand-600 underline underline-offset-2 disabled:opacity-50 dark:text-brand-400">
                    Mark confirmed
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {ev.missing_ids.length > 0 && <Notice tone="warning">{ev.missing_ids.length} cited evidence record(s) are missing from this vault.</Notice>}

      <div>
        <h4 className="mb-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300">Unsupported or uncertain claims</h4>
        {ev.uncertain_claims.length === 0 ? (
          <p className="text-xs text-neutral-500">No claims flagged.</p>
        ) : (
          <ul className="space-y-1" data-testid="uncertain-claims">
            {ev.uncertain_claims.map((c, i) => (
              <li key={i} className="text-sm text-neutral-800 dark:text-neutral-200">
                {c.text}{' '}
                <Pill tone={c.source === 'agent' ? 'info' : 'warning'}>{c.source === 'agent' ? 'flagged by agent' : 'challenged by you'}</Pill>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="mb-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300">Provenance and version lineage</h4>
        {ev.derived_from && (
          <p className="mb-1.5 text-xs text-neutral-600 dark:text-neutral-400" data-testid="derived-from">
            Started from another answer{ev.derived_from.title ? ` “${ev.derived_from.title}”` : ''}
            {ev.derived_from.question_occurrence_id ? ` (question ${ev.derived_from.question_occurrence_id})` : ''} · version{' '}
            <code>{ev.derived_from.version_id.slice(0, 8)}…</code> · sha256 <code>{ev.derived_from.version_sha256.slice(0, 12)}…</code>
            {ev.derived_from.found ? '' : ' (source no longer in this vault)'}. Its approval does not transfer.
          </p>
        )}
        {ev.lineage.length === 0 ? (
          <p className="text-xs text-neutral-500">No versions yet.</p>
        ) : (
          <ol className="space-y-1.5" data-testid="lineage">
            {[...ev.lineage].reverse().map((l) => (
              <li key={l.id} className={cn('rounded-md border px-2 py-1.5 text-xs', l.is_governing ? 'border-brand-300 dark:border-brand-700' : 'border-neutral-200 dark:border-neutral-800')}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">v{l.number}</span>
                  {l.is_governing && <Pill tone="info">displayed</Pill>}
                  {l.approved && <Pill tone="success">approved</Pill>}
                  <span className="text-neutral-500">{l.method_label}</span>
                  <span className="text-neutral-500">{formatWhen(l.created_at)}</span>
                  {l.parent_number && <span className="text-neutral-500">child of v{l.parent_number}</span>}
                  {l.derived_from_version_id && <span className="text-neutral-500">derived from another answer</span>}
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-neutral-400">sha256 {l.sha_prefix}…</div>
                {l.decisions.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {l.decisions.map((d, i) => (
                      <li key={i} className="text-[11px] text-neutral-600 dark:text-neutral-400">
                        {d.label} · {formatWhen(d.at)}
                        {d.via ? ` · via ${d.via.replace('_', ' ')}` : ''}
                        {d.restored ? ' · restored (does not count)' : ''}
                        {!d.hash_matches ? ' · hash mismatch (does not count)' : ''}
                        {d.note ? ` — “${d.note}”` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function RecommendationBlock({ vm }: { vm: ReviewCardVM }) {
  const r = vm.recommendation
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100" data-testid="classification">
          {r.classification_label}
        </p>
        {r.classification_reasons.length > 0 && <BulletList items={r.classification_reasons} empty="" />}
        {r.candidate && (
          <p className="mt-1 text-xs text-neutral-500">
            Best bank candidate <code>{r.candidate.version_id.slice(0, 8)}…</code> · similarity {Math.round(r.candidate.similarity * 100)}%
          </p>
        )}
      </div>
      <Sub title="Why this answer"><BulletList items={r.why} empty="No rationale recorded." /></Sub>
      <Sub title="Closeness to the question"><p className="text-sm text-neutral-800 dark:text-neutral-200">{r.closeness?.label ?? 'Not computed (no answer or no question wording).'}</p></Sub>
      <Sub title="Potential weaknesses"><BulletList items={r.weaknesses} empty="None detected." /></Sub>
      <Sub title="Missing evidence"><BulletList items={r.missing_evidence} empty="None detected." /></Sub>
      <Sub title="Conflicts with your facts">
        <BulletList items={r.fact_conflicts.map((f) => f.message)} empty="No conflicts detected (local heuristic check)." />
      </Sub>
      <Sub title="Suggested improvements"><BulletList items={r.improvements} empty="None." /></Sub>
      {r.agent_notes.length > 0 && (
        <Sub title="Agent notes">
          <ul className="space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
            {r.agent_notes.map((n, i) => (
              <li key={i}>
                <span className="font-medium">{n.kind}</span>
                {n.provider ? ` · ${n.provider}${n.model ? ` / ${n.model}` : ''}` : ''} · {formatWhen(n.created_at)}
              </li>
            ))}
          </ul>
        </Sub>
      )}
    </div>
  )
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300">{title}</h4>
      {children}
    </div>
  )
}

function EditPanel({
  vm,
  row,
  mode,
  busy,
  initialInstruction,
  setMode,
  onSave,
  onRevised,
}: {
  vm: ReviewCardVM
  row: InstanceQuestionRow
  mode: 'edit' | 'revise'
  busy: boolean
  initialInstruction: string
  setMode: (m: Mode) => void
  onSave: (title: string, body: string) => void
  onRevised: (instruction: string, r: DraftAssistResult) => void
}) {
  const a = vm.answer
  const [title, setTitle] = useState(a?.title ?? '')
  const [body, setBody] = useState(a?.body ?? '')
  const [instruction, setInstruction] = useState(initialInstruction)
  const [askAgent, setAskAgent] = useState(false)
  const bodyId = useId()
  const instrId = useId()
  const limits = checkLimits(body, vm.context.word_limit, vm.context.char_limit)
  const unchanged = a ? body === a.body && title === a.title : false

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800" role="region" aria-label="Edit answer">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Edit mode">
        <button type="button" role="tab" aria-selected={mode === 'edit'} onClick={() => setMode('edit')} className={cn('rounded-md px-3 py-1 text-xs font-medium', mode === 'edit' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300')}>
          Edit directly
        </button>
        {a && (
          <button type="button" role="tab" data-testid="tab-revise" aria-selected={mode === 'revise'} onClick={() => setMode('revise')} className={cn('rounded-md px-3 py-1 text-xs font-medium', mode === 'revise' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300')}>
            Ask agent to revise
          </button>
        )}
      </div>

      {mode === 'edit' ? (
        <>
          <p className="text-xs text-neutral-500">
            Saving creates {a ? `v${a.version_count + 1}, a new child of v${a.version_number}` : 'v1'}. Earlier versions and their decisions stay readable.
            {vm.approval.state === 'approved' ? ' The current approval stays on the old hash and does not carry over.' : ''}
          </p>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={cn(INPUT_CLASS, 'mt-1')} />
          </label>
          <label htmlFor={bodyId} className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Answer</label>
          <textarea id={bodyId} data-testid="edit-body" value={body} onChange={(e) => setBody(e.target.value)} rows={8} className={cn(INPUT_CLASS, 'resize-y')} />
          <WordCount current={limits.word_count} limit={limits.word_limit ?? undefined} charCurrent={limits.char_count} charLimit={limits.char_limit ?? undefined} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMode(null)} className="btn-secondary px-3 py-1.5 text-xs">Cancel</button>
            <button type="button" data-testid="save-edit" disabled={busy || !body.trim() || unchanged} onClick={() => onSave(title.trim(), body)} className="btn-primary px-3 py-1.5 text-xs">
              {busy ? 'Encrypting & saving…' : `Save as new version (v${a ? a.version_count + 1 : 1})`}
            </button>
          </div>
        </>
      ) : (
        <>
          <label htmlFor={instrId} className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            What should change? (your instruction — sent to your provider only after you authorize)
          </label>
          <textarea id={instrId} data-testid="revise-instruction" value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={3} className={cn(INPUT_CLASS, 'resize-y')} placeholder="e.g. Use current 2026 numbers and drop the reference to the earlier program." />
          <p className="text-xs text-neutral-500">The agent&apos;s revision becomes a new <strong>suggested</strong> version. It is never approved automatically.</p>
          {!askAgent ? (
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMode(null)} className="btn-secondary px-3 py-1.5 text-xs">Cancel</button>
              <button type="button" disabled={!instruction.trim()} onClick={() => setAskAgent(true)} className="btn-primary px-3 py-1.5 text-xs">Continue to consent</button>
            </div>
          ) : (
            <LocalDraftAssist
              archivedQuestionId={row.question_occurrence_id}
              questionText={vm.context.original_question ?? ''}
              wordLimit={vm.context.word_limit ?? undefined}
              currentDraft={a?.body ?? ''}
              revisionInstruction={instruction}
              onResult={(r) => onRevised(instruction.trim(), r)}
              onCancel={() => setAskAgent(false)}
            />
          )}
        </>
      )}
    </div>
  )
}

function EvidencePanel({
  vm,
  busy,
  onCancel,
  onAttach,
  onRequest,
}: {
  vm: ReviewCardVM
  busy: boolean
  onCancel: () => void
  onAttach: (input: { kind: 'note' | 'url' | 'passage' | 'document'; title: string; excerpt: string; url: string; content_sha256?: string; confirmed: boolean }) => void
  onRequest: (kind: 'evidence_requested' | 'help_requested', note: string) => void
}) {
  const [tab, setTab] = useState<EvidenceMode>('attach')
  const [kind, setKind] = useState<'note' | 'url' | 'passage' | 'document'>('note')
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [url, setUrl] = useState('')
  const [fileSha, setFileSha] = useState<string | undefined>(undefined)
  const [fileName, setFileName] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [text, setText] = useState('')
  const [fileError, setFileError] = useState('')

  async function onFile(f: File | null) {
    setFileError('')
    if (!f) return
    if (f.size > 5 * 1024 * 1024) {
      setFileError('File is larger than 5 MB — paste the relevant passage instead.')
      return
    }
    const buf = await f.arrayBuffer()
    setFileSha(await sha256HexOf(buf))
    setFileName(f.name)
    if (!title) setTitle(f.name)
    const isText = f.type.startsWith('text/') || /\.(txt|md|csv|json|html?)$/i.test(f.name)
    if (isText) setExcerpt(new TextDecoder().decode(buf).slice(0, 2000))
    else setFileError('Only text files can be excerpted automatically — paste the supporting passage below.')
  }

  const canAttach =
    title.trim() &&
    (kind !== 'url' || /^https?:\/\//i.test(url.trim())) &&
    (kind !== 'passage' || excerpt.trim()) &&
    (kind !== 'document' || excerpt.trim() || fileSha)

  const tabs: Array<{ id: EvidenceMode; label: string }> = [
    { id: 'attach', label: 'Attach evidence' },
    { id: 'challenge', label: 'Challenge a claim' },
    { id: 'explain', label: 'Ask for explanation' },
    { id: 'more', label: 'Request more evidence' },
  ]

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800" role="region" aria-label="Evidence and help">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Evidence or help">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" data-testid={`evidence-tab-${t.id}`} aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn('rounded-md px-2.5 py-1 text-xs font-medium', tab === t.id ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300')}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-neutral-500">Nothing here approves the answer. Evidence and requests are recorded on v{vm.answer?.version_number} only.</p>

      {tab === 'attach' ? (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Kind
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={cn(INPUT_CLASS, 'mt-1')} data-testid="evidence-kind">
              <option value="note">Note</option>
              <option value="url">Link</option>
              <option value="passage">Passage</option>
              <option value="document">File excerpt</option>
            </select>
          </label>
          {kind === 'document' && (
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              File (read on this device only; only the excerpt you keep is stored, encrypted)
              <input type="file" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs" />
              {fileName && <span className="mt-1 block text-[11px] text-neutral-500">{fileName} · sha256 {fileSha?.slice(0, 12)}…</span>}
              {fileError && <span className="mt-1 block text-[11px] text-warning-700 dark:text-warning-400">{fileError}</span>}
            </label>
          )}
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Title
            <input data-testid="evidence-title" value={title} onChange={(e) => setTitle(e.target.value)} className={cn(INPUT_CLASS, 'mt-1')} />
          </label>
          {kind === 'url' && (
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Link (https://…)
              <input value={url} onChange={(e) => setUrl(e.target.value)} className={cn(INPUT_CLASS, 'mt-1')} inputMode="url" />
            </label>
          )}
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            {kind === 'passage' ? 'Passage (required)' : kind === 'note' ? 'Note' : 'Excerpt'}
            <textarea data-testid="evidence-excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} className={cn(INPUT_CLASS, 'mt-1 resize-y')} />
          </label>
          <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="h-3.5 w-3.5" />
            I have checked this source myself
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="btn-secondary px-3 py-1.5 text-xs">Cancel</button>
            <button type="button" data-testid="attach-evidence" disabled={busy || !canAttach} onClick={() => onAttach({ kind, title: title.trim(), excerpt: excerpt.trim(), url: url.trim(), content_sha256: fileSha, confirmed })} className="btn-primary px-3 py-1.5 text-xs">
              Link evidence to v{vm.answer?.version_number}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            {tab === 'challenge' ? 'Which claim do you doubt?' : tab === 'explain' ? 'What should be explained?' : 'What evidence is needed?'}
            <textarea data-testid="request-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} className={cn(INPUT_CLASS, 'mt-1 resize-y')} />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="btn-secondary px-3 py-1.5 text-xs">Cancel</button>
            <button
              type="button"
              data-testid="submit-request"
              disabled={busy || !text.trim()}
              onClick={() =>
                tab === 'challenge'
                  ? onRequest('evidence_requested', `Challenged claim: ${text.trim()}`)
                  : tab === 'explain'
                    ? onRequest('help_requested', `Explain: ${text.trim()}`)
                    : onRequest('evidence_requested', text.trim())
              }
              className="btn-primary px-3 py-1.5 text-xs"
            >
              Record request (not an approval)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DiscussPanel({
  vm,
  busy,
  onComment,
  onAsk,
}: {
  vm: ReviewCardVM
  busy: boolean
  onComment: (body: string, parent: string | null) => void
  onAsk: (text: string) => void
}) {
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const id = useId()
  const a = vm.answer!
  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800" role="region" aria-label="Discussion">
      {vm.comments.threads.length === 0 ? (
        <p className="text-xs text-neutral-500">No comments yet.</p>
      ) : (
        <ul className="space-y-2" data-testid="comment-threads">
          {vm.comments.threads.map((t) => (
            <li key={t.thread_id} className="space-y-1.5 border-l-2 border-neutral-200 pl-2 dark:border-neutral-800">
              {t.comments.map((c) => (
                <div key={c.comment_id} className={cn('rounded-md bg-neutral-50 px-2 py-1.5 dark:bg-neutral-900', c.parent_comment_id && 'ml-4')} data-testid="comment">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                    <Pill tone={c.on_current_version ? 'info' : 'neutral'}>{c.on_label}{c.on_current_version ? '' : ' (earlier version)'}</Pill>
                    <span>{c.source === 'companion' ? 'Companion' : c.actor_class === 'human' ? 'You' : 'Agent'}</span>
                    {c.source_label && (
                      <span data-testid={`comment-source-${c.source}`}>
                        <Pill tone={c.source === 'companion' ? 'warning' : 'neutral'}>{c.source_label}</Pill>
                      </span>
                    )}
                    <span>{formatWhen(c.at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-200">{c.body}</p>
                  <div className="mt-1 flex gap-3 text-[11px]">
                    <button type="button" className="text-brand-600 underline-offset-2 hover:underline dark:text-brand-400" onClick={() => setReplyTo(c.comment_id)}>
                      Reply
                    </button>
                    <button type="button" className="text-brand-600 underline-offset-2 hover:underline dark:text-brand-400" onClick={() => onAsk(c.body)}>
                      Ask agent to revise using this
                    </button>
                  </div>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
      <label htmlFor={id} className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
        {replyTo ? 'Reply' : 'Comment'} on v{a.version_number} — questions, corrections, factual updates or instructions
      </label>
      <textarea id={id} data-testid="comment-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} className={cn(INPUT_CLASS, 'resize-y')} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {replyTo && (
          <button type="button" className="text-xs text-neutral-500 underline" onClick={() => setReplyTo(null)}>
            Cancel reply
          </button>
        )}
        <button
          type="button"
          data-testid="add-comment"
          disabled={busy || !body.trim()}
          onClick={() => {
            onComment(body.trim(), replyTo)
            setBody('')
            setReplyTo(null)
          }}
          className="btn-primary px-3 py-1.5 text-xs"
        >
          {replyTo ? 'Post reply' : `Add comment on v${a.version_number}`}
        </button>
      </div>
    </div>
  )
}
