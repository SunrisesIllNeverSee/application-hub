'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  canApproveHostedCard, createTicketCounter, getAccessToken, hostedApprove, HostedApiError, readHostedReview,
  hostedReviewErrorMessage, type HostedReviewCard, type HostedReviewData,
} from '@/lib/aqua-hosted'
import { INPUT_CLASS, Notice, Pill } from './ui'

export function HostedReviewBoard() {
  const [data, setData] = useState<HostedReviewData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // latest-wins guard: a slower earlier reload must never overwrite a newer one
  const seq = useRef(createTicketCounter()).current
  const reload = useCallback(async () => {
    const ticket = seq.take()
    setLoading(true)
    setError('')
    try {
      const token = await getAccessToken()
      if (!token) throw new HostedApiError(0, 'not_signed_in')
      const next = await readHostedReview(token)
      if (!seq.isCurrent(ticket)) return // a newer reload owns the state
      setData(next)
    } catch (error) {
      if (!seq.isCurrent(ticket)) return
      // Hide a previous snapshot after a failed refresh rather than showing
      // stale answer/approval state as if it were current.
      setData(null)
      setError(hostedReviewErrorMessage(error))
    } finally {
      if (seq.isCurrent(ticket)) setLoading(false)
    }
  }, [seq])
  useEffect(() => { void reload() }, [reload])

  return <section className="mt-4 space-y-4" aria-label="Hosted answer review" data-testid="hosted-review-board">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">Hosted answers awaiting your review</h2>
      <button type="button" className="btn-secondary px-3 py-1.5 text-xs" disabled={loading} onClick={() => void reload()}>
        {loading ? 'Loading…' : 'Refresh hosted answers'}
      </button>
    </div>
    <p className="text-xs text-neutral-600 dark:text-neutral-400">
      These records come from your hosted workspace. Review the question, exact saved wording, sources, and warnings
      before approving. Each approval applies only to the displayed version. Ask your connected assistant to save a new
      draft version when wording needs changes.
    </p>
    {error && <Notice tone="danger">{error}</Notice>}
    {data?.applications.length === 0 && <Notice tone="info">Your hosted bank is empty. Use your connected AQUA assistant to import an application or saved answers, then refresh here.</Notice>}
    {data?.applications.map((app) => <section key={app.instance_id} className="space-y-3">
      <h3 className="text-sm font-semibold">{app.review.title || 'Untitled application'}{app.review.history ? ' · Historical application' : ''}</h3>
      {app.review.history && <Notice tone="warning">Historical wording may be dated. A previous submission does not approve an answer for reuse.</Notice>}
      {app.review.cards.map((card) => <HostedAnswerCard key={`${card.question_occurrence_id}:${card.answer?.version_id}:${card.answer?.sha256}`} card={card} reload={reload} />)}
    </section>)}
  </section>
}

