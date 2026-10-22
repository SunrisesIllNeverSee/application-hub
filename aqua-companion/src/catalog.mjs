// Public catalog cache: owner-approved canonical programs, their cycles and
// their question occurrences, plus the canonical questions they point at.
// Sources, in order of preference:
//   1. `catalog sync`: read-only PostgREST GETs with the public publishable
//      key from config/public-catalog.json (see docs/AGENT.md);
//   2. `catalog import-file`: an exported catalog JSON the user downloaded;
//   3. public program:/question: entries that arrived in a vault backup.
// The cache is ONE public (plaintext) record, catalog:public-catalog-snapshot,
// under catalog-cache/snapshots/. A refresh archives the previous snapshot in
// the index (never deleted). Nothing private is ever sent or stored here.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonicalJson, sha256Hex, nowIso } from './crypto.mjs'
import { confirmPlan, out, UsageError } from './io.mjs'
import { CONFIG_ORIGIN, CONFIG_PATH, CatalogNetworkError, endpointOrigin, getCatalogConfigJson, getPublicJson } from './net.mjs'
import { rid, splitRid } from './workspace.mjs'
import { CANONICAL_PROGRAM_SLUGS } from '../vendor/lib/canonical-catalog.mjs'

export const SNAPSHOT_KEY = 'public-catalog-snapshot'
export const SNAPSHOT_RID = rid('catalog', SNAPSHOT_KEY)
export const SNAPSHOT_DIR = 'catalog-cache/snapshots'
export const SNAPSHOT_FORMAT = 'aqua-public-catalog'
const COMPANION_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DEFAULT_CONFIG_PATH = path.join(COMPANION_DIR, 'config', 'public-catalog.json')
const PAGE = 1000
const MAX_PAGES = 50

// ---------------------------------------------------------------------------
// configuration
// ---------------------------------------------------------------------------

function isPlaceholder(v) {
  return typeof v !== 'string' || !v.trim() || /YOUR-PROJECT|REPLACE[-_ ]?WITH|<|>/i.test(v)
}

export class CatalogKeyRefusal extends UsageError {
  constructor(message, role) {
    super(message)
    this.name = 'CatalogKeyRefusal'
    this.role = role
  }
}

/** Decode a key: { kind: 'publishable'|'secret'|'jwt'|'unknown', role } (no verification; the role claim is what matters). */
export function describeKey(key) {
  const k = String(key ?? '')
  if (/^sb_publishable_/i.test(k)) return { kind: 'publishable', role: 'anon', ref: null }
  if (/^sb_secret_/i.test(k)) return { kind: 'secret', role: 'service_role', ref: null }
  const parts = k.split('.')
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
      return { kind: 'jwt', role: typeof payload?.role === 'string' ? payload.role : null, ref: typeof payload?.ref === 'string' ? payload.ref : null }
    } catch {
      return { kind: 'unknown', role: null, ref: null }
    }
  }
  return { kind: 'unknown', role: null, ref: null }
}

/**
 * Refuse anything that is not a public key. Accepted: a publishable key
 * (sb_publishable_...) or a JWT whose role is "anon". Hard refusal for
 * service-role / secret keys, any other role, and keys that cannot be decoded.
 */
export function assertPublicKey(key) {
  const d = describeKey(key)
  if (d.kind === 'secret') throw new CatalogKeyRefusal('That is a Supabase SECRET key. Only the public publishable (anon) key may be configured; nothing was saved or sent.', 'service_role')
  if (d.kind === 'jwt' && d.role === 'service_role') throw new CatalogKeyRefusal('That key carries role "service_role". Service-role keys are refused outright; only the public anon / publishable key may be configured. Nothing was sent.', 'service_role')
  if (d.kind === 'jwt' && d.role !== 'anon') throw new CatalogKeyRefusal(`That key carries role "${d.role ?? 'none'}". Only the public anon / publishable key may be configured; nothing was sent.`, d.role)
  if (d.kind === 'unknown') throw new CatalogKeyRefusal('That key is neither a publishable key (sb_publishable_...) nor an anon JWT, so its role cannot be checked. Nothing was sent.', null)
  return d
}

function fromObject(cfg, base) {
  const url = cfg?.supabase_url
  const key = cfg?.publishable_key
  if (isPlaceholder(url) || isPlaceholder(key)) return { configured: false, ...base, reason: `the public catalog endpoint is not configured (placeholders in ${base.path ?? base.config_url})` }
  const origin = endpointOrigin(url)
  const d = assertPublicKey(key)
  return { configured: true, ...base, origin, key, key_role: d.role, key_kind: d.kind, project_ref: d.ref ?? (origin.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co$/)?.[1] ?? null) }
}

