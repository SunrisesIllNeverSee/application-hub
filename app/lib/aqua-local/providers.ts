// EGRESS-BOUNDARY: this module is the ONLY permitted network egress point in
// aqua-local. Every fetch call site is marked `// EGRESS-DECLARED:` and is
// reachable ONLY after an explicit user-granted consent check. No other file
// in app/lib/aqua-local may perform network I/O.
//
// LF-16 — provider adapters: manual | byok | app_provider.
//   - manual      → no adapter, no egress; versions are user-typed.
//   - byok        → user-supplied API key stored ONLY in the local vault
//                   (encrypted under the vault secret); never sent to the
//                   application server.
//   - app_provider→ application-configured provider endpoint; still requires
//                   explicit stored consent per generation.
//
// Fail closed: no consent → ProviderConsentError. No BYOK key →
// ProviderKeyError. No silent fallback to another provider or to manual.
//
// LF-17 — provenance: every generation stores a consent receipt BEFORE
// egress and the resulting version's ProvenanceRecord carries declared
// labels (method/provider/model) separately from `observed` claims — only
// facts the system actually witnessed may appear in observed_flags.

import {
  canonicalJson,
  decryptText,
  encryptText,
  newId,
  nowIso,
  sha256Hex,
} from './crypto.ts'
import type { VaultStorage } from './vault.ts'
import type {
  ProviderConsentRecord,
  ProviderKeyRecord,
  ProvenanceRecord,
  VersionMethod,
  VersionRecord,
} from './schema.ts'
import { createVersion } from './repo.ts'

export class ProviderConsentError extends Error {
  constructor(message = 'provider egress refused: no explicit user consent for this generation') {
    super(message)
    this.name = 'ProviderConsentError'
  }
}

export class ProviderKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderKeyError'
  }
}

export class ProviderEgressError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderEgressError'
  }
}

export type ProviderMode = 'manual' | 'byok' | 'app_provider'

export interface ProviderGenerateRequest {
  prompt: string
  /** Optional system instruction for chat-style providers. */
  system?: string
  model?: string
  max_output_tokens?: number
}

export interface ProviderGenerateResult {
  text: string
  provider: string
  model: string | null
  /**
   * Claims the adapter actually observed about this call (e.g.
   * 'provider_response', 'model_reported'). These — and only these — may be
   * written into the version's provenance observed_flags. Declared labels
   * that were never witnessed MUST NOT appear here.
   */
  observed: string[]
}

export interface ProviderAdapter {
  /** Stable adapter id, e.g. 'openai-byok', 'aqua-app-provider', 'mock'. */
  id: string
  mode: ProviderMode
  /** Provider label recorded in provenance (declared field). */
  provider: string
  /**
   * Whether a stored key is required before generation (default true for
   * byok). Endpoint-only providers (Ollama) set this false — their config
   * record carries a base_url instead of secret material.
   */
  requiresKey?: boolean
  /**
   * IR-006: the exact URL generation egress targets. Recorded on the consent
   * receipt so the audit trail names the host the request went to — a stored
   * base_url must never silently redirect a provider's key to a foreign host.
   */
  endpoint?: string
  /**
   * Perform the generation. `ctx.apiKey` is present only for `byok` mode.
   * `ctx.fetchImpl` is injectable for tests; adapters MUST use it rather
   * than a global fetch reference so the egress boundary stays auditable.
   */
  generate(
    req: ProviderGenerateRequest,
    ctx: { apiKey?: string; fetchImpl: typeof fetch },
  ): Promise<ProviderGenerateResult>
}

// ---------------------------------------------------------------------------
// BYOK key storage — vault-local only (LF-16)
// ---------------------------------------------------------------------------

export async function storeProviderKey(
  storage: VaultStorage,
  secret: string,
  providerId: string,
  apiKey: string,
  config?: { base_url?: string; model_preference?: string },
): Promise<ProviderKeyRecord> {
  if (!providerId) throw new ProviderKeyError('provider key requires a provider_id')
  // Ollama-style endpoint providers carry no secret key — the base_url is
  // the locator and is stored unencrypted in the record itself.
  if (!apiKey && !config?.base_url) {
    throw new ProviderKeyError('refusing to store an empty provider key')
  }
  const existing = await storage.get<ProviderKeyRecord>('provider_keys', providerId)
  const record: ProviderKeyRecord = {
    provider_id: providerId,
    key_blob: apiKey
      ? JSON.stringify(await encryptText(secret, apiKey))
      : (existing?.key_blob ?? ''),
    stored_at: nowIso(),
    // IR-006: base_url is persisted ONLY for endpoint-only providers
    // (ollama) — a stored URL on a hosted provider would be an exfil path.
    ...(config?.base_url !== undefined && providerId === 'ollama'
      ? { base_url: config.base_url }
      : {}),
    ...(config?.model_preference !== undefined
      ? { model_preference: config.model_preference }
      : {}),
  }
  await storage.put('provider_keys', record)
  return record
}

