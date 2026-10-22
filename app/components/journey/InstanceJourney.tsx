'use client'

// M09 W6 — Steps D–H for one private application instance.
//   D  populate from the answer bank (Direct / Adapt / Gap, drafts only)
//   E  review every proposed final answer on the review board (W5)
//   F  prepare: completeness, limits, approvals, version integrity
//   G  freeze → optional sign → export (existing packet pipeline)
//   H  record the submission YOU made elsewhere (AQUA never submits)
// A submitted instance opens read-only: frozen packet + submission record.
// Everything here reads and writes the local vault only.

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import {
  approveAsHuman,
  getInstance,
  listInstanceQuestions,
  readReviewCardVersion,
  recordClassificationSuggestion,
  saveInstanceDraft,
  type AppInstanceView,
  type InstanceQuestionRow,
  type PublicOccurrence,
} from '@/lib/aqua-local-client/review'
import { LocalDraftAssist } from '@/components/aqua-local/LocalDraftAssist'
import { VaultPacketPanel } from '@/components/aqua-local/VaultPacketPanel'
import {
  buildPrepareInputs,
  catalogProgramFor,
  instanceLifecycle,
  loadHistory,
  type HistoricalSnapshot,
  type InstanceLifecycle,
} from '@/lib/journey/lifecycle'
import { measure, validatePrepare, type PrepareResult } from '@/lib/journey/prepare'
import { catalogOccurrenceId } from '@/lib/journey/activate'
import type { JourneyCatalog } from '@/lib/journey/review-model'
import { Chip, Notice, Section, StatusChip, StepTracker, VaultUnlock, formatWhen, type JourneyEnv } from './ui'

interface Editor {
  occ: string
  mode: 'use' | 'adapt' | 'gap' | 'revise'
  body: string
  derived_from: string | null
  guidance: string[]
  assist: boolean
  method: 'manual' | 'byok'
  provider: string | null
  model: string | null
}

const CLASS_TONE = { direct: 'success', adapt: 'warning', gap: 'neutral' } as const

function draftTitle(row: InstanceQuestionRow): string {
  return `Q${row.order + 1}: ${(row.text ?? row.question_occurrence_id).slice(0, 60)}`
}

