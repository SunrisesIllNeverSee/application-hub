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

// Identity lifecycle (M07-ID-002). The resolved name + owning uid are a
// routing hint bound to `resolutionEpoch`: invalidateVaultIdentity() clears
// both and bumps the epoch, so an async resolution that lands AFTER a
// sign-out/account-switch is discarded instead of resurrecting the previous
// account's vault. Handles issued by getStorage() are epoch-bound — any
// handle minted before an invalidation refuses further operations, so a
// stale vault reference can never write under a new identity.
let lastResolvedDbName: string | null = null
let lastResolvedUid: string | null = null
let resolutionEpoch = 0

/**
 * Forget the resolved vault identity and release uid-keyed vault handles.
 * Call on SIGNED_OUT (this tab OR another — supabase-js broadcasts it) and
 * on a sign-in whose account differs from the resolved one. Persistent
 * IndexedDB data is never touched — this drops in-memory references only.
 */
export function invalidateVaultIdentity(): void {
  resolutionEpoch++
  lastResolvedDbName = null
  lastResolvedUid = null
  // Every cached handle is epoch-bound — all are dead after this bump, so
  // drop them all (the next getStorage() reopens cleanly). Persistent
  // IndexedDB data is untouched.
  storagePromises.clear()
}

/** Uid owning the currently resolved vault — lets auth-change handlers spot
    an account switch (returns null for anonymous/never-resolved). */
export function currentResolvedUid(): string | null {
  return lastResolvedUid
}

/**
 * Bounded async session read — queues behind supabase-js's in-flight token
 * refresh, so it races a timeout (a 429-stalled refresh must not block a
 * local vault open). Injectable in tests via __setSessionProbeForTests.
 */
type SessionProbe = () => Promise<{ uid: string | null }>
async function defaultSessionProbe(): Promise<{ uid: string | null }> {
  const { createClient } = await import('@/lib/supabase/client')
  const sessionPromise = createClient().auth.getSession()
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('session read timeout')), 1500),
  )
  const { data } = await Promise.race([sessionPromise, timeout])
  return { uid: data.session?.user?.id ?? null }
}
let sessionProbe: SessionProbe = defaultSessionProbe

/** TEST SEAM — never called by app code. Swap the async session read for a
    controllable probe; pass null to restore the real implementation. */
export function __setSessionProbeForTests(probe: SessionProbe | null): void {
  sessionProbe = probe ?? defaultSessionProbe
}

/** TEST SEAM — never called by app code. Wrap a storage handle with the
    epoch-bound revocation guard exactly as getStorage() does, so the
    sign-out revocation contract is exercisable without IndexedDB. */
export function __wrapVaultHandleForTests(dbName: string, inner: VaultStorage): VaultStorage {
  return guardVaultHandle(dbName, resolutionEpoch, inner)
}

function rememberResolved(name: string, uid: string): string {
  if (lastResolvedUid && lastResolvedUid !== uid) {
    // Account switched without an invalidation landing first (e.g. cookie
    // swap ahead of the auth listener) — kill every outstanding handle:
    // a write meant for the previous account must never land in it now.
    resolutionEpoch++
    storagePromises.clear()
  }
  lastResolvedDbName = name
  lastResolvedUid = uid
  return name
}

