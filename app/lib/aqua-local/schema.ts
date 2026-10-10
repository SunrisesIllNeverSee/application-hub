// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// LF-05 — aqua-local schema. Typed store definitions for the local-first vault.
// Authority boundary: LF-Architecture-Contract.md — answer bodies, versions,
// packets, provenance, and signoffs live ONLY here. Never egress.

export const DB_NAME = 'aqua-local'
export const DB_VERSION = 1

export const STORE_NAMES = [
  'answers',
  'versions',
  'approvals',
  'packets',
  'provenance',
  'catalog_cache',
  'imports',
  'signoffs',
] as const

export type StoreName = (typeof STORE_NAMES)[number]

/** Versioned methods for how a version body was produced. */
export type VersionMethod = 'manual' | 'byok' | 'app_provider' | 'imported'

export type ActorClass = 'human' | 'agent'

export interface AnswerRecord {
  id: string
  scope: {
    application_id: string
    question_occurrence_id: string
  }
  created_at: string // ISO-8601
}

/**
 * Version bodies are stored ENCRYPTED (serialized EncryptedBlob from
 * crypto.ts). `sha256` is the digest of the canonical plaintext content so
 * integrity can be verified without decrypting.
 * Versions are immutable: an edit is a new child version, never an update.
 */
export interface VersionRecord {
  id: string
  answer_id: string
  parent_version_id: string | null
  title: string
  body: string // serialized EncryptedBlob
  sha256: string // sha256 of canonicalJson({ title, body_plaintext })
  method: VersionMethod
  provenance: string | null // free-form provenance note; see `provenance` store for structured receipt
  created_at: string
  immutable: true
}

export interface ApprovalRecord {
  id: string
  version_id: string
  decision: 'approved' | 'rejected'
  actor_class: ActorClass
  at: string
}

export interface PacketRecord {
  id: string
  application_id: string
  manifest_json: string // canonical JSON manifest
  manifest_sha256: string
  frozen_at: string
}

/** Structured generation provenance receipt (LF contract §5). */
export interface ProvenanceRecord {
  version_id: string // primary key — one receipt per version
  method: VersionMethod
  provider: string | null
  model: string | null
  observed_flags: Record<string, boolean>
}

export interface CatalogCacheRecord {
  key: string
  blob: unknown
  fetched_at: string
}

export interface ImportRecord {
  batch_id: string
  source_ids: string[]
  counts: Record<string, number>
  at: string
}

export interface SignoffRecord {
  packet_id: string // primary key — one signoff per packet
  signer_class: ActorClass
  timestamp: string
  signature_b64: string | null
}

export interface StoreSpec {
  name: StoreName
  keyPath: string
  /** Non-unique secondary indexes. */
  indexes: Array<{ name: string; keyPath: string }>
}

export const STORE_SPECS: StoreSpec[] = [
  {
    name: 'answers',
    keyPath: 'id',
    indexes: [
      { name: 'by_scope', keyPath: 'scope.question_occurrence_id' },
      { name: 'by_application', keyPath: 'scope.application_id' },
    ],
  },
  {
    name: 'versions',
    keyPath: 'id',
    indexes: [
      { name: 'by_answer', keyPath: 'answer_id' },
      { name: 'by_parent', keyPath: 'parent_version_id' },
      { name: 'by_sha256', keyPath: 'sha256' },
    ],
  },
  {
    name: 'approvals',
    keyPath: 'id',
    indexes: [{ name: 'by_version', keyPath: 'version_id' }],
  },
  {
    name: 'packets',
    keyPath: 'id',
    indexes: [{ name: 'by_application', keyPath: 'application_id' }],
  },
  { name: 'provenance', keyPath: 'version_id', indexes: [] },
  { name: 'catalog_cache', keyPath: 'key', indexes: [] },
  { name: 'imports', keyPath: 'batch_id', indexes: [] },
  { name: 'signoffs', keyPath: 'packet_id', indexes: [] },
]

/**
 * Versioned, idempotent migration steps. MIGRATIONS[i] upgrades schema
 * version (i+1) → (i+2). Every step must be safe to reason about when the
 * store already exists (vault.ts guards with contains() checks, so partial
 * prior upgrades are tolerated).
 */
export const MIGRATIONS: Array<(db: IDBDatabase) => void> = [
  // v0 → v1: create all stores
  (db) => {
    for (const spec of STORE_SPECS) {
      if (db.objectStoreNames.contains(spec.name)) continue
      const store = db.createObjectStore(spec.name, { keyPath: spec.keyPath })
      for (const idx of spec.indexes) {
        store.createIndex(idx.name, idx.keyPath, { unique: false })
      }
    }
  },
]
