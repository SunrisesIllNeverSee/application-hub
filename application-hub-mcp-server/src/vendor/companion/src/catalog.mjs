// VENDORED from aqua-companion/src/catalog.mjs. Do not edit: change the source and run
// `npm run vendor:companion` in application-hub-mcp-server/ (CI checks these copies).
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
import { CONFIG_ORIGIN, CONFIG_PATH, CatalogNetworkError, SUPABASE_ORIGIN_RE, endpointOrigin, getCatalogConfigJson, getConfigJsonFromUrl, getPublicJson, safeText } from './net.mjs'
import { rid, splitRid } from './workspace.mjs'
import { APPROVED_SOURCE, CANONICAL_PROGRAM_SLUGS, approvedProgramsFilter } from '../vendor/lib/canonical-catalog.mjs'

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

/** A JWT role claim is config-derived text: show it only when it is a short plain word. */
const roleLabel = (role) => (role === null || role === undefined ? 'none' : typeof role === 'string' && /^[a-z_]{1,24}$/.test(role) ? role : 'unrecognized')

/**
 * Refuse anything that is not a public key. Accepted: a publishable key
 * (sb_publishable_...) or a JWT whose role is "anon". Hard refusal for
 * service-role / secret keys, any other role, and keys that cannot be decoded.
 */
export function assertPublicKey(key) {
  const d = describeKey(key)
  if (d.kind === 'secret') throw new CatalogKeyRefusal('That is a Supabase SECRET key. Only the public publishable (anon) key may be configured; nothing was saved or sent.', 'service_role')
  if (d.kind === 'jwt' && d.role === 'service_role') throw new CatalogKeyRefusal('That key carries role "service_role". Service-role keys are refused outright; only the public anon / publishable key may be configured. Nothing was sent.', 'service_role')
  if (d.kind === 'jwt' && d.role !== 'anon') throw new CatalogKeyRefusal(`That key carries role "${roleLabel(d.role)}". Only the public anon / publishable key may be configured; nothing was sent.`, roleLabel(d.role))
  if (d.kind === 'unknown') throw new CatalogKeyRefusal('That key is neither a publishable key (sb_publishable_...) nor an anon JWT, so its role cannot be checked. Nothing was sent.', null)
  return d
}

export const CATALOG_TABLES = Object.freeze({
  programs: 'programs', program_cycles: 'program_cycles', program_questions: 'program_questions', archived_questions: 'archived_questions',
  program_dna: 'program_dna', program_stats: 'program_stats', acceptance_reports: 'acceptance_reports',
})
const TABLE_NAME = /^[a-z_][a-z0-9_]{0,62}$/

/**
 * The ONE catalog configuration object parser (aqua-mcp-server uses it through
 * resolveCatalogConfig as well). `remote`: the document came over the network,
 * where it is untrusted: its origin must be https://<ref>.supabase.co and it
 * cannot rename tables. Local files and env stay the user's choice. Error
 * messages are fixed text; nothing from the document is echoed.
 */
export function parseConfigObject(cfg, { remote = false, base = {} } = {}) {
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) throw new CatalogNetworkError('the catalog configuration is not a JSON object', 'config')
  const url = cfg.supabase_url
  const key = cfg.publishable_key
  if (isPlaceholder(url) || isPlaceholder(key)) return { configured: false, ...base, reason_code: 'placeholders', reason: `the public catalog endpoint is not configured (placeholders in ${base.path ?? base.config_url ?? 'the configuration'})` }
  const origin = endpointOrigin(url)
  if (remote && !SUPABASE_ORIGIN_RE.test(origin)) throw new CatalogNetworkError('a remote catalog configuration must name an https://<ref>.supabase.co project', 'config')
  const d = assertPublicKey(key)
  const tables = { ...CATALOG_TABLES }
  if (cfg.tables !== undefined && !remote) {
    if (!cfg.tables || typeof cfg.tables !== 'object' || Array.isArray(cfg.tables)) throw new CatalogNetworkError('catalog config "tables" must be an object', 'config')
    for (const [logical, name] of Object.entries(cfg.tables)) {
      if (!(logical in CATALOG_TABLES)) continue
      if (typeof name !== 'string' || !TABLE_NAME.test(name)) throw new CatalogNetworkError('a catalog config table name is not a plain identifier', 'config')
      tables[logical] = name
    }
  }
  return { configured: true, ...base, origin, key: String(key).trim(), key_role: d.role, key_kind: d.kind, tables, project_ref: d.ref ?? (origin.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co$/)?.[1] ?? null) }
}

