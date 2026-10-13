// Thin client adapter over app/lib/aqua-local (LF-10/11/15, IN-01).
// UI code calls ONLY this adapter + repo functions re-exported here; it owns
// no domain logic of its own. The vault lib is the authority — do not patch
// around it. The user secret is held in React state only (never persisted).
//
// Lives in lib/ (not the page dir) so every (app) surface shares one adapter.
// Imports are RELATIVE (../aqua-local) so the pure functions can be exercised
// under `node` type-stripping without the @/ alias — see run-session-tests.mjs.
// The only @/-aliased import is the lazy dynamic import inside getStorage(),
// which never fires in tests (storage is injected directly).

import {
  openVaultStorage,
  createAnswer,
  createVersion,
  readVersion,
  decryptVersionTitle,
  runVaultPrivacyMigration,
  approveVersion,
  compareApprovals,
  exportVault,
  importVault,
  previewVaultImport,
  decryptText,
  storeProviderKey,
  loadProviderKey,
  loadProviderConfig,
  deleteProviderKey,
  listProviderConfigs,
  markProviderTested,
  generateWithConsent,
  adapterForProvider,
  testProviderConnection,
  ProviderConsentError,
  ProviderKeyError,
  ProviderEgressError,
  VaultDecryptError,
  VaultBlankBodyError,
  VaultScopeError,
  VaultNotFoundError,
  VaultTamperError,
  VaultBackupVersionError,
} from '../aqua-local/index.ts'
import type {
  VaultStorage,
  AnswerRecord,
  CatalogCacheRecord,
  ApprovalRecord,
  ProvenanceRecord,
  VersionRecord,
  VersionMethod,
} from '../aqua-local/index.ts'

export {
  VaultDecryptError,
  VaultBlankBodyError,
  VaultScopeError,
  VaultNotFoundError,
  VaultTamperError,
  VaultBackupVersionError,
  ProviderConsentError,
  ProviderKeyError,
  ProviderEgressError,
}
export type { VaultStorage, VersionMethod }
export type { BackupPreview, ImportResult } from '../aqua-local/index.ts'
export { runVaultPrivacyMigration, decryptVersionTitle } from '../aqua-local/index.ts'

/** Scope for the onboarding upload path only; starter answers are scoped to
 *  the 'answer-bank' application so they show in the normal bank. */
export const ONBOARDING_APPLICATION_ID = 'local-onboarding'

/** A version row enriched with its latest approval + provenance receipt. */
export interface BankVersion {
  record: VersionRecord
  approval: 'approved' | 'rejected' | null
  /** IR-017: class of the latest decision actor — agent decisions are
      advisory review, shown distinctly; only 'human' qualifies a version
      for packets. */
  actor_class?: string
  /** IR-019: the displayed decision came from a backup file — it is shown
      but does NOT qualify the version for packets until a fresh local
      decision is recorded. */
  restored?: boolean
  provenance: ProvenanceRecord | null
}

export interface BankEntry {
  answer: AnswerRecord
  versions: BankVersion[] // ascending by created_at — last is newest
  /** For intake-scoped answers: the extracted question text + entity label
      from the `intake:<app>` catalog record (metadata-class — not
      encrypted). Lets the bank show WHICH question a slot refers to. */
  question_text?: string
  intake_label?: string
}

// Keyed by the resolved uid (or 'anon') — an account switch mid-session must
// re-resolve, never hand a different user the previous user's vault handle.
const storagePromises = new Map<string, Promise<VaultStorage>>()

let lastResolvedDbName: string | null = null

export async function resolveVaultDbName(): Promise<string> {
  // Read the LOCAL session (no network): getUser() validates against the
  // server, and a transient failure (429, offline) would silently flip the
  // vault to the shared 'aqua-local' DB — dropping the unlocked secret and
  // potentially writing another user's data into the anon vault. Account
  // switches still register because logout clears the local session.
  //
  // IR-M07: supabase-js getSession() queues behind an in-flight token
  // REFRESH — under auth rate-limiting (429/backoff) a local vault open
  // can stall tens of seconds on a network it does not need. The uid is
  // read synchronously from the persisted session first; the async path
  // only runs as a bounded fallback.
  const fastUid = readLocalSessionUid()
  if (fastUid) {
    const name = `aqua-local-${fastUid}`
    lastResolvedDbName = name
    return name
  }
  try {
    const { createClient } = await import('@/lib/supabase/client')
    const sessionPromise = createClient().auth.getSession()
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('session read timeout')), 1500),
    )
    const { data } = await Promise.race([sessionPromise, timeout])
    const uid = data.session?.user?.id
    const name = uid ? `aqua-local-${uid}` : (lastResolvedDbName ?? 'aqua-local')
    lastResolvedDbName = name
    return name
  } catch {
    return lastResolvedDbName ?? 'aqua-local'
  }
}