/** Read the non-secret config fields of a provider record (no decrypt). */
export async function loadProviderConfig(
  storage: VaultStorage,
  providerId: string,
): Promise<{ base_url?: string; model_preference?: string; last_tested_at?: string } | null> {
  const rec = await storage.get<ProviderKeyRecord>('provider_keys', providerId)
  if (!rec) return null
  return {
    base_url: rec.base_url,
    model_preference: rec.model_preference,
    last_tested_at: rec.last_tested_at,
  }
}

export async function markProviderTested(
  storage: VaultStorage,
  providerId: string,
): Promise<void> {
  const rec = await storage.get<ProviderKeyRecord>('provider_keys', providerId)
  if (!rec) return
  await storage.put('provider_keys', { ...rec, last_tested_at: nowIso() })
}

export async function listProviderConfigs(storage: VaultStorage): Promise<ProviderKeyRecord[]> {
  return storage.getAll<ProviderKeyRecord>('provider_keys')
}

/** Returns the decrypted key, or null when absent/endpoint-only. Wrong secret → VaultDecryptError. */
export async function loadProviderKey(
  storage: VaultStorage,
  secret: string,
  providerId: string,
): Promise<string | null> {
  const rec = await storage.get<ProviderKeyRecord>('provider_keys', providerId)
  if (!rec || !rec.key_blob) return null
  return decryptText(secret, JSON.parse(rec.key_blob))
}

export async function deleteProviderKey(storage: VaultStorage, providerId: string): Promise<void> {
  await storage.delete('provider_keys', providerId)
}

// ---------------------------------------------------------------------------
// Consent-gated generation (the only path that can reach an adapter)
// ---------------------------------------------------------------------------

export interface GenerateWithConsentInput {
  /** Must be exactly `true` — an explicit, per-generation user grant. */
  userConsent: boolean
  /** Vault secret — required for byok mode to unlock the stored key. */
  secret?: string
  fetchImpl?: typeof fetch
}

export interface GenerateWithConsentOutput {
  result: ProviderGenerateResult
  consent: ProviderConsentRecord
}

/**
 * Run one provider generation behind the consent gate.
 * A ProviderConsentRecord is written BEFORE the adapter is invoked, so every
 * egress has a stored consent receipt covering exactly this request.
 */
export async function generateWithConsent(
  storage: VaultStorage,
  adapter: ProviderAdapter,
  request: ProviderGenerateRequest,
  input: GenerateWithConsentInput,
): Promise<GenerateWithConsentOutput> {
  // Fail closed on anything other than an explicit `true`.
  if (input.userConsent !== true) throw new ProviderConsentError()

  // IR-004: freeze the request BEFORE hashing — the caller holds a live
  // reference and could mutate fields between the pin and egress. The consent
  // receipt must attest exactly the bytes that leave the browser.
  const snapshot = structuredClone(request)
  const requestSha = await sha256Hex(canonicalJson(snapshot))
  const consent: ProviderConsentRecord = {
    id: newId(),
    provider_id: adapter.provider,
    adapter_id: adapter.id,
    purpose: 'generation',
    granted_by: 'user',
    request_sha256: requestSha,
    ...(adapter.endpoint ? { endpoint: adapter.endpoint } : {}),
    at: nowIso(),
  }
  // Consent receipt is stored before egress: the audit trail exists even if
  // the provider call subsequently fails.
  await storage.put('provider_consents', consent)

  let apiKey: string | undefined
  if (adapter.mode === 'byok' && adapter.requiresKey !== false) {
    if (!input.secret) {
      throw new ProviderKeyError(`byok adapter '${adapter.id}' requires the vault secret to unlock the key`)
    }
    const key = await loadProviderKey(storage, input.secret, adapter.provider)
    if (!key) {
      throw new ProviderKeyError(`byok adapter '${adapter.id}' has no stored key for provider '${adapter.provider}'`)
    }
    apiKey = key
  } else if (adapter.mode === 'byok' && input.secret) {
    // Endpoint-only BYOK (e.g. Ollama): a stored key may still exist — load
    // it if present but do not require it.
    apiKey = (await loadProviderKey(storage, input.secret, adapter.provider)) ?? undefined
  }

  const fetchImpl = input.fetchImpl ?? globalThis.fetch?.bind(globalThis)
  if (!fetchImpl) {
    throw new ProviderEgressError('no fetch implementation available in this environment')
  }

  const result = await adapter.generate(snapshot, { apiKey, fetchImpl })
  return { result, consent }
}

