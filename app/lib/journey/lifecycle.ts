// M09 W6 — journey plumbing between the vault and the screens: URL import
// request (the only Step A request, carrying just the URL), instance list
// with lifecycle status, prepare-input assembly, historical snapshot.
// Relative imports only (node type stripping in tests).

import { canonicalJson, sha256Hex } from '../aqua-local/crypto.ts'
import { listAppInstances, readAppInstance } from '../aqua-local/instances.ts'
import { getPacketState, listPackets, listSubmissionsForPacket, loadPacket, type FrozenPacket } from '../aqua-local/packets.ts'
import { readVersion } from '../aqua-local/repo.ts'
import type { AppInstanceRecord, LocalAppTemplate, PacketState, SubmissionRecord } from '../aqua-local/schema.ts'
import type { VaultStorage } from '../aqua-local/vault.ts'
import { urlSensitivity } from '../catalog/classify.ts'
import { measure, type PrepareQuestionInput } from './prepare.ts'
import type { ExtractUrlResponse, JourneyCatalog, JourneyCatalogProgram } from './review-model.ts'

// ─── Step A (b): URL import ──────────────────────────────────────────────────

export type UrlImportResult =
  | { ok: true; proposal: ExtractUrlResponse }
  | { ok: false; code: string; message: string }

/**
 * Ask the server to fetch ONE public page and return a read-only proposal.
 * The request body is `{ url }` only. Links that look private are refused
 * here, before any request. A failure returns a result — never a partial
 * instance (nothing is written by this function or by the route).
 */
export async function importFromUrl(rawUrl: string, fetchImpl: typeof fetch): Promise<UrlImportResult> {
  const url = rawUrl.trim()
  if (!url) return { ok: false, code: 'empty', message: 'Enter the application page URL.' }
  if (url.length > 2048) return { ok: false, code: 'too_long', message: 'That URL is too long.' }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, code: 'invalid_url', message: 'That does not look like a web address (include https://).' }
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return { ok: false, code: 'invalid_url', message: 'Only http(s) links can be imported.' }
  const sens = urlSensitivity(url)
  if (sens.length) {
    return { ok: false, code: 'url_not_public', message: 'This link looks private (it carries a token, a private host or a share link), so it was not sent anywhere. Download the form and use file import instead.' }
  }
  let res: Response
  try {
    res = await fetchImpl('/api/catalog/extract-url', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })
  } catch {
    return { ok: false, code: 'network_error', message: 'Could not reach AQUA. Nothing was created — try again, or paste the questions instead.' }
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok) {
    const msg = typeof json?.error === 'string' ? json.error : `The import failed (${res.status}).`
    return { ok: false, code: typeof json?.code === 'string' ? json.code : `http_${res.status}`, message: `${msg} Nothing was created.` }
  }
  if (!json || json.proposal !== true || !Array.isArray(json.questions)) {
    return { ok: false, code: 'bad_response', message: 'The import returned an unexpected response. Nothing was created.' }
  }
  return { ok: true, proposal: json as unknown as ExtractUrlResponse }
}

/**
 * `/apply?url=<encoded>` deep link → prefill value for the URL path. Pure;
 * never triggers a fetch (the user still clicks Import). Links that look
 * private are not prefilled at all.
 */
export function urlPrefill(raw: string | null | undefined): { url: string | null; refused: string | null } {
  const v = (raw ?? '').trim()
  if (!v) return { url: null, refused: null }
  if (v.length > 2048) return { url: null, refused: 'The link you opened carried an address that is too long to import.' }
  let parsed: URL
  try { parsed = new URL(v) } catch { return { url: null, refused: 'The link you opened did not carry a valid web address.' } }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return { url: null, refused: 'Only http(s) application pages can be imported.' }
  if (urlSensitivity(v).length) {
    return { url: null, refused: 'The link you opened points at an address that looks private (token, share link or private host), so it was not filled in. Use file import instead.' }
  }
  return { url: v, refused: null }
}

// ─── instance list / lifecycle ───────────────────────────────────────────────

export type InstanceLifecycle = 'active' | 'queued' | 'submitted'

/** submitted = a packet was recorded as submitted (user attestation);
    queued = a packet is frozen/signed/exported and awaiting submission;
    active = still being prepared. Discarded packets do not count. */
export function deriveInstanceLifecycle(states: Array<PacketState | null | undefined>): InstanceLifecycle {
  if (states.includes('submitted_external_observed')) return 'submitted'
  if (states.some((s) => s === 'prepared' || s === 'signed' || s === 'exported')) return 'queued'
  return 'active'
}

export interface InstanceSummary {
  instance_id: string
  application_id: string
  title: string
  organization: string
  kind: 'catalog' | 'local'
  source_kind: AppInstanceRecord['source']['kind']
  program_id: string | null
  question_count: number
  created_at: string
  lifecycle: InstanceLifecycle
  deadline: string | null
}

