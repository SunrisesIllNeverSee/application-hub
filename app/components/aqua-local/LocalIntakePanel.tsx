'use client'

import { useEffect, useState } from 'react'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import { UnlockPanel } from '@/components/aqua-local/UnlockPanel'
import {
  extractManualIntake,
  buildIntakeMeta,
  type IntakePayload,
  type IntakeExtraction,
} from '@/lib/intake/manual-intake'
import {
  importLocalIntake,
  importLegacyQAPairs,
  type LocalIntakeResult,
  type LegacyImportResult,
} from '@/lib/aqua-local/intake'
import {
  extractQAPairsDeterministic,
  parsePairs,
  buildQAPairsPrompt,
  SYSTEM_PROMPT,
  type ExtractedPair,
} from '@/lib/qa-extract-client'
import { generateDraft, listProviders } from '@/lib/aqua-local-client/session'

// AM-0017 — local-first intake. The hosted pipeline persists pasted
// application text to Supabase — refused under the flag. This panel performs
// the SAME deterministic extraction entirely on this device and writes the
// result into the encrypted vault: extracted entity/application/questions
// become vault-scoped question slots the user answers, versions, approves
// and includes in packets. The raw pasted text is never stored or sent.
//
// Boundary: intake application ids are namespaced `local-intake-*` — they
// can never collide with or impersonate a hosted canonical application,
// and the vault record is never an authoritative writer. Public program
// ingestion continues via /import URLs + program catalog.