const OFFLINE = (ctx) => ctx.flags?.offline === true || ['1', 'true'].includes(String(ctx.env?.AQUA_CATALOG_OFFLINE ?? '').trim().toLowerCase())
const IS_URL = /^https?:\/\//i
const unconfigured = (source, reason_code, reason, extra = {}) => ({ configured: false, source, reason_code, reason, ...extra })

function readConfigFile(abs) {
  let raw
  try {
    const st = fs.statSync(abs)
    if (!st.isFile() || st.size > 64 * 1024) throw new Error('x')
    raw = fs.readFileSync(abs, 'utf8')
  } catch {
    return { error: unconfigured('file', 'unreadable', `no readable catalog config at ${abs}`, { path: abs }) }
  }
  try {
    return { value: JSON.parse(raw) }
  } catch {
    return { error: unconfigured('file', 'not_json', `the catalog config at ${abs} is not JSON`, { path: abs }) }
  }
}

/**
 * Synchronous configuration from a local file only (kept for the CLI's offline
 * paths and tests): --catalog-config F, AQUA_CATALOG_CONFIG, else the bundled file.
 */
export function loadCatalogConfig(ctx) {
  const explicit = ctx.flags?.['catalog-config'] ?? ctx.env?.AQUA_CATALOG_CONFIG ?? null
  const abs = path.resolve(ctx.cwd ?? process.cwd(), explicit ?? DEFAULT_CONFIG_PATH)
  const f = readConfigFile(abs)
  const base = { path: abs, source: explicit ? 'file' : 'bundled' }
  if (f.error) return { ...f.error, source: base.source }
  return parseConfigObject(f.value, { remote: false, base })
}

/**
 * THE catalog configuration resolver, shared by the companion and
 * aqua-mcp-server (which calls this, so the two can never diverge). Order:
 *   1. --catalog-config <file or https URL>
 *   2. AQUA_SUPABASE_URL + AQUA_PUBLISHABLE_KEY
 *   3. AQUA_CATALOG_CONFIG_URL (https URL)
 *   4. AQUA_CATALOG_CONFIG (local file)
 *   5. the bundled config/public-catalog.json when it holds real values
 *   6. --offline / AQUA_CATALOG_OFFLINE=1: not configured
 *   7. https://aquaidp.xyz/.well-known/aqua-catalog.json
 * Anything fetched over the network (3, a URL in 1, 7) is untrusted: it must
 * name https://<ref>.supabase.co and cannot rename tables. Key checks: only
 * anon / publishable (CatalogKeyRefusal otherwise). Result:
 * { configured, source, origin, key, key_role, key_kind, tables, reason_code, reason, ... }.
 * `reason` is fixed companion text (plus the user's own path/URL); text from a
 * remote document is never put into it.
 */
