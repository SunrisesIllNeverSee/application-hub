// VENDORED from aqua-companion/vendor/lib/aqua-local/repo.mjs. Do not edit: change the source and run
// `npm run vendor:companion` in application-hub-mcp-server/ (CI checks these copies).
// VENDORED FILE: DO NOT EDIT. Regenerate with: node aqua-companion/scripts/vendor.mjs
// source: app/lib/aqua-local/repo.ts
// source-sha256: 04a42745142a9f249f3f41dfc4843d216d80c38e7850671ad568db9feee71ef2
// body-sha256: f1e5e20017ae9cc4f53a9170fb46be9506a5594806da5df7680c0ff6c2506186
// generator: v2; types stripped (node:module stripTypeScriptTypes, strip mode); .ts imports point at .mjs.
// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// LF-07 — domain repository. The only API the UI uses for private data.
// Guarantees:
//   - versions are immutable (edit = new child version w/ parent link)
//   - sha256 of canonical content is recorded per version
//   - versions bind an exact scope (application_id + question_occurrence_id);
//     a parent version from a different scope is REFUSED
//   - blank / whitespace-only / invisible-character-only bodies are REFUSED
//     (equivalent to the canon m04 guard: strip Unicode Cf + whitespace,
//     refuse if nothing remains)

import {
  canonicalJson,
  decryptText,
  encryptField,
  encryptText,
  newId,
  nowIso,
  sha256Hex,
  verifyManifestSignature,
} from './crypto.mjs'
                                              
             
             
               
                 
              
              
               
                   
              
                
                
                
                    
import { HISTORY_VIA, normalizeEffectiveAt } from './history.mjs'
import { describePlaceholders, findPlaceholders } from './placeholders.mjs'
import { hasLiveHistoryAttestation } from './status.mjs'

export class VaultScopeError extends Error {
  constructor(message        ) {
    super(message)
    this.name = 'VaultScopeError'
  }
}

export class VaultBlankBodyError extends Error {
  constructor(message = 'version body refused: empty, whitespace-only, or invisible-characters-only') {
    super(message)
    this.name = 'VaultBlankBodyError'
  }
}

export class VaultImmutableError extends Error {
  constructor(message        ) {
    super(message)
    this.name = 'VaultImmutableError'
  }
}

export class VaultNotFoundError extends Error {
  constructor(message        ) {
    super(message)
    this.name = 'VaultNotFoundError'
  }
}

/** v5: a human decision presented a hash that is not the stored version's —
    the user approved content that is not what the vault holds. Refused. */
export class VaultApprovalMismatchError extends Error {
  constructor(message        ) {
    super(message)
    this.name = 'VaultApprovalMismatchError'
  }
}

/** M09b: a submitted-history confirmation or a human approval was refused
    because the answer still carries an unfilled placeholder. `markers` =
    placeholders.ts rule ids. */
export class VaultPlaceholderError extends Error {
  markers          
  constructor(markers          , action = 'history attestation') {
    super(`${action} refused: ${describePlaceholders(markers)}`)
    this.name = 'VaultPlaceholderError'
    this.markers = markers
  }
}

/**
 * Canon m04 blank-guard equivalent: remove Unicode format chars (Cf —
 * ZWSP, BOM, word joiners, bidi controls) and all whitespace; refuse when
 * nothing visible remains.
 */
const INVISIBLE_RE = /[\p{Cf}\s]/gu

export function isBlankBody(body        )          {
  return body.replace(INVISIBLE_RE, '').length === 0
}

export async function createAnswer(
  storage              ,
  scope                                                            ,
)                        {
  if (!scope.application_id || !scope.question_occurrence_id) {
    throw new VaultScopeError('answer scope requires application_id and question_occurrence_id')
  }
  const record               = { id: newId(), scope, created_at: nowIso() }
  await storage.put('answers', record)
  return record
}

                                     
                   
                                   
               
              
                       
                            
                          
                       
                                          
                                                                         
                                                                   
                                                                      
                                                                    
                         
 

