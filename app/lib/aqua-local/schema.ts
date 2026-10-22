// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// LF-05 — aqua-local schema. Typed store definitions for the local-first vault.
// Authority boundary: LF-Architecture-Contract.md — answer bodies, versions,
// packets, provenance, and signoffs live ONLY here. Never egress.

export const DB_NAME = 'aqua-local'
export const DB_VERSION = 5

export const STORE_NAMES = [
  'answers',
  'versions',
  'approvals',
  'packets',
  'provenance',
  'catalog_cache',
  'imports',
  'signoffs',
  'provider_keys',
  'provider_consents',
  'packet_states',
  'submissions',
  'events',
  // v5 (M09 W4) — private application workspace + evidence-based review
  'app_instances',
  'facts',
  'evidence',
  'reviews',
  'comments',
  'suggestions',
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
  /** IR-014: title is encrypted at rest — it is free-text user input that
      can carry real private content, not harmless metadata. When
      `title_enc` is set the field holds serialized EncryptedBlob (same
      shape as `body`); legacy records without the flag keep plaintext
      until the unlock-time migration rewrites them. */
  title: string
  title_enc?: true
  /** IR-026: provenance link to the source version this body was derived
      from — set when text drafted/reused from ANOTHER scope becomes a new
      answer's root version. Separate from parent_version_id (same-answer
      lineage) — never implies approval transfer. */
  /** Cross-scope (or same-scope) provenance: the draft this version STARTED
      FROM — the bank answer it was picked/derived from. Means "started
      from", not "still resembles" — the editor may diverge the body freely;
      the link records the seed, never a content claim. parent_version_id
      stays strict same-answer lineage; this field carries the cross-scope
      trace (IR-026). */
  derived_from?: { version_id: string; version_sha256: string } | null
  /** v5: evidence records cited when this version was written. Metadata
      only — NOT part of the content hash (sha256 covers title + body), so
      citing evidence never changes what an approval binds. Later links are
      recorded on the evidence record itself (versions are immutable). */
  evidence_ids?: string[]
  /** M09b: set on answers imported as SUBMITTED history (aqua-companion
      import-history). Metadata only — not part of the content hash. */
  history?: true
  /** M09b: serialized EncryptedBlob of a history.ts HistoryMeta (program,
      exact question, submission date, source hash, placeholder scan). */
  history_enc?: string
  body: string // serialized EncryptedBlob
  sha256: string // sha256 of canonicalJson({ title_plaintext, body_plaintext })
  method: VersionMethod
  provenance: string | null // free-form provenance note; see `provenance` store for structured receipt
  created_at: string
  immutable: true
}

export interface ApprovalRecord {
  id: string
  version_id: string
  version_sha256: string // approval binds the exact content hash (F-V1)
  decision: 'approved' | 'rejected'
  actor_class: ActorClass
  at: string
  /**
   * LF-18 — storage-side monotonic sequence mirrored from the `events`
   * ledger entry written in the same transaction. This is the authoritative
   * order for "latest decision": wall-clock `at` can collide across tabs
   * (ms granularity, independent clocks). Absent on pre-LF-18 rows; those
   * order by (at, id) as before.
   */
  seq?: number
  /**
   * IR-003: set by backup import — the decision came from a file, not this
   * session's user. Freeze treats restored approvals as absent; the version
   * needs a fresh local decision before a packet can select it.
   */
  restored_from_backup?: boolean
  /** v5: who decided. Present on every v5 write (recordHumanApproval /
      legacy approveVersion); absent on v4 rows, which stay readable. */
  actor_id?: string | null
  /** v5: the surface the decision came through. `legacy` = the pre-v5
      approveVersion primitive. Absent on v4 rows. */
  via?: ApprovalVia
  /** M09b: `via: 'history_attestation'` only — the date the user says the
      answer was SUBMITTED (YYYY-MM-DD or ISO date-time). The approval counts
      as of this date; `at` stays the time the user confirmed it. */
  effective_at?: string
  /** M09b: `via: 'history_attestation'` only — the user's attestation
      statement, serialized EncryptedBlob under the vault secret. */
  attestation_enc?: string
}

