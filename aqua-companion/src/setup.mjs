// M09b — the setup tools that work BEFORE a workspace exists:
//   locate_workspace  (read)          where the workspace is / would be
//   init_workspace    (human_consent) create one, only after the human
//                                     confirms the folder and consent in the
//                                     client UI (MCP elicitation/create);
//                                     otherwise returns requires_human with
//                                     the exact `aqua-companion init` command
//   doctor            (read, network) configuration, connectivity,
//                                     canonical-only read, workspace and
//                                     keychain status; never throws
// The passphrase never travels through the model or tool arguments: an
// agent-initiated init uses AQUA_PASSPHRASE from the SERVER's environment
// (set by the user in the client config), never a tool argument or an
// elicitation field. Without it, init stays a terminal step for the human.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { COMPANION_VERSION, MANIFEST, isWorkspaceManifest, readManifestAt } from './workspace.mjs'
import { resolveCatalogConfig } from './catalog.mjs'
import { getPublicJson } from './net.mjs'
import { KEYCHAIN_SERVICE, keychainRead } from './secrets.mjs'
import { CANONICAL_PROGRAM_SLUGS } from '../vendor/lib/canonical-catalog.mjs'

export const INIT_COMMAND = 'aqua-companion init --path'
const ELICIT_TIMEOUT_MS = 10 * 60 * 1000

/** POSIX shell quoting for a path shown in a command the user copies. */
export function shellQuote(p) {
  return /^[A-Za-z0-9_./~:@%+=-]+$/.test(p) ? p : `'${String(p).replace(/'/g, `'\\''`)}'`
}

function expandHome(p) {
  if (p === '~') return os.homedir()
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2))
  return p
}

/** Folder in which `AQUA/` is created by default: the configured path, else ~/Documents (or ~). */
export function defaultBase(s) {
  if (s.workspace) {
    const abs = path.resolve(s.cwd, expandHome(s.workspace))
    return path.basename(abs) === 'AQUA' ? path.dirname(abs) : abs
  }
  const docs = path.join(os.homedir(), 'Documents')
  return fs.existsSync(docs) ? docs : os.homedir()
}

function probe(dir) {
  const has = fs.existsSync(path.join(dir, MANIFEST))
  let id = null
  if (has) {
    try {
      const m = readManifestAt(dir)
      if (m && isWorkspaceManifest(m)) id = m.workspace_id
    } catch {
      id = null
    }
  }
  return { path: dir, exists: fs.existsSync(dir), is_workspace: Boolean(id), workspace_id: id }
}

/** Candidate folders, in the order the companion looks. */
export function workspaceCandidates(s) {
  const out = []
  const push = (p, why) => {
    if (!out.some((c) => c.path === p)) out.push({ ...probe(p), why })
  }
  if (s.workspace) {
    const abs = path.resolve(s.cwd, expandHome(s.workspace))
    push(abs, 'configured (--workspace / AQUA_WORKSPACE)')
    push(path.join(abs, 'AQUA'), 'configured folder + AQUA/')
  }
  let cur = path.resolve(s.cwd)
  for (let i = 0; i < 6; i++) {
    push(cur, 'current folder or a parent')
    push(path.join(cur, 'AQUA'), 'current folder or a parent + AQUA/')
    const parent = path.dirname(cur)
    if (parent === cur) break
    cur = parent
  }
  push(path.join(os.homedir(), 'Documents', 'AQUA'), 'default location')
  push(path.join(os.homedir(), 'AQUA'), 'home folder')
  return out
}

export function initCommandFor(base) {
  return `${INIT_COMMAND} ${shellQuote(base)}`
}

/** The same command without an installed companion (the self-hosted tarball, until npm publication). */
export function npxInitCommandFor(base) {
  return `npx --yes https://aquaidp.xyz/companion/aqua-companion-${COMPANION_VERSION}.tgz init --path ${shellQuote(base)}`
}

function nextStepsUninitialized(base, s) {
  return [
    `Ask the user to create the workspace. Either call init_workspace (the user confirms the folder in your client's UI), or the user runs in a terminal: ${initCommandFor(base)}`,
    'The user chooses the workspace passphrase in that terminal prompt. Never ask the user for the passphrase in the conversation.',
    `Then restart this MCP server with --workspace ${shellQuote(path.join(base, 'AQUA'))}${s.keychain ? ' --keychain' : ''} (or set AQUA_WORKSPACE).`,
  ]
}

