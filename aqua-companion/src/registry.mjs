// The AQUA agent tool registry: ONE place that owns the tool set, the
// workspace session and tier enforcement. The companion's own MCP server
// (mcp-server.mjs) is a thin JSON-RPC layer over it, and aqua-mcp-server 2.0
// imports the same factory, so both serve identical, identically enforced
// tools.
//
//   const reg = await createAquaToolRegistry({ workspace, readOnly })
//   reg.tools        -> [{ name, tier, title, description, inputSchema, annotations, handler(args) }]
//   reg.dispatch(n,a)-> { result, isError }   (result is the shaped tool result)
//
// Tier enforcement happens in Session.callTool, never in descriptions:
//   privileged / unknown  -> not callable (dispatch throws UnknownToolError)
//   private_write         -> refused in read-only mode, before the handler runs
//   human_consent         -> refused in read-only mode; acts only after the
//                            human confirms in the client UI (elicitation)
//   read, human_only      -> handler gets a workspace whose writes throw
// With no initialized workspace the server still starts: setup tools
// (locate_workspace, init_workspace, doctor) work, every other tool returns
// { status: 'workspace_not_initialized', next_steps }.

import fs from 'node:fs'
import path from 'node:path'
import { decryptWithKeys, macHex, nowIso, DecryptError } from './crypto.mjs'
import { mkdirInside } from './fsafe.mjs'
import { AGENT_LOG, INBOX_DIR, Workspace, WorkspaceError, keyCheckText } from './workspace.mjs'
import { buildSnapshot, catalogMaxAgeHours, catalogNeedsRefresh, fetchPublicCatalog, readCatalog, resolveCatalogConfig, saveSnapshot } from './catalog.mjs'
import { loadModel } from './mcp-model.mjs'
import { resolveSecrets } from './secrets.mjs'
import { warnEnvSecret } from './io.mjs'
import { cmdImportBackup, cmdInit } from './commands.mjs'
import { MAX_REVIEW_FILES, TIER, TOOL_MAP, TOOLS, ToolRefusal, UNTRUSTED_NOTICE, argsCanonical, validateArgs } from './mcp-tools.mjs'
import { defaultBase, initCommandFor, shellQuote } from './setup.mjs'

const MUTATORS = ['writeRecord', 'saveManifest', 'audit']

/**
 * WRITE POLICY (M7). Tiers are honest: only private_write tools write to the
 * workspace, and a tool handler never receives a writable workspace unless
 * its tier is private_write. The dispatcher enforces three explicit,
 * documented exceptions:
 *
 *   1. the agent audit log (audit/agent.jsonl): an append-only record of every
 *      call (HMACs of arguments, never content). It is written for every tool
 *      and ALSO under --read-only. It is the only workspace file that changes
 *      under --read-only.
 *   2. the PUBLIC catalog cache (catalog-cache/snapshots/): public data only,
 *      refreshed by the tools below through the dispatcher-owned
 *      t.persistCatalog(); the handlers themselves get a write-refusing
 *      workspace. Skipped under --read-only (kept in memory for the session).
 *   3. nothing else. present_review_decisions writes plaintext answers into an
 *      HTML file, so it is private_write (refused under --read-only).
 */
export const CATALOG_CACHE_WRITERS = Object.freeze(['refresh_catalog', 'discover_applications', 'get_application_details', 'match_canonical_questions'])
for (const tdef of TOOLS) {
  const mayWrite = tdef.tier === TIER.PRIVATE_WRITE || tdef.tier === TIER.HUMAN_CONSENT
  if (!mayWrite && (tdef.writes || tdef.autoRefreshCatalog || (tdef.network && !tdef.setup)) && !CATALOG_CACHE_WRITERS.includes(tdef.name)) {
    throw new Error(`tool ${tdef.name} is not private_write but is not on the documented write-exception list`)
  }
}
/** Error classes whose messages are built by companion code from fixed text (safe to show as server statements). */
const OWN_ERRORS = new Set(['WorkspaceError', 'DecryptError', 'KeyMismatchError', 'CatalogNetworkError', 'PathSafetyError', 'UsageError', 'EnvelopeError', 'CatalogKeyRefusal', 'HistoryImportError'])