const OFFLINE = (env) => ['1', 'true'].includes(String(env?.AQUA_CATALOG_OFFLINE ?? '').trim().toLowerCase())

/**
 * Synchronous configuration from a local file only: --catalog-config F,
 * AQUA_CATALOG_CONFIG, else the bundled config/public-catalog.json.
 * { configured, origin, key, path, source, reason }
 */
export function loadCatalogConfig(ctx) {
  const explicit = ctx.flags?.['catalog-config'] ?? ctx.env?.AQUA_CATALOG_CONFIG ?? null
  const p = explicit ?? DEFAULT_CONFIG_PATH
  const abs = path.resolve(ctx.cwd ?? process.cwd(), p)
  let cfg
  try {
    cfg = JSON.parse(fs.readFileSync(abs, 'utf8'))
  } catch {
    return { configured: false, path: abs, source: explicit ? 'file' : 'bundled', reason: `no readable catalog config at ${abs}` }
  }
  return fromObject(cfg, { path: abs, source: explicit ? 'file' : 'bundled' })
}

/**
 * M09b: the default catalog configuration comes from
 * https://aquaidp.xyz/.well-known/aqua-catalog.json (fetch allowlist: that
 * origin and path only). Order: a local file override (--catalog-config /
 * AQUA_CATALOG_CONFIG), the bundled file when it holds real values, then the
 * well-known document. AQUA_CATALOG_OFFLINE=1 skips the fetch. The key is
 * decoded and anything but anon / publishable is refused.
 */
export async function resolveCatalogConfig(ctx, { fetchImpl } = {}) {
  const local = loadCatalogConfig(ctx)
  const explicit = Boolean(ctx.flags?.['catalog-config'] ?? ctx.env?.AQUA_CATALOG_CONFIG)
  if (local.configured || explicit) return local
  const config_url = `${CONFIG_ORIGIN}${CONFIG_PATH}`
  if (OFFLINE(ctx.env)) return { configured: false, source: 'well-known', config_url, reason: 'the public catalog endpoint is not configured (AQUA_CATALOG_OFFLINE is set and no local config file was given)' }
  let doc
  try {
    doc = await getCatalogConfigJson({ fetchImpl })
  } catch (e) {
    return { configured: false, source: 'well-known', config_url, reason: `the public catalog configuration could not be loaded from ${config_url} (${e.message}); pass --catalog-config <file> to use a local copy` }
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { configured: false, source: 'well-known', config_url, reason: `${config_url} did not return a configuration object` }
  return { ...fromObject(doc, { source: 'well-known', config_url }), version: doc.version ?? null, tables: doc.tables ?? null }
}

// ---------------------------------------------------------------------------
// sanitizing (shared by sync and import-file): keep known public fields only
// ---------------------------------------------------------------------------

const str = (v, max = 2000) => (typeof v === 'string' && v.length <= max ? v : null)
const id = (v) => (typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v) ? v : null)
const int = (v) => (Number.isInteger(v) && v > 0 && v < 1_000_000 ? v : null)
const iso = (v) => (typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v)) ? v : null)
const bool = (v) => (typeof v === 'boolean' ? v : null)

function rows(v, what) {
  if (v === undefined || v === null) return []
  if (!Array.isArray(v)) throw new UsageError(`catalog ${what} is not a list`)
  return v.filter((r) => r && typeof r === 'object' && !Array.isArray(r))
}

/**
 * Validate catalog rows into the snapshot body. Programs are kept only when
 * they are canonical AND their slug is in the approval registry
 * (app/lib/canonical-catalog.ts, vendored) unless `allowAnySlug`.
 */
