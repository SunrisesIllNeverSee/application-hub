// VENDORED from aqua-companion/src/vault.mjs. Do not edit: change the source and run
// `npm run vendor:companion` in application-hub-mcp-server/ (CI checks these copies).
// The bridge format: the AQUA browser vault's encrypted backup envelope
// (app/lib/aqua-local/backup.ts, BACKUP_FORMAT_VERSION 2). This is the ONLY
// way data moves between the browser vault and the companion workspace, in
// both directions. Parsing mirrors backup.ts decryptBackupPayload: every
// refusal happens before anything is written.

import { checkHistoryMetaHash } from '../vendor/lib/aqua-local/history.mjs'
import { canonicalJson, decryptField, decryptText, encryptText, sha256Hex, DecryptError } from './crypto.mjs'

export const BACKUP_FORMAT_VERSION = 2
export const ENVELOPE_FORMAT = 'aqua-local-backup'
export const COMPANION_PRODUCER = 'aqua-companion'

export class EnvelopeError extends Error {
  constructor(message) {
    super(message)
    this.name = 'EnvelopeError'
  }
}

/**
 * Vault store -> companion record kind. `key` is the store's key path.
 * `encFields` are `*_enc` fields (ciphertext under the vault secret).
 */
export const STORE_KINDS = [
  { store: 'answers', kind: 'answer', key: 'id' },
  { store: 'versions', kind: 'version', key: 'id' },
  { store: 'approvals', kind: 'approval', key: 'id' },
  { store: 'packets', kind: 'packet', key: 'id' },
  { store: 'provenance', kind: 'provenance', key: 'version_id' },
  { store: 'imports', kind: 'import', key: 'batch_id' },
  { store: 'signoffs', kind: 'signoff', key: 'packet_id' },
  { store: 'packet_states', kind: 'packet_state', key: 'packet_id' },
  { store: 'catalog_cache', kind: 'catalog', key: 'key' },
  { store: 'events', kind: 'event', key: 'id' },
  { store: 'app_instances', kind: 'app_instance', key: 'instance_id' },
  { store: 'facts', kind: 'fact', key: 'fact_version_id' },
  { store: 'evidence', kind: 'evidence', key: 'evidence_id' },
  { store: 'reviews', kind: 'review', key: 'review_id' },
  { store: 'comments', kind: 'comment', key: 'comment_id' },
  { store: 'suggestions', kind: 'suggestion', key: 'suggestion_id' },
]

export function storeOfKind(kind) {
  const k = kind === 'intake' || kind === 'catalog_private' ? 'catalog' : kind
  return STORE_KINDS.find((s) => s.kind === k) ?? null
}

/** Public catalog keys go to plaintext catalog-cache; everything else stays encrypted. */
export function classifyCatalogKey(key, record) {
  if (key.startsWith('intake:') || record?.blob_enc) return { kind: 'intake', bucket: null }
  if (/^(program|programs|opportunity|opportunities)[:/]/i.test(key)) return { kind: 'catalog', bucket: 'programs' }
  if (/^(question|questions)[:/]/i.test(key)) return { kind: 'catalog', bucket: 'questions' }
  return { kind: 'catalog_private', bucket: null }
}

function requireList(store, list, keyField, extra = [], stringOnly = []) {
  if (list === undefined || list === null) return
  if (!Array.isArray(list)) throw new EnvelopeError(`backup ${store} is not an array`)
  for (const [i, rec] of list.entries()) {
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) throw new EnvelopeError(`backup ${store}[${i}] is not an object`)
    for (const f of [keyField, ...extra]) {
      if (typeof rec[f] !== 'string' || rec[f].length === 0) {
        throw new EnvelopeError(`backup ${store}[${i}] missing/invalid field: ${f}`)
      }
    }
    for (const f of stringOnly) {
      if (rec[f] !== undefined && typeof rec[f] !== 'string') {
        throw new EnvelopeError(`backup ${store}[${i}] field must be a string: ${f}`)
      }
    }
  }
}

