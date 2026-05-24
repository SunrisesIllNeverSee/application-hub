'use client'

import { useMemo, useState } from 'react'

type IntakeCheckpoint =
  | 'entity_checkpoint'
  | 'application_checkpoint'
  | 'structured_layers_checkpoint'
  | 'questions_checkpoint'
  | 'finalized'

type SubmissionEnvelope = {
  submission: Record<string, unknown>
  entity: Record<string, unknown> | null
  application: Record<string, unknown> | null
  layers: Array<Record<string, unknown>>
  questions: Array<Record<string, unknown>>
  reviews?: Array<Record<string, unknown>>
  events?: Array<Record<string, unknown>>
}

const verticals = ['unknown', 'tech', 'university', 'grants', 'jobs'] as const
const sourceTypes = ['manual_paste', 'manual_url', 'manual_markdown'] as const

const CHECKPOINT_LABELS: Record<IntakeCheckpoint, string> = {
  entity_checkpoint: 'Checkpoint 1 · Entity',
  application_checkpoint: 'Checkpoint 2 · Application',
  structured_layers_checkpoint: 'Checkpoint 3 · Structured Layers',
  questions_checkpoint: 'Checkpoint 4 · Questions',
  finalized: 'Finalized',
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function statusPill(value: unknown) {
  const label = typeof value === 'string' ? value : 'unknown'
  const color = label === 'approved' || label === 'finalized'
    ? 'bg-green-950/50 text-green-300 border-green-900/60'
    : label === 'rejected'
    ? 'bg-red-950/50 text-red-300 border-red-900/60'
    : label === 'needs_revision'
    ? 'bg-amber-950/50 text-amber-300 border-amber-900/60'
    : 'bg-neutral-900 text-neutral-300 border-neutral-800'
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${color}`}>{label}</span>
}

function renderBox(title: string, value: unknown) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-neutral-100">{title}</p>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-neutral-300">{formatJson(value)}</pre>
    </div>
  )
}

export function IngestionUploader() {
  const [vertical, setVertical] = useState<(typeof verticals)[number]>('unknown')
  const [sourceType, setSourceType] = useState<(typeof sourceTypes)[number]>('manual_paste')
  const [sourceTitle, setSourceTitle] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submission, setSubmission] = useState<SubmissionEnvelope | null>(null)

  const currentCheckpoint = submission?.submission?.current_checkpoint as IntakeCheckpoint | undefined

  const canSubmit = useMemo(
    () => content.trim().length > 20 && (sourceTitle.trim().length > 1 || sourceUrl.trim().length > 0),
    [content, sourceTitle, sourceUrl]
  )

  async function readFiles(files: FileList | null) {
    if (!files?.length) return
    const readableFiles = Array.from(files).filter((file) =>
      file.type.startsWith('text/')
      || file.name.endsWith('.json')
      || file.name.endsWith('.md')
      || file.name.endsWith('.txt')
    )
    const text = await Promise.all(readableFiles.map((file) => file.text()))
    setContent(text.join('\n\n---\n\n'))
    if (!sourceTitle && readableFiles[0]?.name) setSourceTitle(readableFiles[0].name)
    if (sourceType !== 'manual_markdown') setSourceType('manual_markdown')
  }

  async function refreshSubmission(submissionId: string) {
    const resp = await fetch(`/api/hub/intake/${submissionId}`, { cache: 'no-store' })
    const payload = await resp.json()
    if (!resp.ok) throw new Error(payload.error ?? 'Unable to load staged submission')
    setSubmission(payload)
  }

  async function submit() {
    if (!canSubmit) return
    setBusy(true)
    setError('')
    try {
      const resp = await fetch('/api/hub/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: sourceType,
          raw_input: content,
          source_url: sourceUrl || null,
          source_title: sourceTitle,
          vertical_hint: vertical,
          capture_method: sourceType === 'manual_url' ? 'url_submit' : sourceType === 'manual_markdown' ? 'markdown_upload' : 'paste',
          manual_mode: true,
        }),
      })
      const payload = await resp.json()
      if (!resp.ok) throw new Error(payload.error ?? 'Unable to stage submission')
      setSubmission(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function review(decision: 'approve' | 'reject' | 'needs_revision') {
    const submissionId = submission?.submission?.id
    if (!submissionId || !currentCheckpoint || currentCheckpoint === 'finalized') return
    setBusy(true)
    setError('')
    try {
      const resp = await fetch('/api/hub/intake/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submissionId,
          checkpoint: currentCheckpoint,
          decision,
          notes: `Manual ${decision} via ingestion workbench`,
        }),
      })
      const payload = await resp.json()
      if (!resp.ok) throw new Error(payload.error ?? 'Unable to review checkpoint')
      await refreshSubmission(String(submissionId))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-5 text-neutral-100">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-medium text-neutral-400">
            Source Type
            <select className="input mt-1" value={sourceType} onChange={(event) => setSourceType(event.target.value as typeof sourceType)}>
              {sourceTypes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-neutral-400">
            Vertical Hint
            <select className="input mt-1" value={vertical} onChange={(event) => setVertical(event.target.value as typeof vertical)}>
              {verticals.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-neutral-400">
            Host / Source Title
            <input className="input mt-1" value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="Y Combinator, NSF SBIR, Stanford..." />
          </label>
          <label className="text-xs font-medium text-neutral-400">
            Source URL
            <input className="input mt-1" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://apply.example.com" />
          </label>
        </div>

        <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-neutral-700 bg-neutral-900/50 p-5 text-center transition-colors hover:border-brand-600">
          <span className="text-sm font-medium text-neutral-200">Drop text or markdown files here</span>
          <span className="mt-1 text-xs text-neutral-500">Manual-first intake. Uploads only populate the raw input layer.</span>
          <input className="sr-only" type="file" multiple onChange={(event) => readFiles(event.target.files)} />
        </label>

        <textarea
          className="input mt-4 min-h-52 font-mono text-xs"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Paste the application page, exported markdown, screenshot transcript, or raw form text..."
        />

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-neutral-500">
            {busy ? 'Staging all 7 layers in Supabase...' : 'The system stages Entity → Application → Structured Layers → Questions before any downstream archive work.'}
          </p>
          <button className="btn-primary" disabled={!canSubmit || busy} onClick={submit}>
            {busy ? 'Staging...' : 'Stage Manual Intake'}
          </button>
        </div>

        {error && <p className="mt-3 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</p>}
      </div>

      {submission && (
        <div className="space-y-4">
          <div className="rounded-lg border border-brand-900/60 bg-brand-950/20 p-4 text-neutral-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Submission {String(submission.submission.ref ?? submission.submission.id)}</p>
                <p className="mt-1 text-xs text-neutral-400">
                  Current checkpoint: {CHECKPOINT_LABELS[currentCheckpoint ?? 'entity_checkpoint']}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {statusPill(submission.submission.workflow_status)}
                {statusPill(submission.submission.current_checkpoint)}
              </div>
            </div>
            {currentCheckpoint && currentCheckpoint !== 'finalized' && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-primary" disabled={busy} onClick={() => review('approve')}>
                  Approve checkpoint
                </button>
                <button className="btn-secondary border border-amber-900/60 bg-amber-950/30 text-amber-200 hover:bg-amber-950/50" disabled={busy} onClick={() => review('needs_revision')}>
                  Needs revision
                </button>
                <button className="btn-secondary border border-red-900/60 bg-red-950/30 text-red-200 hover:bg-red-950/50" disabled={busy} onClick={() => review('reject')}>
                  Reject
                </button>
              </div>
            )}
          </div>

          {renderBox('Layer 1 · Entity', submission.entity)}
          {renderBox('Layer 3 · Application', submission.application)}
          {renderBox('Layers 4-6 · Structured Layers', submission.layers)}
          {renderBox('Layer 7 · Questions', submission.questions)}

          {submission.events && submission.events.length > 0 && (
            <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
              <p className="mb-3 text-sm font-medium text-neutral-100">Append-Only Audit Trail</p>
              <div className="space-y-2">
                {submission.events.map((event) => (
                  <div key={String(event.id)} className="rounded-md border border-neutral-800 bg-neutral-900/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium text-neutral-200">{String(event.event_type)}</p>
                      <p className="text-[11px] text-neutral-500">{String(event.created_at)}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-400">
                      Layer {String(event.layer_number)} · {String(event.layer_name)}
                      {event.checkpoint ? ` · ${String(event.checkpoint)}` : ''}
                    </p>
                    {typeof event.notes === 'string' && event.notes.length > 0 && (
                      <p className="mt-2 text-xs text-neutral-300">{event.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