/** locate_workspace handler (read). */
export async function locateWorkspace(s) {
  const state = s.state()
  const base = defaultBase(s)
  const candidates = workspaceCandidates(s)
  const found = candidates.find((c) => c.is_workspace) ?? null
  const result = {
    status: state.mode === 'ready' ? 'ready' : state.mode === 'locked' ? 'workspace_locked' : found ? 'found_not_open' : 'workspace_not_initialized',
    mode: state.mode,
    workspace_root: state.root ?? found?.path ?? null,
    workspace_id: state.workspace_id ?? found?.workspace_id ?? null,
    configured_path: s.workspace ?? null,
    suggested_init_folder: base,
    suggested_init_command: initCommandFor(base),
    candidates: candidates.map(({ path: p, exists, is_workspace, why }) => ({ path: p, exists, is_workspace, why })),
  }
  if (state.mode === 'ready') result.next_steps = ['The workspace is open. Use discover_applications or import_history next.']
  else if (state.mode === 'locked') result.next_steps = [state.reason ?? 'The workspace exists but the server has no passphrase for it.', 'The user sets AQUA_PASSPHRASE in the MCP server environment, or starts it with --keychain (macOS). Never ask for the passphrase in the conversation.']
  else if (found) result.next_steps = [`A workspace exists at ${found.path}. Restart this MCP server with --workspace ${shellQuote(found.path)} so it opens it.`]
  else result.next_steps = nextStepsUninitialized(base, s)
  return result
}

/** Refusal reason when `root` cannot be created as a fresh workspace (null = fine). */
function freshRootProblem(root) {
  if (!fs.existsSync(root)) return null
  const st = fs.lstatSync(root)
  if (st.isSymbolicLink()) return `${root} is a symlink; choose a real folder.`
  if (!st.isDirectory()) return `${root} exists and is not a folder.`
  const m = readManifestAt(root)
  if (m && isWorkspaceManifest(m)) return 'exists'
  if (fs.readdirSync(root).filter((n) => n !== '.DS_Store').length) return `${root} already exists and is not empty.`
  return null
}

function elicitSchema(base) {
  return {
    type: 'object',
    properties: {
      folder: { type: 'string', title: 'Folder', description: 'An AQUA/ folder is created inside this folder. Nothing existing is changed.', default: base, minLength: 1, maxLength: 1000 },
      consent: { type: 'boolean', title: 'Create an encrypted AQUA workspace here and let this agent work in it', description: 'Private records are encrypted with the passphrase already set for this server (AQUA_PASSPHRASE). The agent can read what its tools return; approvals stay in the AQUA browser.', default: false },
    },
    required: ['folder', 'consent'],
  }
}

/** init_workspace handler (human_consent). */
export async function initWorkspaceTool(s, args) {
  const state = s.state()
  if (state.mode === 'ready') return { status: 'already_initialized', workspace_root: state.root, workspace_id: state.workspace_id }
  const base = path.resolve(s.cwd, expandHome(args.folder ?? defaultBase(s)))
  const command = initCommandFor(base)
  const human = (reason, extra = {}) => ({
    status: 'requires_human', reason, command, npx_command: npxInitCommandFor(base),
    how: [
      `The user runs in a terminal: ${command} (without an installed companion: ${npxInitCommandFor(base)})`,
      'The companion explains what it creates, asks the user to type "yes", and asks for a new passphrase without echo. Never ask the user for the passphrase in the conversation.',
      `Then the user restarts this MCP server with --workspace ${shellQuote(path.join(base, 'AQUA'))}${s.keychain ? ' --keychain' : ''} (Claude Code: claude mcp remove aqua, then claude mcp add again).`,
    ],
    ...extra,
  })
  if (!s.elicit) return human('This MCP client does not support elicitation, so the user cannot confirm the folder in the client UI. Creating a workspace needs the user\'s own confirmation.')
  const passphrase = s.env?.AQUA_PASSPHRASE
  if (!passphrase || passphrase.length < 8) {
    return human('The workspace passphrase is chosen by the user in a terminal prompt. This server has no AQUA_PASSPHRASE in its environment, and a passphrase never travels through the agent or a tool argument.')
  }
  let response
  try {
    response = await s.elicit({
      message: `Create an encrypted AQUA workspace? The companion will create an AQUA/ folder inside the folder below (nothing existing is changed) and let this agent stage drafts there. Approvals stay in the AQUA browser. Edit the folder if you want it elsewhere.`,
      requestedSchema: elicitSchema(base),
    }, { timeoutMs: ELICIT_TIMEOUT_MS })
  } catch (e) {
    return human(`The confirmation request failed (${e?.message ?? e}).`)
  }
  if (!response || response.action !== 'accept' || response.content?.consent !== true) {
    return { status: 'declined', action: response?.action ?? 'cancel', created: false, message: 'The user did not confirm. Nothing was created.' }
  }
  const raw = String(response.content.folder ?? '').trim()
  if (!raw) return { status: 'declined', created: false, message: 'No folder was given. Nothing was created.' }
  const confirmedBase = path.resolve(s.cwd, expandHome(raw))
  if (!path.isAbsolute(expandHome(raw)) && !raw.startsWith('~')) {
    return { status: 'refused', reason: 'relative_path', created: false, message: 'Please confirm an absolute folder path. Nothing was created.' }
  }
  const root = path.basename(confirmedBase) === 'AQUA' ? confirmedBase : path.join(confirmedBase, 'AQUA')
  const problem = freshRootProblem(root)
  if (problem === 'exists') {
    const m = readManifestAt(root)
    const attached = await s.attach(root).catch((e) => ({ error: e.message }))
    return { status: 'workspace_exists', created: false, workspace_root: root, workspace_id: m?.workspace_id ?? null, opened: !attached?.error, ...(attached?.error ? { message: attached.error } : {}) }
  }
  if (problem) return { status: 'refused', reason: 'not_fresh', created: false, message: `${problem} Nothing was changed.` }
  const created = await s.createWorkspace(confirmedBase)
  return {
    status: 'initialized', created: true, workspace_root: created.root, workspace_id: created.workspace_id,
    consent: { via: 'elicitation', confirmed_folder: confirmedBase },
    next_steps: [
      'Ask the user to export an encrypted backup from the AQUA browser (AQUA Local) into the workspace inbox/ folder, then call sync_from_vault_export with its file name.',
      'Or, to load past submitted applications, the user copies them into inbox/<folder>/ and you call import_history.',
      `To reopen this workspace later, the server needs --workspace ${shellQuote(created.root)}.`,
    ],
  }
}