export async function createVersion(
  storage              ,
  secret        ,
  input                    ,
)                         {
  if (isBlankBody(input.body)) throw new VaultBlankBodyError()

  const answer = await storage.get              ('answers', input.answer_id)
  if (!answer) throw new VaultNotFoundError(`answer not found: ${input.answer_id}`)

  let parent                       = null
  if (input.parent_version_id) {
    parent = (await storage.get               ('versions', input.parent_version_id)) ?? null
    if (!parent) throw new VaultNotFoundError(`parent version not found: ${input.parent_version_id}`)
    if (parent.answer_id !== input.answer_id) {
      throw new VaultScopeError(
        `cross-scope parent refused: parent belongs to answer ${parent.answer_id}, not ${input.answer_id}`,
      )
    }
  }

  const { record, receipt } = await buildVersionPayload(secret, input, parent?.id ?? null)
  await insertVersion(storage, record, receipt)
  return record
}

/** Crypto + record assembly for a version — pure (no store access), so it is
    safe to call OUTSIDE a transaction. Do the puts via insertVersion (or a
    caller-managed tx) — WebCrypto awaits inside an IDB transaction risk
    auto-commit in real browsers. */
export async function buildVersionPayload(
  secret        ,
  input                                                                                                                                                                ,
  parentVersionId                = null,
)                                                                {
  // The canon blank-guard applies to EVERY version writer, not only the
  // createVersion path — a Cf-only body must never become an encrypted
  // version that could be approved + packet-bound.
  if (isBlankBody(input.body)) throw new VaultBlankBodyError()
  const sha256 = await sha256Hex(canonicalJson({ title: input.title, body: input.body }))
  const blob = await encryptText(secret, input.body)
  const titleBlob = await encryptText(secret, input.title)
  const record                = {
    id: newId(),
    answer_id: input.answer_id,
    parent_version_id: parentVersionId,
    title: JSON.stringify(titleBlob),
    title_enc: true,
    derived_from: input.derived_from ?? null,
    body: JSON.stringify(blob),
    sha256,
    method: input.method,
    provenance: input.provenance ?? null,
    created_at: nowIso(),
    immutable: true,
  }
  // v5: evidence ids are metadata outside the content hash; omitted when
  // empty so v4-shaped records stay byte-identical.
  const evidenceIds = [...new Set((input.evidence_ids ?? []).filter((e) => typeof e === 'string' && e))]
  if (evidenceIds.length) record.evidence_ids = evidenceIds
  const receipt                   = {
    version_id: record.id,
    method: input.method,
    provider: input.provider ?? null,
    model: input.model ?? null,
    observed_flags: input.observed_flags ?? {},
  }
  return { record, receipt }
}

/**
 * First draft for a question that has no answer yet: create the answer AND
 * its first version (+ provenance receipt) in ONE transaction, so a refused
 * or failed version write can never leave an empty answer shell behind
 * (M09 AT22). Validation and crypto run before the transaction opens.
 */
export async function createAnswerWithVersion(
  storage              ,
  secret        ,
  scope                                                            ,
  input                                                             ,
)                                                            {
  if (!scope?.application_id || !scope.question_occurrence_id) {
    throw new VaultScopeError('answer scope requires application_id and question_occurrence_id')
  }
  if (isBlankBody(input.body)) throw new VaultBlankBodyError()
  const answer               = { id: newId(), scope, created_at: nowIso() }
  const { record, receipt } = await buildVersionPayload(secret, { ...input, answer_id: answer.id }, null)
  await storage.tx(['answers', 'versions', 'provenance'], async (s) => {
    if (!(await s.putIfAbsent('answers', answer.id, answer))) throw new VaultImmutableError(`answer id collision refused: ${answer.id}`)
    if (!(await s.putIfAbsent('versions', record.id, record))) throw new VaultImmutableError(`version id collision refused: ${record.id}`)
    await s.put('provenance', receipt)
  })
  return { answer, version: record }
}

/** Put a pre-built version record + provenance receipt. Inside a caller tx
    the same puts may be issued directly on the tx-scoped storage. */
async function insertVersion(
  storage              ,
  record               ,
  receipt                  ,
)                {
  await storage.tx(['versions', 'provenance'], async (s) => {
    const inserted = await s.putIfAbsent('versions', record.id, record)
    if (!inserted) throw new VaultImmutableError(`version id collision refused: ${record.id}`)
    await s.put('provenance', receipt)
  })
}

/** Decrypt a stored version. Throws VaultDecryptError on wrong secret. */
export async function decryptVersionTitle(secret        , record               )                  {
  if (!record.title_enc) return record.title // legacy plaintext
  return decryptText(secret, JSON.parse(record.title))
}

export async function readVersion(
  storage              ,
  secret        ,
  versionId        ,
)                                                                  {
  const record = await storage.get               ('versions', versionId)
  if (!record) throw new VaultNotFoundError(`version not found: ${versionId}`)
  const body = await decryptText(secret, JSON.parse(record.body))
  const title = await decryptVersionTitle(secret, record)
  return { record, title, body }
}