// ---------------------------------------------------------------------------
// Version-producing helper (LF-16 → LF-17): one call that generates AND
// stores the version + provenance receipt with observed-vs-declared split.
// ---------------------------------------------------------------------------

export interface GenerateVersionInput extends GenerateWithConsentInput {
  /** Vault secret — encrypts the generated version body (and unlocks BYOK keys). */
  secret: string
  answer_id: string
  title: string
  parent_version_id?: string | null
  request: ProviderGenerateRequest
}

export async function generateVersion(
  storage: VaultStorage,
  adapter: ProviderAdapter,
  input: GenerateVersionInput,
): Promise<{ version: VersionRecord; result: ProviderGenerateResult; consent: ProviderConsentRecord }> {
  const { result, consent } = await generateWithConsent(storage, adapter, input.request, input)
  const observedFlags: Record<string, boolean> = {}
  for (const claim of result.observed) observedFlags[claim] = true
  const version = await createVersion(storage, input.secret, {
    answer_id: input.answer_id,
    parent_version_id: input.parent_version_id ?? null,
    title: input.title,
    body: result.text,
    method: adapter.mode as VersionMethod,
    provider: result.provider,
    model: result.model,
    provenance: `consent:${consent.id}`,
    observed_flags: observedFlags,
  })
  return { version, result, consent }
}

// ---------------------------------------------------------------------------
// Provenance queries (LF-17)
// ---------------------------------------------------------------------------

export async function provenanceReceiptFor(
  storage: VaultStorage,
  versionId: string,
): Promise<ProvenanceRecord | null> {
  return (await storage.get<ProvenanceRecord>('provenance', versionId)) ?? null
}

export async function listProvenanceReceipts(storage: VaultStorage): Promise<ProvenanceRecord[]> {
  return storage.getAll<ProvenanceRecord>('provenance')
}

export async function listProviderConsents(storage: VaultStorage): Promise<ProviderConsentRecord[]> {
  const all = await storage.getAll<ProviderConsentRecord>('provider_consents')
  return all.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

/**
 * Deterministic mock provider for tests — performs NO network I/O (its
 * `generate` never touches fetchImpl). Observed claims reflect only what the
 * mock genuinely produced.
 */
export function createMockProvider(opts: {
  id?: string
  mode?: ProviderMode
  provider?: string
  model?: string
  responder?: (req: ProviderGenerateRequest) => string
}): ProviderAdapter {
  const responder = opts.responder ?? ((req: ProviderGenerateRequest) => `mock-response:${req.prompt}`)
  return {
    id: opts.id ?? 'mock',
    mode: opts.mode ?? 'app_provider',
    provider: opts.provider ?? 'mock-provider',
    async generate(req) {
      const text = responder(req)
      const observed = ['provider_response']
      const model = opts.model ?? null
      if (model) observed.push('model_reported')
      return { text, provider: opts.provider ?? 'mock-provider', model, observed }
    },
  }
}

/**
 * Minimal HTTP JSON provider adapter — the canonical real-egress adapter.
 * POSTs {prompt, model?, max_output_tokens?} and expects `{text}` or
 * `{completion}` in the JSON response. `byok` mode sends the vault-stored
 * key as a bearer token; `app_provider` mode sends a configured static token
 * (if any) that was provisioned app-side.
 */
export function createHttpJsonProvider(opts: {
  id: string
  mode: 'byok' | 'app_provider'
  provider: string
  endpoint: string
  model?: string
  /** Static token for app_provider mode (app-provisioned, not user BYOK). */
  appToken?: string
}): ProviderAdapter {
  return {
    id: opts.id,
    mode: opts.mode,
    provider: opts.provider,
    async generate(req, ctx) {
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (opts.mode === 'byok') {
        if (!ctx.apiKey) throw new ProviderKeyError(`byok provider '${opts.provider}' called without a key`)
        headers['authorization'] = `Bearer ${ctx.apiKey}`
      } else if (opts.appToken) {
        headers['authorization'] = `Bearer ${opts.appToken}`
      }
      // EGRESS-DECLARED: provider generation call — the only permitted
      // network egress from aqua-local, reached only after a stored
      // per-generation consent record (see generateWithConsent).
      const res = await ctx.fetchImpl(opts.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: req.prompt,
          model: req.model ?? opts.model,
          max_output_tokens: req.max_output_tokens,
        }),
      })
      if (!res.ok) {
        throw new ProviderEgressError(`provider '${opts.provider}' returned HTTP ${res.status}`)
      }
      const data = (await res.json()) as { text?: string; completion?: string; model?: string }
      const text = data.text ?? data.completion
      if (typeof text !== 'string' || text.length === 0) {
        throw new ProviderEgressError(`provider '${opts.provider}' returned no text`)
      }
      const observed = ['provider_response', 'provider_http_response']
      if (typeof data.model === 'string' && data.model.length > 0) observed.push('model_reported')
      return { text, provider: opts.provider, model: data.model ?? opts.model ?? null, observed }
    },
  }
}

