'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import {
  listProviders,
  generateDraft,
  SUPPORTED_PROVIDERS,
} from '@/lib/aqua-local-client/session'
import type { ProviderConfigSummary } from '@/lib/aqua-local-client/session'
import { buildDraftPrompt, resolveKind } from '@/lib/draft-prompts'

// SP021/LF-16 — local-first AI drafting. The generation call goes
// browser→provider directly with the user's vault-stored BYOK key — the AQUA
// server sees neither key nor content. Every generation writes a consent
// receipt BEFORE egress; the result is a proposal the user reviews and only
// then saves as a version.

// IR-022: canonical egress URLs shown in the consent disclosure —
// endpoint-configured providers (ollama) show their stored base_url instead.
const PROVIDER_ENDPOINTS: Record<string, string> = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/chat/completions',
  google: 'https://generativelanguage.googleapis.com/v1beta/models',
}

export interface DraftAssistResult {
  text: string
  provider: string
  model: string | null
  consent_id: string
  observed: string[]
}

export function LocalDraftAssist({
  archivedQuestionId,
  questionText,
  questionTheme,
  wordLimit,
  programId,
  currentDraft,
  revisionInstruction,
  onResult,
  onCancel,
}: {
  archivedQuestionId: string
  questionText: string
  questionTheme?: string | null
  wordLimit?: number
  programId?: string
  currentDraft: string
  /** M09 W5 "Ask agent to revise": the user's instruction. When set, the
      current draft is always sent (that is the thing being revised) and the
      instruction is disclosed in the consent box. */
  revisionInstruction?: string
  onResult: (r: DraftAssistResult) => void
  onCancel: () => void
}) {
  const vault = useVault()
  const [providers, setProviders] = useState<ProviderConfigSummary[]>([])
  const [providerId, setProviderId] = useState('')
  const [model, setModel] = useState('')
  const revising = Boolean(revisionInstruction && revisionInstruction.trim())
  const [includeDraftChoice, setIncludeDraft] = useState(false)
  const includeDraft = revising || includeDraftChoice
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [programKind, setProgramKind] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const storage = await vault.ensureStorage()
        const list = await listProviders(storage)
        if (cancelled) return
        const usable = list.filter((p) => p.has_key || p.provider_id === 'ollama')
        setProviders(usable)
        if (usable.length > 0) {
          const first = usable.find((p) => p.provider_id === 'anthropic') ?? usable[0]
          setProviderId(first.provider_id)
          setModel(first.model_preference ?? '')
        }
      } catch {
        if (!cancelled) setProviders([])
      }
      // Resolve opportunity kind for coaching profile (public catalog read).
      if (programId) {
        try {
          const supabase = createClient()
          const { data: prog } = await supabase
            .from('programs')
            .select('kind, program_type')
            .eq('id', programId)
            .maybeSingle()
          if (!cancelled && prog) {
            setProgramKind(prog.kind ?? prog.program_type ?? null)
          }
        } catch {
          // kind falls back to 'accelerator' coach profile
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId])

  const selected = providers.find((p) => p.provider_id === providerId) ?? null
  const providerName =
    SUPPORTED_PROVIDERS.find((p) => p.id === providerId)?.name ?? providerId

  const { systemPrompt, userPrompt, targetWords } = useMemo(() => {
    return buildDraftPrompt({
      kind: resolveKind(programKind),
      questionText: questionText || '(question text unavailable)',
      theme: questionTheme ?? null,
      wordLimit: wordLimit ?? 300,
      existingAnswerContext:
        includeDraft && currentDraft.trim()
          ? revising
            ? `\n\nUser's current answer for this exact question:\n${currentDraft}\n\nRevise this answer following the user's instruction below. Keep everything the instruction does not ask to change.\n\nUser's revision instruction:\n${revisionInstruction!.trim()}`
            : `\n\nUser's current draft for this exact question:\n${currentDraft}\n\nImprove and adapt this — don't start from scratch.`
          : undefined,
    })
  }, [programKind, questionText, questionTheme, wordLimit, includeDraft, currentDraft, revising, revisionInstruction])

  async function handleGenerate() {
    const secret = vault.getSecret()
    if (!secret) {
      setError('Vault is locked — unlock to generate.')
      return
    }
    if (!providerId) {
      setError('Choose a configured provider first.')
      return
    }
    setGenerating(true)
    setError('')
    try {
      const storage = await vault.ensureStorage()
      // userConsent=true here IS the user's click on this authorize button —
      // the disclosure above names provider, model, and the exact payload.
      const result = await generateDraft(storage, secret, true, {
        provider_id: providerId,
        prompt: userPrompt,
        system: systemPrompt,
        model: model.trim() || undefined,
      })
      onResult(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-brand-200 p-4 dark:border-brand-800/60">
      <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {revising ? 'Revise with AI — consent required' : 'Draft with AI — consent required'}
      </h3>

      {providers.length === 0 ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          No provider configured in your vault.{' '}
          <a href="/aqua-local" className="text-brand-600 underline underline-offset-2 dark:text-brand-400">
            Configure one under AI providers
          </a>{' '}
          — keys stay on this device.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">
              Provider
              <select
                value={providerId}
                onChange={(e) => {
                  const p = providers.find((x) => x.provider_id === e.target.value)
                  setProviderId(e.target.value)
                  setModel(p?.model_preference ?? '')
                }}
                className="ml-2 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
              >
                {providers.map((p) => (
                  <option key={p.provider_id} value={p.provider_id}>
                    {SUPPORTED_PROVIDERS.find((d) => d.id === p.provider_id)?.name ?? p.provider_id}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-neutral-500 dark:text-neutral-400">
              Model
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="ml-2 w-48 rounded-md border border-neutral-200 bg-white px-2 py-1 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
                placeholder="default model"
              />
            </label>
          </div>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-400">
            <p className="font-medium text-neutral-700 dark:text-neutral-300">
              Sends directly from this browser to {providerName}
              {model.trim() ? ` (model ${model.trim()})` : ''}:
            </p>
            {/* IR-022: name the concrete endpoint — for endpoint-configured
                providers (e.g. Ollama) the user must see where text is going. */}
            {(() => {
              const cfg = providers.find((p) => p.provider_id === providerId)
              const ep = cfg?.base_url
                ? `${cfg.base_url.replace(/\/+$/, '')}/api/chat`
                : PROVIDER_ENDPOINTS[providerId]
              return ep ? (
                <p className="mt-1 font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
                  egress: {ep}
                </p>
              ) : null
            })()}
            <ul className="mt-1 list-inside list-disc">
              <li>The question text + theme + word limit (~{targetWords} target)</li>
              <li>An application-coach system instruction</li>
              {includeDraft && <li>Your current draft text (context)</li>}
              {revising && <li>Your revision instruction: “{revisionInstruction!.trim()}”</li>}
            </ul>
            {!revising && (
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeDraft}
                onChange={(e) => setIncludeDraft(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-neutral-300 dark:border-neutral-600"
              />
              <span>
                Also send my current draft as context
                {currentDraft.trim() ? '' : ' (editor is empty)'}
              </span>
            </label>
            )}
            <p className="mt-2 text-neutral-400 dark:text-neutral-500">
              Nothing is sent to the AQUA server. A consent receipt is recorded
              in your vault before the request leaves this device.
            </p>
          </div>

          {error && (
            <p className="text-xs text-danger-600 dark:text-danger-400">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button onClick={onCancel} className="btn-secondary px-3 py-1.5 text-xs">
              Cancel
            </button>
            <button
              onClick={() => void handleGenerate()}
              disabled={generating || !providerId}
              className="btn-primary px-4 py-1.5 text-xs disabled:opacity-60"
            >
              {generating ? 'Contacting provider…' : `Authorize & ${revising ? 'revise' : 'generate'} via ${providerName}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