/** Synchronous uid read from supabase-js's persisted session — the vault's
    DB key must never wait on a token refresh. Scoped to THIS deployment's
    project ref (from NEXT_PUBLIC_SUPABASE_URL) so a shared origin hosting
    multiple Supabase projects never resolves the wrong uid. */
function readLocalSessionUid(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const ref = /^https:\/\/([a-z0-9-]+)\.supabase\.co/.exec(url)?.[1]
    const wanted = ref ? `sb-${ref}-auth-token` : null
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !/^sb-[a-z0-9-]+-auth-token$/.test(k)) continue
      if (wanted && k !== wanted) continue // wrong project on this origin
      const raw = localStorage.getItem(k)
      if (!raw) continue
      const parsed = JSON.parse(raw) as { user?: { id?: string } }
      const id = parsed?.user?.id
      if (typeof id === 'string' && id.length > 0) return id
    }
  } catch {
    /* malformed entry — fall through to the async path */
  }
  return null
}

/**
 * Open the IndexedDB vault (memoized per authenticated user). F-UI1 + IN-01
 * review fix: the cache key is the user id, so signing out and in as a
 * different account inside one SPA session opens that user's vault — never
 * the previous user's.
 */
export async function getStorage(): Promise<VaultStorage> {
  const dbName = await resolveVaultDbName()
  let p = storagePromises.get(dbName)
  if (!p) {
    p = openVaultStorage(dbName)
    storagePromises.set(dbName, p)
  }
  return p
}

/**
 * Attempt unlock. The vault has no stored verifier by design — correctness is
 * proven by decrypting a real version. Empty vault → any secret is accepted
 * (it becomes the vault secret). Wrong secret → VaultDecryptError.
 */
export async function tryUnlock(storage: VaultStorage, secret: string): Promise<'ok' | 'empty'> {
  const versions = await storage.getAll<VersionRecord>('versions')
  if (versions.length === 0) return 'empty'
  // Deterministic probe: oldest version.
  const sorted = [...versions].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  )
  await readVersion(storage, secret, sorted[0].id) // throws VaultDecryptError on wrong secret
  return 'ok'
}