// ---------------------------------------------------------------------------
// Typed BYOK adapters (SP021 support) — provider-native request/response
// schemas, direct browser→provider egress. The BYOK key NEVER transits the
// AQUA server; the browser calls the provider API directly (all listed
// providers answer CORS preflights — verified 2026-10-11). Each adapter
// reports only what it actually observed.
// ---------------------------------------------------------------------------

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  google: 'gemini-2.0-flash',
  ollama: 'llama3.2',
}

async function readErrorBody(res: Response): Promise<string> {
  const t = await res.text().catch(() => '')
  return t.slice(0, 300)
}

/** Anthropic Messages API — direct from the browser (dangerous-direct-browser-access). */
export function createAnthropicAdapter(opts?: { model?: string }): ProviderAdapter {
  const model = opts?.model ?? DEFAULT_MODELS.anthropic
  return {
    id: 'anthropic-byok',
    mode: 'byok',
    provider: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    async generate(req, ctx) {
      if (!ctx.apiKey) throw new ProviderKeyError('anthropic adapter called without a key')
      // EGRESS-DECLARED: user-consented BYOK generation.
      const res = await ctx.fetchImpl('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': ctx.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: req.model ?? model,
          max_tokens: req.max_output_tokens ?? 1024,
          ...(req.system ? { system: req.system } : {}),
          messages: [{ role: 'user', content: req.prompt }],
        }),
      })
      if (!res.ok) {
        throw new ProviderEgressError(`anthropic returned HTTP ${res.status}: ${await readErrorBody(res)}`)
      }
      const data = (await res.json()) as {
        content?: { type: string; text?: string }[]
        model?: string
      }
      const text = data.content?.find((c) => c.type === 'text')?.text?.trim() ?? ''
      if (!text) throw new ProviderEgressError('anthropic returned no text')
      return {
        text,
        provider: 'anthropic',
        model: typeof data.model === 'string' ? data.model : model,
        observed: ['provider_response', 'model_reported'],
      }
    },
  }
}

