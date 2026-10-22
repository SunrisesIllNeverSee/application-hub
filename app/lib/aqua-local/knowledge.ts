// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// v5 (M09 W4) — private knowledge: versioned facts (personal / organization /
// project) and evidence records. Values, titles, excerpts and URLs are
// encrypted (`*_enc`). Evidence is SUPPORT, never approval; linking evidence
// to a version does not change the version or its hash.

import {
  canonicalJson,
  decryptField,
  decryptOptionalField,
  encryptField,
  encryptOptionalField,
  newId,
  nowIso,
  sha256Hex,
} from './crypto.ts'
import { isBlankBody, VaultNotFoundError, VaultScopeError } from './repo.ts'
import type { VaultStorage } from './vault.ts'
import type {
  EvidenceKind,
  EvidenceRecord,
  EvidenceTargetKind,
  EvidenceVerification,
  FactKind,
  FactRecord,
  VersionMethod,
  VersionRecord,
} from './schema.ts'

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

export const FACT_KINDS: readonly FactKind[] = ['personal', 'organization', 'project']
/** Fact keys are identifiers, never free text (they stay plaintext). */
export const FACT_KEY_RE = /^[a-z0-9][a-z0-9_.:-]{0,63}$/
const METHODS: readonly VersionMethod[] = ['manual', 'byok', 'app_provider', 'imported']

export class VaultFactConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VaultFactConflictError'
  }
}

export interface FactView {
  fact_id: string
  fact_version_id: string
  kind: FactKind
  key: string
  value: string
  supersedes: string | null
  evidence_ids: string[]
  created_at: string
  method: VersionMethod
  retracted: boolean
}

function cleanIds(ids: string[] | undefined): string[] {
  return [...new Set((ids ?? []).filter((e) => typeof e === 'string' && e.length > 0))]
}

/** Head of a fact chain: the version no other version supersedes (ties —
    a concurrent fork — resolve to the newest by (created_at, id)). */
function headOf(rows: FactRecord[]): FactRecord | null {
  const superseded = new Set(rows.map((r) => r.supersedes).filter(Boolean) as string[])
  return (
    rows
      .filter((r) => !superseded.has(r.fact_version_id))
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.fact_version_id.localeCompare(b.fact_version_id))
      .at(-1) ?? null
  )
}

async function viewOf(secret: string, r: FactRecord): Promise<FactView> {
  return {
    fact_id: r.fact_id,
    fact_version_id: r.fact_version_id,
    kind: r.kind,
    key: r.key,
    value: r.retracted ? '' : await decryptField(secret, r.value_enc),
    supersedes: r.supersedes ?? null,
    evidence_ids: r.evidence_ids ?? [],
    created_at: r.created_at,
    method: r.method,
    retracted: r.retracted === true,
  }
}

export async function createFact(
  storage: VaultStorage,
  secret: string,
  input: { kind: FactKind; key: string; value: string; evidence_ids?: string[]; method?: VersionMethod },
): Promise<FactRecord> {
  if (!FACT_KINDS.includes(input.kind)) throw new VaultScopeError(`fact kind must be one of ${FACT_KINDS.join('|')}`)
  if (typeof input.key !== 'string' || !FACT_KEY_RE.test(input.key)) {
    throw new VaultScopeError(`fact key must match ${FACT_KEY_RE} (identifier, not free text)`)
  }
  if (typeof input.value !== 'string' || isBlankBody(input.value)) throw new VaultScopeError('fact value is required')
  const method = input.method ?? 'manual'
  if (!METHODS.includes(method)) throw new VaultScopeError(`unknown fact method ${method}`)
  const value_enc = await encryptField(secret, input.value)
  const factId = newId()
  const record: FactRecord = {
    fact_version_id: newId(),
    fact_id: factId,
    kind: input.kind,
    key: input.key,
    value_enc,
    supersedes: null,
    evidence_ids: cleanIds(input.evidence_ids),
    created_at: nowIso(),
    method,
  }
  return storage.tx(['facts'], async (s) => {
    // One live fact per (kind, key): a second create must revise instead.
    const all = await s.getAll<FactRecord>('facts')
    const byFact = new Map<string, FactRecord[]>()
    for (const r of all) {
      if (r.kind !== input.kind || r.key !== input.key) continue
      byFact.set(r.fact_id, [...(byFact.get(r.fact_id) ?? []), r])
    }
    for (const rows of byFact.values()) {
      const head = headOf(rows)
      if (head && !head.retracted) {
        throw new VaultFactConflictError(
          `a live ${input.kind} fact '${input.key}' exists (${head.fact_id}) — revise it instead`,
        )
      }
    }
    await s.put('facts', record)
    return record
  })
}