/** Load the whole Answer Bank: answers + versions + latest approval + provenance. */
export async function loadBank(storage: VaultStorage, secret?: string | null): Promise<BankEntry[]> {
  const [answers, versions, approvals, provenance, catalog] = await Promise.all([
    storage.getAll<AnswerRecord>('answers'),
    storage.getAll<VersionRecord>('versions'),
    storage.getAll<ApprovalRecord>('approvals'),
    storage.getAll<ProvenanceRecord>('provenance'),
    storage.getAll<CatalogCacheRecord>('catalog_cache'),
  ])

  // IR-014/035: titles + intake blobs are ciphertext at rest — decrypt when
  // the caller carries the vault secret (all bank displays run unlocked).
  if (secret) {
    // Per-record isolation: one corrupt title must not reject the whole
    // bank view (contrast VaultPacketPanel's .catch(() => v.title)).
    await Promise.all(versions.map(async (v) => {
      if (!v.title_enc) return
      v.title = await decryptVersionTitle(secret, v).catch(() => '[undecryptable title]')
      delete v.title_enc
    }))
  }

  // Intake-scoped answers join their extracted question text — a bank slot
  // must be identifiable by WHAT was asked, not just opaque ids.
  const intakeMeta = new Map<string, { label: string; byOcc: Map<string, string> }>()
  for (const rec of catalog) {
    if (!rec.key.startsWith('intake:')) continue
    const blob = (rec.blob_enc
      ? (secret
          ? JSON.parse(await decryptText(secret, JSON.parse(rec.blob_enc)))
          : undefined) // encrypted intake record and no secret → skip
      : rec.blob) as {
      application_id?: string
      entity?: { name?: string }
      application?: { title?: string }
      questions?: Array<{ occurrence_id?: string; text?: string }>
    } | undefined
    if (!blob?.application_id || !Array.isArray(blob.questions)) continue
    intakeMeta.set(blob.application_id, {
      label: blob.entity?.name ?? blob.application?.title ?? blob.application_id,
      byOcc: new Map(
        blob.questions
          .filter((q) => typeof q?.occurrence_id === 'string')
          .map((q) => [q.occurrence_id!, q.text ?? '']),
      ),
    })
  }

  // Latest approval wins per version (records are append-only).
  // IR-007: single-sourced ordering — compareApprovals is the LF-18
  // authoritative order (seq beats legacy timestamps); never re-roll.
  const approvalByVersion = new Map<string, ApprovalRecord>()
  for (const a of [...approvals].sort(compareApprovals)) {
    approvalByVersion.set(a.version_id, a)
  }
  const provenanceByVersion = new Map<string, ProvenanceRecord>()
  for (const p of provenance) provenanceByVersion.set(p.version_id, p)

  const byAnswer = new Map<string, BankVersion[]>()
  for (const v of versions) {
    // F-UI2: an approval only displays when its pinned sha matches the stored
    // version — a swapped version row must not still look "Approved".
    const ap = approvalByVersion.get(v.id)
    const bv: BankVersion = {
      record: v,
      approval: ap && ap.version_sha256 === v.sha256 ? ap.decision : null,
      actor_class: ap?.actor_class,
      restored: ap?.restored_from_backup === true && ap.version_sha256 === v.sha256,
      provenance: provenanceByVersion.get(v.id) ?? null,
    }
    const list = byAnswer.get(v.answer_id) ?? []
    list.push(bv)
    byAnswer.set(v.answer_id, list)
  }

  return answers
    .map((answer) => ({
      answer,
      question_text: intakeMeta
        .get(answer.scope.application_id)
        ?.byOcc.get(answer.scope.question_occurrence_id),
      intake_label: intakeMeta.get(answer.scope.application_id)?.label,
      versions: (byAnswer.get(answer.id) ?? []).sort(
        (a, b) =>
          a.record.created_at.localeCompare(b.record.created_at) ||
          a.record.id.localeCompare(b.record.id),
      ),
    }))
    .sort((a, b) => {
      const at = a.versions.at(-1)?.record.created_at ?? a.answer.created_at
      const bt = b.versions.at(-1)?.record.created_at ?? b.answer.created_at
      return bt.localeCompare(at)
    })
}

export interface SaveVersionInput {
  /** Existing answer id, or null to create a new answer under `scope`. */
  answer_id: string | null
  scope?: { application_id: string; question_occurrence_id: string }
  parent_version_id?: string | null
  title: string
  body: string
  method?: VersionMethod
  provenance?: string | null
  provider?: string | null
  model?: string | null
  observed_flags?: Record<string, boolean>
  /** IR-026: provenance link to the source version the body was derived
      from — used when reuse crosses application scope. */
  derived_from?: { version_id: string; version_sha256: string } | null
}

/**
 * Save = always a new immutable version. Editing an approved version produces
 * a child version (parent link set); the prior approval stays attached to the
 * parent's sha256 — approvals never transfer forward silently.
 */
export async function saveVersion(
  storage: VaultStorage,
  secret: string,
  input: SaveVersionInput,
): Promise<VersionRecord> {
  let answerId = input.answer_id
  if (!answerId) {
    const scope = input.scope
    if (!scope?.application_id || !scope.question_occurrence_id) {
      throw new VaultScopeError('new answer requires application_id and question_occurrence_id')
    }
    const answer = await createAnswer(storage, scope)
    answerId = answer.id
  }
  return createVersion(storage, secret, {
    answer_id: answerId,
    parent_version_id: input.parent_version_id ?? null,
    title: input.title,
    body: input.body,
    method: input.method ?? 'manual',
    provenance: input.provenance ?? null,
    provider: input.provider ?? null,
    model: input.model ?? null,
    observed_flags: input.observed_flags,
    derived_from: input.derived_from ?? null,
  })
}

