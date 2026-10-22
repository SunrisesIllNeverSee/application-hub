'use client'

// M09 W6 — Steps A–C of the unified application journey.
//   A  choose or import: catalog · URL · paste · file · my applications
//   B  review the extraction (corrections recorded, originals kept)
//   C  create ONE private instance in the local vault, then continue at
//      <basePath>/<instanceId> (Steps D–H)
// Only two requests can leave this screen: the URL import (body = {url})
// and the optional, user-confirmed catalog suggestion. Pasted text and
// files are parsed on this device.

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import { extractApplication } from '@/lib/catalog/extract'
import { extractFromFile } from '@/lib/catalog/files'
import { activateInstance, JourneyActivationError } from '@/lib/journey/activate'
import { importFromUrl, urlPrefill } from '@/lib/journey/lifecycle'
import { decodePendingUrl, PENDING_URL_FRAGMENT_KEY, readUrlFragment } from '@/lib/url-privacy'
import {
  activationBlockers,
  modelFromCatalogProgram,
  modelFromLocalExtraction,
  modelFromUrlProposal,
  type ExtractionReviewModel,
  type JourneyCatalog,
} from '@/lib/journey/review-model'
import { CandidateSuggest } from './CandidateSuggest'
import { ExtractionReview } from './ExtractionReview'
import { InstanceList } from './InstanceList'
import { Notice, Section, StepTracker, VaultUnlock, type JourneyEnv } from './ui'

type Path = 'catalog' | 'url' | 'paste' | 'file' | 'mine'

const PATHS: Array<{ id: Path; label: string; hint: string }> = [
  { id: 'catalog', label: 'From the catalog', hint: 'Pick a program AQUA already knows' },
  { id: 'url', label: 'From a URL', hint: 'Import a public application page' },
  { id: 'paste', label: 'Paste text', hint: 'Parsed on this device' },
  { id: 'file', label: 'Upload a file', hint: '.txt .md .html .csv .json .docx — parsed on this device' },
  { id: 'mine', label: 'My applications', hint: 'Open or reopen private work' },
]