export class UnknownToolError extends Error {
  constructor(name) {
    super(`Unknown tool: ${name}`)
    this.name = 'UnknownToolError'
  }
}

/** A workspace handle whose write methods throw: what read and human_only tools receive. */
function readOnlyView(ws, tier) {
  for (const m of MUTATORS) {
    ws[m] = () => {
      throw new ToolRefusal('tier_violation', `tier violation: ${tier} tools cannot write (${m})`)
    }
  }
  return ws
}

function sink() {
  let buf = ''
  return { write: (s) => { buf += s; return true }, get text() { return buf } }
}

export class Session {
  constructor(ctx, { readOnly = false, keychain = false, fetchImpl = undefined, exec = undefined, platform = undefined, elicit = null } = {}) {
    this.ctx = { flags: {}, cache: {}, ...ctx, env: ctx.env ?? {}, cwd: ctx.cwd ?? process.cwd(), stderr: ctx.stderr ?? process.stderr }
    this.readOnly = readOnly
    this.keychain = keychain
    this.fetchImpl = fetchImpl
    this.exec = exec
    this.platform = platform
    this.elicit = elicit
    this.keys = null
    this.catalogOverride = null
    this.catalogCfg = null
    this.autoRefreshFailedAt = 0
    this.root = null
    this.mode = 'not_initialized'
  }

  /** The configured workspace path (--workspace or AQUA_WORKSPACE), if any. */
  get workspaceFlag() {
    return this.ctx.flags.workspace ?? this.ctx.env.AQUA_WORKSPACE ?? null
  }

  /**
   * Locate the workspace, read secrets, derive keys once (fails fast on a
   * wrong or missing passphrase). No workspace at all is NOT an error: the
   * session starts in 'not_initialized' mode.
   */
  async init() {
    let ws
    try {
      ws = Workspace.open(this.ctx)
    } catch (e) {
      if (e instanceof WorkspaceError && e.exitCode === 2) {
        this.mode = 'not_initialized'
        return this
      }
      throw e
    }
    await this.unlockAt(ws)
    return this
  }

  async unlockAt(ws) {
    const secrets = resolveSecrets({ env: this.ctx.env, keychain: this.keychain, workspaceId: ws.manifest.workspace_id, exec: this.exec, platform: this.platform })
    this.passphrase = secrets.passphrase
    this.vaultSecret = secrets.vaultSecret
    this.secretSource = secrets.source
    if (secrets.source === 'env') warnEnvSecret(this.ctx, 'AQUA_PASSPHRASE') // M4: stderr only, never the secret
    await ws.unlock(this.passphrase)
    this.keys = ws.keys
    this.workspaceId = ws.manifest.workspace_id
    this.root = ws.root
    this.ctx.flags = { ...this.ctx.flags, workspace: ws.root }
    if (!this.readOnly) mkdirInside(ws.root, INBOX_DIR) // the drop folder for files the user hands to the agent (--read-only changes nothing)
    this.mode = 'ready'
  }

  /** Open an existing workspace at `root` (init_workspace found one, or just created it). */
  async attach(root) {
    const ws = Workspace.open({ ...this.ctx, flags: { ...this.ctx.flags, workspace: root } })
    await this.unlockAt(ws)
    return { root: this.root, workspace_id: this.workspaceId }
  }

  /** Create a workspace in `base` (consent already given in the client UI) and open it. */
  async createWorkspace(base) {
    const out = sink()
    const err = sink()
    const code = await runCommand(cmdInit, { ...this.ctx, flags: { path: base, yes: true }, env: { ...this.ctx.env }, stdin: { isTTY: false }, stdout: out, stderr: err })
    if (code !== 0) throw new WorkspaceError(err.text.replace(/^aqua-companion: /, '').trim() || 'init failed', code)
    const root = path.basename(base) === 'AQUA' ? base : path.join(base, 'AQUA')
    return this.attach(fs.realpathSync(root))
  }

