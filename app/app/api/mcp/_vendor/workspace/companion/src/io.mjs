// VENDORED from application-hub-mcp-server/src/vendor/companion/src/io.mjs. Do not edit: change the source and run
// `npm run vendor:hosted` in application-hub-mcp-server/ (CI checks these copies).
// VENDORED from aqua-companion/src/io.mjs. Do not edit: change the source and run
// `npm run vendor:companion` in application-hub-mcp-server/ (CI checks these copies).
// Terminal I/O: consent prompts and no-echo passphrase entry.
// Consent rule: every write prints its plan first, then needs either an
// interactive "yes" on a terminal or an explicit `--yes`. Without a terminal
// and without --yes, the command refuses (exit 3) and writes nothing.
// Passphrases come from AQUA_PASSPHRASE / AQUA_VAULT_SECRET /
// AQUA_NEW_PASSPHRASE or a no-echo prompt. They are never printed, logged,
// or written to disk.

import readline from 'node:readline'

export class ConsentError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ConsentError'
    this.exitCode = 3
  }
}

export class UsageError extends Error {
  constructor(message) {
    super(message)
    this.name = 'UsageError'
    this.exitCode = 2
  }
}

export function out(ctx, text = '') {
  ctx.stdout.write(`${text}\n`)
}

export function err(ctx, text = '') {
  ctx.stderr.write(`${text}\n`)
}

function isTty(ctx) {
  return Boolean(ctx.stdin && ctx.stdin.isTTY && typeof ctx.stdin.setRawMode === 'function')
}

function askLine(ctx, question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: ctx.stdin, output: ctx.stderr, terminal: true })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

/**
 * Show the plan and get consent. `word` is what the user must type.
 * Returns false for --dry-run (caller stops without writing).
 */
export async function confirmPlan(ctx, title, lines, { word = 'yes' } = {}) {
  out(ctx, `Plan: ${title}`)
  for (const l of lines) out(ctx, `  - ${l}`)
  if (ctx.flags['dry-run']) {
    out(ctx, 'Dry run: nothing was written.')
    return false
  }
  if (ctx.flags.yes) {
    out(ctx, 'Confirmed with --yes.')
    return true
  }
  if (!isTty(ctx)) {
    throw new ConsentError(
      'This command writes files and needs your confirmation. Re-run it in a terminal, or add --yes to confirm the plan above.',
    )
  }
  const answer = await askLine(ctx, `Type "${word}" to continue: `)
  if (answer.trim().toLowerCase() !== word.toLowerCase()) {
    throw new ConsentError('Not confirmed. Nothing was written.')
  }
  return true
}

function promptHidden(ctx, question) {
  return new Promise((resolve, reject) => {
    const stdin = ctx.stdin
    ctx.stderr.write(question)
    let buf = ''
    const wasRaw = stdin.isRaw
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    const finish = (fn) => {
      stdin.removeListener('data', onData)
      stdin.setRawMode(wasRaw)
      stdin.pause()
      ctx.stderr.write('\n')
      fn()
    }
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') return finish(() => resolve(buf))
        if (ch === '\u0003') return finish(() => reject(new ConsentError('Cancelled.')))
        if (ch === '\u007f' || ch === '\b') buf = buf.slice(0, -1)
        else buf += ch
      }
    }
    stdin.on('data', onData)
  })
}

// M09 hardening M4 — a secret in the environment is readable by every
// process that inherits it (CI runners, agent shells, tool subprocesses, crash
// reporters). Under CI or a coding agent we say so on stderr (never stdout,
// never the secret itself) and point at --keychain / the interactive prompt.
export const AGENT_ENV_MARKERS = Object.freeze([
  'CI', 'GITHUB_ACTIONS', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CODEX_SANDBOX', 'CURSOR_TRACE_ID', 'AIDER_MODEL', 'GEMINI_CLI',
])

/** The CI/agent marker variables present in `env` (non-empty, not "0"/"false"). */
export function agentEnvMarkers(env = {}) {
  return AGENT_ENV_MARKERS.filter((k) => {
    const v = env[k]
    return typeof v === 'string' && v !== '' && v !== '0' && v.toLowerCase() !== 'false'
  })
}

/** Warning text when `name` came from the environment under CI/an agent; null otherwise. */
export function envSecretWarning(env, name) {
  const markers = agentEnvMarkers(env)
  if (!markers.length) return null
  return `aqua-companion: warning: ${name} was read from the environment while running under ${markers.join('/')}. ` +
    'Environment variables are visible to the agent, its tools and child processes. ' +
    'Prefer --keychain (mcp, macOS) or the interactive no-echo prompt. See docs/AGENT.md "Passphrase".'
}

/** Print the env-secret warning once per process context. */
export function warnEnvSecret(ctx, name) {
  const w = envSecretWarning(ctx.env ?? {}, name)
  if (!w) return
  ctx.cache = ctx.cache ?? {}
  ctx.cache.envSecretWarned = ctx.cache.envSecretWarned ?? new Set()
  if (ctx.cache.envSecretWarned.has(name)) return
  ctx.cache.envSecretWarned.add(name)
  try { ctx.stderr?.write(`${w}\n`) } catch { /* stderr closed — never fail on a warning */ }
}

/** Workspace passphrase (existing workspace). */
export async function getPassphrase(ctx) {
  if (ctx.cache.passphrase) return ctx.cache.passphrase
  let p = ctx.env.AQUA_PASSPHRASE
  if (p) warnEnvSecret(ctx, 'AQUA_PASSPHRASE')
  if (!p) {
    if (!isTty(ctx)) throw new UsageError('Workspace passphrase needed: set AQUA_PASSPHRASE or run in a terminal.')
    p = await promptHidden(ctx, 'Workspace passphrase: ')
  }
  if (!p) throw new UsageError('Empty passphrase.')
  ctx.cache.passphrase = p
  return p
}

/** New passphrase (init / rekey): env or prompt twice. */
export async function getNewPassphrase(ctx, envName = 'AQUA_PASSPHRASE') {
  let p = ctx.env[envName]
  if (p) warnEnvSecret(ctx, envName)
  if (!p) {
    if (!isTty(ctx)) throw new UsageError(`New passphrase needed: set ${envName} or run in a terminal.`)
    p = await promptHidden(ctx, 'New workspace passphrase: ')
    const again = await promptHidden(ctx, 'Repeat passphrase: ')
    if (p !== again) throw new UsageError('Passphrases did not match.')
  }
  if (p.length < 8) throw new UsageError('Choose a passphrase of at least 8 characters.')
  return p
}

/**
 * The browser vault secret (decrypts vault envelopes; encrypts exports so the
 * browser Restore panel accepts them). Defaults to the workspace passphrase.
 */
export async function getVaultSecret(ctx) {
  if (ctx.cache.vaultSecret) return ctx.cache.vaultSecret
  let s = ctx.env.AQUA_VAULT_SECRET
  if (s) warnEnvSecret(ctx, 'AQUA_VAULT_SECRET')
  if (!s && isTty(ctx) && !ctx.env.AQUA_PASSPHRASE) {
    s = await promptHidden(ctx, 'Browser vault secret (press Enter if it is the same as the workspace passphrase): ')
  }
  if (!s) s = await getPassphrase(ctx)
  ctx.cache.vaultSecret = s
  return s
}