/** `history_attestation` (M09b): the user confirmed an imported answer as
    actually submitted (repo.ts recordHistoryAttestation). */
export type ApprovalVia = 'review_ui' | 'decision_file' | 'history_attestation' | 'legacy'

/**
 * LF-18 — append-only audit event ledger. Every governed mutation that
 * needs a receipt appends exactly one event; `seq` is assigned inside the
 * same transaction as the mutation by taking max(existing seq)+1, so two
 * tabs cannot interleave the read-modify-write (IndexedDB serializes
 * readwrite transactions over the same stores). The ledger is never
 * updated or deleted — a revocation is a NEW event, not an edit.
 */
export interface EventRecord {
  id: string
  seq: number // authoritative total order, starts at 1
  kind: string // e.g. 'approval_decision'
  entity: string // e.g. 'version'
  entity_id: string
  payload: Record<string, unknown>
  at: string
}

export interface PacketRecord {
  id: string
  application_id: string
  /**
   * Serialized EncryptedBlob of the canonical JSON manifest — the manifest
   * embeds plaintext answer bodies/titles/skip reasons, so it is ciphertext
   * at rest like version bodies (IR-002). `manifest_json` exists only on
   * pre-encryption legacy records; readers fall back to it.
   */
  manifest_enc?: string
  manifest_json?: string // legacy plaintext manifests (pre-IR-002)
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
  /** Plaintext blob — used for PUBLIC catalog data. For `intake:` keys the
      extracted private text (question text, entity name, titles, URLs) is
      stored in `blob_enc` instead (IR-035). */
  blob?: unknown
  /** Serialized EncryptedBlob of JSON.stringify(blob) — private intake
      records only; requires the vault secret to read. */
  blob_enc?: string
  fetched_at: string
}

export interface ImportRecord {
  batch_id: string
  source_ids: string[]
  counts: Record<string, number>
  at: string
}

/**
 * LF-21 signer identity class. `authenticated-account` = backed by a real
 * signed-in account identity; `local-only` = a vault-local signer with no
 * external identity attestation. ActorClass values remain accepted for
 * pre-LF-21 callers.
 */
export type SignerClass = 'authenticated-account' | 'local-only'

export interface SignoffRecord {
  packet_id: string // primary key — one signoff per packet
  signer_class: ActorClass | SignerClass
  timestamp: string
  signature_b64: string | null
  /** Base64 SPKI public key that produced signature_b64 (ECDSA P-256). Null when unsigned. */
  pubkey_b64?: string | null
  /** IR-024: whether signature_b64 verified against the packet manifest
      digest at write time (pre-flag records carry undefined). */
  signature_verified?: boolean
  /**
   * IR-003: set by backup import — a restored signoff is a claim carried by
   * the file, not a fresh attestation. attestPacket may overwrite it with a
   * real sign-off.
   */
  restored_from_backup?: boolean
}

/**
 * LF-16 — BYOK key material. The API key is stored ONLY in the local vault
 * (encrypted like version bodies). It is never sent to the application
 * server; the only egress is the provider call itself.
 */
export interface ProviderKeyRecord {
  provider_id: string // primary key
  key_blob: string // serialized EncryptedBlob
  stored_at: string
  /** Optional provider endpoint override (e.g. Ollama base URL). */
  base_url?: string
  /** Optional model preference for generation calls. */
  model_preference?: string
  /** Last successful connectivity probe timestamp (ISO-8601). */
  last_tested_at?: string
}

/** LF-16 — one consent receipt per generation call. Written before egress. */
export interface ProviderConsentRecord {
  id: string // primary key
  provider_id: string
  adapter_id: string
  purpose: 'generation'
  granted_by: 'user' // consent is only ever user-granted
  request_sha256: string // sha256 of canonical request that consent covered
  /** IR-006: the exact egress URL the adapter declared — the consent record
      names the host the key+prompt actually went to, not just the provider. */
  endpoint?: string
  at: string
}

/**
 * LF-23 — packet lifecycle state. `submitted_external_observed` is reachable
 * ONLY through `recordExternalSubmission` — a user-attested record that the
 * exported packet was submitted through a real external channel (portal,
 * email). AQUA never transmits; the user attests after the fact.
 */