  state() {
    return { mode: this.mode, root: this.root, workspace_id: this.workspaceId ?? null }
  }

  /** What setup tools receive (works with or without a workspace). */
  setupContext() {
    const self = this
    return {
      env: this.ctx.env, cwd: this.ctx.cwd, flags: this.ctx.flags, workspace: this.workspaceFlag, keychain: this.keychain, readOnly: this.readOnly,
      fetchImpl: this.fetchImpl, exec: this.exec, platform: this.platform, elicit: this.elicit,
      get elicitState() { return self.elicitState }, set elicitState(v) { self.elicitState = v },
      state: () => this.state(), attach: (root) => this.attach(root), createWorkspace: (base) => this.createWorkspace(base),
    }
  }

  /** Fresh view of the workspace for one call (the CLI may have changed it meanwhile). */
  async openWorkspace() {
    const ws = Workspace.open(this.ctx)
    if (ws.manifest.workspace_id !== this.workspaceId) throw new WorkspaceError('The workspace folder now holds a different workspace. Restart the server.', 4)
    if (ws.manifest.kdf.salt_b64 !== this.keys.salt_b64) {
      await ws.unlock(this.passphrase) // passphrase changed by rekey: derive again (fails if it no longer opens)
      this.keys = ws.keys
      return ws
    }
    ws.keys = this.keys
    let ok = false
    try {
      ok = (await decryptWithKeys(this.keys, ws.manifest.key_check)) === keyCheckText(ws.manifest.workspace_id)
    } catch {
      ok = false
    }
    if (!ok) throw new DecryptError('Wrong passphrase for this workspace.')
    if (ws.manifest.pending_rekey) throw new WorkspaceError('A passphrase change is unfinished; run "aqua-companion rekey" first.', 4)
    if ((await ws.manifestMac(ws.manifest)) !== ws.manifest.manifest_mac) {
      throw new WorkspaceError('workspace.json was changed outside the companion. Run "aqua-companion verify".', 4)
    }
    return ws
  }

  /** Catalog configuration (M09b: default from https://aquaidp.xyz/.well-known/aqua-catalog.json); cached per session. */
  async catalogConfig() {
    if (this.catalogCfg?.configured) return this.catalogCfg
    try {
      this.catalogCfg = await resolveCatalogConfig(this.ctx, { fetchImpl: this.fetchImpl })
    } catch (e) {
      this.catalogCfg = { configured: false, reason: e.message, refused: e?.name === 'CatalogKeyRefusal' }
    }
    return this.catalogCfg
  }