/** IR-014 + IR-035 unlock-time migration: encrypts legacy plaintext
    version titles and intake catalog blobs in place. Runs after unlock —
    crypto happens outside write transactions; records stay readable as
    legacy plaintext if a run is interrupted mid-way. */
export async function runVaultPrivacyMigration(
  storage              ,
  secret        ,
)                                                                 {
  const versions = await storage.getAll               ('versions')
  const titleUpdates                  = []
  for (const v of versions) {
    if (v.title_enc) continue
    const blob = await encryptText(secret, v.title)
    titleUpdates.push({ ...v, title: JSON.stringify(blob), title_enc: true })
  }
  if (titleUpdates.length) {
    await storage.tx(['versions'], async (s) => {
      for (const u of titleUpdates) await s.put('versions', u)
    })
  }
  const cats = await storage.getAll                                          ('catalog_cache')
  const catUpdates                                             = []
  for (const c of cats) {
    if (!c.key.startsWith('intake:') || c.blob_enc || c.blob === undefined) continue
    const enc = await encryptText(secret, JSON.stringify(c.blob))
    const { blob: _omit, ...rest } = c
    catUpdates.push({ ...rest, blob_enc: JSON.stringify(enc) })
  }
  if (catUpdates.length) {
    await storage.tx(['catalog_cache'], async (s) => {
      for (const u of catUpdates) await s.put('catalog_cache', u)
    })
  }
  return { titles_migrated: titleUpdates.length, catalog_migrated: catUpdates.length }
}