export type PacketState =
  | 'prepared'
  | 'signed'
  | 'exported'
  | 'discarded' // user closed without exporting — honest terminal state
  | 'submitted_external_observed'

export const PACKET_STATES: readonly PacketState[] = [
  'prepared',
  'signed',
  'exported',
  'submitted_external_observed',
]

export interface PacketStateRecord {
  packet_id: string // primary key
  state: PacketState
  history: Array<{ state: PacketState; at: string }>
  updated_at: string
}

export const SUBMISSION_METHODS = [
  'portal',
  'email',
  'post',
  'in-person',
  'other',
] as const
export type SubmissionMethod = (typeof SUBMISSION_METHODS)[number]

export const SUBMISSION_OUTCOMES = [
  'pending',
  'interview',
  'accepted',
  'rejected',
  'withdrawn',
] as const
export type SubmissionOutcome = (typeof SUBMISSION_OUTCOMES)[number]

/**
 * User-attested external submission record — metadata class (no answer
 * bodies; portal_url/confirmation_ref are user-typed identifiers like
 * version titles). Written only by recordExternalSubmission, which also
 * performs the packet_states transition.
 */
export interface SubmissionRecord {
  id: string // primary key
  packet_id: string
  submitted_at: string // user-provided timestamp of the external submission
  method: SubmissionMethod
  portal_url: string | null
  confirmation_ref: string | null
  outcome: SubmissionOutcome
  outcome_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// v5 (M09 W4) — private application workspace + evidence-based review.
// Encryption rule: EVERY free-text field is stored as `*_enc` (serialized
// EncryptedBlob under the vault secret). Plaintext fields are ids, enums,
// hashes, timestamps, and identifier-shaped keys only.
// ---------------------------------------------------------------------------

export type AppInstanceSourceKind = 'catalog' | 'url' | 'paste' | 'file' | 'existing'

/** One question as it appears in THIS application instance. */
export interface InstanceQuestionRef {
  /** Public `program_questions.id`, or a local `LQ-` id for local-only apps. */
  question_occurrence_id: string
  /** Normalized/canonical question id (public `archived_questions.id`) when matched. */
  canonical_question_id?: string | null
  order: number
}

/**
 * Decrypted shape of `AppInstanceRecord.local_template_enc` — the full
 * application template for apps that exist only locally (exact question
 * wording, limits, required flags, sections). Never stored in plaintext.
 */
export interface LocalAppTemplate {
  title: string
  org: string
  cycle_year?: number | null
  deadline?: string | null
  sections?: Array<{ section_id: string; title: string }>
  questions: Array<{
    question_occurrence_id: string // LQ- id (assigned when absent)
    canonical_question_id?: string | null
    text: string // exact wording
    word_limit?: number | null
    char_limit?: number | null
    required: boolean
    section_id?: string | null
    order: number
    /** M09 W6: exact wording as originally extracted, kept when the user
        recorded a correction (`text` then holds the corrected wording). */
    original_text?: string | null
  }>
  /** M09 W6: corrections recorded during extraction review (Step B). The
      originals stay alongside — nothing is silently rewritten. */
  corrections?: LocalTemplateCorrection[]
  /** M09 W6: how the template arrived (method, source hash, reuse signal). */
  import_meta?: LocalTemplateImportMeta | null
}

export interface LocalTemplateCorrection {
  /** Index of the question in the reviewed extraction (null = template-level). */
  question_index: number | null
  field: string
  from: string | number | boolean | null
  to: string | number | boolean | null
  at: string
}

export interface LocalTemplateImportMeta {
  method: 'url_fetch' | 'paste' | 'file'
  content_sha256?: string | null
  reuse?: 'allowed' | 'unknown' | 'disallowed' | null
  file_format?: string | null
  extracted_at: string
  question_count_extracted: number
  /** Catalog program the user linked this import to (kept inside the
      encrypted template; the instance itself stays local-only so a program
      keeps exactly one catalog-backed instance). */
  linked_program_id?: string | null
  linked_cycle_id?: string | null
}

/**
 * A private working instance of one application. Catalog-backed instances
 * reference the public template by id (program_id / ap_serial / cycle_id /
 * template_revision_sha) and do not duplicate public catalog text;
 * local-only instances (`LA-` ids) carry their template encrypted.
 */
export interface AppInstanceRecord {
  instance_id: string // 'AI-…' (catalog-backed) | 'LA-…' (local-only)
  /** Answer scope key: answers for this instance bind
      `scope.application_id === application_id`. Defaults to instance_id. */
  application_id: string
  program_id?: string | null
  ap_serial?: string | null
  cycle_id?: string | null
  template_revision_sha?: string | null
  local_template_enc?: string
  question_refs: InstanceQuestionRef[]
  source: {
    kind: AppInstanceSourceKind
    /** URL / file name / catalog ref — free text, so encrypted. */
    ref_enc?: string
  }
  created_at: string
}

export type FactKind = 'personal' | 'organization' | 'project'

/**
 * Immutable fact version. An update is a NEW row whose `supersedes` names
 * the previous fact_version_id; a deletion is a `retracted` tombstone row.
 * `key` is identifier-shaped (enforced: /^[a-z0-9][a-z0-9_.:-]{0,63}$/) —
 * never free text — so it may stay plaintext for lookup.
 */
export interface FactRecord {
  fact_version_id: string // primary key
  fact_id: string
  kind: FactKind
  key: string
  value_enc: string
  supersedes?: string | null
  evidence_ids: string[]
  created_at: string
  method: VersionMethod
  retracted?: true
}

export type EvidenceKind = 'document' | 'url' | 'passage' | 'note'
export type EvidenceVerification = 'unverified' | 'user_confirmed' | 'source_checked'
export type EvidenceTargetKind = 'version' | 'fact' | 'claim'

/**
 * Evidence is supporting material — NOT an approval and NOT a
 * recommendation. `links` and `verification` are mutable metadata (evidence
 * can be linked to more targets or re-checked over time); title/excerpt/url
 * are encrypted.
 */
export interface EvidenceRecord {
  evidence_id: string
  kind: EvidenceKind
  title_enc: string
  excerpt_enc?: string
  /** User-provided URLs can carry private tokens/paths — encrypted. */
  url_enc?: string
  content_sha256: string
  captured_at: string
  verification: EvidenceVerification
  freshness_checked_at?: string | null
  links: Array<{ target_kind: EvidenceTargetKind; target_id: string }>
}

export const REVIEW_DECISIONS = [
  'under_review',
  'needs_evidence',
  'needs_revision',
  'rejected',
  'superseded',
  'evidence_requested',
  'help_requested',
] as const
/** Review decisions are NOT approvals — 'approved' is deliberately absent. */
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number]

