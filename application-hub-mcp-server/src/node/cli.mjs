// `aqua-mcp-server [--workspace <dir>] [--read-only] [--keychain] [--catalog-config <file|url>] [--offline]`
// `aqua-mcp-server companion <command> ...`   (the bundled aqua-companion CLI)
//
// MCP over stdio (newline-delimited JSON-RPC 2.0), on the aqua-companion's
// tool registry. Two modes, chosen by whether a workspace is open:
//   workspace open (--workspace, AQUA_WORKSPACE, or found from the current
//     folder): the companion's tiered tools on that encrypted workspace, plus
//     the public catalog tools;
//   none yet: the companion's setup tools (locate_workspace, init_workspace,
//     doctor) plus the public catalog tools. init_workspace switches modes.
// It never holds an account token or a privileged key. The only credential
// is the public publishable key; any other key stops startup. `main` returns
// an exit code and never calls process.exit, so tests drive it in-process.

import readline from 'node:readline'
import { main as companionMain } from '../vendor/companion/src/cli.mjs'
import { CANONICAL_PROGRAM_SLUGS } from '../vendor/companion/vendor/lib/canonical-catalog.mjs'
import { KeyRefusal } from '../catalog/key.mjs'
import { CatalogClient } from '../catalog/rest.mjs'
import { CatalogData } from '../catalog/data.mjs'
import { McpDispatcher, PACKAGE_VERSION } from '../catalog/protocol.mjs'
import { resolveCatalogConfig } from './config.mjs'
import { createCompanionBackend } from './companion.mjs'

export const HELP = `aqua-mcp-server ${PACKAGE_VERSION}: the AQUA MCP server (stdio)

Usage
  aqua-mcp-server                          public catalog tools + workspace setup tools (or the workspace found from here)
  aqua-mcp-server --workspace <dir>        full tool set on one local AQUA workspace
  aqua-mcp-server companion <command> ...  the bundled aqua-companion CLI (init, import-backup, ...)

Options
  --workspace DIR          workspace folder (or AQUA_WORKSPACE)
  --read-only              refuse every private write (drafts, imports, evidence)
  --keychain               read the workspace passphrase from the macOS Keychain
  --catalog-config F|URL   public catalog config (file or https URL)
  --offline                do not fetch the catalog config
  --no-catalog             exclude the public catalog tools (workspace-only plugin surface)
  --version, --help

Environment
  AQUA_PASSPHRASE          workspace passphrase (workspace mode; or --keychain)
  AQUA_CATALOG_CONFIG_URL  catalog config URL (default https://aquaidp.xyz/.well-known/aqua-catalog.json)
  AQUA_CATALOG_CONFIG      catalog config file
  AQUA_SUPABASE_URL + AQUA_PUBLISHABLE_KEY   catalog endpoint directly (public key only)

Approvals, signatures, packet export and submission happen in the AQUA browser app.
Hosted read-only endpoint: https://aquaidp.xyz/mcp
`

const BOOLEAN = new Set(['read-only', 'keychain', 'offline', 'help', 'version', 'no-catalog'])

function parse(argv) {
  const flags = {}
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-h') flags.help = true
    else if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      const name = eq > 0 ? a.slice(2, eq) : a.slice(2)
      if (BOOLEAN.has(name)) flags[name] = eq > 0 ? a.slice(eq + 1) !== 'false' : true
      else if (eq > 0) flags[name] = a.slice(eq + 1)
      else {
        const v = argv[i + 1]
        if (v === undefined || v.startsWith('--')) throw Object.assign(new Error(`--${name} needs a value`), { exitCode: 2 })
        flags[name] = v
        i++
      }
    } else rest.push(a)
  }
  return { flags, rest }
}

