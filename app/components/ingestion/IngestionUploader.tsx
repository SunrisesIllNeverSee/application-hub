'use client'

import { useMemo, useState } from 'react'

type IngestResult = {
  package?: { id: string; hash: string }
  mapped?: Array<{
    canonical: { id: string; title: string; aggregate_description?: string }
    created: boolean
    similarity: number
    variant: { id: string; fidelity_score: number; content: string }
  }>
  credit_estimate?: number
  error?: string
}

const verticals = ['founder', 'college', 'grants', 'jobs'] as const

export function IngestionUploader() {
  const [vertical, setVertical] = useState<(typeof verticals)[number]>('founder')
  const [entity, setEntity] = useState('')
  const [source, setSource] = useState('')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<IngestResult | null>(null)
  const [error, setError] = useState('')

  const canSubmit = useMemo(() => content.trim().length > 20 && entity.trim().length > 1, [content, entity])

  async function readFiles(files: FileList | null) {
    if (!files?.length) return
    const textFiles = Array.from(files).filter((file) =>
      file.type.startsWith('text/')
      || file.name.endsWith('.json')
      || file.name.endsWith('.md')
      || file.name.endsWith('.txt')
    )
    const text = await Promise.all(textFiles.map((file) => file.text()))
    setContent(text.join('\n\n---\n\n'))
    setSource(textFiles.map((file) => file.name).join(', '))
  }

  async function submit() {
    if (!canSubmit) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const resp = await fetch('/api/hub/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vertical, entity, source, content }),
      })
      const payload = await resp.json()
      if (!resp.ok) throw new Error(payload.error ?? 'Ingestion failed')
      setResult(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-neutral-100">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs font-medium text-neutral-400">
          Vertical
          <select className="input mt-1" value={vertical} onChange={(event) => setVertical(event.target.value as typeof vertical)}>
            {verticals.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-neutral-400">
          Program / Entity
          <input className="input mt-1" value={entity} onChange={(event) => setEntity(event.target.value)} placeholder="YC W26, NSF SBIR, Stanford..." />
        </label>
        <label className="text-xs font-medium text-neutral-400">
          Source
          <input className="input mt-1" value={source} onChange={(event) => setSource(event.target.value)} placeholder="Portal URL or file names" />
        </label>
      </div>

      <label className="mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-neutral-700 bg-neutral-900/50 p-5 text-center transition-colors hover:border-brand-600">
        <span className="text-sm font-medium text-neutral-200">Drop application files or click to upload</span>
        <span className="mt-1 text-xs text-neutral-500">Text, Markdown, JSON, or copied portal content. PDF/ZIP parsing belongs in the workstation step.</span>
        <input className="sr-only" type="file" multiple onChange={(event) => readFiles(event.target.files)} />
      </label>

      <textarea
        className="input mt-4 min-h-44 font-mono text-xs"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Paste application questions, answers, or captured portal markdown..."
      />

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-neutral-500">
          {busy ? 'Processing via Canonical Hub...' : 'Free: manual review. Premium: bulk auto-apply after review gates.'}
        </p>
        <button className="btn-primary" disabled={!canSubmit || busy} onClick={submit}>
          {busy ? 'Processing...' : 'Stage in Hub'}
        </button>
      </div>

      {busy && <div className="mt-3 h-1 overflow-hidden rounded-full bg-neutral-800"><div className="h-full w-2/3 animate-pulse rounded-full bg-brand-500" /></div>}
      {error && <p className="mt-3 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</p>}

      {result?.mapped && (
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Staging Review</p>
            <span className="text-xs text-brand-300">{result.credit_estimate ?? 0} credit estimate</span>
          </div>
          {result.mapped.map((item) => (
            <div key={item.variant.id} className="rounded-md border border-neutral-800 bg-neutral-900 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-100">{item.canonical.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-neutral-400">{item.variant.content}</p>
                </div>
                <div className="text-right text-xs text-neutral-400">
                  <p>{item.created ? 'new canonical' : 'mapped'}</p>
                  <p>fidelity {Number(item.variant.fidelity_score ?? 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