export function ApplyStart({
  catalog,
  env,
  initialProgramSlug,
  initialPath,
  initialUrl,
}: {
  catalog: JourneyCatalog
  env: JourneyEnv
  initialProgramSlug?: string | null
  initialPath?: string | null
  /** `?url=` deep link: prefills the URL path. Never fetched without the user's click. */
  initialUrl?: string | null
}) {
  const router = useRouter()
  const vault = useVault()
  const initialProgram = initialProgramSlug ? catalog.programs.find((p) => p.slug === initialProgramSlug) ?? null : null
  const prefill = useMemo(() => urlPrefill(initialUrl), [initialUrl])
  const [path, setPath] = useState<Path>(prefill.url !== null || prefill.refused ? 'url' : PATHS.some((p) => p.id === initialPath) ? (initialPath as Path) : 'catalog')
  const [model, setModel] = useState<ExtractionReviewModel | null>(() => (initialProgram ? modelFromCatalogProgram(initialProgram) : null))
  const [query, setQuery] = useState('')
  const [url, setUrl] = useState(prefill.url ?? '')
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(prefill.refused ? prefill.refused : '')

  // M09 hardening M5: the deep-linked URL arrives in the FRAGMENT (#url=…,
  // set by middleware / the early inline script) or, after a login
  // round-trip, from sessionStorage. Read it once, then drop it from the
  // address bar so it is not kept in history or later page-view analytics.
  useEffect(() => {
    if (typeof window === 'undefined') return
    let raw = readUrlFragment(window.location.hash)
    try {
      const pending = decodePendingUrl(window.sessionStorage.getItem(PENDING_URL_FRAGMENT_KEY))
      window.sessionStorage.removeItem(PENDING_URL_FRAGMENT_KEY)
      if (!raw) raw = pending
    } catch { /* storage unavailable */ }
    const u = new URL(window.location.href)
    const hadQuery = u.searchParams.has('url')
    if (hadQuery) u.searchParams.delete('url')
    if (hadQuery || raw) u.searchParams.set('path', 'url')
    if (raw || hadQuery) {
      const qs = u.searchParams.toString()
      window.history.replaceState(window.history.state, '', `${u.pathname}${qs ? `?${qs}` : ''}`)
    }
    if (!raw || initialUrl) return
    const p = urlPrefill(raw)
    setPath('url')
    if (p.url) setUrl(p.url)
    if (p.refused) setError(p.refused)
  }, [initialUrl])
  const [creating, setCreating] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const programs = useMemo(() => {
    const q = query.trim().toLowerCase()
    return catalog.programs.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.organization ?? '').toLowerCase().includes(q))
  }, [catalog.programs, query])

  async function runUrl() {
    setBusy(true); setError('')
    const r = await importFromUrl(url, fetch)
    setBusy(false)
    if (!r.ok) { setError(r.message); return }
    setModel(modelFromUrlProposal(r.proposal, url.trim()))
  }

  function runPaste() {
    setError('')
    if (!paste.trim()) { setError('Paste the application questions first.'); return }
    const ex = extractApplication({ content: paste })
    if (!ex.occurrences.length) { setError('No questions were found in the pasted text. Put each question on its own line (numbered or ending in “?”).'); return }
    setModel(modelFromLocalExtraction(ex, { kind: 'paste', catalog }))
  }

  async function runFile(file: File) {
    setBusy(true); setError('')
    try {
      // pass bytes explicitly — the parser never sees the File object itself
      const { file: parsed, extraction } = await extractFromFile({ name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) })
      if (!parsed.ok) { setError(parsed.message); return }
      if (!extraction || !extraction.occurrences.length) { setError('No questions were found in that file.'); return }
      setModel(modelFromLocalExtraction(extraction, { kind: 'file', fileName: parsed.name, fileFormat: parsed.format, catalog }))
    } catch {
      setError('The file could not be read. Nothing was created.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function create() {
    if (!model) return
    const secret = vault.getSecret()
    if (!secret) { setError('Unlock your vault to create the private application.'); return }
    setCreating(true); setError('')
    try {
      const rec = await activateInstance(await vault.ensureStorage(), secret, model, catalog)
      router.push(`${env.basePath}/${encodeURIComponent(rec.instance_id)}`)
    } catch (e) {
      setCreating(false)
      setError(e instanceof JourneyActivationError ? e.blockers.map((b) => b.message).join(' ') : `Could not create the application: ${e instanceof Error ? e.message : 'unknown error'}. Nothing was saved.`)
    }
  }

  // ── Step B / C ──
  if (model) {
    const blocked = activationBlockers(model, catalog).length > 0
    return (
      <div className="space-y-4">
        <StepTracker current="B" done={['A']} />
        <ExtractionReview
          model={model}
          onModel={setModel}
          catalog={catalog}
          footer={
            <Section step="C" title="Create your private application">
              <p className="mb-3 text-xs text-neutral-600 dark:text-neutral-400">
                {model.use_catalog_template
                  ? 'Creates a private working copy on this device that points at the catalog template (ids only — the public template is not duplicated). If you already have one for this program — from here or from the workspace — AQUA opens it instead of making a duplicate.'
                  : 'Creates a private working copy on this device with the reviewed question list, encrypted in your vault. It does not become public catalog material.'}
              </p>
              {vault.status !== 'unlocked' ? (
                <VaultUnlock reason="Unlock (or create) your vault — the application is stored encrypted on this device only." />
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" data-testid="create-instance" disabled={blocked || creating} onClick={() => void create()} className="btn-primary disabled:opacity-50">
                    {creating ? 'Creating…' : 'Create private application'}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => { setModel(null); setError('') }}>Back</button>
                </div>
              )}
              {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
            </Section>
          }
        />
        <CandidateSuggest model={model} catalog={catalog} />
      </div>
    )
  }

  // ── Step A ──
  return (
    <div className="space-y-4">
      <StepTracker current="A" />
      <div role="tablist" aria-label="How do you want to start?" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {PATHS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={path === p.id} data-testid={`path-${p.id}`}
            onClick={() => { setPath(p.id); setError('') }}
            className={`rounded-lg border p-3 text-left transition-colors ${path === p.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800'}`}>
            <span className="block text-sm font-medium text-neutral-900 dark:text-white">{p.label}</span>
            <span className="mt-0.5 block text-[11px] text-neutral-500">{p.hint}</span>
          </button>
        ))}
      </div>

      {path === 'catalog' && (
        <Section step="A" title="Pick an application from the catalog">
          {catalog.unavailable && <Notice tone="warning">The catalog could not be loaded right now. You can still import from a URL, text or a file.</Notice>}
          <input aria-label="Search programs" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search programs or organizations" className="input mb-3 text-sm" />
          <ul className="space-y-2">
            {programs.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">{p.name}</p>
                  <p className="text-xs text-neutral-500">{p.organization ? `${p.organization} · ` : ''}{p.questions.length} questions{p.cycle ? ` · ${p.cycle.cycle_name}` : ''}{(p.cycle?.closes_at ?? p.deadline_at) ? ` · closes ${(p.cycle?.closes_at ?? p.deadline_at)!.slice(0, 10)}` : ''}</p>
                </div>
                <button type="button" data-testid={`pick-${p.slug}`} disabled={!p.questions.length} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                  onClick={() => setModel(modelFromCatalogProgram(p))}>
                  {p.questions.length ? 'Start' : 'No questions yet'}
                </button>
              </li>
            ))}
            {!programs.length && <li className="text-sm text-neutral-500">No catalog programs match. Try a URL, text or file import.</li>}
          </ul>
        </Section>
      )}

      {path === 'url' && (
        <Section step="A" title="Import a public application page">
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void runUrl() }}>
            <input aria-label="Application URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://program.example.org/apply" className="input text-sm" inputMode="url" />
            <button type="submit" disabled={busy} className="btn-primary shrink-0 disabled:opacity-50">{busy ? 'Reading the page…' : 'Import'}</button>
          </form>
          {prefill.url !== null && url === prefill.url && (
            <p data-testid="url-prefilled" className="mt-2 text-xs text-brand-700 dark:text-brand-300">This address was filled in from the link you opened. Check it, then click Import — nothing has been fetched yet.</p>
          )}
          <p className="mt-2 text-xs text-neutral-500">
            AQUA fetches the public page once and proposes the questions — nothing is saved until you create the application.
            Links that look private (tokens, share links, private hosts) are refused here and never sent.
          </p>
        </Section>
      )}

      {path === 'paste' && (
        <Section step="A" title="Paste the application">
          <textarea aria-label="Application text" value={paste} onChange={(e) => setPaste(e.target.value)} rows={10} className="input font-mono text-xs"
            placeholder={'Program name\nDeadline: …\n\n1. First question? (max 200 words)\n2. …'} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" onClick={runPaste}>Find the questions</button>
            <span className="text-xs text-neutral-500">Parsed on this device — the text is not sent anywhere.</span>
          </div>
        </Section>
      )}

      {path === 'file' && (
        <Section step="A" title="Upload an application file">
          <input ref={fileRef} aria-label="Application file" type="file" accept=".txt,.md,.markdown,.html,.htm,.csv,.json,.docx,.pdf,text/plain,text/markdown,text/html,text/csv,application/json"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void runFile(f) }} className="block w-full text-sm" />
          <p className="mt-2 text-xs text-neutral-500">Supported: .txt, .md, .html, .csv, .json, .docx (up to 5 MB). PDF is not supported yet. The file is read on this device and never uploaded.</p>
          {busy && <p className="mt-2 text-xs text-neutral-500">Reading…</p>}
        </Section>
      )}

      {path === 'mine' && (
        <Section step="A" title="My private applications">
          <InstanceList catalog={catalog} env={env} />
        </Section>
      )}

      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  )
}