export async function resolveVaultDbName(): Promise<string> {
  // Read the LOCAL session (no network): getUser() validates against the
  // server, and a transient failure (429, offline) would silently flip the
  // vault to the shared 'aqua-local' DB — dropping the unlocked secret and
  // potentially writing another user's data into the anon vault. Account
  // switches still register because logout clears the local session.
  //
  // IR-M07: supabase-js getSession() queues behind an in-flight token
  // REFRESH — under auth rate-limiting (429/backoff) a local vault open
  // can stall tens of seconds on a network it does not need. The session
  // is read synchronously from the auth cookies first (this app persists
  // sessions via @supabase/ssr → document.cookie, not localStorage); the
  // async path only runs as a bounded fallback.
  const epoch = resolutionEpoch
  const fastUid = readLocalSessionUid()
  if (fastUid) return rememberResolved(`aqua-local-${fastUid}`, fastUid)
  try {
    const { uid } = await sessionProbe()
    if (epoch !== resolutionEpoch) {
      // A sign-out/account-switch landed while the async read was in
      // flight — this result is stale; resolve against current state.
      return resolveVaultDbName()
    }
    // A session written mid-flight (cookie appeared after our first read)
    // beats a stale probe result.
    const lateUid = readLocalSessionUid()
    if (lateUid) return rememberResolved(`aqua-local-${lateUid}`, lateUid)
    if (!uid) {
      // Supabase definitively reports NO session — a sticky authenticated
      // identity must not survive it (this is sign-out, not a stall).
      lastResolvedDbName = null
      lastResolvedUid = null
      return 'aqua-local'
    }
    return rememberResolved(`aqua-local-${uid}`, uid)
  } catch {
    if (epoch !== resolutionEpoch) return resolveVaultDbName()
    // Timeout/429-stall: sticky name ONLY while the epoch is unchanged —
    // an invalidated identity can never be reused here. 'aqua-local' is
    // the never-resolved first-call fallback (anonymous surface) only.
    return lastResolvedDbName ?? 'aqua-local'
  }
}

/**
 * Reassemble THIS project's supabase-ssr auth cookie(s) from a raw
 * `document.cookie` header string and extract the session uid — or null.
 *
 * @supabase/ssr@0.4.x layout (mirrors its chunker/combineChunks exactly):
 *   - small session:   `sb-<ref>-auth-token`  = percent-encoded full value
 *   - large session:   `sb-<ref>-auth-token.0`, `.1`, `.2`, …
 *                      each a percent-encoded slice; contiguous from .0
 *   - payload:         raw JSON, or `base64-<base64url(JSON)>` (default
 *                      cookieEncoding 'base64url')
 *
 * Rules: a bare base cookie wins over chunks (library precedence); a
 * chunked set must be a contiguous 0..N run — a missing index means a
 * half-written/rotated set and the partial value is REFUSED, never decoded
 * into an authoritative identity. Other projects' `sb-*` cookies are
 * ignored via the <ref> scoping.
 */
export function parseAuthCookieUid(cookieHeader: string, supabaseUrl: string): string | null {
  if (!cookieHeader) return null
  try {
    const ref = /^https:\/\/([a-z0-9-]+)\.supabase\.co/.exec(supabaseUrl)?.[1]
    if (!ref) return null
    const base = `sb-${ref}-auth-token`
    const chunkRe = new RegExp(`^${base}\\.(\\d+)$`)
    let single: string | null = null
    const chunks = new Map<number, string>()
    for (const pair of cookieHeader.split(';')) {
      const eq = pair.indexOf('=')
      if (eq === -1) continue
      const k = pair.slice(0, eq).trim()
      const v = pair.slice(eq + 1).trim()
      if (k === base) {
        single = v
        continue
      }
      const m = chunkRe.exec(k)
      if (m) {
        const i = Number(m[1])
        if (chunks.has(i)) return null // duplicate chunk index — corrupt
        chunks.set(i, v)
      }
    }
    let joined: string
    if (single !== null) {
      joined = single
    } else if (chunks.size > 0) {
      const parts: string[] = []
      for (let i = 0; i < chunks.size; i++) {
        const v = chunks.get(i)
        if (v === undefined) return null // gap in 0..N — refuse partial
        parts.push(v)
      }
      joined = parts.join('')
    } else {
      return null
    }
    if (!joined) return null
    const raw = decodeURIComponent(joined)
    // Cookie payload is either raw JSON or 'base64-<base64url>' (supabase-ssr).
    const json = raw.startsWith('base64-')
      ? (() => {
          let b64 = raw.slice(7).replace(/-/g, '+').replace(/_/g, '/')
          b64 += '='.repeat((4 - (b64.length % 4)) % 4)
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
          return new TextDecoder().decode(bytes)
        })()
      : raw
    const parsed = JSON.parse(json) as { user?: { id?: string } }
    const id = parsed?.user?.id
    return typeof id === 'string' && id.length > 0 ? id : null
  } catch {
    return null
  }
}

/** Synchronous uid read from the persisted auth session — a vault-ROUTING
    hint only. It never grants remote privileges: Supabase auth remains the
    authority for every privileged network operation. */