  /**
   * Catalog auto-refresh for the catalog read tools (discover_applications,
   * get_application_details, match_canonical_questions): when the cached
   * public catalog is empty or older than AQUA_CATALOG_MAX_AGE_HOURS (default
   * 24; 0 turns this off), fetch it with the same read-only, anon-key-only
   * path as refresh_catalog. The public cache is saved unless the server runs
   * --read-only (then it is kept for this session). Offline or unconfigured:
   * the cache is used as it is and the result says so. A failed attempt is
   * not retried for 5 minutes.
   */
  async catalogForRead(ws) {
    const cached = await readCatalog(ws, { override: this.catalogOverride })
    const maxAge = catalogMaxAgeHours(this.ctx.env)
    const need = catalogNeedsRefresh(cached, { maxAgeHours: maxAge, now: Date.now() })
    if (!need) return { cat: cached, refresh: { attempted: false, reason: maxAge === 0 ? 'disabled' : 'fresh', max_age_hours: maxAge } }
    if (Date.now() - this.autoRefreshFailedAt < 5 * 60 * 1000) return { cat: cached, refresh: { attempted: false, reason: 'recently_failed', stale_reason: need, max_age_hours: maxAge } }
    const cfg = await this.catalogConfig()
    if (!cfg.configured) return { cat: cached, refresh: { attempted: false, reason: 'not_configured', stale_reason: need, max_age_hours: maxAge, detail: cfg.reason } }
    try {
      const body = await fetchPublicCatalog(cfg, { fetchImpl: this.fetchImpl })
      const snap = await buildSnapshot(body, { origin: cfg.origin, kind: 'supabase-rest' })
      let persisted = false
      if (this.readOnly) this.catalogOverride = snap
      else {
        const writable = await this.openWorkspace()
        await saveSnapshot(writable, snap, { via: 'agent-auto-refresh' }) // exception 2: public catalog cache only
        persisted = true
        this.catalogOverride = null
      }
      return {
        cat: await readCatalog(ws, { override: snap }),
        refresh: { attempted: true, refreshed: true, persisted, stale_reason: need, origin: cfg.origin, programs: snap.programs.length, fetched_at: snap.fetched_at, max_age_hours: maxAge },
      }
    } catch (e) {
      this.autoRefreshFailedAt = Date.now()
      return { cat: cached, refresh: { attempted: true, refreshed: false, reason: 'offline', stale_reason: need, max_age_hours: maxAge, detail: String(e?.message ?? e).slice(0, 300) } }
    }
  }

  /** import-backup for sync_from_vault_export: the same code path as the CLI, with this session's secrets. */
  async importBackupFile(absFile, { account = null } = {}) {
    const out = sink()
    const err = sink()
    const code = await runCommand(cmdImportBackup, {
      ...this.ctx, flags: { workspace: this.root, yes: true, ...(account ? { account } : {}) }, env: { ...this.ctx.env, AQUA_PASSPHRASE: this.passphrase, AQUA_VAULT_SECRET: this.vaultSecret },
      stdin: { isTTY: false }, stdout: out, stderr: err,
    }, [absFile])
    return { code, out: out.text, err: err.text.replace(/^aqua-companion: /gm, '').trim() }
  }

  async audit(entry) {
    if (this.mode !== 'ready') return
    try {
      const ws = Workspace.open(this.ctx)
      await ws.audit('tool_call', entry, AGENT_LOG)
    } catch (e) {
      this.ctx.stderr.write(`aqua-companion mcp: could not write the agent audit log: ${e.message}\n`)
    }
  }

  notInitialized(name, tier) {
    const base = defaultBase(this.setupContext())
    return {
      result: shape(name, tier, {
        status: 'workspace_not_initialized',
        message: 'No AQUA workspace is open in this MCP server yet. Workspace tools work once one exists.',
        next_steps: [
          'Call locate_workspace to see where the companion looked.',
          `Call init_workspace (the user confirms the folder in the client UI), or ask the user to run in a terminal: ${initCommandFor(base)}`,
          `Then restart this server with --workspace ${shellQuote(path.join(base, 'AQUA'))}. Never ask the user for the passphrase in the conversation.`,
        ],
      }),
      isError: true,
    }
  }