/** Decrypt a version body for editing/preview. Throws VaultDecryptError. */
export function readBody(
  storage: VaultStorage,
  secret: string,
  versionId: string,
): Promise<{ title: string; body: string }> {
  return readVersion(storage, secret, versionId).then(({ title, body }) => ({ title, body }))
}

export function approve(
  storage: VaultStorage,
  versionId: string,
  decision: 'approved' | 'rejected',
): Promise<ApprovalRecord> {
  return approveVersion(storage, { version_id: versionId, decision, actor_class: 'human' })
}

/** LF-15 backup-reminder bookkeeping — a localStorage timestamp, nothing private. */
const LAST_BACKUP_KEY = 'aqua-local:last-backup-at'
export const BACKUP_REMINDER_MS = 7 * 24 * 60 * 60 * 1000

export function lastBackupAt(): number | null {
  if (typeof localStorage === 'undefined') return null
  const v = localStorage.getItem(LAST_BACKUP_KEY)
  const t = v ? Date.parse(v) : NaN
  return Number.isFinite(t) ? t : null
}

/**
 * IN-01 — scope conventions for the normal (app) surfaces.
 *
 * `question_occurrence_id` is always the `archived_question_id` — one
 * occurrence per catalog question, consistent with the local surface's
 * string occurrences ('onboarding:*', legacy source_ids).
 *
 * `application_id`:
 *   - a `programId` when the edit happens inside an application workspace
 *     (binds the answer to that application's exact question occurrence);
 *   - PROFILE_BANK_APPLICATION_ID otherwise (answer bank / profile pages).
 */
export const PROFILE_BANK_APPLICATION_ID = 'answer-bank'

export function scopeForQuestion(
  archivedQuestionId: string,
  programId?: string | null,
): { application_id: string; question_occurrence_id: string } {
  return {
    application_id: programId ?? PROFILE_BANK_APPLICATION_ID,
    question_occurrence_id: archivedQuestionId,
  }
}

/** All answers recorded for a question occurrence, across applications. */
export async function findAnswersForOccurrence(
  storage: VaultStorage,
  questionOccurrenceId: string,
): Promise<AnswerRecord[]> {
  const answers = await storage.getAll<AnswerRecord>('answers')
  return answers.filter((a) => a.scope?.question_occurrence_id === questionOccurrenceId)
}

export interface ScopedAnswer {
  entry: BankEntry | null
  /** Latest version + decrypted body, or null when no versions exist. */
  latest: { version: BankVersion; title: string; body: string } | null
}

/**
 * Load the bank entry for a question scope. Exact application_id match wins;
 * otherwise the occurrence's most-recently-versioned answer is used (one
 * logical answer per question across contexts). Requires an UNLOCKED vault —
 * the latest body is decrypted with `secret`.
 */
export async function loadScopeEntry(
  storage: VaultStorage,
  secret: string,
  scope: { application_id: string; question_occurrence_id: string },
): Promise<ScopedAnswer> {
  const bank = await loadBank(storage, secret)
  const matches = bank.filter(
    (e) => e.answer.scope.question_occurrence_id === scope.question_occurrence_id,
  )
  const entry =
    matches.find((e) => e.answer.scope.application_id === scope.application_id) ??
    matches[0] ??
    null
  if (!entry) return { entry: null, latest: null }
  const latest = entry.versions.at(-1) ?? null
  if (!latest) return { entry, latest: null }
  const { title, body } = await readBody(storage, secret, latest.record.id)
  return { entry, latest: { version: latest, title, body } }
}

/**
 * Save an edit for a question scope as a new immutable child version.
 * Reuses an existing answer ONLY when its application scope matches the
 * requested one — a bank-scoped answer must never silently absorb a
 * program-context save (the version would be invisible to that program's
 * readiness overlay and foreign-scoped to its packet freeze). One answer
 * per (occurrence, application scope); a new scoped answer is created when
 * none matches. Returns the created version.
 */