export async function listVersions(storage              , answerId        )                           {
  const all = await storage.getAll               ('versions')
  return all
    .filter((v) => v.answer_id === answerId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}

/**
 * LF-18 / v5 — allocate the next ledger seq and append one event. MUST be
 * called inside a storage.tx that includes 'events' so the
 * read-max-then-write cannot interleave across tabs.
 */
export async function appendLedgerEvent(
  s              ,
  event                                 ,
)                       {
  const events = await s.getAll             ('events')
  const seq = events.reduce((max, e) => Math.max(max, e.seq), 0) + 1
  const record              = { id: newId(), seq, ...event }
  await s.put('events', record)
  return record
}

/** Shared approvals-ledger writer (inside a tx over approvals + events). */
async function writeApprovalDecision(
  s              ,
  version               ,
  input   
                                     
                           
                           
                    
                                   
                         
                            
   ,
)                          {
  const id = newId()
  const at = nowIso()
  const event = await appendLedgerEvent(s, {
    kind: 'approval_decision',
    entity: 'version',
    entity_id: version.id,
    payload: {
      approval_id: id,
      version_sha256: version.sha256,
      decision: input.decision,
      actor_class: input.actor_class,
      actor_id: input.actor_id,
      via: input.via,
      ...(input.effective_at ? { effective_at: input.effective_at } : {}),
    },
    at,
  })
  const record                 = {
    id,
    version_id: version.id,
    version_sha256: version.sha256,
    decision: input.decision,
    actor_class: input.actor_class,
    at,
    seq: event.seq,
    actor_id: input.actor_id,
    via: input.via,
  }
  if (input.effective_at) record.effective_at = input.effective_at
  if (input.attestation_enc) record.attestation_enc = input.attestation_enc
  await s.put('approvals', record)
  return record
}

/**
 * LF-18 — record an approval decision AND its audit receipt atomically.
 * The `seq` is allocated from the events ledger inside the same
 * transaction (max(existing)+1), so two tabs racing on the same vault get
 * a strict total order instead of a wall-clock tie: IndexedDB serializes
 * readwrite transactions over the same object stores, and the in-memory
 * adapter is single-threaded. A revocation is a NEW decision row + NEW
 * event — never an update of the prior approval.
 */
/** @deprecated v5 — LEGACY primitive kept for pre-v5 callers/tests (rows
    are written with via:'legacy', actor_id:null). New code MUST use
    recordHumanApproval / recordHumanRevocation (hash-bound, human-only)
    for decisions and recordSuggestion for agent recommendations.
    actor_class is caller-asserted, not proven — the packet freeze gate
    (status.ts approvalGate) is the enforcement point: only the LATEST
    decision being a live, hash-bound, human 'approved' satisfies it. */
export async function approveVersion(
  storage              ,
  input                                                                                    ,
)                          {
  const version = await storage.get               ('versions', input.version_id)
  if (!version) throw new VaultNotFoundError(`version not found: ${input.version_id}`)
  return storage.tx(['approvals', 'events'], (s) =>
    writeApprovalDecision(s, version, {
      decision: input.decision,
      actor_class: input.actor_class,
      actor_id: null,
      via: 'legacy',
    }),
  )
}

                                     
                    
                                                                          
                                                                    
                         
                                                                     
                  
                                                             
                                                                   
                                                                          
                                                                         
                                                                      
                                      
                 
 

/** Thrown (before any write) when an approval targets an imported
    submitted-history version that has not been confirmed on the history
    screen (recordHistoryAttestation). */
export class VaultHistoryApprovalError extends VaultScopeError {
  constructor(versionId        ) {
    super(
      `version ${versionId} is an imported submitted-history record: confirm it on the history screen ` +
        '(history attestation) before approving it here',
    )
    this.name = 'VaultHistoryApprovalError'
  }
}

const HUMAN_VIA                                                                        = ['review_ui', 'decision_file']

async function recordHumanDecision(
  storage              ,
  input                    ,
  decision                         ,
)                          {
  if (!input.version_id) throw new VaultNotFoundError('version_id is required')
  if (typeof input.expected_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(input.expected_sha256)) {
    throw new VaultApprovalMismatchError('expected_sha256 must be the 64-hex content hash the human reviewed')
  }
  if (typeof input.actor_id !== 'string' || isBlankBody(input.actor_id)) {
    throw new VaultScopeError('human decision requires actor_id')
  }
  if (!HUMAN_VIA.includes(input.via)) {
    throw new VaultScopeError(`human decision via must be one of ${HUMAN_VIA.join('|')}`)
  }
  const approving = decision === 'approved'
  if (approving && !input.secret) {
    // Same refusal precedence as the in-transaction checks, then fail closed:
    // without the secret the body cannot be scanned for placeholders.
    const stored = await storage.get               ('versions', input.version_id)
    if (!stored) throw new VaultNotFoundError(`version not found: ${input.version_id}`)
    if (stored.sha256 !== input.expected_sha256) {
      throw new VaultApprovalMismatchError(`version ${input.version_id} sha256 does not match the reviewed sha256 — decision refused`)
    }
    throw new VaultScopeError('human approval requires the vault secret: the answer is checked for unfilled placeholders first')
  }
  if (input.secret) {
    const { record, title, body } = await readVersion(storage, input.secret, input.version_id)
    const recomputed = await sha256Hex(canonicalJson({ title, body }))
    if (recomputed !== input.expected_sha256) {
      throw new VaultApprovalMismatchError(
        `version ${input.version_id} plaintext does not hash to the reviewed sha256 — refused`,
      )
    }
    if (approving) {
      if (record.history === true && !hasLiveHistoryAttestation(record, await storage.getAll                ('approvals'))) {
        throw new VaultHistoryApprovalError(input.version_id)
      }
      const markers = findPlaceholders(body)
      if (markers.length) throw new VaultPlaceholderError(markers, 'approval')
    }
  }
  return storage.tx(['versions', 'approvals', 'events'], async (s) => {
    // Re-read INSIDE the write transaction: the hash check and the write
    // are atomic, so a concurrent row swap cannot slip between them.
    const version = await s.get               ('versions', input.version_id)
    if (!version) throw new VaultNotFoundError(`version not found: ${input.version_id}`)
    if (version.sha256 !== input.expected_sha256) {
      throw new VaultApprovalMismatchError(
        `version ${input.version_id} sha256 is ${version.sha256.slice(0, 12)}…, ` +
          `reviewed ${input.expected_sha256.slice(0, 12)}… — decision refused`,
      )
    }
    if (approving && version.history === true && !hasLiveHistoryAttestation(version, await s.getAll                ('approvals'))) {
      throw new VaultHistoryApprovalError(input.version_id)
    }
    return writeApprovalDecision(s, version, {
      decision,
      actor_class: 'human', // hardcoded — this API cannot write an agent row
      actor_id: input.actor_id,
      via: input.via,
    })
  })
}

/**
 * v5 — THE approval API. Re-reads the stored version, refuses on hash
 * mismatch, and writes an `actor_class: 'human'` approval bound to that
 * exact sha256. There is no actor_class parameter: agents recommend via
 * recordSuggestion and can never reach this writer's 'approved' row.
 */
export function recordHumanApproval(
  storage              ,
  input                    ,
)                          {
  return recordHumanDecision(storage, input, 'approved')
}

/** v5 — human revocation / rejection on the approvals ledger (same hash
    binding as recordHumanApproval). */
export function recordHumanRevocation(
  storage              ,
  input                    ,
)                          {
  return recordHumanDecision(storage, input, 'rejected')
}

                                          
                    
                                                                           
                         
                                                                              
                      
                                                             
                   
                                                                       
                  
 

/**
 * M09b — confirm an imported answer as ACTUALLY SUBMITTED (OWNER rule
 * 2026-10-22: submitted answers are approved as of their submission date).
 * Writes a human approval (`actor_class: 'human'`, `via:
 * 'history_attestation'`) bound to the exact version hash, carrying
 * `effective_at` (the submission date) and the user's statement encrypted
 * as `attestation_enc`.
 *
 * Refuses — before anything is written — when:
 *   - the version is not an imported history record (`history: true`);
 *   - the decrypted title+body does not hash to `expected_sha256`, or the
 *     stored row's sha256 differs (checked again inside the write tx);
 *   - the BODY contains an unfilled placeholder (findPlaceholders in
 *     placeholders.ts, the one shared detector, which canonicalizes
 *     Unicode and spacing before matching);
 *     this rule lives here, in the vault write, not only in the UI;
 *   - effective_at is not a real date or is in the future;
 *   - the statement or actor_id is blank.
 * All crypto runs before the write transaction (IndexedDB auto-commit).
 */
export async function recordHistoryAttestation(
  storage              ,
  secret        ,
  input                         ,
)                          {
  if (!input.version_id) throw new VaultNotFoundError('version_id is required')
  if (typeof input.expected_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(input.expected_sha256)) {
    throw new VaultApprovalMismatchError('expected_sha256 must be the 64-hex content hash the user confirmed')
  }
  if (typeof input.actor_id !== 'string' || isBlankBody(input.actor_id)) {
    throw new VaultScopeError('history attestation requires actor_id')
  }
  if (typeof input.statement !== 'string' || isBlankBody(input.statement)) {
    throw new VaultScopeError('history attestation requires the user\'s attestation statement')
  }
  if (input.statement.length > 4000) throw new VaultScopeError('attestation statement is too long (max 4000 characters)')
  const effectiveAt = normalizeEffectiveAt(input.effective_at)
  if (!effectiveAt) {
    throw new VaultScopeError('effective_at must be the submission date (YYYY-MM-DD or ISO date-time) and not in the future')
  }
  const { record, title, body } = await readVersion(storage, secret, input.version_id)
  if (record.history !== true) {
    throw new VaultScopeError(`version ${input.version_id} is not an imported submitted-history record`)
  }
  const recomputed = await sha256Hex(canonicalJson({ title, body }))
  if (recomputed !== input.expected_sha256 || record.sha256 !== input.expected_sha256) {
    throw new VaultApprovalMismatchError(
      `version ${input.version_id} does not hash to the confirmed sha256 — refused`,
    )
  }
  const markers = findPlaceholders(body)
  if (markers.length) throw new VaultPlaceholderError(markers)
  const attestation_enc = await encryptField(secret, input.statement)
  return storage.tx(['versions', 'approvals', 'events'], async (s) => {
    const version = await s.get               ('versions', input.version_id)
    if (!version) throw new VaultNotFoundError(`version not found: ${input.version_id}`)
    if (version.sha256 !== input.expected_sha256 || version.history !== true) {
      throw new VaultApprovalMismatchError(`version ${input.version_id} changed before the attestation was written — refused`)
    }
    return writeApprovalDecision(s, version, {
      decision: 'approved',
      actor_class: 'human',
      actor_id: input.actor_id,
      via: HISTORY_VIA,
      effective_at: effectiveAt,
      attestation_enc,
    })
  })
}

                                    
                           
              
                                                    
                
                        
                            
                          
                       
                                          
                         
 

/**
 * v5 — EDIT. Always a new immutable version on the parent's answer with
 * parent_version_id set. Approvals bind version ids, so nothing carries
 * forward: the child starts unapproved and the parent keeps its decisions.
 */
export async function createChildVersion(
  storage              ,
  secret        ,
  input                   ,
)                         {
  const parent = await storage.get               ('versions', input.parent_version_id)
  if (!parent) throw new VaultNotFoundError(`parent version not found: ${input.parent_version_id}`)
  const title = input.title ?? (await decryptVersionTitle(secret, parent))
  return createVersion(storage, secret, {
    answer_id: parent.answer_id,
    parent_version_id: parent.id,
    title,
    body: input.body,
    method: input.method ?? 'manual',
    provenance: input.provenance ?? null,
    provider: input.provider ?? null,
    model: input.model ?? null,
    observed_flags: input.observed_flags,
    derived_from: null,
    evidence_ids: input.evidence_ids,
  })
}

/**
 * LF-18 authoritative ordering for approval records: `seq` (storage-side
 * total order) when both records carry it; otherwise the legacy (at, id)
 * wall-clock order for pre-LF-18 rows. Mixed pairs also fall back to
 * (at, id) — there is no meaningful way to compare a ledger sequence
 * against a timestamp.
 */
export function compareApprovals(a                , b                )         {
  if (a.seq != null && b.seq != null) return a.seq - b.seq
  // Mixed pairs: seq-bearing rows post-date legacy rows by construction —
  // a legacy approval's wall-clock at can be skewed and must not outrank a
  // seq'd revocation (LF-APPROVAL-01).
  if (a.seq != null) return 1
  if (b.seq != null) return -1
  return a.at.localeCompare(b.at) || a.id.localeCompare(b.id)
}

/** All decisions for one version (or every version), oldest → newest. */
export async function listApprovals(
  storage              ,
  versionId         ,
)                            {
  const all = await storage.getAll                ('approvals')
  return all.filter((a) => !versionId || a.version_id === versionId).sort(compareApprovals)
}

/** Audit ledger, oldest → newest. Optionally filter by event kind. */
export async function listEvents(
  storage              ,
  kind         ,
)                         {
  const all = await storage.getAll             ('events')
  return all.filter((e) => !kind || e.kind === kind).sort((a, b) => a.seq - b.seq)
}

/** Freeze a packet: canonical manifest + digest. Frozen packets are immutable. */
export async function freezePacket(
  storage              ,
  input                                               ,
)                        {
  if (!input.application_id) throw new VaultScopeError('packet requires application_id')
  const manifestJson = canonicalJson(input.manifest)
  const record               = {
    id: newId(),
    application_id: input.application_id,
    manifest_json: manifestJson,
    manifest_sha256: await sha256Hex(manifestJson),
    frozen_at: nowIso(),
  }
  const inserted = await storage.putIfAbsent('packets', record.id, record)
  if (!inserted) throw new VaultImmutableError(`packet id collision refused: ${record.id}`)
  return record
}

/** Sign a frozen packet. One signoff per packet; signature is optional
    (declared sign-off allowed).
    IR-024: a cryptographic signature is verified against the packet's
    stored manifest digest AT THIS BOUNDARY — the primitive itself.
    A signature that fails verification is refused outright; an absent
    signature is a legitimate unsigned acknowledgement.
    NOTE: this primitive awaits WebCrypto and therefore must NOT be called
    inside an IDB transaction (the tx auto-commits mid-call and later writes
    throw TransactionInactiveError). The governed path attestPacket writes
    its signoff inside its own tx with a signature it verified pre-tx. */
export async function signPacket(
  storage              ,
  input   
                     
                                          
                                 
                              
                                                                            
                                                                              
                      
   ,
)                         {
  if (input.user_ack !== true)
    throw new Error('packet sign-off requires explicit user acknowledgement')
  const packet = await storage.get              ('packets', input.packet_id)
  if (!packet) throw new VaultNotFoundError(`packet not found: ${input.packet_id}`)

  let signatureVerified = false
  if (input.signature_b64) {
    if (!input.pubkey_b64)
      throw new Error('signature presented without its verification key')
    const ok = await verifyManifestSignature(
      input.pubkey_b64,
      packet.manifest_sha256,
      input.signature_b64,
    )
    if (!ok)
      throw new Error('signature verification failed — forged or mismatched signature refused')
    signatureVerified = true
  }

  const record                = {
    packet_id: input.packet_id,
    signer_class: input.signer_class,
    timestamp: nowIso(),
    signature_b64: input.signature_b64 ?? null,
    pubkey_b64: input.pubkey_b64 ?? null,
    signature_verified: signatureVerified,
  }
  const inserted = await storage.putIfAbsent('signoffs', record.packet_id, record)
  if (!inserted) throw new VaultImmutableError(`packet already signed: ${input.packet_id}`)
  return record
}