export function catalogProgramFor(record: Pick<AppInstanceRecord, 'program_id'>, catalog?: JourneyCatalog | null): JourneyCatalogProgram | null {
  return record.program_id ? catalog?.programs.find((p) => p.id === record.program_id) ?? null : null
}

export async function instanceLifecycle(storage: VaultStorage, applicationId: string): Promise<InstanceLifecycle> {
  const packets = await listPackets(storage, applicationId)
  const states = await Promise.all(packets.map(async (p) => (await getPacketState(storage, p.id))?.state ?? null))
  return deriveInstanceLifecycle(states)
}

/** Every private instance with its lifecycle (Step A path e / "reopen historical work"). */
export async function loadInstanceSummaries(storage: VaultStorage, secret: string, catalog?: JourneyCatalog | null): Promise<InstanceSummary[]> {
  const out: InstanceSummary[] = []
  for (const rec of await listAppInstances(storage)) {
    let template: LocalAppTemplate | null = null
    try {
      template = (await readAppInstance(storage, secret, rec.instance_id)).template
    } catch {
      template = null // undecryptable under this secret — still listed by id
    }
    const prog = catalogProgramFor(rec, catalog)
    out.push({
      instance_id: rec.instance_id,
      application_id: rec.application_id,
      title: template?.title ?? prog?.name ?? 'Catalog application',
      organization: template?.org ?? prog?.organization ?? '',
      kind: template ? 'local' : 'catalog',
      source_kind: rec.source.kind,
      program_id: rec.program_id ?? null,
      question_count: rec.question_refs.length,
      created_at: rec.created_at,
      lifecycle: await instanceLifecycle(storage, rec.application_id),
      deadline: template?.deadline ?? (prog?.cycle?.closes_at ?? prog?.deadline_at ?? null),
    })
  }
  return out
}

// ─── Step F inputs ───────────────────────────────────────────────────────────

/** Re-hash a stored version from its decrypted plaintext (integrity check). */
export async function rehashVersion(storage: VaultStorage, secret: string, versionId: string): Promise<{ recorded: string; recomputed: string | null; body: string | null }> {
  try {
    const { record, title, body } = await readVersion(storage, secret, versionId)
    return { recorded: record.sha256, recomputed: await sha256Hex(canonicalJson({ title, body })), body }
  } catch {
    const rec = await storage.get<{ sha256: string }>('versions', versionId)
    return { recorded: rec?.sha256 ?? '', recomputed: null, body: null }
  }
}

/** Minimal row shape (InstanceQuestionRow from aqua-local-client/review.ts). */
export interface PrepareRowLike {
  question_occurrence_id: string
  text: string | null
  required: boolean
  word_limit: number | null
  char_limit: number | null
  versions: Array<{ id: string }>
  status: { status: PrepareQuestionInput['status']; approved_version_id: string | null; governing_version_id: string | null }
}

export async function buildPrepareInputs(
  storage: VaultStorage,
  secret: string,
  rows: PrepareRowLike[],
  skipReasons: Record<string, string> = {},
): Promise<PrepareQuestionInput[]> {
  const out: PrepareQuestionInput[] = []
  for (const r of rows) {
    let approved: PrepareQuestionInput['approved'] = null
    const vid = r.status.approved_version_id
    if (vid) {
      const h = await rehashVersion(storage, secret, vid)
      const m = h.body !== null ? measure(h.body) : { word_count: 0, char_count: 0 }
      approved = { version_id: vid, recorded_sha256: h.recorded, recomputed_sha256: h.recomputed, ...m, is_governing: r.status.governing_version_id === vid }
    }
    out.push({
      question_occurrence_id: r.question_occurrence_id,
      text: r.text,
      required: r.required,
      word_limit: r.word_limit,
      char_limit: r.char_limit,
      has_versions: r.versions.length > 0,
      status: r.status.status,
      approved,
      skip_reason: skipReasons[r.question_occurrence_id] ?? null,
    })
  }
  return out
}

// ─── Step H / historical snapshot ────────────────────────────────────────────

export interface HistoricalSnapshot {
  packet: FrozenPacket
  manifest_sha256: string
  state: PacketState | null
  submissions: SubmissionRecord[]
}

/** Frozen packets for an application with their state + submission records (read-only). */
export async function loadHistory(storage: VaultStorage, secret: string, applicationId: string): Promise<HistoricalSnapshot[]> {
  const out: HistoricalSnapshot[] = []
  for (const p of await listPackets(storage, applicationId)) {
    const state = (await getPacketState(storage, p.id))?.state ?? null
    if (state === 'discarded') continue
    try {
      out.push({ packet: await loadPacket(storage, p.id, secret), manifest_sha256: p.manifest_sha256, state, submissions: await listSubmissionsForPacket(storage, p.id) })
    } catch {
      // undecryptable packet under this secret — omitted from the snapshot view
    }
  }
  return out
}