  /** Run one tool. Returns { result, isError } or { unknown: true }. */
  async callTool(name, rawArgs) {
    const def = TOOL_MAP.get(name)
    if (!def || def.tier === TIER.PRIVILEGED) return { unknown: true }
    if (this.mode !== 'ready' && !def.setup) return this.notInitialized(name, def.tier)
    const started = nowIso()
    let result
    let isError = false
    let argsMac = null
    try {
      argsMac = this.keys ? (await macHex(this.keys, argsCanonical(rawArgs))).slice(0, 32) : null
    } catch {
      argsMac = null
    }
    const v = validateArgs(def.inputSchema, rawArgs)
    let catalogState = null
    if (!v.ok) {
      result = { status: 'invalid_arguments', errors: v.errors }
      isError = true
    } else if ((def.tier === TIER.PRIVATE_WRITE || def.tier === TIER.HUMAN_CONSENT) && this.readOnly) {
      result = { status: 'refused', reason: 'read_only', message: 'The server runs with --read-only: private writes are disabled. The user can restart it without --read-only to allow drafts, imports and evidence.' }
      isError = true
    } else {
      try {
        if (def.setup) {
          result = await def.handler(this.setupContext(), v.args)
        } else {
          let ws = await this.openWorkspace()
          if (def.tier !== TIER.PRIVATE_WRITE) ws = readOnlyView(ws, def.tier)
          const mayPersistCatalog = CATALOG_CACHE_WRITERS.includes(def.name) && !this.readOnly
          let model = null
          let catalog = null
          let catalogRefresh = null
          const t = {
            ws,
            readOnly: this.readOnly,
            exportsWritable: def.writes === 'exports' && def.tier === TIER.PRIVATE_WRITE && !this.readOnly,
            fetchImpl: this.fetchImpl,
            now: () => nowIso(),
            catalogConfig: () => this.catalogConfig(),
            /** Dispatcher-owned public-cache write (exception 2). Returns { persisted, changed }. */
            persistCatalog: async (snap) => {
              if (!mayPersistCatalog) {
                this.catalogOverride = snap
                catalog = null
                return { persisted: false, changed: false }
              }
              const writable = await this.openWorkspace()
              const { changed } = await saveSnapshot(writable, snap, { via: 'agent' })
              this.catalogOverride = null
              catalog = null
              return { persisted: true, changed }
            },
            setCatalogOverride: (snap) => { this.catalogOverride = snap; catalog = null },
            catalog: async () => {
              if (catalog) return catalog
              if (def.autoRefreshCatalog) {
                const r = await this.catalogForRead(ws)
                catalogRefresh = r.refresh
                return (catalog = r.cat)
              }
              return (catalog = await readCatalog(ws, { override: this.catalogOverride }))
            },
            catalogRefresh: () => catalogRefresh,
            model: async () => (model ??= await loadModel(ws, this.vaultSecret)),
            importBackupFile: (abs, o) => this.importBackupFile(abs, o),
          }
          catalogState = () => ({ refresh: catalogRefresh, cat: catalog })
          result = def.tier === TIER.HUMAN_ONLY ? await def.handler({ now: t.now }, v.args) : await def.handler(t, v.args)
        }
        if (result?.status === 'requires_human' && def.tier === TIER.HUMAN_CONSENT) isError = false
      } catch (e) {
        isError = true
        if (e instanceof ToolRefusal) result = { status: 'refused', reason: e.code, message: e.message, ...e.extra }
        else if (OWN_ERRORS.has(e?.name)) result = { status: 'error', error: e.name, message: e.message }
        else {
          // an unexpected error message may quote input text: keep it out of the trusted part
          result = { status: 'error', error: 'internal', message: 'The tool failed. The detail is in untrusted_content.', untrusted: { detail: String(e?.message ?? e).slice(0, 2000) } }
          if (this.ctx.env.AQUA_COMPANION_DEBUG && e?.stack) this.ctx.stderr.write(`${e.stack}\n`)
        }
      }
    }
    if (def.autoRefreshCatalog && catalogState && result && typeof result === 'object') {
      const { refresh, cat } = catalogState()
      if (refresh) result = { ...result, catalog_refresh: refresh }
      if (cat && !cat.programs.length && !cat.canonical_questions.length && !cat.vault_programs.length) {
        result = { ...result, catalog_empty: 'run refresh_catalog', catalog_empty_note: 'The public catalog cache is empty and could not be refreshed automatically (offline or not configured). Run refresh_catalog when online, or import a catalog file.' }
      }
    }
    await this.audit({ tool: name, tier: def.tier, args_mac: argsMac, result_status: result.status, read_only: this.readOnly, started_at: started })
    return { result: shape(name, def.tier, result), isError }
  }
}

