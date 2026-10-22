'use client'

// M09 W6 — Step B: review the extraction before anything enters the
// private workspace. Every edit is a recorded correction; the original
// wording stays visible. Private / uncertain material is shown only here,
// on this device, and is never sent anywhere.

import { useMemo, useState } from 'react'
import {
  activationBlockers,
  activeQuestions,
  clearProgramMatch,
  clearQuestionMatch,
  correctWording,
  mergeDuplicate,
  methodLabel,
  missingRequirements,
  pickProgramMatch,
  removeQuestion,
  restoreQuestion,
  restoreQuestionMatch,
  setDeadline,
  setLimits,
  setProgramIdentity,
  setRequired,
  setUseCatalogTemplate,
  type ExtractionReviewModel,
  type JourneyCatalog,
  type ReviewQuestion,
} from '@/lib/journey/review-model'
import { Chip, Notice, Section } from './ui'

function QuestionCard({
  q,
  model,
  readOnly,
  onModel,
  onError,
}: {
  q: ReviewQuestion
  model: ExtractionReviewModel
  readOnly: boolean
  onModel: (m: ExtractionReviewModel) => void
  onError: (msg: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(q.text ?? '')
  const apply = (fn: () => ExtractionReviewModel) => {
    try {
      onModel(fn())
      onError('')
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not apply the correction')
    }
  }
  const inactive = q.status !== 'active'
  const dupTarget = q.duplicate_of ? model.questions.find((x) => x.key === q.duplicate_of) : null
  const match = q.match && !q.match_cleared && q.match.tier !== 'novel' ? q.match : null

  return (
    <li data-testid={`review-q-${q.key}`} className={`rounded-lg border p-3 ${inactive ? 'border-dashed border-neutral-300 opacity-60 dark:border-neutral-700' : 'border-neutral-200 dark:border-neutral-800'}`}>
      <div className="flex flex-wrap items-start gap-2">
        <span className="mt-0.5 text-xs font-semibold text-neutral-400">{q.order_index + 1}.</span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2">
              <textarea aria-label={`Corrected wording for question ${q.order_index + 1}`} value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="input text-sm" />
              <div className="flex gap-2">
                <button type="button" className="btn-primary px-3 py-1 text-xs" onClick={() => { apply(() => correctWording(model, q.key, draft)); setEditing(false) }}>Save correction</button>
                <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => { setDraft(q.text ?? ''); setEditing(false) }}>Cancel</button>
              </div>
            </div>
          ) : (
            <p className="break-words text-sm text-neutral-900 dark:text-neutral-100">
              {q.text ?? <em className="text-danger-600 dark:text-danger-400">Wording withheld — it contained private details. Retype the question or remove it.</em>}
            </p>
          )}
          {q.corrected && q.original_text != null && (
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              Original (kept): <span className="italic">{q.original_text}</span>
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {q.section && <Chip>{q.section}</Chip>}
            <Chip tone={q.required ? 'brand' : 'neutral'}>{q.required ? 'required' : 'optional'}{q.original_required === null && model.source.kind !== 'catalog' ? ' (not stated)' : ''}</Chip>
            {q.word_limit != null && <Chip>≤ {q.word_limit} words</Chip>}
            {q.char_limit != null && <Chip>≤ {q.char_limit} chars</Chip>}
            {q.requirement_flags.map((f) => <Chip key={f}>{f}</Chip>)}
            {match ? (
              <Chip tone={match.needs_review ? 'warning' : 'success'} title={match.matched_text ?? undefined}>
                {match.tier} match · {Math.round(match.confidence * 100)}%{match.needs_review ? ' · check' : ''}
              </Chip>
            ) : (
              <Chip>{q.match_cleared ? 'match cleared' : 'new question'}</Chip>
            )}
            {q.visibility !== 'public' && (
              <Chip tone="warning" title={q.visibility_reasons.join('; ')}>{q.visibility} — stays on this device</Chip>
            )}
            {q.has_private_context && <Chip tone="warning">answer-like text nearby (kept private)</Chip>}
            {dupTarget && q.status === 'active' && <Chip tone="warning">duplicate of {dupTarget.order_index + 1}</Chip>}
            {q.status === 'merged' && <Chip>merged into {(model.questions.find((x) => x.key === q.merged_into)?.order_index ?? 0) + 1}</Chip>}
            {q.status === 'removed' && <Chip>removed</Chip>}
          </div>
          {match?.matched_text && match.matched_text !== q.text && (
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">Canonical: {match.matched_text}</p>
          )}
        </div>
      </div>
      {!readOnly && !editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {q.status === 'active' ? (
            <>
              <button type="button" className="btn-secondary px-2.5 py-1 text-xs" onClick={() => { setDraft(q.text ?? ''); setEditing(true) }}>Correct wording</button>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={q.required} onChange={(e) => apply(() => setRequired(model, q.key, e.target.checked))} /> Required
              </label>
              <label className="flex items-center gap-1">
                Words
                <input key={`w-${q.word_limit}`} aria-label={`Word limit for question ${q.order_index + 1}`} type="number" min={1} className="input w-20 px-2 py-1 text-xs" defaultValue={q.word_limit ?? ''}
                  onBlur={(e) => apply(() => setLimits(model, q.key, { word_limit: e.target.value ? Number(e.target.value) : null }))} />
              </label>
              <label className="flex items-center gap-1">
                Chars
                <input key={`c-${q.char_limit}`} aria-label={`Character limit for question ${q.order_index + 1}`} type="number" min={1} className="input w-20 px-2 py-1 text-xs" defaultValue={q.char_limit ?? ''}
                  onBlur={(e) => apply(() => setLimits(model, q.key, { char_limit: e.target.value ? Number(e.target.value) : null }))} />
              </label>
              {dupTarget && dupTarget.status === 'active' && (
                <button type="button" className="btn-secondary px-2.5 py-1 text-xs" onClick={() => apply(() => mergeDuplicate(model, q.key, dupTarget.key))}>Merge into {dupTarget.order_index + 1}</button>
              )}
              {q.match && !q.match_cleared && q.match.tier !== 'novel' && (
                <button type="button" className="text-neutral-500 underline" onClick={() => apply(() => clearQuestionMatch(model, q.key))}>Clear match</button>
              )}
              {q.match_cleared && (
                <button type="button" className="text-neutral-500 underline" onClick={() => apply(() => restoreQuestionMatch(model, q.key))}>Restore match</button>
              )}
              <button type="button" className="text-danger-600 underline dark:text-danger-400" onClick={() => apply(() => removeQuestion(model, q.key))}>Remove</button>
            </>
          ) : (
            <button type="button" className="btn-secondary px-2.5 py-1 text-xs" onClick={() => apply(() => restoreQuestion(model, q.key))}>Restore</button>
          )}
        </div>
      )}
    </li>
  )
}