export function HostedAnswerCard({ card, reload }: { card: HostedReviewCard; reload: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  const [secret, setSecret] = useState('')
  const [effectiveAt, setEffectiveAt] = useState(card.history_source?.submitted_at ?? '')
  const [attested, setAttested] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const id = useId()
  const answer = card.answer
  // history:true versions only count via a human history attestation (M09b
  // gate) — plain hosted_review approval is ignored for historical answers
  const isHistory = card.history_source != null
  const cancel = () => { setConfirming(false); setSecret(''); setAttested(false) }
  async function approve(event: React.FormEvent) {
    event.preventDefault()
    if (!answer || !canApproveHostedCard(card) || secret.trim().length < 8 || busy) return
    if (isHistory && (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveAt) || !attested)) return
    setBusy(true)
    setError('')
    try {
      const token = await getAccessToken()
      if (!token) throw new HostedApiError(0, 'not_signed_in')
      await hostedApprove({
        version_id: answer.version_id, expected_sha256: answer.sha256, approval_secret: secret,
        ...(isHistory ? {
          via: 'history_attestation' as const,
          effective_at: effectiveAt,
          attestation: `I attest that I submitted this exact answer wording in a past application on ${effectiveAt}.`,
        } : {}),
      }, token)
      cancel()
      await reload()
    } catch (error) {
      setError(hostedReviewErrorMessage(error))
    } finally { setSecret(''); setBusy(false) }
  }

  return <article className="space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
    <h4 className="text-sm font-medium">{card.context.original_question || 'Question wording unavailable'}</h4>
    <div className="flex flex-wrap gap-2 text-xs">
      <Pill tone={card.status.tone}>{card.status.label}</Pill>
      <Pill tone="info">{card.recommendation_badge.label}</Pill>
      <Pill tone="neutral">Human review: {card.human_review.label}</Pill>
      <Pill tone={card.approval.state === 'approved' ? 'success' : 'neutral'}>{card.approval.label}</Pill>
    </div>
    <ul className="list-disc pl-5 text-xs text-neutral-600 dark:text-neutral-400">
      {card.context.requirements.map((item, index) => <li key={index}>{item}</li>)}
    </ul>
    {answer ? <>
      <p className="text-xs text-neutral-500">{answer.method_label} · {answer.created_at}</p>
      {card.history_source && <div className="space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
        <p>Source: {card.history_source.source_file} · Submission date: {card.history_source.submitted_at || 'Unknown'}{card.history_source.date_source ? ` (${card.history_source.date_source})` : ''}</p>
        <p className="break-all">Source fingerprint: {card.history_source.source_sha256}</p>
        {card.history_source.flags.map((flag, index) => <p key={index}>History warning: {flag}</p>)}
        {card.history_source.placeholder_found && <Notice tone="danger">This historical answer contains placeholders and cannot be approved.</Notice>}
        {card.history_source.metadata_integrity === 'legacy' && <Notice tone="warning">This older source record lacks a metadata fingerprint. Verify its source and date before reuse.</Notice>}
      </div>}
      <pre className="whitespace-pre-wrap break-words rounded-md bg-neutral-50 p-3 font-sans text-sm dark:bg-neutral-900">{answer.body}</pre>
      <p className="break-all text-xs text-neutral-500">Version {answer.version_number} · {answer.version_id}<br />Content fingerprint: {answer.sha256}</p>
      {!card.integrity_ok && <Notice tone="danger">This version failed its content-integrity check. Approval is unavailable; save a corrected version first.</Notice>}
      {answer.limits.over_limit && <Notice tone="warning">This answer exceeds the question’s length limit. Revise it before preparing this application.</Notice>}
    </> : <Notice tone="info">No answer has been saved for this question.</Notice>}
    {(card.evidence.gap || card.evidence.uncertain_claims.length > 0) && <Notice tone="warning">Evidence needs review. Check the sources and unsupported claims before approving.</Notice>}
    <details className="text-xs">
      <summary className="cursor-pointer font-medium">Sources, version history, and writing checks</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {card.evidence.items.map((item) => <li key={item.evidence_id}>{item.title} · {item.verification_label} · {item.freshness_label}{item.url ? ` · ${item.url}` : ''}{item.excerpt ? ` — ${item.excerpt}` : ''}</li>)}
        {card.evidence.items.length === 0 && <li>No attached evidence.</li>}
        {card.evidence.lineage.map((version) => <li key={version.id}>Version {version.number} · {version.method_label} · {version.created_at} · {version.approved ? 'Approved' : 'Unapproved'}</li>)}
        {[...card.recommendation.why, ...card.recommendation.weaknesses, ...card.recommendation.missing_evidence,
          ...card.recommendation.fact_conflicts.map((fact) => fact.message)].map((message, index) => <li key={`check-${index}`}>{message}</li>)}
      </ul>
    </details>
    {error && <Notice tone="danger">{error}</Notice>}
    {canApproveHostedCard(card) && !confirming && <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={() => setConfirming(true)}>Review approval of this exact version</button>}
    {confirming && answer && <form onSubmit={approve} className="space-y-2 rounded-md border border-success-500/50 p-3">
      <p className="text-xs">Approve version {answer.version_number} exactly as displayed above? Later edits will need a new approval.</p>
      {isHistory && <>
        <label htmlFor={`${id}-date`} className="block text-xs font-medium">Date you submitted this wording
          <input id={`${id}-date`} type="date" required disabled={busy} value={effectiveAt}
            onChange={(event) => setEffectiveAt(event.target.value)} className={`${INPUT_CLASS} mt-1 w-full`} />
        </label>
        <label className="flex items-start gap-2 text-xs" htmlFor={`${id}-attest`}>
          <input id={`${id}-attest`} type="checkbox" required disabled={busy} checked={attested}
            onChange={(event) => setAttested(event.target.checked)} className="mt-0.5" />
          I attest that I submitted this exact answer wording in a past application on the date above.
        </label>
      </>}
      <label htmlFor={id} className="block text-xs font-medium">Hosted approval secret
        <input id={id} type="password" autoComplete="off" required minLength={8} disabled={busy} value={secret}
          onChange={(event) => setSecret(event.target.value)} className={`${INPUT_CLASS} mt-1 w-full`} />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary px-3 py-1.5 text-xs" disabled={busy || secret.trim().length < 8 || (isHistory && (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveAt) || !attested))}>{busy ? 'Recording…' : 'Confirm approval'}</button>
        <button type="button" className="btn-secondary px-3 py-1.5 text-xs" disabled={busy} onClick={cancel}>Cancel</button>
      </div>
    </form>}
  </article>
}