/** Append-only review decision, hash-bound to the exact version reviewed. */
export interface ReviewRecord {
  review_id: string
  answer_id: string
  version_id: string
  version_sha256: string
  decision: ReviewDecision
  rationale_enc?: string
  actor_class: ActorClass
  actor_id: string
  at: string
  seq?: number // events-ledger seq; stripped on backup restore
  restored_from_backup?: boolean
}

/**
 * M09 hardening: the surface a comment arrived through. Absent = written in
 * this browser (review UI). 'decision_file' = imported from an offline
 * review decision file (shown as imported); 'companion' = staged by the
 * aqua-companion CLI / agent and imported (shown as "from companion — review").
 */
export type CommentVia = 'review_ui' | 'decision_file' | 'companion'
export const COMMENT_VIAS: readonly CommentVia[] = ['review_ui', 'decision_file', 'companion']

/** Discussion attached to an exact version (and its hash). */
export interface CommentRecord {
  comment_id: string
  answer_id: string
  version_id: string
  version_sha256: string
  thread_id: string
  parent_comment_id?: string | null
  body_enc: string
  actor_class: ActorClass
  actor_id: string
  at: string
  seq: number
  via?: CommentVia
}

export type SuggestionKind = 'reuse' | 'draft' | 'recommendation' | 'evidence_gap'
export type ReuseClassificationKind = 'direct' | 'adapt' | 'gap'