export function ExtractionReview({
  model,
  onModel,
  catalog,
  footer,
}: {
  model: ExtractionReviewModel
  onModel: (m: ExtractionReviewModel) => void
  catalog: JourneyCatalog
  footer: React.ReactNode
}) {
  const [error, setError] = useState('')
  const isCatalog = model.source.kind === 'catalog'
  const templateMode = model.use_catalog_template
  const readOnly = isCatalog || templateMode
  const missing = useMemo(() => missingRequirements(model), [model])
  const blockers = useMemo(() => activationBlockers(model, catalog), [model, catalog])
  const act = activeQuestions(model)
  const matchedProgram = model.program_match ? catalog.programs.find((p) => p.id === model.program_match!.program_id) ?? null : null
  const apply = (fn: () => ExtractionReviewModel) => {
    try { onModel(fn()); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'Could not apply') }
  }
  const d = model.cycle.deadline

  return (
    <div className="space-y-4">
      <Section step="B" title={isCatalog ? 'Template summary' : 'Review what AQUA found'}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-neutral-500">Program</dt>
            <dd>
              {readOnly ? (
                <span className="font-medium text-neutral-900 dark:text-white">{model.program.title ?? '—'}</span>
              ) : (
                <input aria-label="Application name" className="input text-sm" defaultValue={model.program.title ?? ''} placeholder="Name this application"
                  onBlur={(e) => apply(() => setProgramIdentity(model, { title: e.target.value }))} />
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Organization</dt>
            <dd>
              {readOnly ? (
                <span>{model.program.organization || '—'}</span>
              ) : (
                <input aria-label="Organization" className="input text-sm" defaultValue={model.program.organization ?? ''} placeholder="Organization (optional)"
                  onBlur={(e) => apply(() => setProgramIdentity(model, { organization: e.target.value }))} />
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Cycle and deadline</dt>
            <dd data-testid="review-deadline">
              {model.cycle.name ? <span className="mr-2">{model.cycle.name}</span> : null}
              {d ? <span>{d.date ?? d.text}{d.time ? ` ${d.time}` : ''} <strong>{d.timezone ?? 'no time zone'}</strong>{d.ambiguous ? ' (ambiguous)' : ''}</span> : <span className="text-neutral-500">No deadline found</span>}
              {!readOnly && (
                <details className="mt-1 text-xs">
                  <summary className="cursor-pointer text-neutral-500">Correct deadline</summary>
                  <form className="mt-2 flex flex-wrap gap-2" onSubmit={(e) => {
                    e.preventDefault()
                    const f = new FormData(e.currentTarget)
                    apply(() => setDeadline(model, { date: String(f.get('date') || '') || null, time: String(f.get('time') || '') || null, timezone: String(f.get('tz') || '') || null }))
                  }}>
                    <input name="date" type="date" defaultValue={d?.date ?? ''} className="input w-36 px-2 py-1 text-xs" aria-label="Deadline date" />
                    <input name="time" type="time" defaultValue={d?.time ?? ''} className="input w-28 px-2 py-1 text-xs" aria-label="Deadline time" />
                    <input name="tz" defaultValue={d?.timezone ?? ''} placeholder="TZ e.g. PT" className="input w-24 px-2 py-1 text-xs" aria-label="Deadline time zone" />
                    <button className="btn-secondary px-2 py-1 text-xs">Save</button>
                  </form>
                </details>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Source and method</dt>
            <dd data-testid="review-source">
              <span>{methodLabel(model.source.method)}</span>
              {model.source.kind === 'url' && (
                <span className="block break-all text-xs text-neutral-500">
                  {model.source.final_url ?? model.source.ref} · reuse: <strong>{model.source.reuse ?? 'unknown'}</strong>
                  {model.source.reuse_signals.length ? ` (${model.source.reuse_signals.join(', ')})` : ''}
                  {model.source.content_sha256 ? ` · page sha256 ${model.source.content_sha256.slice(0, 12)}…` : ''}
                </span>
              )}
              {model.source.kind === 'file' && <span className="block text-xs text-neutral-500">{model.source.ref} ({model.source.file_format})</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Questions</dt>
            <dd data-testid="review-count">{act.length} active{act.length !== model.questions.length ? ` of ${model.questions.length} found` : ''}</dd>
          </div>
          {!isCatalog && (
            <div>
              <dt className="text-xs text-neutral-500">Catalog program match</dt>
              <dd className="space-y-1">
                {model.program_match ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{model.program_match.name}</span>
                    <Chip tone={model.program_needs_review && model.program_match.basis !== 'user' ? 'warning' : 'success'}>
                      {model.program_match.basis} · {Math.round(model.program_match.confidence * 100)}%
                    </Chip>
                    <button type="button" className="text-xs text-neutral-500 underline" onClick={() => apply(() => clearProgramMatch(model))}>Clear</button>
                  </div>
                ) : (
                  <span className="text-xs text-neutral-500">Not linked to a catalog program</span>
                )}
                {catalog.programs.length > 0 && (
                  <select aria-label="Pick a catalog program" className="input px-2 py-1 text-xs" value="" onChange={(e) => {
                    const p = catalog.programs.find((x) => x.id === e.target.value)
                    if (p) apply(() => pickProgramMatch(model, p))
                  }}>
                    <option value="">{model.program_match ? 'Switch program…' : 'Link a catalog program…'}</option>
                    {[...model.program_candidates.map((c) => catalog.programs.find((p) => p.id === c.program_id)).filter(Boolean), ...catalog.programs]
                      .filter((p, i, arr) => p && arr.findIndex((x) => x!.id === p.id) === i)
                      .map((p) => <option key={p!.id} value={p!.id}>{p!.name}{model.program_candidates.some((c) => c.program_id === p!.id) ? ' (suggested)' : ''}</option>)}
                  </select>
                )}
              </dd>
            </div>
          )}
        </dl>

        {!isCatalog && matchedProgram && matchedProgram.questions.length > 0 && (
          <fieldset className="mt-4 rounded-lg border border-neutral-200 p-3 text-xs dark:border-neutral-800">
            <legend className="px-1 font-medium">Which question list will you answer?</legend>
            <label className="flex items-start gap-2">
              <input type="radio" name="template-choice" checked={!templateMode} onChange={() => apply(() => setUseCatalogTemplate(model, false))} />
              <span>The imported list below ({model.questions.length} found) — kept private, linked to {matchedProgram.name}.</span>
            </label>
            <label className="mt-1 flex items-start gap-2">
              <input type="radio" name="template-choice" checked={templateMode} onChange={() => apply(() => setUseCatalogTemplate(model, true))} />
              <span>AQUA&rsquo;s catalog template for {matchedProgram.name} ({matchedProgram.questions.length} questions).</span>
            </label>
          </fieldset>
        )}

        {missing.length > 0 && !templateMode && (
          <div className="mt-4">
            <Notice tone="warning">
              <p className="mb-1 font-medium">Missing or unverified</p>
              <ul className="list-disc space-y-0.5 pl-4">{missing.map((m) => <li key={m}>{m}</li>)}</ul>
            </Notice>
          </div>
        )}
        {model.private_summary.count > 0 && (
          <p className="mt-3 text-xs text-neutral-500">
            {model.private_summary.count} private item(s) ({Object.entries(model.private_summary.kinds).map(([k, n]) => `${n} ${k.replace(/_/g, ' ')}`).join(', ')}) were detected and kept out of everything that leaves this device.
          </p>
        )}
        {model.uncertain.length > 0 && (
          <details className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
            <summary className="cursor-pointer">{model.uncertain.length} uncertain item(s) — kept private until verified</summary>
            <ul className="mt-1 list-disc pl-4">{model.uncertain.map((u, i) => <li key={i}><strong>{u.kind}</strong>: {u.value} <span className="text-neutral-400">({u.reasons.join('; ')})</span></li>)}</ul>
          </details>
        )}
        {model.warnings.length > 0 && <p className="mt-2 text-xs text-neutral-500">Extraction notes: {model.warnings.join(' · ')}</p>}
      </Section>

      <Section title={templateMode && !isCatalog ? `Catalog template questions (${matchedProgram?.questions.length ?? 0})` : 'Exact question list'}
        aside={model.corrections.length > 0 ? <Chip tone="brand">{model.corrections.length} correction(s) recorded</Chip> : undefined}>
        {templateMode && !isCatalog && matchedProgram ? (
          <ol className="space-y-2 text-sm">
            {matchedProgram.questions.map((q, i) => (
              <li key={q.id} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                {i + 1}. {q.asked_as} <span className="ml-1 text-xs text-neutral-500">{q.required ? 'required' : 'optional'}{q.word_limit ? ` · ≤ ${q.word_limit} words` : ''}{q.char_limit ? ` · ≤ ${q.char_limit} chars` : ''}</span>
              </li>
            ))}
          </ol>
        ) : (
          <ul className="space-y-2">
            {model.questions.map((q) => (
              <QuestionCard key={q.key} q={q} model={model} readOnly={readOnly} onModel={onModel} onError={setError} />
            ))}
          </ul>
        )}
        {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
      </Section>

      {blockers.length > 0 && (
        <Notice tone="danger">
          <p className="mb-1 font-medium">Fix before creating the private application</p>
          <ul className="list-disc pl-4">{blockers.map((b, i) => <li key={i}>{b.message}</li>)}</ul>
        </Notice>
      )}
      {footer}
    </div>
  )
}