function readLocalSessionUid(): string | null {
  if (typeof document === 'undefined' || !document.cookie) return null
  return parseAuthCookieUid(document.cookie, process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
}

/**
 * Bind a vault handle to the resolution epoch that minted it. After
 * invalidateVaultIdentity() (sign-out / account switch), every operation on
 * a pre-invalidation handle refuses — a stale handle can never read or
 * write under a new identity, even if a component still holds it.
 */
function guardVaultHandle(dbName: string, epoch: number, inner: VaultStorage): VaultStorage {
  const revoked = () => {
    if (epoch !== resolutionEpoch) {
      throw new VaultScopeError(`vault handle for '${dbName}' revoked by sign-out/account switch`)
    }
  }
  // Async wrappers keep the VaultStorage promise contract — a revocation
  // surfaces as a rejection, never a synchronous throw into render paths.
  return {
    get: async (store, key) => (revoked(), inner.get(store, key)),
    put: async (store, value) => (revoked(), inner.put(store, value)),
    putIfAbsent: async (store, key, value) => (revoked(), inner.putIfAbsent(store, key, value)),
    getAll: async (store) => (revoked(), inner.getAll(store)),
    delete: async (store, key) => (revoked(), inner.delete(store, key)),
    keys: async (store) => (revoked(), inner.keys(store)),
    tx: async (stores, fn) => (revoked(), inner.tx(stores, fn)),
  }
}

/**
 * Open the IndexedDB vault (memoized per authenticated user). F-UI1 + IN-01
 * review fix: the cache key is the user id, so signing out and in as a
 * different account inside one SPA session opens that user's vault — never
 * the previous user's.
 */
export async function getStorage(): Promise<VaultStorage> {
  const dbName = await resolveVaultDbName()
  const epoch = resolutionEpoch
  let p = storagePromises.get(dbName)
  if (!p) {
    p = openVaultStorage(dbName).then((s) => guardVaultHandle(dbName, epoch, s))
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
  if (versions.length === 0) {
    // Intake-only vaults have no versions — an encrypted intake blob is a
    // valid secret probe too (IR-035 records carry blob_enc).
    const catalog = await storage.getAll<CatalogCacheRecord>('catalog_cache')
    const encrypted = catalog.find((c) => c.blob_enc)
    if (!encrypted) return 'empty'
    const { decryptText } = await import('../aqua-local/crypto.ts')
    await decryptText(secret, JSON.parse(encrypted.blob_enc!))
    return 'ok'
  }
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
    await Promise.all(versions.map(async (v, i) => {
      if (!v.title_enc) return
      const title = await decryptVersionTitle(secret, v).catch(() => '[undecryptable title]')
      // Shallow copy — never mutate the stored shape in place: a caller
      // re-putting this record would persist plaintext without the flag.
      const { title_enc: _te, ...rest } = v
      versions[i] = { ...rest, title } as VersionRecord
    }))
  }

  // Intake-scoped answers join their extracted question text — a bank slot
  // must be identifiable by WHAT was asked, not just opaque ids.
  const intakeMeta = new Map<string, { label: string; byOcc: Map<string, string> }>()
  for (const rec of catalog) {
    if (!rec.key.startsWith('intake:')) continue
    // Per-record isolation: one corrupt/foreign intake ciphertext must not
    // reject the whole bank view (same contract as the title pass above).
    const blob = (rec.blob_enc
      ? (secret
          ? JSON.parse(
              await decryptText(secret, JSON.parse(rec.blob_enc)).catch(() => 'null'),
            )
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
 * becomes the vault secret). Covers versions, provider keys, AND encrypted
 * intake catalog blobs — the stores that carry EncryptedBlobs.
 * Throws VaultDecryptError on mismatch.
 */
export async function assertVaultSecretCompatible(
  storage: VaultStorage,
  secret: string,
): Promise<void> {
  // tryUnlock already probes the oldest version AND — on a versionless
  // vault — an encrypted intake blob, so intake-only vaults can't accept
  // a mismatched secret either (IR-035 escrow).
  const status = await tryUnlock(storage, secret)
  if (status === 'ok') return
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