export function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') throw new EnvelopeError('backup payload is not an object')
  if (typeof payload.format_version !== 'number' || payload.format_version > BACKUP_FORMAT_VERSION) {
    throw new EnvelopeError(`backup format_version ${payload.format_version} is newer than supported ${BACKUP_FORMAT_VERSION}`)
  }
  if (payload.format_version < 1) throw new EnvelopeError(`backup format_version ${payload.format_version} unsupported`)
  requireList('answers', payload.answers, 'id')
  requireList('versions', payload.versions, 'id', ['answer_id', 'sha256', 'body_plaintext'], ['title', 'title_plaintext', 'history_enc'])
  requireList('approvals', payload.approvals, 'id', ['version_id'], ['via', 'effective_at', 'attestation_enc'])
  requireList('packets', payload.packets, 'id')
  requireList('provenance', payload.provenance, 'version_id')
  requireList('imports', payload.imports, 'batch_id')
  requireList('signoffs', payload.signoffs, 'packet_id')
  requireList('packet_states', payload.packet_states, 'packet_id')
  requireList('catalog_cache', payload.catalog_cache, 'key')
  requireList('events', payload.events, 'id')
  requireList('app_instances', payload.app_instances, 'instance_id', ['application_id'], ['local_template_enc'])
  requireList('facts', payload.facts, 'fact_version_id', ['fact_id', 'kind', 'key', 'value_enc'])
  requireList('evidence', payload.evidence, 'evidence_id', ['kind', 'title_enc', 'content_sha256'], ['excerpt_enc', 'url_enc'])
  requireList('reviews', payload.reviews, 'review_id', ['version_id', 'version_sha256', 'decision', 'actor_class'], ['rationale_enc'])
  requireList('comments', payload.comments, 'comment_id', ['version_id', 'version_sha256', 'thread_id', 'body_enc'])
  requireList('suggestions', payload.suggestions, 'suggestion_id', ['question_occurrence_id', 'kind', 'explanation_enc'], ['weaknesses_enc', 'unsupported_claims_enc'])
}

export async function verifyVersionHashes(payload) {
  for (const v of payload.versions ?? []) {
    const title = v.title_plaintext ?? v.title
    if (typeof title !== 'string') throw new EnvelopeError(`version ${v.id} has no title field`)
    const digest = await sha256Hex(canonicalJson({ title, body: v.body_plaintext }))
    if (digest !== v.sha256) throw new EnvelopeError(`version ${v.id} sha256 mismatch: refusing tampered backup`)
  }
}

/**
 * G18: a history version whose metadata carries a hash must still match it
 * (metadata + version id + content sha256). Unhashed (legacy) metadata passes.
 */
export async function verifyHistoryMetaHashes(payload, secret) {
  for (const v of payload.versions ?? []) {
    if (!v.history_enc) continue
    let meta
    try {
      meta = JSON.parse(await decryptField(secret, v.history_enc))
    } catch {
      throw new EnvelopeError(`version ${v.id} history metadata could not be read: refusing tampered backup`)
    }
    if ((await checkHistoryMetaHash(meta, { version_id: v.id, version_sha256: v.sha256 })) === 'mismatch') {
      throw new EnvelopeError(`version ${v.id} history metadata hash mismatch: refusing tampered backup`)
    }
  }
}

/**
 * Parse + decrypt + validate a vault envelope. Returns
 * { payload, header, envelope_sha256 }. `header` holds non-secret outer
 * fields (producer, account_fp) when present.
 */
export async function openEnvelope(secret, text) {
  let envelope
  try {
    envelope = JSON.parse(text)
  } catch {
    throw new EnvelopeError('backup is not valid JSON')
  }
  if (!envelope || envelope.format !== ENVELOPE_FORMAT) throw new EnvelopeError('not an aqua-local backup envelope')
  let payload
  try {
    payload = JSON.parse(await decryptText(secret, envelope))
  } catch (e) {
    if (e instanceof DecryptError) throw new DecryptError('could not decrypt the backup: wrong vault secret or tampered file')
    throw new EnvelopeError('backup payload failed to decrypt/parse')
  }
  validatePayload(payload)
  await verifyVersionHashes(payload)
  await verifyHistoryMetaHashes(payload, secret)
  const header = {
    producer: typeof envelope.producer === 'string' ? envelope.producer : null,
    account_fp: typeof envelope.account_fp === 'string' && /^[0-9a-f]{64}$/.test(envelope.account_fp) ? envelope.account_fp : null,
  }
  return { payload, header, envelope_sha256: await sha256Hex(text) }
}