export function sanitizeCatalog(raw, { allowAnySlug = false } = {}) {
  const allow = new Set(CANONICAL_PROGRAM_SLUGS)
  const programs = []
  for (const p of rows(raw?.programs, 'programs')) {
    const pid = id(p.id)
    const slug = id(p.slug)
    if (!pid || !slug || !str(p.name, 500)) continue
    if (p.source !== undefined && p.source !== 'canonical') continue
    if (!allowAnySlug && !allow.has(slug)) continue
    programs.push({
      id: pid, slug, name: str(p.name, 500), organization: str(p.organization, 500), description: str(p.description, 10_000),
      url: str(p.url, 2000), apply_url: str(p.apply_url, 2000), deadline_at: iso(p.deadline_at), closes_at: iso(p.closes_at),
      opens_at: iso(p.opens_at), is_rolling: bool(p.is_rolling), status: str(p.status, 40), source: 'canonical',
      kind: str(p.kind, 40), type: str(p.type, 40), round: str(p.round, 200), cohort_name: str(p.cohort_name, 200),
      updated_at: iso(p.updated_at), last_scraped_at: iso(p.last_scraped_at),
    })
  }
  const pids = new Set(programs.map((p) => p.id))
  const cycles = rows(raw?.cycles, 'cycles')
    .filter((c) => id(c.id) && pids.has(c.program_id) && str(c.cycle_name, 200))
    .map((c) => ({
      id: c.id, program_id: c.program_id, cycle_name: c.cycle_name, opens_at: iso(c.opens_at), closes_at: iso(c.closes_at),
      cohort_name: str(c.cohort_name, 200), apply_url: str(c.apply_url, 2000), is_active: bool(c.is_active), updated_at: iso(c.updated_at),
    }))
  const questions = rows(raw?.questions, 'questions')
    .filter((q) => id(q.id) && pids.has(q.program_id) && str(q.asked_as, 5000))
    .map((q) => ({
      id: q.id, program_id: q.program_id, archived_question_id: id(q.archived_question_id), asked_as: q.asked_as,
      word_limit: int(q.word_limit), char_limit: int(q.char_limit), is_required: q.is_required === true,
      order_index: Number.isInteger(q.order_index) ? q.order_index : 0, section: str(q.section, 500),
    }))
  const referenced = new Set(questions.map((q) => q.archived_question_id).filter(Boolean))
  const canonical_questions = rows(raw?.canonical_questions, 'canonical_questions')
    .filter((c) => id(c.id) && referenced.has(c.id) && str(c.text, 5000))
    .map((c) => ({ id: c.id, text: c.text, theme: str(c.theme, 200), typical_word_limit: int(c.typical_word_limit) }))
  return { programs, cycles, questions, canonical_questions }
}

// ---------------------------------------------------------------------------
// fetching
// ---------------------------------------------------------------------------

const PROGRAM_COLS = 'id,slug,name,organization,description,url,apply_url,deadline_at,closes_at,opens_at,is_rolling,status,source,kind,type,round,cohort_name,updated_at,last_scraped_at'
const CYCLE_COLS = 'id,program_id,cycle_name,opens_at,closes_at,cohort_name,apply_url,is_active,updated_at'
const QUESTION_COLS = 'id,program_id,archived_question_id,asked_as,word_limit,char_limit,is_required,order_index,section'
const CANONICAL_COLS = 'id,text,theme,typical_word_limit'

function inList(values) {
  // PostgREST in.() list; ids/slugs are validated identifier strings, quoted defensively
  return `in.(${values.map((v) => `"${String(v).replace(/["\\]/g, '')}"`).join(',')})`
}

async function pagedGet(cfg, table, params, fetchImpl) {
  const outRows = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const q = new URLSearchParams({ ...params, limit: String(PAGE), offset: String(page * PAGE) })
    const body = await getPublicJson(cfg.origin, `/rest/v1/${table}?${q.toString()}`, cfg.key, { fetchImpl })
    if (!Array.isArray(body)) throw new CatalogNetworkError(`the catalog returned a non-list for ${table}`, 'format')
    outRows.push(...body)
    if (body.length < PAGE) return outRows
  }
  throw new CatalogNetworkError(`the catalog returned more than ${PAGE * MAX_PAGES} ${table} rows`, 'too_large')
}

/** Fetch public canonical programs + cycles + questions. Sends table/column names and public ids only. */
export async function fetchPublicCatalog(cfg, { fetchImpl } = {}) {
  const slugs = [...CANONICAL_PROGRAM_SLUGS]
  if (!slugs.length) return { programs: [], cycles: [], questions: [], canonical_questions: [] }
  const programs = await pagedGet(cfg, 'programs', { select: PROGRAM_COLS, source: 'eq.canonical', slug: inList(slugs), order: 'slug.asc' }, fetchImpl)
  const kept = sanitizeCatalog({ programs }).programs
  const ids = kept.map((p) => p.id)
  if (!ids.length) return sanitizeCatalog({ programs })
  const cycles = await pagedGet(cfg, 'program_cycles', { select: CYCLE_COLS, program_id: inList(ids), order: 'program_id.asc' }, fetchImpl)
  const questions = await pagedGet(cfg, 'program_questions', { select: QUESTION_COLS, program_id: inList(ids), order: 'program_id.asc,order_index.asc' }, fetchImpl)
  const canonIds = [...new Set(questions.map((q) => q.archived_question_id).filter((x) => id(x)))]
  const canonical_questions = []
  for (let i = 0; i < canonIds.length; i += 200) {
    canonical_questions.push(...(await pagedGet(cfg, 'archived_questions', { select: CANONICAL_COLS, id: inList(canonIds.slice(i, i + 200)) }, fetchImpl)))
  }
  return sanitizeCatalog({ programs, cycles, questions, canonical_questions })
}