async function appendFactVersion(
  storage: VaultStorage,
  input: {
    fact_id: string
    expected_latest_version_id?: string
    build: (head: FactRecord) => FactRecord
  },
): Promise<FactRecord> {
  return storage.tx(['facts'], async (s) => {
    const rows = (await s.getAll<FactRecord>('facts')).filter((r) => r.fact_id === input.fact_id)
    const head = headOf(rows)
    if (!head) throw new VaultNotFoundError(`fact not found: ${input.fact_id}`)
    if (input.expected_latest_version_id && head.fact_version_id !== input.expected_latest_version_id) {
      throw new VaultFactConflictError(
        `fact ${input.fact_id} changed: latest is ${head.fact_version_id}, not ${input.expected_latest_version_id}`,
      )
    }
    if (head.retracted) throw new VaultFactConflictError(`fact ${input.fact_id} is retracted`)
    const next = input.build(head)
    await s.put('facts', next)
    return next
  })
}

/** New immutable fact version superseding the current head. */
export async function reviseFact(
  storage: VaultStorage,
  secret: string,
  input: {
    fact_id: string
    value: string
    evidence_ids?: string[]
    method?: VersionMethod
    expected_latest_version_id?: string
  },
): Promise<FactRecord> {
  if (typeof input.value !== 'string' || isBlankBody(input.value)) throw new VaultScopeError('fact value is required')
  const method = input.method ?? 'manual'
  if (!METHODS.includes(method)) throw new VaultScopeError(`unknown fact method ${method}`)
  const value_enc = await encryptField(secret, input.value) // crypto outside the tx
  return appendFactVersion(storage, {
    fact_id: input.fact_id,
    expected_latest_version_id: input.expected_latest_version_id,
    build: (head) => ({
      fact_version_id: newId(),
      fact_id: head.fact_id,
      kind: head.kind,
      key: head.key,
      value_enc,
      supersedes: head.fact_version_id,
      evidence_ids: input.evidence_ids ? cleanIds(input.evidence_ids) : head.evidence_ids ?? [],
      created_at: nowIso(),
      method,
    }),
  })
}

/** "Delete" = a retraction tombstone version; history is kept. */
export async function retractFact(
  storage: VaultStorage,
  secret: string,
  input: { fact_id: string; expected_latest_version_id?: string },
): Promise<FactRecord> {
  const value_enc = await encryptField(secret, '') // uniform shape; never read
  return appendFactVersion(storage, {
    fact_id: input.fact_id,
    expected_latest_version_id: input.expected_latest_version_id,
    build: (head) => ({
      fact_version_id: newId(),
      fact_id: head.fact_id,
      kind: head.kind,
      key: head.key,
      value_enc,
      supersedes: head.fact_version_id,
      evidence_ids: [],
      created_at: nowIso(),
      method: 'manual',
      retracted: true,
    }),
  })
}

/** Live facts (head version, not retracted), decrypted. */
export async function listFacts(
  storage: VaultStorage,
  secret: string,
  filter: { kind?: FactKind } = {},
): Promise<FactView[]> {
  const all = await storage.getAll<FactRecord>('facts')
  const byFact = new Map<string, FactRecord[]>()
  for (const r of all) {
    if (filter.kind && r.kind !== filter.kind) continue
    byFact.set(r.fact_id, [...(byFact.get(r.fact_id) ?? []), r])
  }
  const out: FactView[] = []
  for (const rows of byFact.values()) {
    const head = headOf(rows)
    if (head && !head.retracted) out.push(await viewOf(secret, head))
  }
  return out.sort((a, b) => a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key))
}