/** doctor: never throws; every check reports ok / warn / fail with a message. */
export async function doctorReport(s, { live = true } = {}) {
  const checks = []
  const add = (name, status, message, extra = {}) => checks.push({ name, status, message, ...extra })
  const [major] = process.versions.node.split('.').map(Number)
  add('node', major >= 22 ? 'ok' : 'fail', `Node.js ${process.versions.node}${major >= 22 ? '' : ' (22 or newer is required)'}`)
  add('companion', 'ok', `aqua-companion ${COMPANION_VERSION}`)
  let cfg = null
  try {
    cfg = await resolveCatalogConfig({ flags: s.flags ?? {}, env: s.env ?? {}, cwd: s.cwd }, { fetchImpl: live ? s.fetchImpl : async () => { throw new Error('offline check') } })
    if (cfg.configured) add('catalog_config', 'ok', `public catalog ${cfg.origin} from ${cfg.source}${cfg.config_url ? ` (${cfg.config_url})` : cfg.path ? ` (${cfg.path})` : ''}; key ${cfg.key_kind} role ${cfg.key_role}`, { source: cfg.source, origin: cfg.origin, key_role: cfg.key_role, project_ref: cfg.project_ref ?? null })
    else add('catalog_config', 'warn', cfg.reason, { source: cfg.source ?? null })
  } catch (e) {
    add('catalog_config', 'fail', e?.message ?? String(e), { refused: e?.name === 'CatalogKeyRefusal' })
  }
  if (cfg?.configured && live) {
    try {
      const slugs = [...CANONICAL_PROGRAM_SLUGS]
      const q = new URLSearchParams({ select: 'id,slug,source', source: 'eq.canonical', slug: `in.(${slugs.map((x) => `"${x}"`).join(',')})`, limit: '1000' })
      const rows = await getPublicJson(cfg.origin, `/rest/v1/programs?${q}`, cfg.key, { fetchImpl: s.fetchImpl })
      const list = Array.isArray(rows) ? rows : []
      const nonCanonical = list.filter((r) => r?.source !== 'canonical').length
      add('connectivity', 'ok', `reached ${cfg.origin} with the public key`)
      add('canonical_read', nonCanonical ? 'fail' : list.length ? 'ok' : 'warn', `${list.length} approved canonical program(s) readable${nonCanonical ? `; ${nonCanonical} non-canonical row(s) returned` : ''}`, { programs: list.length, registry: slugs.length })
    } catch (e) {
      add('connectivity', 'fail', e?.message ?? String(e))
    }
  } else if (!live) add('connectivity', 'warn', 'skipped (offline check)')
  const state = s.state()
  if (state.mode === 'ready') add('workspace', 'ok', `workspace ${state.workspace_id} open at ${state.root}`, { root: state.root, workspace_id: state.workspace_id })
  else if (state.mode === 'locked') add('workspace', 'warn', state.reason ?? 'workspace found but not unlocked', { root: state.root })
  else {
    const found = workspaceCandidates(s).find((c) => c.is_workspace)
    add('workspace', 'warn', found ? `a workspace exists at ${found.path} but this process has not opened it` : `no workspace yet; create one with ${initCommandFor(defaultBase(s))}`, { root: found?.path ?? null })
  }
  if (process.platform === 'darwin') {
    const id = state.workspace_id ?? workspaceCandidates(s).find((c) => c.is_workspace)?.workspace_id ?? null
    if (!id) add('keychain', 'warn', 'no workspace id yet; after init add the passphrase with: security add-generic-password -s aqua-companion -a <workspace id> -w')
    else {
      let has = false
      try {
        has = Boolean(keychainRead(id, { exec: s.exec, platform: s.platform }))
      } catch {
        has = false
      }
      add('keychain', has ? 'ok' : 'warn', has ? `Keychain item ${KEYCHAIN_SERVICE}/${id} found` : `no Keychain item ${KEYCHAIN_SERVICE}/${id}; add one with: security add-generic-password -s ${KEYCHAIN_SERVICE} -a ${id} -w`)
    }
  } else add('keychain', 'warn', 'the macOS Keychain is not available on this platform; use AQUA_PASSPHRASE in the server environment')
  const worst = checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'ok'
  return { status: 'ok', overall: worst, checks }
}