// ---------------------------------------------------------------------------
// the cached snapshot
// ---------------------------------------------------------------------------

export async function buildSnapshot(body, { origin, kind }) {
  const content_sha256 = await sha256Hex(canonicalJson(body))
  return { format: SNAPSHOT_FORMAT, version: 1, source: { kind, origin: origin ?? null }, fetched_at: nowIso(), content_sha256, ...body }
}

/** Save a snapshot record (archives the previous one). Returns { changed }. Caller holds an unlocked workspace. */
export async function saveSnapshot(ws, snapshot, { via = 'cli' } = {}) {
  const current = ws.records[SNAPSHOT_RID]
  if (current && current.status !== 'archived' && current.catalog_content_sha256 === snapshot.content_sha256) {
    return { changed: false }
  }
  const stamp = nowIso().replace(/[:.]/g, '-')
  if (current) ws.records[`${SNAPSHOT_RID}#superseded-${stamp}`] = { ...current, status: 'archived', superseded_at: nowIso() }
  ws.records[SNAPSHOT_RID] = await ws.writeRecord({
    kind: 'catalog', key: SNAPSHOT_KEY, authority: 'projection', data: snapshot, dir: SNAPSHOT_DIR,
    extra: { catalog_source: snapshot.source.kind, catalog_content_sha256: snapshot.content_sha256, fetched_at: snapshot.fetched_at },
  })
  await ws.saveManifest()
  await ws.audit('catalog_snapshot', {
    source: snapshot.source.kind, origin: snapshot.source.origin, programs: snapshot.programs.length, questions: snapshot.questions.length,
    content_sha256: snapshot.content_sha256, ...(via !== 'cli' ? { via } : {}),
  })
  return { changed: true }
}

/**
 * The merged public catalog view: the latest snapshot plus public program:/
 * question: entries from vault backups. `override` (an in-memory snapshot)
 * replaces the saved one (read-only agent sessions).
 */
export async function readCatalog(ws, { override = null } = {}) {
  let snapshot = override
  if (!snapshot) {
    const e = ws.records[SNAPSHOT_RID]
    if (e && !['archived', 'missing'].includes(e.status)) {
      try {
        snapshot = (await ws.decodeEntry(SNAPSHOT_RID)).data
      } catch {
        snapshot = null
      }
    }
  }
  const vaultPrograms = []
  const vaultQuestions = []
  for (const [r, e] of Object.entries(ws.records)) {
    if (e.kind !== 'catalog' || e.catalog_source || ['archived', 'missing'].includes(e.status) || r === SNAPSHOT_RID) continue
    let rec
    try {
      rec = (await ws.decodeEntry(r)).data
    } catch {
      continue
    }
    const key = splitRid(r).key
    const blob = rec?.blob && typeof rec.blob === 'object' ? rec.blob : null
    if (!blob || !id(key)) continue // ids are returned as server structure: identifier-shaped keys only
    if (/^program/i.test(key) && (str(blob.name, 500) || str(blob.title, 500))) {
      vaultPrograms.push({ id: key, slug: null, name: blob.name ?? blob.title, organization: str(blob.organization, 500), description: str(blob.description, 10_000), source: 'vault-cache', fetched_at: rec.fetched_at ?? null })
    } else if (/^question/i.test(key) && str(blob.text, 5000)) {
      vaultQuestions.push({ id: key, text: blob.text })
    }
  }
  const programs = (snapshot?.programs ?? []).map((p) => ({
    ...p,
    cycles: (snapshot.cycles ?? []).filter((c) => c.program_id === p.id),
    questions: (snapshot.questions ?? []).filter((q) => q.program_id === p.id).sort((a, b) => a.order_index - b.order_index),
  }))
  return {
    available: Boolean(snapshot) || vaultPrograms.length > 0 || vaultQuestions.length > 0,
    snapshot: snapshot ? { source: snapshot.source, fetched_at: snapshot.fetched_at, content_sha256: snapshot.content_sha256 } : null,
    programs,
    canonical_questions: snapshot?.canonical_questions ?? [],
    vault_programs: vaultPrograms,
    vault_questions: vaultQuestions,
  }
}