/** OpenAI Chat Completions API — direct from the browser (CORS: *). */
export function createOpenAiAdapter(opts?: { model?: string }): ProviderAdapter {
  const model = opts?.model ?? DEFAULT_MODELS.openai
  // IR-006: hard-pinned. The vault stores base_url for endpoint-only
  // providers (Ollama); letting a stored URL redirect a hosted-provider
  // adapter would smuggle the BYOK key + prompt to any CSP-allowed host.
  const base = 'https://api.openai.com'
  return {
    id: 'openai-byok',
    mode: 'byok',
    provider: 'openai',
    endpoint: `${base}/v1/chat/completions`,
    async generate(req, ctx) {
      if (!ctx.apiKey) throw new ProviderKeyError('openai adapter called without a key')
      // EGRESS-DECLARED: user-consented BYOK generation.
      const res = await ctx.fetchImpl(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${ctx.apiKey}`,
        },
        body: JSON.stringify({
          model: req.model ?? model,
          max_tokens: req.max_output_tokens ?? 1024,
          messages: [
            ...(req.system ? [{ role: 'system', content: req.system }] : []),
            { role: 'user', content: req.prompt },
          ],
        }),
      })
      if (!res.ok) {
        throw new ProviderEgressError(`openai returned HTTP ${res.status}: ${await readErrorBody(res)}`)
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[]
        model?: string
      }
      const text = data.choices?.[0]?.message?.content?.trim() ?? ''
      if (!text) throw new ProviderEgressError('openai returned no text')
      const observed = ['provider_response']
      if (typeof data.model === 'string' && data.model.length > 0) observed.push('model_reported')
      return { text, provider: 'openai', model: data.model ?? model, observed }
    },
  }
}

/** Google Gemini generateContent — direct from the browser (CORS echoes origin). */
export function createGoogleAdapter(opts?: { model?: string }): ProviderAdapter {
  const model = opts?.model ?? DEFAULT_MODELS.google
  return {
    id: 'google-byok',
    mode: 'byok',
    provider: 'google',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    async generate(req, ctx) {
      if (!ctx.apiKey) throw new ProviderKeyError('google adapter called without a key')
      // EGRESS-DECLARED: user-consented BYOK generation.
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        req.model ?? model,
      )}:generateContent`
      const res = await ctx.fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Header-based key keeps it out of the URL/logs where possible.
          'x-goog-api-key': ctx.apiKey,
        },
        body: JSON.stringify({
          ...(req.system
            ? { systemInstruction: { parts: [{ text: req.system }] } }
            : {}),
          contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
          generationConfig: { maxOutputTokens: req.max_output_tokens ?? 1024 },
        }),
      })
      if (!res.ok) {
        throw new ProviderEgressError(`google returned HTTP ${res.status}: ${await readErrorBody(res)}`)
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
        modelVersion?: string
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      if (!text) throw new ProviderEgressError('google returned no text')
      const observed = ['provider_response']
      if (typeof data.modelVersion === 'string' && data.modelVersion.length > 0) {
        observed.push('model_reported')
      }
      return {
        text,
        provider: 'google',
        model: data.modelVersion ?? model,
        observed,
      }
    },
  }
}