export async function saveScopedVersion(
  storage: VaultStorage,
  secret: string,
  scope: { application_id: string; question_occurrence_id: string },
  input: {
    title: string
    body: string
    method?: VersionMethod
    provenance?: string | null
    provider?: string | null
    model?: string | null
    observed_flags?: Record<string, boolean>
    /** IR-026: source version the drafted body was derived from. */
    derived_from?: { version_id: string; version_sha256: string } | null
  },
): Promise<VersionRecord> {
  const candidates = await findAnswersForOccurrence(storage, scope.question_occurrence_id)
  const answer = candidates.find((a) => a.scope.application_id === scope.application_id) ?? null

  let parentVersionId: string | null = null
  if (answer) {
    const versions = await storage.getAll<VersionRecord>('versions')
    const latest = versions
      .filter((v) => v.answer_id === answer!.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
      .at(-1)
    parentVersionId = latest?.id ?? null
  }

  return saveVersion(storage, secret, {
    answer_id: answer?.id ?? null,
    scope,
    parent_version_id: parentVersionId,
    title: input.title,
    body: input.body,
    method: input.method ?? 'manual',
    provenance: input.provenance ?? null,
    provider: input.provider ?? null,
    model: input.model ?? null,
    observed_flags: input.observed_flags,
    derived_from: input.derived_from ?? null,
  })
}

/**
 * Assert `secret` can read every secret-bearing store already in the vault —
 * required before restoring a backup into a NON-EMPTY vault, since imported
 * bodies are re-encrypted under it. An empty vault accepts any secret (it
 * becomes the vault secret). Covers versions AND provider keys — the two
 * stores that carry EncryptedBlobs. Throws VaultDecryptError on mismatch.
 */
export async function assertVaultSecretCompatible(
  storage: VaultStorage,
  secret: string,
): Promise<void> {
  const versions = await storage.getAll<VersionRecord>('versions')
  if (versions.length > 0) {
    await tryUnlock(storage, secret) // decrypts oldest version
    return
  }
  const keys = await storage.getAll<{ key_blob: string }>('provider_keys')
  const secretBearing = keys.find((k) => k.key_blob)
  if (secretBearing) {
    await decryptText(secret, JSON.parse(secretBearing.key_blob))
  }
}

/** Dry-run a backup restore against the current vault — decrypts + verifies, writes nothing. */
export function previewBackup(
  storage: VaultStorage,
  secret: string,
  exportedJson: string,
) {
  return previewVaultImport(storage, secret, exportedJson)
}

/**
 * Restore an encrypted backup into the vault. `secret` must be BOTH the
 * backup's secret and (when the vault is non-empty) the vault's secret —
 * the import re-encrypts version bodies under it. Callers enforce that
 * compatibility via tryUnlock before invoking this.
 */
export function restoreBackup(
  storage: VaultStorage,
  secret: string,
  exportedJson: string,
) {
  return importVault(storage, secret, exportedJson)
}

/** Export an encrypted backup and trigger a user-initiated file download. */
export async function downloadBackup(storage: VaultStorage, secret: string): Promise<string> {
  const json = await exportVault(storage, secret)
  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `aqua-local-backup-${stamp}.json`
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString())
  return filename
}

// ---------------------------------------------------------------------------
// LF-16/SP021 — local-first BYOK provider configuration + consented generation.
// Keys live ONLY in the vault (provider_keys store, encrypted under the user
// secret). Generation egress goes browser→provider directly — the AQUA server
// never sees the key or the content.
// ---------------------------------------------------------------------------

export const SUPPORTED_PROVIDERS: {
  id: string
  name: string
  keyLabel: string
  keyPlaceholder: string
  baseUrlLabel?: string
  modelPlaceholder: string
  requiresKey: boolean
  requiresBaseUrl: boolean
}[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    keyLabel: 'API key',
    keyPlaceholder: 'sk-ant-…',
    modelPlaceholder: 'claude-haiku-4-5-20251001',
    requiresKey: true,
    requiresBaseUrl: false,
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT)',
    keyLabel: 'API key',
    keyPlaceholder: 'sk-…',
    modelPlaceholder: 'gpt-4o-mini',
    requiresKey: true,
    requiresBaseUrl: false,
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    keyLabel: 'API key',
    keyPlaceholder: 'AIza…',
    modelPlaceholder: 'gemini-2.0-flash',
    requiresKey: true,
    requiresBaseUrl: false,
  },
  {
    id: 'ollama',
    name: 'Ollama (self-hosted)',
    keyLabel: 'API key (optional)',
    keyPlaceholder: '(leave blank — Ollama usually needs none)',
    baseUrlLabel: 'Ollama URL',
    modelPlaceholder: 'llama3.2',
    requiresKey: false,
    requiresBaseUrl: true,
  },
]