/** Build the backend. Throws KeyRefusal / startup errors (a wrong passphrase stops startup). */
export async function buildBackend({ flags, env, cwd, stderr, fetchImpl = globalThis.fetch, registry }) {
  if (String(env.TRANSPORT ?? '').toLowerCase() === 'http') {
    throw Object.assign(new Error('TRANSPORT=http was removed in aqua-mcp-server 2.0 (it served unauthenticated writes). Use stdio locally, or the read-only hosted endpoint https://aquaidp.xyz/mcp.'), { exitCode: 2 })
  }
  const conf = await resolveCatalogConfig({ flags, env, cwd, fetchImpl })
  const data = conf.configured ? new CatalogData(new CatalogClient(conf.cfg, { fetchImpl }), { allowSlugs: [...CANONICAL_PROGRAM_SLUGS] }) : null
  const backend = await createCompanionBackend({
    workspace: flags.workspace ?? env.AQUA_WORKSPACE, readOnly: Boolean(flags['read-only']), keychain: Boolean(flags.keychain),
    // the companion resolves the catalog through the SAME resolver (below), from the same flags and env
    flags: { ...(flags['catalog-config'] ? { 'catalog-config': flags['catalog-config'] } : {}), ...(flags.offline ? { offline: true } : {}), ...(flags['no-catalog'] ? { 'no-catalog': true } : {}) },
    env, cwd, fetchImpl, stderr, data, registry,
  })
  return { backend, conf }
}

/** True for a JSON-RPC response (to one of our requests), parsed. */
function asResponse(line) {
  try {
    const m = JSON.parse(line)
    return m && typeof m === 'object' && !Array.isArray(m) && !('method' in m) && ('result' in m || 'error' in m) ? m : null
  } catch {
    return null
  }
}

/**
 * Serve newline-delimited JSON-RPC until stdin closes. Requests run one at a
 * time (no concurrent workspace writes); responses to our own requests
 * (elicitation) are routed at once so a waiting tool call can finish.
 */
export async function serveStdio(dispatcher, { stdin }) {
  const rl = readline.createInterface({ input: stdin, crlfDelay: Infinity, terminal: false })
  let chain = Promise.resolve()
  rl.on('line', (line) => {
    if (!line.trim()) return
    const resp = asResponse(line)
    if (resp) return dispatcher.handleResponse(resp)
    chain = chain.then(async () => {
      const r = await dispatcher.handleLine(line)
      if (r) dispatcher.send(r)
    })
  })
  await new Promise((resolve) => rl.on('close', resolve))
  await chain
}

export async function main(argv, io = {}) {
  const env = io.env ?? process.env
  const cwd = io.cwd ?? process.cwd()
  const stdin = io.stdin ?? process.stdin
  const stdout = io.stdout ?? process.stdout
  const stderr = io.stderr ?? process.stderr
  if (argv[0] === 'companion') return companionMain(argv.slice(1), { env, cwd, stdin, stdout, stderr })
  let parsed
  try {
    parsed = parse(argv)
  } catch (e) {
    stderr.write(`${e.message}\n`)
    return 2
  }
  const { flags, rest } = parsed
  if (flags.version) {
    stdout.write(`${PACKAGE_VERSION}\n`)
    return 0
  }
  if (flags.help || rest.length) {
    stdout.write(HELP)
    return rest.length ? 2 : 0
  }
  let built
  try {
    built = await buildBackend({ flags, env, cwd, stderr, fetchImpl: io.fetchImpl ?? globalThis.fetch, registry: io.registry })
  } catch (e) {
    if (e instanceof KeyRefusal) {
      stderr.write(`aqua-mcp-server: ${e.message} Nothing was sent.\n`)
      return 2
    }
    stderr.write(`aqua-mcp-server: ${e?.message ?? e}\n`)
    return typeof e?.exitCode === 'number' ? e.exitCode : e?.name === 'DecryptError' ? 4 : 1
  }
  const { backend, conf } = built
  const mode = backend.mode()
  stderr.write(`aqua-mcp-server ${PACKAGE_VERSION}: ${mode}${mode === 'stdio-catalog' ? ' (no workspace open: setup tools locate_workspace, init_workspace, doctor)' : ''}; ${backend.toolDefs().length} tools; catalog ${conf.configured ? `configured (${conf.source.split(':')[0]})` : `not configured (${conf.reason})`}${flags['read-only'] ? '; read-only' : ''}\n`)
  const send = (obj) => stdout.write(`${JSON.stringify(obj)}\n`)
  await serveStdio(new McpDispatcher(backend, { requireInitialize: true, allowBatch: true, send, listChanged: true }), { stdin })
  return 0
}
