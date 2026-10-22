'use client'

// M09 W6 — optional, separate action: suggest a PUBLIC URL's application
// for the AQUA catalog. Shows the exact request body first; nothing is sent
// until the user confirms. Never includes answers, approvals, corrections,
// private or uncertain items. A curator reviews every suggestion.

import { useMemo, useState } from 'react'
import { buildCandidateRequest, candidateEligibility, submitCandidate, type CandidateSubmitResult } from '@/lib/journey/candidate'
import type { ExtractionReviewModel, JourneyCatalog } from '@/lib/journey/review-model'
import { Notice, Section } from './ui'

export function CandidateSuggest({ model, catalog }: { model: ExtractionReviewModel; catalog?: JourneyCatalog | null }) {
  const elig = useMemo(() => candidateEligibility(model), [model])
  const req = useMemo(() => (elig.eligible ? buildCandidateRequest(model, catalog) : null), [elig, model, catalog])
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CandidateSubmitResult | null>(null)

  if (model.source.kind !== 'url') return null

  return (
    <Section title="Optional: suggest this application for the public catalog">
      {!elig.eligible ? (
        <div className="text-xs text-neutral-600 dark:text-neutral-400">
          <p>This import cannot be suggested:</p>
          <ul className="mt-1 list-disc pl-4">{elig.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      ) : req && !req.ok ? (
        <Notice tone="warning">
          <p className="font-medium">Suggestion withheld — something private would have been included:</p>
          <ul className="mt-1 list-disc pl-4">{req.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </Notice>
      ) : req && req.ok ? (
        <div className="space-y-3 text-xs text-neutral-600 dark:text-neutral-400">
          <p>
            Sends only the public parts of <strong>this public page</strong> (program identity, published deadline, question wording,
            source reference) for a catalog curator to verify. Your answers, approvals, corrections and anything marked private or
            uncertain are never included. AQUA re-fetches the public page itself to verify it, and a curator reviews the result. This is separate from your private application and is never sent automatically.
          </p>
          {!open ? (
            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setOpen(true)}>Show exactly what would be sent</button>
          ) : (
            <>
              <pre data-testid="candidate-payload" className="max-h-80 overflow-auto rounded-lg bg-neutral-950 p-3 font-mono text-[11px] leading-relaxed text-neutral-100">
                {`POST /api/catalog/candidates\n${JSON.stringify(req.body, null, 2)}`}
              </pre>
              {req.notes.length > 0 && <p>Curator notes: {req.notes.join(' · ')}</p>}
              {result?.ok ? (
                <Notice tone="success">Suggested for curator review{result.candidate_id ? ` (candidate ${result.candidate_id})` : ''}. It is not public until a curator approves it.</Notice>
              ) : (
                <>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
                    <span>I confirm this page is public and I want to send exactly the body above to AQUA for catalog review.</span>
                  </label>
                  <button
                    type="button"
                    disabled={!confirm || busy}
                    className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                    onClick={async () => {
                      setBusy(true)
                      setResult(await submitCandidate(req.body, fetch))
                      setBusy(false)
                    }}
                  >
                    {busy ? 'Sending…' : 'Send suggestion'}
                  </button>
                </>
              )}
              {result && !result.ok && (
                <Notice tone={result.code === 'unavailable' ? 'neutral' : 'warning'}>
                  {result.message}
                  {result.errors?.length ? <span className="block">Refused fields: {result.errors.map((e) => `${e.path} (${e.code})`).join(', ')}</span> : null}
                </Notice>
              )}
            </>
          )}
        </div>
      ) : null}
    </Section>
  )
}