export function LocalIntakePanel() {
  const vault = useVault()
  const [content, setContent] = useState('')
  const [sourceTitle, setSourceTitle] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [extraction, setExtraction] = useState<IntakeExtraction | null>(null)
  const [result, setResult] = useState<LocalIntakeResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // AM-0009/0102: legacy Q&A import mode — answered applications land as
  // vault versions, not just question slots.
  const [mode, setMode] = useState<'questions' | 'qa'>('questions')
  const [pairs, setPairs] = useState<ExtractedPair[] | null>(null)
  const [qaResult, setQaResult] = useState<LegacyImportResult | null>(null)
  const [providers, setProviders] = useState<{ provider_id: string; base_url?: string; model_preference?: string }[]>([])

  useEffect(() => {
    if (vault.status !== 'unlocked') return
    let cancelled = false
    void vault.ensureStorage()
      .then((s) => listProviders(s))
      .then((ps) => { if (!cancelled) setProviders(ps.map((p) => ({ provider_id: p.provider_id, base_url: p.base_url, model_preference: p.model_preference }))) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [vault, vault.status])

  const canExtract = content.trim().length >= 20

  function extract() {
    setError('')
    setResult(null)
    setQaResult(null)
    setPairs(null)
    if (mode === 'qa') {
      setPairs(extractQAPairsDeterministic(content))
      return
    }
    try {
      const payloadBase: Omit<IntakePayload, 'metadata'> = {
        source_type: 'manual_paste',
        raw_input: content.trim(),
        source_url: sourceUrl.trim() || null,
        source_title: sourceTitle.trim() || null,
        vertical_hint: 'unknown',
        kind_hint: null,
        captured_at: new Date().toISOString(),
        capture_method: 'paste',
      }
      const payload: IntakePayload = {
        ...payloadBase,
        metadata: buildIntakeMeta({
          adapterName: 'local-first-intake',
          actorId: 'vault-local',
          route: 'local:intake',
          payload: payloadBase,
        }),
      }
      setExtraction(extractManualIntake(payload))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed')
      setExtraction(null)
    }
  }

  async function extractWithProvider() {
    setError('')
    setResult(null); setQaResult(null); setPairs(null)
    setBusy(true)
    try {
      const storage = await vault.ensureStorage()
      const secret = vault.getSecret()
      if (!secret) throw new Error('Vault locked')
      const cfgs = await listProviders(storage)
      const chosen = providers[0] ?? cfgs[0]
      if (!chosen) throw new Error('No provider configured — set one up in the vault panel')
      const { text } = await generateDraft(storage, secret, true, {
        provider_id: chosen.provider_id,
        prompt: buildQAPairsPrompt(content, 'other'),
        system: SYSTEM_PROMPT,
        model: chosen.model_preference,
      })
      setPairs(parsePairs(text))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Provider extraction failed')
    } finally {
      setBusy(false)
    }
  }

  async function importPairs() {
    if (!pairs?.length) return
    setBusy(true)
    setError('')
    try {
      const storage = await vault.ensureStorage()
      const secret = vault.getSecret()
      if (!secret) throw new Error('Vault locked')
      const res = await importLegacyQAPairs(storage, secret, pairs, {
        label: sourceTitle.trim() || 'manual paste',
        source_url: sourceUrl.trim() || null,
      })
      setQaResult(res)
      setPairs(null)
      setContent('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vault import failed')
    } finally {
      setBusy(false)
    }
  }

  async function importToVault() {
    if (!extraction) return
    setBusy(true)
    setError('')
    try {
      const storage = await vault.ensureStorage()
      const res = await importLocalIntake(storage, extraction, {
        source_type: 'manual_paste',
        source_url: sourceUrl.trim() || null,
        source_title: sourceTitle.trim() || null,
      })
      setResult(res)
      setExtraction(null)
      setContent('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vault import failed')
    } finally {
      setBusy(false)
    }
  }

  if (vault.status !== 'unlocked') {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-5">
        <p className="text-sm font-medium text-neutral-100">Local-first intake</p>
        <p className="mt-2 text-xs leading-6 text-neutral-400">
          Paste application text and it is extracted on this device into your
          encrypted vault — the same deterministic extraction the hosted
          pipeline uses, with zero server upload. Unlock your vault to
          continue.
        </p>
        <UnlockPanel vaultHasData={vault.vaultHasData} onUnlock={vault.unlock} />
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-950 p-5 text-neutral-100">
      <div>
        <p className="text-sm font-medium">Import an application on this device</p>
        <p className="mt-1 text-xs leading-6 text-neutral-400">
          Pasted application text never leaves this device. Extraction runs
          locally and stores only the structured result (entity, application,
          questions) in your encrypted vault — each extracted question becomes
          an answer slot you can edit, approve and include in packets.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-medium text-neutral-400">
          Source title (optional)
          <input
            className="input mt-1"
            value={sourceTitle}
            onChange={(e) => setSourceTitle(e.target.value)}
            placeholder="Y Combinator, NSF SBIR, Stanford..."
          />
        </label>
        <label className="text-xs font-medium text-neutral-400">
          Source URL (optional)
          <input
            className="input mt-1"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://apply.example.com"
          />
        </label>
      </div>

      <div className="flex gap-2 text-xs">
        <button
          className={mode === 'questions' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => { setMode('questions'); setPairs(null); setExtraction(null) }}
        >
          New application — extract questions
        </button>
        <button
          className={mode === 'qa' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => { setMode('qa'); setPairs(null); setExtraction(null) }}
        >
          Answered application — import Q&A
        </button>
      </div>

      <textarea
        className="input min-h-40 font-mono text-xs"
        value={content}
        onChange={(e) => {
          setContent(e.target.value)
          setExtraction(null)
        }}
        placeholder="Paste the application page or form text here — nothing is sent anywhere."
      />

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={!canExtract || busy} onClick={extract}>
          Extract on this device
        </button>
        {mode === 'qa' && providers.length > 0 && (
          <>
            <button className="btn-secondary" disabled={!canExtract || busy} onClick={() => void extractWithProvider()}>
              {busy ? 'Extracting…' : `Extract with ${providers[0].provider_id}`}
            </button>
            {/* IR-033: disclose the actual egress — same standard as the
                drafting consent disclosure. The paste goes ONLY to the
                configured endpoint; the AQUA server never sees it. */}
            <p className="basis-full font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
              sends your paste directly to {providers[0].provider_id}
              {providers[0].base_url ? ` @ ${providers[0].base_url}` : ''} — a consent receipt is stored first
            </p>
          </>
        )}
        <p className="text-xs text-neutral-500">
          {canExtract
            ? mode === 'qa'
              ? 'Deterministic Q/A parsing runs locally; provider extraction sends the paste to YOUR provider only.'
              : 'Runs the deterministic intake extractor locally — preview before importing.'
            : 'Paste at least 20 characters to extract.'}
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {pairs && (
        <div className="space-y-3 rounded-md border border-brand-900/60 bg-brand-950/20 p-4">
          <p className="text-xs font-medium text-neutral-200">
            {pairs.length === 0
              ? 'No Q&A pairs detected — paste text with Q:/A:, Question:/Answer:, or numbered-question structure.'
              : `${pairs.length} Q&A pair${pairs.length === 1 ? '' : 's'} detected`}
          </p>
          <div className="max-h-48 space-y-2 overflow-y-auto text-xs">
            {pairs.map((p, i) => (
              <div key={i} className="text-neutral-300">
                <p className="font-medium">{p.question_text}</p>
                <p className="text-neutral-500 line-clamp-2">{p.answer_text}</p>
              </div>
            ))}
          </div>
          {pairs.length > 0 && (
            <div className="flex items-center gap-3">
              <button className="btn-primary" disabled={busy} onClick={() => void importPairs()}>
                {busy ? 'Importing…' : `Import ${pairs.length} answer${pairs.length === 1 ? '' : 's'} to vault bank`}
              </button>
              <button className="text-xs text-neutral-400 hover:text-neutral-200" onClick={() => setPairs(null)}>
                Discard preview
              </button>
            </div>
          )}
        </div>
      )}

      {qaResult && (
        <div className="rounded-md border border-success-900/60 bg-success-950/30 p-4 text-xs">
          <p className="font-medium text-success-200">
            Imported {qaResult.added_versions} answer version{qaResult.added_versions === 1 ? '' : 's'}
            {qaResult.created_answers > 0 ? ` across ${qaResult.created_answers} new bank entr${qaResult.created_answers === 1 ? 'y' : 'ies'}` : ' into existing bank entries'}
            {qaResult.skipped_short > 0 ? ` — ${qaResult.skipped_short} skipped (under 10 chars)` : ''}
          </p>
          <p className="mt-1 text-neutral-400">
            Bodies are encrypted in your{' '}
            <a href="/aqua-local" className="text-brand-400 underline underline-offset-2">vault answer bank</a>
            {' '}— reusing them in applications keeps the normal approval gates.
          </p>
        </div>
      )}

      {extraction && (
        <div className="space-y-3 rounded-md border border-brand-900/60 bg-brand-950/20 p-4">
          <div className="text-xs">
            <p className="font-medium text-neutral-200">
              {extraction.entity.name} · {extraction.entity.vertical}
            </p>
            <p className="mt-1 text-neutral-400">
              {extraction.application.title}
              {extraction.application.deadline_at
                ? ` — deadline detected ${extraction.application.deadline_at}`
                : ''}
            </p>
          </div>
          <div className="max-h-48 space-y-1 overflow-y-auto text-xs">
            {extraction.questions.map((q) => (
              <p key={q.order_index} className="text-neutral-300">
                <span className="text-neutral-500">{q.order_index}.</span> {q.question_text}
                {q.word_limit ? <span className="text-neutral-500"> ({q.word_limit}w)</span> : null}
              </p>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-primary" disabled={busy} onClick={() => void importToVault()}>
              {busy ? 'Importing…' : `Import ${extraction.questions.length} question${extraction.questions.length === 1 ? '' : 's'} to vault`}
            </button>
            <button
              className="text-xs text-neutral-400 hover:text-neutral-200"
              onClick={() => setExtraction(null)}
            >
              Discard preview
            </button>
          </div>
          <p className="text-[11px] text-neutral-500">
            The raw pasted text is discarded after extraction — only the
            structured result is stored, encrypted, in your vault.
          </p>
        </div>
      )}

      {result && (
        <div className="rounded-md border border-success-900/60 bg-success-950/30 p-4 text-xs">
          <p className="font-medium text-success-200">
            Imported {result.question_count} question{result.question_count === 1 ? '' : 's'} — {result.entity_name}
          </p>
          <p className="mt-1 text-neutral-400">
            Application <code className="font-mono">{result.application_id}</code> is in your{' '}
            <a href="/aqua-local" className="text-brand-400 underline underline-offset-2">
              vault answer bank
            </a>{' '}
            — each question is a scoped slot ready for answers, approvals and packets.
          </p>
        </div>
      )}
    </div>
  )
}