/** Iterate every record of a payload as { kind, store, key, record, bucket }. */
export function* payloadRecords(payload) {
  for (const spec of STORE_KINDS) {
    for (const record of payload[spec.store] ?? []) {
      const key = record[spec.key]
      if (spec.store === 'catalog_cache') {
        const c = classifyCatalogKey(key, record)
        yield { kind: c.kind, store: spec.store, key, record, bucket: c.bucket }
      } else {
        yield { kind: spec.kind, store: spec.store, key, record, bucket: null }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Staging records: the workspace keeps them in a normalized plaintext form
// (inside workspace encryption). These helpers convert between that form and
// the vault form the browser's importVault expects.
// ---------------------------------------------------------------------------

/** Kinds the companion may stage and export. Decisions are never exportable. */
export const EXPORTABLE_KINDS = ['answer', 'version', 'app_instance', 'evidence', 'comment']

/** Vault form -> normalized form (decrypts *_enc fields with the vault secret). */
export async function normalizeVaultRecord(kind, rec, secret) {
  switch (kind) {
    case 'version': {
      const { title_plaintext, body_plaintext, title: legacyTitle, history_enc, ...rest } = rec
      const out = { ...rest, title: title_plaintext ?? legacyTitle, body: body_plaintext }
      // M09b: submitted-history metadata travels encrypted (history_enc); the workspace keeps it as history_meta
      if (history_enc) out.history_meta = JSON.parse(await decryptField(secret, history_enc))
      return out
    }
    case 'app_instance': {
      const { local_template_enc, source, ...rest } = rec
      const out = { ...rest, source: { kind: source?.kind } }
      if (source?.ref_enc) out.source.ref = await decryptField(secret, source.ref_enc)
      if (local_template_enc) out.local_template = JSON.parse(await decryptField(secret, local_template_enc))
      return out
    }
    case 'evidence': {
      const { title_enc, excerpt_enc, url_enc, ...rest } = rec
      const out = { ...rest, title: await decryptField(secret, title_enc) }
      if (excerpt_enc) out.excerpt = await decryptField(secret, excerpt_enc)
      if (url_enc) out.url = await decryptField(secret, url_enc)
      return out
    }
    case 'comment': {
      const { body_enc, ...rest } = rec
      return { ...rest, body: await decryptField(secret, body_enc) }
    }
    default:
      return rec
  }
}

/**
 * Normalized form -> vault form. `encField(plaintext)` returns a serialized
 * blob under the vault secret (see crypto.mjs fieldEncrypter).
 */
export async function toVaultRecord(kind, rec, encField) {
  switch (kind) {
    case 'answer':
      return { id: rec.id, scope: rec.scope, created_at: rec.created_at }
    case 'version': {
      const { title, body, history_meta, ...rest } = rec
      const out = { ...rest, title_plaintext: title, body_plaintext: body }
      if (history_meta) out.history_enc = await encField(JSON.stringify(history_meta))
      return out
    }
    case 'app_instance': {
      const { local_template, source, ...rest } = rec
      const out = { ...rest, source: { kind: source.kind } }
      if (source.ref) out.source.ref_enc = await encField(source.ref)
      if (local_template) out.local_template_enc = await encField(JSON.stringify(local_template))
      return out
    }
    case 'evidence': {
      const { title, excerpt, url, ...rest } = rec
      const out = { ...rest, title_enc: await encField(title) }
      if (excerpt) out.excerpt_enc = await encField(excerpt)
      if (url) out.url_enc = await encField(url)
      return out
    }
    case 'comment': {
      // M09 hardening M3: every comment the companion exports was staged
      // outside the browser review UI (CLI or agent), so it is exported as
      // actor_class 'agent' / via 'companion' — never as the user's own
      // ('human') comment — whatever an older staging record says.
      const { body, actor_class: _ac, actor_id, via: _via, ...rest } = rec
      return {
        ...rest,
        actor_class: 'agent',
        actor_id: !actor_id || actor_id === 'local-user' ? 'aqua-companion' : actor_id,
        via: 'companion',
        body_enc: await encField(body),
      }
    }
    default:
      throw new EnvelopeError(`kind ${kind} is not exportable`)
  }
}

/** Decrypt every *_enc field in a projection for display (show --reveal / plaintext export). */
export async function revealVaultRecord(kind, rec, secret) {
  if (['version', 'app_instance', 'evidence', 'comment'].includes(kind)) return normalizeVaultRecord(kind, rec, secret)
  const out = {}
  for (const [k, v] of Object.entries(rec)) {
    if (k.endsWith('_enc') && typeof v === 'string') {
      const name = k.slice(0, -4)
      try {
        const plain = await decryptField(secret, v)
        out[name] = name === 'blob' ? JSON.parse(plain) : plain
      } catch {
        out[name] = '[could not decrypt with this vault secret]'
      }
    } else out[k] = v
  }
  return out
}

/** Build a v2 envelope string the browser Restore panel accepts. */
export async function buildEnvelope(secret, payload, header = {}) {
  validatePayload(payload)
  await verifyVersionHashes(payload)
  const blob = await encryptText(secret, canonicalJson(payload))
  const env = { format: ENVELOPE_FORMAT, ...blob, producer: COMPANION_PRODUCER }
  if (header.account_fp) env.account_fp = header.account_fp
  return JSON.stringify(env, null, 2)
}