export interface ProviderConfigSummary {
  provider_id: string
  has_key: boolean
  base_url?: string
  model_preference?: string
  last_tested_at?: string
  stored_at: string
}

export async function listProviders(storage: VaultStorage): Promise<ProviderConfigSummary[]> {
  const recs = await listProviderConfigs(storage)
  return recs.map((r) => ({
    provider_id: r.provider_id,
    has_key: Boolean(r.key_blob),
    base_url: r.base_url,
    model_preference: r.model_preference,
    last_tested_at: r.last_tested_at,
    stored_at: r.stored_at,
  }))
}

export async function saveProvider(
  storage: VaultStorage,
  secret: string,
  input: { provider_id: string; api_key?: string; base_url?: string; model_preference?: string },
): Promise<void> {
  if (!SUPPORTED_PROVIDERS.some((p) => p.id === input.provider_id)) {
    throw new ProviderKeyError(`unsupported provider '${input.provider_id}'`)
  }
  const def = SUPPORTED_PROVIDERS.find((p) => p.id === input.provider_id)!
  if (def.requiresKey && !input.api_key?.trim() && !(await loadProviderKey(storage, secret, input.provider_id))) {
    throw new ProviderKeyError(`${def.name} requires an API key`)
  }
  if (def.requiresBaseUrl && !input.base_url?.trim()) {
    throw new ProviderKeyError(`${def.name} requires a base URL`)
  }
  await storeProviderKey(storage, secret, input.provider_id, input.api_key?.trim() ?? '', {
    base_url: input.base_url?.trim() || undefined,
    model_preference: input.model_preference?.trim() || undefined,
  })
}

export async function removeProvider(storage: VaultStorage, providerId: string): Promise<void> {
  await deleteProviderKey(storage, providerId)
}

/**
 * Real connectivity probe — calls the provider with the stored key/config.
 * Throws an honest error on failure; records last_tested_at on success.
 */
export async function testProvider(
  storage: VaultStorage,
  secret: string,
  providerId: string,
): Promise<string> {
  const cfg = await loadProviderConfig(storage, providerId)
  const apiKey = (await loadProviderKey(storage, secret, providerId)) ?? undefined
  const detail = await testProviderConnection(providerId, {
    apiKey,
    base_url: cfg?.base_url,
    model: cfg?.model_preference,
    fetchImpl: globalThis.fetch.bind(globalThis),
  })
  await markProviderTested(storage, providerId)
  return detail
}

export interface GenerateDraftInput {
  provider_id: string
  /** What the provider will receive — assembled by the caller, disclosed in UI. */
  prompt: string
  system?: string
  model?: string
  /** Pinned config from the UI disclosure — when set, the adapter is built
      from THESE values so actual egress cannot diverge from what the user
      was shown mid-session (stored config may have been edited). */
  disclosed_config?: { base_url?: string; model_preference?: string }
}

export interface GenerateDraftResult {
  text: string
  provider: string
  model: string | null
  consent_id: string
  observed: string[]
}

/**
 * Consent-gated generation. `userConsent` must be a real user grant — the UI
 * collects it per request. A consent receipt is written BEFORE egress so every
 * external call has an audit trail even when the provider call fails.
 */
export async function generateDraft(
  storage: VaultStorage,
  secret: string,
  userConsent: boolean,
  input: GenerateDraftInput,
): Promise<GenerateDraftResult> {
  const stored = await loadProviderConfig(storage, input.provider_id)
  if (!stored) throw new ProviderKeyError(`provider '${input.provider_id}' is not configured in this vault`)
  // Only DEFINED disclosed fields pin the adapter — an absent key must not
  // erase a stored value.
  const cfg = input.disclosed_config
    ? {
        ...stored,
        ...Object.fromEntries(
          Object.entries(input.disclosed_config).filter(([, v]) => v !== undefined),
        ),
      }
    : stored
  const adapter = adapterForProvider(input.provider_id, cfg)
  const { result, consent } = await generateWithConsent(
    storage,
    adapter,
    {
      prompt: input.prompt,
      system: input.system,
      model: input.model ?? cfg.model_preference,
    },
    { userConsent, secret },
  )
  return {
    text: result.text,
    provider: result.provider,
    model: result.model,
    consent_id: consent.id,
    observed: result.observed,
  }
}