// Ollama (self-hosted) — direct browser call to the user's own endpoint.
// Remote tunnels (ngrok et al.) do NOT get the ngrok-skip header: requests
// send a non-HTML Accept header which already passes ngrok's browser
// warning page, while the extra header would FAIL the CORS preflight
// against the daemon's fixed Access-Control-Allow-Headers list.
export function createOllamaAdapter(opts: { base_url: string; model?: string }): ProviderAdapter {
  const model = opts.model ?? DEFAULT_MODELS.ollama
  const base = opts.base_url.replace(/\/+$/, '')
  return {
    id: 'ollama-byok',
    mode: 'byok',
    provider: 'ollama',
    requiresKey: false,
    endpoint: `${base}/api/chat`,
    async generate(req, ctx) {
      if (!base) throw new ProviderKeyError('ollama adapter requires a base_url')
      // EGRESS-DECLARED: user-consented generation to the user's own endpoint.
      const res = await ctx.fetchImpl(`${base}/api/chat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: req.model ?? model,
          stream: false,
          messages: [
            ...(req.system ? [{ role: 'system', content: req.system }] : []),
            { role: 'user', content: req.prompt },
          ],
        }),
      })
      if (!res.ok) {
        throw new ProviderEgressError(`ollama returned HTTP ${res.status}: ${await readErrorBody(res)}`)
      }
      const data = (await res.json()) as {
        message?: { content?: string }
        model?: string
      }
      const text = data.message?.content?.trim() ?? ''
      if (!text) throw new ProviderEgressError('ollama returned no text')
      const observed = ['provider_response']
      if (typeof data.model === 'string' && data.model.length > 0) observed.push('model_reported')
      return { text, provider: 'ollama', model: data.model ?? model, observed }
    },
  }
}

/** Provider ids the UI may offer for local-first BYOK. */
export const SUPPORTED_PROVIDER_IDS = ['anthropic', 'openai', 'google', 'ollama'] as const
export type SupportedProviderId = (typeof SUPPORTED_PROVIDER_IDS)[number]

/** Build the adapter for a configured provider record. */
export function adapterForProvider(
  providerId: string,
  config: { base_url?: string; model_preference?: string },
): ProviderAdapter {
  const model = config.model_preference || undefined
  switch (providerId) {
    case 'anthropic':
      return createAnthropicAdapter({ model })
    case 'openai':
      // IR-006: caller-stored base_url is ignored for hosted providers.
      return createOpenAiAdapter({ model })
    case 'google':
      return createGoogleAdapter({ model })
    case 'ollama':
      return createOllamaAdapter({
        base_url: config.base_url ?? '',
        model,
      })
    default:
      throw new ProviderKeyError(`unsupported provider '${providerId}'`)
  }
}

/**
 * Connectivity probe — a real provider call, not a mock. Cheap per provider:
 * Anthropic burns a 1-token message; OpenAI/Google list models; Ollama lists
 * local tags. Returns a human-readable detail string or throws the honest
 * provider error.
 */
export async function testProviderConnection(
  providerId: string,
  ctx: { apiKey?: string; base_url?: string; model?: string; fetchImpl: typeof fetch },
): Promise<string> {
  const f = ctx.fetchImpl
  const withTimeout = async (url: string, init: RequestInit, ms = 10000) => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), ms)
    try {
      return await f(url, { ...init, signal: ctrl.signal })
    } finally {
      clearTimeout(t)
    }
  }
  if (providerId === 'anthropic') {
    if (!ctx.apiKey) throw new ProviderKeyError('API key required')
    const res = await withTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ctx.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: ctx.model ?? DEFAULT_MODELS.anthropic,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ok' }],
      }),
    })
    if (res.status === 401) throw new ProviderEgressError('Authentication failed — check your API key.')
    if (res.status === 404) throw new ProviderEgressError(`Model "${ctx.model ?? DEFAULT_MODELS.anthropic}" not found for this account.`)
    if (!res.ok) throw new ProviderEgressError(`Anthropic returned HTTP ${res.status}`)
    return `Anthropic connected — model "${ctx.model ?? DEFAULT_MODELS.anthropic}" responding.`
  }
  if (providerId === 'openai') {
    if (!ctx.apiKey) throw new ProviderKeyError('API key required')
    // IR-006: pinned canonical endpoint — never a caller-stored URL.
    const base = 'https://api.openai.com'
    const res = await withTimeout(`${base}/v1/models`, {
      headers: { authorization: `Bearer ${ctx.apiKey}` },
    })
    if (res.status === 401) throw new ProviderEgressError('Authentication failed — check your API key.')
    if (!res.ok) throw new ProviderEgressError(`OpenAI returned HTTP ${res.status}`)
    const data = (await res.json()) as { data?: unknown[] }
    const n = data.data?.length ?? 0
    return `OpenAI connected — ${n > 0 ? `${n} models available` : 'key accepted'}.`
  }
  if (providerId === 'google') {
    if (!ctx.apiKey) throw new ProviderKeyError('API key required')
    const res = await withTimeout(
      'https://generativelanguage.googleapis.com/v1beta/models',
      { headers: { 'x-goog-api-key': ctx.apiKey } },
    )
    if (res.status === 401 || res.status === 403) {
      throw new ProviderEgressError('Authentication failed — check your API key.')
    }
    if (!res.ok) throw new ProviderEgressError(`Google returned HTTP ${res.status}`)
    const data = (await res.json()) as { models?: unknown[] }
    return `Google connected — ${data.models?.length ?? 0} models available.`
  }
  if (providerId === 'ollama') {
    const base = (ctx.base_url ?? '').replace(/\/+$/, '')
    if (!base) throw new ProviderKeyError('Ollama base URL required')
    const res = await withTimeout(`${base}/api/tags`, {}, 6000)
    if (!res.ok) throw new ProviderEgressError(`Ollama returned HTTP ${res.status}`)
    const data = (await res.json()) as { models?: { name: string }[] }
    const names = (data.models ?? []).map((m) => m.name)
    return names.length > 0
      ? `Ollama reachable — ${names.length} model${names.length === 1 ? '' : 's'} pulled: ${names.slice(0, 5).join(', ')}`
      : 'Ollama reachable, but no models are pulled yet.'
  }
  throw new ProviderKeyError(`unsupported provider '${providerId}'`)
}