/** Canonical questions with their recorded occurrence wordings as variants (catalog/match.ts CatalogQuestion). */
export function catalogQuestionsForMatch(cat) {
  const byCanon = new Map()
  for (const c of cat.canonical_questions) byCanon.set(c.id, { id: c.id, text: c.text, variants: [], word_limit: c.typical_word_limit ?? null })
  for (const p of cat.programs) {
    for (const q of p.questions) {
      const c = q.archived_question_id && byCanon.get(q.archived_question_id)
      if (c) c.variants.push({ text: q.asked_as, word_limit: q.word_limit, char_limit: q.char_limit })
    }
  }
  for (const q of cat.vault_questions) if (!byCanon.has(q.id)) byCanon.set(q.id, { id: q.id, text: q.text, variants: [] })
  return [...byCanon.values()]
}

// ---------------------------------------------------------------------------
// CLI: aqua-companion catalog sync | import-file <file> | status
// ---------------------------------------------------------------------------

export async function cmdCatalog(ctx, sub, arg, { openUnlocked }) {
  if (sub === 'status') {
    const cfg = await safeConfig(ctx)
    const ws = await openUnlocked(ctx)
    const cat = await readCatalog(ws)
    out(ctx, `endpoint: ${cfg.configured ? cfg.origin : `not configured (${cfg.reason})`}`)
    out(ctx, cat.snapshot ? `cached snapshot: ${cat.programs.length} program(s), fetched ${cat.snapshot.fetched_at} from ${cat.snapshot.source.kind}${cat.snapshot.source.origin ? ` ${cat.snapshot.source.origin}` : ''}` : 'cached snapshot: none')
    if (cat.vault_programs.length || cat.vault_questions.length) out(ctx, `from vault backups: ${cat.vault_programs.length} program(s), ${cat.vault_questions.length} question(s)`)
    return 0
  }
  if (sub === 'sync') {
    const cfg = await safeConfig(ctx)
    if (!cfg.configured) throw new UsageError(`Cannot sync: ${cfg.reason}. See aqua-companion/docs/AGENT.md ("Public catalog"). Cached data, if any, still works offline.`)
    const ws = await openUnlocked(ctx)
    const lines = [
      `read public canonical programs, cycles and questions from ${cfg.origin} (read-only GET requests with the public publishable key)`,
      'nothing from this workspace is sent; only table names, column names and public catalog ids are in the requests',
      `replace the cached snapshot in ${SNAPSHOT_DIR}/ (the previous snapshot stays in the index as archived)`,
    ]
    if (!(await confirmPlan(ctx, 'refresh the public catalog cache', lines))) return 0
    const body = await fetchPublicCatalog(cfg)
    const snap = await buildSnapshot(body, { origin: cfg.origin, kind: 'supabase-rest' })
    const { changed } = await saveSnapshot(ws, snap)
    out(ctx, `${changed ? 'Saved' : 'Unchanged:'} ${snap.programs.length} program(s), ${snap.questions.length} question occurrence(s), ${snap.canonical_questions.length} canonical question(s).`)
    return 0
  }
  if (sub === 'import-file') {
    if (!arg) throw new UsageError('Usage: aqua-companion catalog import-file <catalog.json>')
    const abs = path.resolve(ctx.cwd, arg)
    let raw
    try {
      const st = fs.statSync(abs)
      if (!st.isFile() || st.size > 50 * 1024 * 1024) throw new Error('x')
      raw = JSON.parse(fs.readFileSync(abs, 'utf8'))
    } catch {
      throw new UsageError(`Not a readable catalog JSON file: ${arg}`)
    }
    const body = sanitizeCatalog(raw)
    const ws = await openUnlocked(ctx)
    const lines = [
      `import ${body.programs.length} canonical program(s), ${body.questions.length} question occurrence(s) from ${path.basename(abs)}`,
      'only approved canonical programs (source canonical, slug in the approval registry) and their public questions are kept',
      `replace the cached snapshot in ${SNAPSHOT_DIR}/ (the previous snapshot stays in the index as archived)`,
    ]
    if (!(await confirmPlan(ctx, 'import a public catalog file', lines))) return 0
    const snap = await buildSnapshot(body, { origin: null, kind: 'file' })
    const { changed } = await saveSnapshot(ws, snap)
    out(ctx, `${changed ? 'Saved' : 'Unchanged:'} ${snap.programs.length} program(s).`)
    return 0
  }
  throw new UsageError('Usage: aqua-companion catalog sync | import-file <file> | status')
}

async function safeConfig(ctx) {
  try {
    return await resolveCatalogConfig(ctx)
  } catch (e) {
    if (e instanceof UsageError) throw e
    return { configured: false, reason: e.message }
  }
}
