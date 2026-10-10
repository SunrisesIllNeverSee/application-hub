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
): Promise<ProviderKeyRecord> {
  if (!providerId) throw new ProviderKeyError('provider key requires a provider_id')
  if (!apiKey) throw new ProviderKeyError('refusing to store an empty provider key')
  const record: ProviderKeyRecord = {
    provider_id: providerId,
    key_blob: JSON.stringify(await encryptText(secret, apiKey)),
    stored_at: nowIso(),
  }
  await storage.put('provider_keys', record)
  return record
}

/** Returns the decrypted key, or null when absent. Wrong secret → VaultDecryptError. */
export async function loadProviderKey(
  storage: VaultStorage,
  secret: string,
  providerId: string,
): Promise<string | null> {
  const rec = await storage.get<ProviderKeyRecord>('provider_keys', providerId)
  if (!rec) return null
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

  const requestSha = await sha256Hex(canonicalJson(request))
  const consent: ProviderConsentRecord = {
    id: newId(),
    provider_id: adapter.provider,
    adapter_id: adapter.id,
    purpose: 'generation',
    granted_by: 'user',
    request_sha256: requestSha,
    at: nowIso(),
  }
  // Consent receipt is stored before egress: the audit trail exists even if
  // the provider call subsequently fails.
  await storage.put('provider_consents', consent)

  let apiKey: string | undefined
  if (adapter.mode === 'byok') {
    if (!input.secret) {
      throw new ProviderKeyError(`byok adapter '${adapter.id}' requires the vault secret to unlock the key`)
    }
    const key = await loadProviderKey(storage, input.secret, adapter.provider)
    if (!key) {
      throw new ProviderKeyError(`byok adapter '${adapter.id}' has no stored key for provider '${adapter.provider}'`)
    }
    apiKey = key
  }

  const fetchImpl = input.fetchImpl ?? globalThis.fetch?.bind(globalThis)
  if (!fetchImpl) {
    throw new ProviderEgressError('no fetch implementation available in this environment')
  }

  const result = await adapter.generate(request, { apiKey, fetchImpl })
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