/**
 * Agent/system recommendation — distinct from evidence and from approvals.
 * Writing a suggestion NEVER writes an approval or a review decision.
 */
export interface SuggestionRecord {
  suggestion_id: string
  instance_id?: string | null
  question_occurrence_id: string
  kind: SuggestionKind
  classification?: ReuseClassificationKind | null
  candidate_version_id?: string | null
  /** Hash of the candidate version at suggestion time. */
  candidate_version_sha256?: string | null
  /** Machine reason codes (e.g. 'over_word_limit') — no free text. */
  reason_codes?: string[]
  explanation_enc: string
  weaknesses_enc?: string
  unsupported_claims_enc?: string
  evidence_ids: string[]
  provider?: string | null
  model?: string | null
  created_at: string
  restored_from_backup?: boolean
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
  { name: 'provider_keys', keyPath: 'provider_id', indexes: [] },
  {
    name: 'provider_consents',
    keyPath: 'id',
    indexes: [{ name: 'by_provider', keyPath: 'provider_id' }],
  },
  { name: 'packet_states', keyPath: 'packet_id', indexes: [] },
  {
    name: 'submissions',
    keyPath: 'id',
    indexes: [{ name: 'by_packet', keyPath: 'packet_id' }],
  },
  {
    name: 'events',
    keyPath: 'id',
    indexes: [
      { name: 'by_seq', keyPath: 'seq' },
      { name: 'by_entity', keyPath: 'entity_id' },
    ],
  },
  // --- v5 ---
  { name: 'app_instances', keyPath: 'instance_id', indexes: [{ name: 'by_program', keyPath: 'program_id' }] },
  {
    name: 'facts',
    keyPath: 'fact_version_id',
    indexes: [
      { name: 'by_fact', keyPath: 'fact_id' },
      { name: 'by_key', keyPath: 'key' },
    ],
  },
  { name: 'evidence', keyPath: 'evidence_id', indexes: [] },
  {
    name: 'reviews',
    keyPath: 'review_id',
    indexes: [
      { name: 'by_version', keyPath: 'version_id' },
      { name: 'by_answer', keyPath: 'answer_id' },
    ],
  },
  {
    name: 'comments',
    keyPath: 'comment_id',
    indexes: [
      { name: 'by_version', keyPath: 'version_id' },
      { name: 'by_thread', keyPath: 'thread_id' },
    ],
  },
  {
    name: 'suggestions',
    keyPath: 'suggestion_id',
    indexes: [
      { name: 'by_occurrence', keyPath: 'question_occurrence_id' },
      { name: 'by_candidate', keyPath: 'candidate_version_id' },
    ],
  },
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
  // v1 → v2: LF-16/LF-23 stores (idempotent — guarded like v1)
  (db) => {
    for (const spec of STORE_SPECS) {
      if (db.objectStoreNames.contains(spec.name)) continue
      const store = db.createObjectStore(spec.name, { keyPath: spec.keyPath })
      for (const idx of spec.indexes) {
        store.createIndex(idx.name, idx.keyPath, { unique: false })
      }
    }
  },
  // v2 → v3: LF-18 events ledger (idempotent — guarded like v1)
  (db) => {
    for (const spec of STORE_SPECS) {
      if (db.objectStoreNames.contains(spec.name)) continue
      const store = db.createObjectStore(spec.name, { keyPath: spec.keyPath })
      for (const idx of spec.indexes) {
        store.createIndex(idx.name, idx.keyPath, { unique: false })
      }
    }
  },
  // v3 → v4: submissions ledger (idempotent — guarded like v1)
  (db) => {
    for (const spec of STORE_SPECS) {
      if (db.objectStoreNames.contains(spec.name)) continue
      const store = db.createObjectStore(spec.name, { keyPath: spec.keyPath })
      for (const idx of spec.indexes) {
        store.createIndex(idx.name, idx.keyPath, { unique: false })
      }
    }
  },
  // v4 → v5 (M09 W4): app_instances, facts, evidence, reviews, comments,
  // suggestions. ADDITIVE ONLY — creates missing stores, never touches an
  // existing store or its rows (v4 versions/approvals stay byte-identical;
  // the new optional fields are simply absent on them).
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