/** Every version of one fact, oldest → newest (retractions included). */
export async function factHistory(storage: VaultStorage, secret: string, factId: string): Promise<FactView[]> {
  const rows = (await storage.getAll<FactRecord>('facts'))
    .filter((r) => r.fact_id === factId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.fact_version_id.localeCompare(b.fact_version_id))
  if (!rows.length) throw new VaultNotFoundError(`fact not found: ${factId}`)
  return Promise.all(rows.map((r) => viewOf(secret, r)))
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export const EVIDENCE_KINDS: readonly EvidenceKind[] = ['document', 'url', 'passage', 'note']
export const EVIDENCE_VERIFICATIONS: readonly EvidenceVerification[] = [
  'unverified',
  'user_confirmed',
  'source_checked',
]
const TARGET_KINDS: readonly EvidenceTargetKind[] = ['version', 'fact', 'claim']

export interface EvidenceLink {
  target_kind: EvidenceTargetKind
  target_id: string
}

export interface EvidenceView {
  evidence_id: string
  kind: EvidenceKind
  title: string
  excerpt: string | null
  url: string | null
  content_sha256: string
  captured_at: string
  verification: EvidenceVerification
  freshness_checked_at: string | null
  links: EvidenceLink[]
}

async function assertTargetExists(storage: VaultStorage, link: EvidenceLink): Promise<void> {
  if (!TARGET_KINDS.includes(link?.target_kind)) {
    throw new VaultScopeError(`evidence link target_kind must be one of ${TARGET_KINDS.join('|')}`)
  }
  if (!link.target_id) throw new VaultScopeError('evidence link requires target_id')
  if (link.target_kind === 'version') {
    if (!(await storage.get<VersionRecord>('versions', link.target_id))) {
      throw new VaultNotFoundError(`evidence link target version not found: ${link.target_id}`)
    }
  } else if (link.target_kind === 'fact') {
    const facts = await storage.getAll<FactRecord>('facts')
    if (!facts.some((f) => f.fact_id === link.target_id || f.fact_version_id === link.target_id)) {
      throw new VaultNotFoundError(`evidence link target fact not found: ${link.target_id}`)
    }
  }
  // 'claim' targets are claim ids owned by the review layer — any id.
}

export async function addEvidence(
  storage: VaultStorage,
  secret: string,
  input: {
    kind: EvidenceKind
    title: string
    excerpt?: string | null
    url?: string | null
    /** Hash of the underlying document bytes, when the caller has them. */
    content_sha256?: string
    verification?: EvidenceVerification
    freshness_checked_at?: string | null
    links?: EvidenceLink[]
  },
): Promise<EvidenceRecord> {
  if (!EVIDENCE_KINDS.includes(input.kind)) throw new VaultScopeError(`evidence kind must be one of ${EVIDENCE_KINDS.join('|')}`)
  if (typeof input.title !== 'string' || isBlankBody(input.title)) throw new VaultScopeError('evidence title is required')
  if (input.kind === 'url' && !input.url) throw new VaultScopeError("evidence kind 'url' requires url")
  if (input.kind === 'passage' && !input.excerpt) throw new VaultScopeError("evidence kind 'passage' requires excerpt")
  const verification = input.verification ?? 'unverified'
  if (!EVIDENCE_VERIFICATIONS.includes(verification)) throw new VaultScopeError(`unknown verification ${verification}`)
  if (input.content_sha256 !== undefined && !/^[0-9a-f]{64}$/.test(input.content_sha256)) {
    throw new VaultScopeError('content_sha256 must be 64 lowercase hex')
  }
  const links = input.links ?? []
  for (const l of links) await assertTargetExists(storage, l)

  const content_sha256 =
    input.content_sha256 ??
    (await sha256Hex(
      canonicalJson({ kind: input.kind, title: input.title, excerpt: input.excerpt ?? null, url: input.url ?? null }),
    ))
  const record: EvidenceRecord = {
    evidence_id: newId(),
    kind: input.kind,
    title_enc: await encryptField(secret, input.title),
    content_sha256,
    captured_at: nowIso(),
    verification,
    freshness_checked_at: input.freshness_checked_at ?? null,
    links: dedupeLinks(links),
  }
  const excerpt_enc = await encryptOptionalField(secret, input.excerpt)
  if (excerpt_enc) record.excerpt_enc = excerpt_enc
  const url_enc = await encryptOptionalField(secret, input.url)
  if (url_enc) record.url_enc = url_enc
  await storage.put('evidence', record)
  return record
}

function dedupeLinks(links: EvidenceLink[]): EvidenceLink[] {
  const seen = new Set<string>()
  const out: EvidenceLink[] = []
  for (const l of links) {
    const k = `${l.target_kind}:${l.target_id}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ target_kind: l.target_kind, target_id: l.target_id })
  }
  return out
}

/** Link existing evidence to a version / fact / claim (idempotent). The
    target is NOT modified — versions stay immutable. */
export async function linkEvidence(
  storage: VaultStorage,
  evidenceId: string,
  link: EvidenceLink,
): Promise<EvidenceRecord> {
  await assertTargetExists(storage, link)
  return storage.tx(['evidence'], async (s) => {
    const rec = await s.get<EvidenceRecord>('evidence', evidenceId)
    if (!rec) throw new VaultNotFoundError(`evidence not found: ${evidenceId}`)
    const next = { ...rec, links: dedupeLinks([...rec.links, link]) }
    await s.put('evidence', next)
    return next
  })
}

export async function setEvidenceVerification(
  storage: VaultStorage,
  evidenceId: string,
  input: { verification: EvidenceVerification; freshness_checked_at?: string | null },
): Promise<EvidenceRecord> {
  if (!EVIDENCE_VERIFICATIONS.includes(input.verification)) {
    throw new VaultScopeError(`unknown verification ${input.verification}`)
  }
  return storage.tx(['evidence'], async (s) => {
    const rec = await s.get<EvidenceRecord>('evidence', evidenceId)
    if (!rec) throw new VaultNotFoundError(`evidence not found: ${evidenceId}`)
    const next: EvidenceRecord = {
      ...rec,
      verification: input.verification,
      freshness_checked_at: input.freshness_checked_at ?? nowIso(),
    }
    await s.put('evidence', next)
    return next
  })
}

export async function readEvidence(storage: VaultStorage, secret: string, evidenceId: string): Promise<EvidenceView> {
  const rec = await storage.get<EvidenceRecord>('evidence', evidenceId)
  if (!rec) throw new VaultNotFoundError(`evidence not found: ${evidenceId}`)
  return evidenceView(secret, rec)
}

async function evidenceView(secret: string, rec: EvidenceRecord): Promise<EvidenceView> {
  return {
    evidence_id: rec.evidence_id,
    kind: rec.kind,
    title: await decryptField(secret, rec.title_enc),
    excerpt: await decryptOptionalField(secret, rec.excerpt_enc),
    url: await decryptOptionalField(secret, rec.url_enc),
    content_sha256: rec.content_sha256,
    captured_at: rec.captured_at,
    verification: rec.verification,
    freshness_checked_at: rec.freshness_checked_at ?? null,
    links: rec.links ?? [],
  }
}

/** Evidence ids attached to a target: evidence.links ∪ the target's own
    cited ids (version.evidence_ids / fact.evidence_ids). No decryption. */
export async function evidenceIdsFor(
  storage: VaultStorage,
  targetKind: EvidenceTargetKind,
  targetId: string,
): Promise<string[]> {
  const ids = new Set<string>()
  for (const e of await storage.getAll<EvidenceRecord>('evidence')) {
    if ((e.links ?? []).some((l) => l.target_kind === targetKind && l.target_id === targetId)) ids.add(e.evidence_id)
  }
  if (targetKind === 'version') {
    const v = await storage.get<VersionRecord>('versions', targetId)
    for (const id of v?.evidence_ids ?? []) ids.add(id)
  } else if (targetKind === 'fact') {
    for (const f of await storage.getAll<FactRecord>('facts')) {
      if (f.fact_id === targetId || f.fact_version_id === targetId) for (const id of f.evidence_ids ?? []) ids.add(id)
    }
  }
  return [...ids].sort()
}

/** Decrypted evidence for a target. Ids cited but missing from the store
    are reported in `missing` (dangling citations are never hidden). */
export async function listEvidenceFor(
  storage: VaultStorage,
  secret: string,
  targetKind: EvidenceTargetKind,
  targetId: string,
): Promise<{ evidence: EvidenceView[]; missing: string[] }> {
  const ids = await evidenceIdsFor(storage, targetKind, targetId)
  const evidence: EvidenceView[] = []
  const missing: string[] = []
  for (const id of ids) {
    const rec = await storage.get<EvidenceRecord>('evidence', id)
    if (rec) evidence.push(await evidenceView(secret, rec))
    else missing.push(id)
  }
  return { evidence, missing }
}