export function InstanceJourney({ instanceId, catalog, env }: { instanceId: string; catalog: JourneyCatalog; env: JourneyEnv }) {
  const vault = useVault()
  const [view, setView] = useState<AppInstanceView | null>(null)
  const [rows, setRows] = useState<InstanceQuestionRow[]>([])
  const [lifecycle, setLifecycle] = useState<InstanceLifecycle>('active')
  const [history, setHistory] = useState<HistoricalSnapshot[]>([])
  const [skipReasons, setSkipReasons] = useState<Record<string, string>>({})
  const [prepare, setPrepare] = useState<PrepareResult | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [previews, setPreviews] = useState<Record<string, { body: string; words: number } | 'error'>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [matchedAt, setMatchedAt] = useState<string | null>(null)

  const program = view ? catalogProgramFor(view.record, catalog) : null
  const template = view?.template ?? null
  const title = template?.title ?? program?.name ?? 'Application'
  const org = template?.org ?? program?.organization ?? ''

  const load = useCallback(async () => {
    const secret = vault.getSecret()
    if (!secret) return
    try {
      const storage = await vault.ensureStorage()
      const v = await getInstance(storage, secret, instanceId)
      const prog = catalogProgramFor(v.record, catalog)
      const catalog_questions: PublicOccurrence[] | undefined = !v.template && prog
        ? prog.questions.map((q) => ({ question_occurrence_id: catalogOccurrenceId(q), text: q.asked_as, canonical_question_id: q.canonical_question_id, word_limit: q.word_limit, char_limit: q.char_limit, required: q.required, section_id: q.section }))
        : undefined
      const closes = prog?.cycle?.closes_at ?? prog?.deadline_at ?? null
      const r = await listInstanceQuestions(storage, secret, instanceId, {
        catalog_questions,
        program_name: prog?.name ?? null,
        org_name: prog?.organization ?? null,
        cycle_year: closes ? Number(closes.slice(0, 4)) : null,
        deadline: closes,
        known_program_names: catalog.programs.flatMap((p) => [p.name, p.organization ?? '']).filter(Boolean),
      })
      setView(v)
      setRows(r)
      setLifecycle(await instanceLifecycle(storage, v.record.application_id))
      setHistory(await loadHistory(storage, secret, v.record.application_id))
      setError('')
    } catch (e) {
      setError(e instanceof Error && e.name === 'VaultNotFoundError' ? 'This private application was not found in your vault on this device.' : 'Could not read this application from your vault.')
    } finally {
      setLoading(false)
    }
  }, [vault, instanceId, catalog])

  useEffect(() => {
    if (vault.status === 'unlocked') void load()
  }, [vault.status, load])

  // Step F — recomputed whenever answers or skip reasons change.
  useEffect(() => {
    const secret = vault.getSecret()
    if (!secret || !rows.length) { setPrepare(null); return }
    let cancelled = false
    ;(async () => {
      const inputs = await buildPrepareInputs(await vault.ensureStorage(), secret, rows, skipReasons)
      if (!cancelled) setPrepare(validatePrepare(inputs))
    })()
    return () => { cancelled = true }
  }, [rows, skipReasons, vault])

  const packetQuestions = useMemo(
    () => rows.map((r) => ({ archived_question_id: r.question_occurrence_id, asked_as: r.text, is_required: r.required, order_index: r.order })),
    [rows],
  )
  const frozenSkips = useMemo(() => {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(skipReasons)) if (v.trim()) out[k] = v.trim()
    return out
    // only the frozen view of the reasons — recomputed when they change
  }, [skipReasons])

  async function withVault<T>(fn: (storage: Awaited<ReturnType<typeof vault.ensureStorage>>, secret: string) => Promise<T>): Promise<T | undefined> {
    const secret = vault.getSecret()
    if (!secret) { setError('Vault locked — unlock to continue.'); return undefined }
    setBusy(true); setError(''); setNotice('')
    try {
      return await fn(await vault.ensureStorage(), secret)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      return undefined
    } finally {
      setBusy(false)
    }
  }

  async function recordMatches() {
    await withVault(async (storage, secret) => {
      let n = 0
      for (const r of rows) {
        const c = r.classification
        if (!c) continue
        const dup = r.suggestions.some((s) => s.kind === 'reuse' && s.classification === c.classification && (s.candidate_version_id ?? null) === (c.candidate_version_id ?? null))
        if (dup) continue
        await recordClassificationSuggestion(storage, secret, r.question_occurrence_id, c, { instance_id: instanceId })
        n++
      }
      setMatchedAt(new Date().toISOString())
      setNotice(n ? `Recorded ${n} answer-bank suggestion(s). Suggestions are advice only — nothing was approved.` : 'Answer-bank suggestions are already recorded for every question.')
      await load()
    })
  }

  async function preview(versionId: string) {
    await withVault(async (storage, secret) => {
      try {
        const v = await readReviewCardVersion(storage, secret, versionId)
        setPreviews((p) => ({ ...p, [versionId]: { body: v.body, words: v.word_count } }))
      } catch {
        setPreviews((p) => ({ ...p, [versionId]: 'error' }))
      }
    })
  }

  async function openEditor(row: InstanceQuestionRow, mode: Editor['mode']) {
    const c = row.classification
    let body = ''
    let derived: string | null = null
    await withVault(async (storage, secret) => {
      if ((mode === 'use' || mode === 'adapt') && c?.candidate_version_id) {
        body = (await readReviewCardVersion(storage, secret, c.candidate_version_id)).body
        derived = c.candidate_version_id
      } else if (mode === 'revise' && row.versions.length) {
        body = (await readReviewCardVersion(storage, secret, row.versions[row.versions.length - 1].id)).body
      }
    })
    setEditor({
      occ: row.question_occurrence_id,
      mode,
      body,
      derived_from: derived,
      guidance: mode === 'adapt' ? (c?.reasons ?? []).map((x) => x.message) : [],
      assist: false,
      method: 'manual',
      provider: null,
      model: null,
    })
  }

  async function applyDirect(row: InstanceQuestionRow) {
    const c = row.classification
    if (!c?.candidate_version_id) return
    await withVault(async (storage, secret) => {
      const src = await readReviewCardVersion(storage, secret, c.candidate_version_id!)
      await saveInstanceDraft(storage, secret, instanceId, row.question_occurrence_id, {
        title: draftTitle(row),
        body: src.body,
        method: 'manual',
        derived_from_version_id: c.candidate_version_id,
      })
      setNotice('Draft created from your approved answer. It is a new, unapproved version — review it before it can be used.')
      await load()
    })
  }

  async function saveEditor(row: InstanceQuestionRow) {
    if (!editor) return
    if (!editor.body.trim()) { setError('The draft is empty.'); return }
    await withVault(async (storage, secret) => {
      await saveInstanceDraft(storage, secret, instanceId, row.question_occurrence_id, {
        title: draftTitle(row),
        body: editor.body,
        method: editor.method,
        provider: editor.provider,
        model: editor.model,
        derived_from_version_id: editor.derived_from,
      })
      setEditor(null)
      setNotice(row.versions.length ? 'Saved as a new version. Earlier versions and their decisions are unchanged.' : 'Draft saved to your vault.')
      await load()
    })
  }

  async function harnessApprove(row: InstanceQuestionRow) {
    const vid = row.status.governing_version_id
    const sha = row.status.governing_version_sha256
    if (!vid || !sha) return
    await withVault(async (storage, secret) => {
      await approveAsHuman(storage, { version_id: vid, expected_sha256: sha, secret, via: 'review_ui' })
      await load()
    })
  }

  if (vault.status !== 'unlocked') {
    return <VaultUnlock reason="This application lives encrypted in your vault on this device. Unlock to continue." />
  }
  if (loading) return <p className="text-sm text-neutral-500">Loading your application…</p>
  if (!view) {
    return (
      <div className="space-y-3">
        <Notice tone="danger">{error || 'Application not found.'}</Notice>
        <Link href={`${env.basePath}?path=mine`} className="btn-secondary">Back to my applications</Link>
      </div>
    )
  }

  const proposed = rows.filter((r) => r.versions.length > 0)
  const approvedCount = rows.filter((r) => r.status.approved_version_id).length
  const needsReview = rows.filter((r) => r.versions.length && !r.status.freeze_eligible)
  const corrections = template?.corrections ?? []
  const deadline = template?.deadline ?? (program?.cycle?.closes_at ?? program?.deadline_at ?? null)
  const current = lifecycle === 'submitted' ? 'H' : lifecycle === 'queued' ? 'G' : prepare?.ready ? 'F' : proposed.length ? 'E' : 'D'
  const done = (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const).slice(0, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].indexOf(current))

  const header = (
    <div className="space-y-3">
      <Link href={`${env.basePath}?path=mine`} className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">← My applications</Link>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-white">{title}</h1>
          <p className="text-xs text-neutral-500">
            {org ? `${org} · ` : ''}{rows.length} questions{deadline ? ` · due ${String(deadline).slice(0, 16).replace('T', ' ')}` : ''} ·{' '}
            {template ? `private template (${view.record.source.kind})` : 'catalog template'} · <code>{view.record.instance_id}</code>
          </p>
        </div>
        <Chip tone={lifecycle === 'submitted' ? 'success' : lifecycle === 'queued' ? 'warning' : 'brand'}>{lifecycle}</Chip>
      </div>
      <StepTracker current={current} done={[...done]} />
    </div>
  )

  // ── read-only historical view ──
  if (lifecycle === 'submitted') {
    return (
      <div className="space-y-4" data-testid="historical-view">
        {header}
        <Notice tone="success">
          You recorded this application as submitted. AQUA did not submit it — this is your own record of a submission you made
          through the program&rsquo;s channel. The frozen packet and record below are read-only.
        </Notice>
        {history.map((h) => (
          <Section key={h.packet.packet_id} title={`Packet ${h.packet.packet_id}`} aside={<Chip tone={h.state === 'submitted_external_observed' ? 'success' : 'neutral'}>{(h.state ?? 'unknown').replace(/_/g, ' ')}</Chip>}>
            <p className="break-all font-mono text-[11px] text-neutral-500">manifest sha256 {h.manifest_sha256} · frozen {formatWhen(h.packet.created_at)} · signature {h.packet.signoff.signature_b64 ? (h.packet.signoff.signature_verified ? 'verified' : 'present, not verified') : 'unsigned'}</p>
            {h.submissions.map((s) => (
              <p key={s.id} className="mt-2 text-xs text-neutral-700 dark:text-neutral-300" data-testid="submission-record">
                Submitted by you via <strong>{s.method}</strong> on {formatWhen(s.submitted_at)}{s.confirmation_ref ? ` · ref ${s.confirmation_ref}` : ''}{s.portal_url ? ` · ${s.portal_url}` : ''} · outcome {s.outcome}
              </p>
            ))}
            <ol className="mt-3 space-y-2">
              {h.packet.questions.map((q) => (
                <li key={q.question_occurrence_id} className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">{q.question_text_snapshot}</p>
                  {q.skipped ? (
                    <p className="mt-1 text-xs italic text-neutral-500">Skipped: {q.skip_reason}</p>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">{q.answer_body}</p>
                  )}
                </li>
              ))}
            </ol>
          </Section>
        ))}
        <VerifyHelp />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {header}
      {corrections.length > 0 && (
        <details className="text-xs text-neutral-600 dark:text-neutral-400">
          <summary className="cursor-pointer">{corrections.length} correction(s) recorded during import — originals kept</summary>
          <ul className="mt-1 list-disc pl-4">
            {corrections.map((c, i) => <li key={i}>{c.field}{c.question_index != null ? ` (question ${c.question_index + 1})` : ''}: {String(c.from ?? '—')} → {String(c.to ?? '—')}</li>)}
          </ul>
        </details>
      )}
      {lifecycle === 'queued' && <Notice tone="warning">A packet is frozen for this application but no submission is recorded yet. Export it, submit it through the program&rsquo;s own channel, then record the submission in Step H.</Notice>}

      <Section step="D" title="Populate from your answer bank"
        aside={<button type="button" data-testid="record-matches" disabled={busy} onClick={() => void recordMatches()} className="btn-secondary px-3 py-1 text-xs">Record answer-bank matches</button>}>
        <p className="mb-3 text-xs text-neutral-500">
          Each question is compared with answers already in your vault. <strong>Direct</strong>: an approved answer to the same question that fits the limits.
          <strong> Adapt</strong>: related, but something must change. <strong>Gap</strong>: nothing related yet. Using an answer creates a new draft here —
          approvals never carry over, and existing versions are never overwritten.{matchedAt ? ` Suggestions recorded ${formatWhen(matchedAt)}.` : ''}
        </p>
        <ol className="space-y-3">
          {rows.map((r) => {
            const meta = template?.questions.find((q) => q.question_occurrence_id === r.question_occurrence_id)
            const c = r.classification
            const prev = c?.candidate_version_id ? previews[c.candidate_version_id] : undefined
            const ed = editor?.occ === r.question_occurrence_id ? editor : null
            const counts = ed ? measure(ed.body) : null
            const hasDraft = r.versions.length > 0
            return (
              <li key={r.question_occurrence_id} id={`q-${r.question_occurrence_id}`} data-testid="populate-row" className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 text-sm text-neutral-900 dark:text-neutral-100">{r.order + 1}. {r.text ?? r.question_occurrence_id}</p>
                  <StatusChip status={r.status.status} />
                </div>
                {meta?.original_text && <p className="mt-1 text-[11px] text-neutral-500">Original wording (kept): <span className="italic">{meta.original_text}</span></p>}
                <div className="mt-2 flex flex-wrap gap-1">
                  <Chip tone={r.required ? 'brand' : 'neutral'}>{r.required ? 'required' : 'optional'}</Chip>
                  {r.word_limit != null && <Chip>≤ {r.word_limit} words</Chip>}
                  {r.char_limit != null && <Chip>≤ {r.char_limit} chars</Chip>}
                  {/* M09 hardening (W6): once a draft exists, answer-bank advice (Direct/Adapt/Gap, reasons, source answer) is stale — show the draft instead. */}
                  {c && !hasDraft && <Chip tone={CLASS_TONE[c.classification]}>{c.classification.toUpperCase()}{c.candidate_version_id ? ` · ${Math.round(c.similarity * 100)}% similar` : ''}</Chip>}
                  {hasDraft && <span data-testid="draft-created"><Chip tone="brand">Draft created (v{r.versions.length})</Chip></span>}
                </div>
                {c && !hasDraft && c.reasons.length > 0 && (
                  <ul className="mt-2 list-disc pl-4 text-xs text-neutral-600 dark:text-neutral-400">{c.reasons.map((x, i) => <li key={i}>{x.message}</li>)}</ul>
                )}
                {c?.candidate_version_id && !hasDraft && (
                  <div className="mt-2 text-xs">
                    {prev === undefined ? (
                      <button type="button" className="text-brand-600 underline dark:text-brand-400" onClick={() => void preview(c.candidate_version_id!)}>Show the source answer</button>
                    ) : prev === 'error' ? (
                      <span className="text-danger-600">Source answer could not be decrypted.</span>
                    ) : (
                      <blockquote className="whitespace-pre-wrap rounded border-l-2 border-neutral-300 bg-neutral-50 p-2 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">{prev.body}</blockquote>
                    )}
                  </div>
                )}

                {ed ? (
                  <div className="mt-3 space-y-2">
                    {ed.guidance.length > 0 && (
                      <Notice tone="warning"><p className="font-medium">Adapt for this application:</p><ul className="list-disc pl-4">{ed.guidance.map((g, i) => <li key={i}>{g}</li>)}</ul></Notice>
                    )}
                    <textarea aria-label={`Draft for question ${r.order + 1}`} value={ed.body} onChange={(e) => setEditor({ ...ed, body: e.target.value, method: ed.method })} rows={6} className="input text-sm" />
                    <p className={`text-[11px] ${(r.word_limit != null && counts!.word_count > r.word_limit) || (r.char_limit != null && counts!.char_count > r.char_limit) ? 'text-danger-600' : 'text-neutral-500'}`}>
                      {counts!.word_count}{r.word_limit != null ? ` / ${r.word_limit}` : ''} words · {counts!.char_count}{r.char_limit != null ? ` / ${r.char_limit}` : ''} characters
                    </p>
                    {ed.assist ? (
                      <LocalDraftAssist
                        archivedQuestionId={r.canonical_question_id ?? r.question_occurrence_id}
                        questionText={r.text ?? ''}
                        wordLimit={r.word_limit ?? undefined}
                        programId={view.record.program_id ?? undefined}
                        currentDraft={ed.body}
                        onResult={(res) => setEditor({ ...ed, body: res.text, assist: false, method: 'byok', provider: res.provider, model: res.model })}
                        onCancel={() => setEditor({ ...ed, assist: false })}
                      />
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" data-testid="save-draft" disabled={busy} className="btn-primary px-3 py-1.5 text-xs" onClick={() => void saveEditor(r)}>Save draft</button>
                      {!ed.assist && <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setEditor({ ...ed, assist: true })}>Draft with my AI key (optional)</button>}
                      <button type="button" className="text-xs text-neutral-500 underline" onClick={() => setEditor(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.versions.length === 0 && c?.classification === 'direct' && (
                      <>
                        <button type="button" data-testid="use-direct" disabled={busy} className="btn-primary px-3 py-1.5 text-xs" onClick={() => void applyDirect(r)}>Use this answer</button>
                        <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => void openEditor(r, 'use')}>Edit before using</button>
                      </>
                    )}
                    {r.versions.length === 0 && c?.classification === 'adapt' && (
                      <button type="button" data-testid="adapt" disabled={busy} className="btn-primary px-3 py-1.5 text-xs" onClick={() => void openEditor(r, 'adapt')}>Adapt this answer</button>
                    )}
                    {r.versions.length === 0 && (!c || c.classification === 'gap') && (
                      <button type="button" data-testid="write-draft" disabled={busy} className="btn-primary px-3 py-1.5 text-xs" onClick={() => void openEditor(r, 'gap')}>Write a draft</button>
                    )}
                    {r.versions.length > 0 && (
                      <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => void openEditor(r, 'revise')}>Draft a new version</button>
                    )}
                    {env.harness && r.status.governing_version_id && !r.status.freeze_eligible && (
                      <button type="button" data-testid="harness-approve" disabled={busy} className="rounded-lg border border-dashed border-warning-500 px-3 py-1.5 text-xs text-warning-700 dark:text-warning-300" onClick={() => void harnessApprove(r)}>
                        Approve as shown (dev harness stand-in for the W5 review card)
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </Section>

      <Section step="E" title="Review every proposed answer">
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          {proposed.length} of {rows.length} questions have a proposed answer · {approvedCount} approved by you · {needsReview.length} waiting for your review.
          Only you can approve an answer, and only exactly the version shown to you; suggestions and agents cannot.
        </p>
        <div className="mt-3 flex flex-wrap gap-1">
          {rows.map((r) => <span key={r.question_occurrence_id} className="inline-flex items-center gap-1 text-[11px] text-neutral-500">Q{r.order + 1} <StatusChip status={r.status.status} /></span>)}
        </div>
        <Link href={env.reviewHref(instanceId, view.record.program_id && !view.template ? view.record.program_id : null)} data-testid="review-cta" className="btn-primary mt-3">Review answers</Link>
      </Section>

      <Section step="F" title="Prepare the application" aside={prepare ? <Chip tone={prepare.ready ? 'success' : 'danger'}>{prepare.ready ? 'ready to freeze' : `${prepare.blockers.length} blocker(s)`}</Chip> : undefined}>
        {!prepare ? (
          <p className="text-xs text-neutral-500">Checking…</p>
        ) : (
          <div className="space-y-2" data-testid="prepare-panel">
            <p className="text-xs text-neutral-500">
              Every required question needs a version you approved (bound to its hash), within its limits, whose stored text still matches that hash.
              Optional questions you leave out need a reason. {prepare.counts.ready} ready · {prepare.counts.skipped} skipped · {prepare.counts.blocked} blocked.
            </p>
            {prepare.blockers.length > 0 && (
              <ul className="space-y-1">
                {prepare.blockers.map((b, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 text-xs text-danger-700 dark:text-danger-400">
                    <span>{b.message}</span>
                    {b.fix === 'review' ? <Link href={env.reviewHref(instanceId, view.record.program_id && !view.template ? view.record.program_id : null)} className="underline">Review</Link>
                      : b.fix === 'skip_reason' ? <a href={`#skip-${b.question_occurrence_id}`} className="underline">Explain skip</a>
                      : <a href={`#q-${b.question_occurrence_id}`} className="underline">{b.fix === 'draft' ? 'Write a draft' : 'Revise'}</a>}
                  </li>
                ))}
              </ul>
            )}
            {prepare.warnings.map((w, i) => <p key={i} className="text-xs text-warning-700 dark:text-warning-400">{w.message}</p>)}
            {rows.filter((r) => !r.required && !r.status.approved_version_id).map((r) => (
              <label key={r.question_occurrence_id} id={`skip-${r.question_occurrence_id}`} className="block text-xs">
                <span className="text-neutral-600 dark:text-neutral-400">Q{r.order + 1} (optional) — reason for leaving it out:</span>
                <input aria-label={`Skip reason for question ${r.order + 1}`} className="input mt-1 text-xs" value={skipReasons[r.question_occurrence_id] ?? ''}
                  onChange={(e) => setSkipReasons((s) => ({ ...s, [r.question_occurrence_id]: e.target.value }))} placeholder="e.g. Not applicable to our project" />
              </label>
            ))}
          </div>
        )}
      </Section>

      <Section step="G" title="Freeze and export the packet">
        {prepare?.ready ? (
          <>
            <VaultPacketPanel programId={view.record.application_id} programName={title} questions={packetQuestions} initialSkipReasons={frozenSkips} onStateChange={() => void load()} />
            <div className="mt-4"><VerifyHelp /></div>
          </>
        ) : (
          <p className="text-xs text-neutral-500">Fix the Step F blockers to freeze a packet.</p>
        )}
      </Section>

      <Section step="H" title="Record your submission">
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          AQUA does not submit applications. Submit the exported packet through the program&rsquo;s own portal (or email), then record it in the
          packet panel above. The record is your own attestation; once recorded, this application moves to <em>submitted</em> and opens read-only.
        </p>
      </Section>

      {error && <Notice tone="danger">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
    </div>
  )
}

function VerifyHelp() {
  return (
    <details className="text-xs text-neutral-600 dark:text-neutral-400" open>
      <summary className="cursor-pointer font-medium">How to verify an exported packet</summary>
      <p className="mt-1">
        Anyone can check an exported packet offline with the standalone verifier (Node.js, no AQUA account, no network):
      </p>
      <pre className="mt-1 overflow-x-auto rounded bg-neutral-950 p-2 font-mono text-[11px] text-neutral-100">node app/lib/aqua-local/verify-packet.mjs your-packet.json</pre>
      <p className="mt-1">It recomputes the manifest hash, every answer hash and the packet id, and checks the signature against the embedded public key. Exit code 0 means every check passed.</p>
    </details>
  )
}