async function runCommand(fn, ctx, args = []) {
  try {
    return (await fn(ctx, ...args)) ?? 0
  } catch (e) {
    const code = typeof e?.exitCode === 'number' ? e.exitCode : e?.name === 'DecryptError' ? 4 : 1
    ctx.stderr.write(`aqua-companion: ${e?.message ?? e}\n`)
    return code
  }
}

/** Final tool result: server structure first, file-derived text only under untrusted_content. */
export function shape(name, tier, result) {
  const { untrusted, ...rest } = result
  const outObj = { tool: name, tier, ...rest }
  if (untrusted !== undefined) outObj.untrusted_content = { notice: UNTRUSTED_NOTICE, data: untrusted }
  return outObj
}

/** MCP tool annotations for one definition (shared with tools/list). */
export function annotationsFor(tdef) {
  return {
    title: tdef.title,
    readOnlyHint: tdef.tier === TIER.READ && !tdef.writes && !tdef.network && !CATALOG_CACHE_WRITERS.includes(tdef.name),
    destructiveHint: false,
    idempotentHint: tdef.tier !== TIER.PRIVATE_WRITE && tdef.tier !== TIER.HUMAN_CONSENT,
    openWorldHint: Boolean(tdef.network || tdef.autoRefreshCatalog),
  }
}

/**
 * The stable hook for aqua-mcp-server 2.0 (and the companion's own server).
 *
 * @param {object} [opts]
 * @param {string} [opts.workspace]   workspace folder (default: AQUA_WORKSPACE, else search from cwd; none = not_initialized mode)
 * @param {boolean} [opts.readOnly]   refuse private_write and human_consent tools
 * @param {boolean} [opts.keychain]   read the passphrase from the macOS Keychain
 * @param {object} [opts.env]         environment for secrets (AQUA_PASSPHRASE, AQUA_VAULT_SECRET) and config; default process.env
 * @param {string} [opts.cwd]
 * @param {Function} [opts.fetchImpl] injectable fetch implementation, for tests
 * @param {Function} [opts.elicit]    async (params, { timeoutMs }) => { action, content }: MCP elicitation/create, when the client supports it
 * @param {object} [opts.stderr]
 * @returns {Promise<{ tools: Array<{name, tier, title, description, inputSchema, annotations, handler}>, dispatch: (name: string, args?: object) => Promise<{result: object, isError: boolean}>, session: Session, state: () => object, setElicitor: (fn) => void }>}
 */
export async function createAquaToolRegistry({ workspace, flags = {}, readOnly = false, keychain = false, env = process.env, cwd = process.cwd(), fetchImpl, elicit = null, stderr = process.stderr, exec, platform } = {}) {
  const session = await new Session({ env, cwd, stderr, flags: { ...flags, ...(workspace ? { workspace } : {}) } }, { readOnly, keychain, fetchImpl, elicit, exec, platform }).init()
  const dispatch = async (name, args = {}) => {
    const r = await session.callTool(name, args)
    if (r.unknown) throw new UnknownToolError(name)
    return r
  }
  const tools = TOOLS.map((tdef) => ({
    name: tdef.name, tier: tdef.tier, title: tdef.title, description: tdef.description, inputSchema: tdef.inputSchema,
    annotations: annotationsFor(tdef), setup: Boolean(tdef.setup),
    handler: (args) => dispatch(tdef.name, args),
  }))
  return { tools, dispatch, session, state: () => session.state(), setElicitor: (fn) => { session.elicit = fn } }
}

/**
 * A standalone setup context for SETUP_TOOLS (aqua-mcp-server 2.0 no-workspace
 * mode): `await tool.handler(await createSetupContext(opts), args)`. Same
 * options as createAquaToolRegistry. After init_workspace succeeds, the
 * returned context's state() reports the new workspace.
 */
export async function createSetupContext(opts = {}) {
  const reg = await createAquaToolRegistry(opts)
  return reg.session.setupContext()
}