export async function resolveCatalogConfig(ctx, { fetchImpl } = {}) {
  const flags = ctx.flags ?? {}
  const env = ctx.env ?? {}
  const cwd = ctx.cwd ?? process.cwd()
  const flagValue = flags['catalog-config'] ? String(flags['catalog-config']) : null
  const remoteFetch = async (url, base) => {
    let doc
    try {
      doc = base.source === 'well-known' ? await getCatalogConfigJson({ fetchImpl }) : await getConfigJsonFromUrl(url, { fetchImpl })
    } catch (e) {
      return unconfigured(base.source, 'unreachable', `the public catalog configuration could not be loaded from ${base.config_url} (${safeText(e?.message)}); pass --catalog-config <file> to use a local copy`, { config_url: base.config_url })
    }
    try {
      return { ...parseConfigObject(doc, { remote: true, base }), version: doc?.version ?? null }
    } catch (e) {
      if (e instanceof CatalogKeyRefusal) throw e
      return unconfigured(base.source, 'invalid', `${base.config_url} did not return a usable catalog configuration (${safeText(e?.message)})`, { config_url: base.config_url })
    }
  }
  if (flagValue) {
    if (IS_URL.test(flagValue)) return remoteFetch(flagValue, { source: 'url', config_url: flagValue })
    const abs = path.resolve(cwd, flagValue)
    const f = readConfigFile(abs)
    if (f.error) return f.error
    return parseConfigObject(f.value, { base: { path: abs, source: 'file' } })
  }
  if (env.AQUA_SUPABASE_URL || env.AQUA_PUBLISHABLE_KEY) {
    return parseConfigObject({ supabase_url: env.AQUA_SUPABASE_URL, publishable_key: env.AQUA_PUBLISHABLE_KEY }, { base: { source: 'env' } })
  }
  if (env.AQUA_CATALOG_CONFIG_URL) return remoteFetch(env.AQUA_CATALOG_CONFIG_URL, { source: 'url', config_url: String(env.AQUA_CATALOG_CONFIG_URL) })
  if (env.AQUA_CATALOG_CONFIG) {
    const abs = path.resolve(cwd, String(env.AQUA_CATALOG_CONFIG))
    const f = readConfigFile(abs)
    if (f.error) return f.error
    return parseConfigObject(f.value, { base: { path: abs, source: 'file' } })
  }
  const bundled = loadCatalogConfig({ ...ctx, flags: {}, env: {} })
  if (bundled.configured) return bundled
  const config_url = `${CONFIG_ORIGIN}${CONFIG_PATH}`
  if (OFFLINE(ctx)) return unconfigured('well-known', 'offline', 'the public catalog endpoint is not configured (offline mode is set and no local config file was given)', { config_url })
  return remoteFetch(config_url, { source: 'well-known', config_url })
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
 * Validate catalog rows into the snapshot body. A program is approved, and
 * kept, on the same rule as the app's approvedProgramsFilter()
 * (app/lib/canonical-catalog.ts, vendored): its slug is in the approval
 * registry OR its source is 'canonical' (published by a curator through the
 * 058 promotion pipeline). `allowAnySlug` also keeps rows outside the
 * registry that carry no source at all (an exported file without the column);
 * a row with any other explicit source still needs a registry slug.
 */
export function sanitizeCatalog(raw, { allowAnySlug = false } = {}) {
  const allow = new Set(CANONICAL_PROGRAM_SLUGS)
  const programs = []
  for (const p of rows(raw?.programs, 'programs')) {
    const pid = id(p.id)
    const slug = id(p.slug)
    if (!pid || !slug || !str(p.name, 500)) continue
    const canonical = p.source === APPROVED_SOURCE
    if (!canonical && !allow.has(slug) && !(allowAnySlug && p.source === undefined)) continue
    programs.push({
      id: pid, slug, name: str(p.name, 500), organization: str(p.organization, 500), description: str(p.description, 10_000),
      url: str(p.url, 2000), apply_url: str(p.apply_url, 2000), deadline_at: iso(p.deadline_at), closes_at: iso(p.closes_at),
      opens_at: iso(p.opens_at), is_rolling: bool(p.is_rolling), status: str(p.status, 40), source: canonical ? APPROVED_SOURCE : str(p.source, 40),
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

/** Fetch approved public programs (registry slug OR source canonical) + cycles + questions. Sends table/column names and public ids only. */
export async function fetchPublicCatalog(cfg, { fetchImpl } = {}) {
  const programs = await pagedGet(cfg, 'programs', { select: PROGRAM_COLS, or: `(${approvedProgramsFilter()})`, order: 'slug.asc' }, fetchImpl)
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

export const DEFAULT_CATALOG_MAX_AGE_HOURS = 24

/** AQUA_CATALOG_MAX_AGE_HOURS (hours, >= 0; 0 = never auto-refresh). Default 24. */
export function catalogMaxAgeHours(env = {}) {
  const raw = env?.AQUA_CATALOG_MAX_AGE_HOURS
  if (raw === undefined || raw === null || String(raw).trim() === '') return DEFAULT_CATALOG_MAX_AGE_HOURS
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_CATALOG_MAX_AGE_HOURS
}

/** Why a cached catalog view should be refreshed ('empty' | 'stale'), or null. */
export function catalogNeedsRefresh(cat, { maxAgeHours = DEFAULT_CATALOG_MAX_AGE_HOURS, now = Date.now() } = {}) {
  if (maxAgeHours === 0) return null
  if (!cat?.snapshot || !cat.programs?.length) return 'empty'
  const at = Date.parse(cat.snapshot.fetched_at ?? '')
  if (!Number.isFinite(at) || now - at > maxAgeHours * 3600 * 1000) return 'stale'
  return null
}

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
      `read approved public programs (registry slug or source canonical), cycles and questions from ${cfg.origin} (read-only GET requests with the public publishable key)`,
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
      'only approved programs (slug in the approval registry, or source canonical: curator-published) and their public questions are kept',
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
