// VENDORED from application-hub-mcp-server/src/vendor/companion/src/cli.mjs. Do not edit: change the source and run
// `npm run vendor:hosted` in application-hub-mcp-server/ (CI checks these copies).
// VENDORED from aqua-companion/src/cli.mjs. Do not edit: change the source and run
// `npm run vendor:companion` in application-hub-mcp-server/ (CI checks these copies).
// Argument parsing and dispatch. `main(argv, ctx)` returns an exit code and
// never calls process.exit, so tests can drive it in-process.
// Exit codes: 0 ok, 1 error, 2 usage / not found, 3 consent not given,
// 4 integrity problem, 5 account mismatch.

import {
  cmdAddEvidence, cmdBackup, cmdComment, cmdConflicts, cmdDraft, cmdExportBackup, cmdExportPlaintext, cmdImportApplication,
  cmdImportBackup, cmdInit, cmdList, cmdRecover, cmdRekey, cmdRelocate, cmdResolve, cmdRestoreWorkspace, cmdRetract, cmdShow,
  cmdStatus, cmdVerify, openUnlocked,
} from './commands.mjs'
import { cmdCatalog } from './catalog.mjs'
import { cmdMcp } from './mcp-server.mjs'
import { cmdImportHistory } from './history.mjs'
import { cmdDoctor } from './doctor.mjs'
import { COMPANION_VERSION } from './workspace.mjs'

const BOOLEAN_FLAGS = new Set(['yes', 'dry-run', 'reveal', 'plaintext', 'allow-account-mismatch', 'json', 'structure-only', 'help', 'all', 'read-only', 'keychain', 'offline'])

export const HELP = `aqua-companion ${COMPANION_VERSION}: a local, encrypted AQUA document workspace

The AQUA browser vault stays the private authority. This tool keeps an encrypted
copy of your vault backups, stages local work for the browser, and never syncs,
approves, signs or submits anything on its own.

Usage: aqua-companion <command> [options]

Workspace
  init [--path DIR]                 create DIR/AQUA (asks first; never overwrites)
  status                            summary of the workspace (no passphrase needed)
  list [kind] [--all]               list records (kinds: app_instance, version, answer, approval, evidence, ...)
  show <id> [--reveal]              show a record; --reveal decrypts it to the terminal
  verify [--structure-only]         check manifest, checksums, decryption, orphans, audit chain
  recover                           rebuild the index from files; damaged files go to audit/quarantine/

Bridge to the browser vault (encrypted backup files only)
  import-backup <file> [--account ID] [--allow-account-mismatch]
                                    bring in a backup exported by the AQUA browser vault
  export-backup <out.json>          write staged records as a backup the browser can restore
  conflicts [--all]                 list conflicts found during import
  resolve <conflict-id> --keep vault|workspace|both

Local work (staged until you export it)
  import-application <file> [--title T] [--org O] [--deadline D] [--cycle-year Y]
                                    stage an application from .txt, .md, .json or .html
  import-history <folder> [--date YYYY-MM-DD] [--program NAME]
                                    stage applications you ALREADY SUBMITTED (.md .txt .docx .html
                                    .json .csv) as history; confirm them in the browser (/history)
  draft --application ID --question ID --body-file F [--title T] [--evidence IDS]
  draft --parent VERSION-ID --body-file F [--title T]
  add-evidence --title T [--kind note|passage|url|document] [--excerpt-file F] [--url U] [--file DOC] [--link version:ID]
  comment --version ID --body-file F [--reply-to COMMENT-ID]
  retract <id>                      tombstone a staged record (never deletes)

Public catalog (approved canonical programs only; plain public data)
  catalog sync [--catalog-config F] read-only fetch of approved public programs (config from
                                    https://aquaidp.xyz/.well-known/aqua-catalog.json unless F is given)
  catalog import-file <file>        cache an exported public catalog JSON
  catalog status                    what is cached and whether an endpoint is configured

Agent interface (MCP over stdio; see docs/AGENT.md)
  mcp [--read-only] [--keychain]    serve this workspace to a local AI agent. No account token, no
                                    service-role key; secrets come from AQUA_PASSPHRASE or the macOS
                                    Keychain. Approvals, signing, freeze/export stay with you.
                                    Starts without a workspace too (setup tools only).
  doctor [--json] [--offline]       check Node, the public catalog config and connectivity, the
                                    workspace and the Keychain; never changes anything

Copies and keys
  export --plaintext <id|all> --out DIR   UNENCRYPTED Markdown export (explicit warning + confirmation)
  relocate <new-folder>             copy + verify the workspace elsewhere; the original is left in place
  backup <out-file>                 one encrypted file containing the whole workspace
  restore-workspace <file> [--path DIR]
  rekey                             change the workspace passphrase

Common options
  --workspace DIR    workspace folder (default: AQUA_WORKSPACE, or search from the current folder)
  --yes              confirm the printed plan without a prompt
  --dry-run          print the plan and stop
  --json             machine-readable output (status, list, verify, conflicts)

Secrets (never written to disk or logs)
  AQUA_PASSPHRASE      workspace passphrase (otherwise prompted without echo)
  AQUA_VAULT_SECRET    browser vault secret (defaults to the workspace passphrase)
  AQUA_NEW_PASSPHRASE  new passphrase for rekey
`

export function parseArgs(argv) {
  const flags = {}
  const positional = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') {
      positional.push(...argv.slice(i + 1))
      break
    }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      const name = eq > 0 ? a.slice(2, eq) : a.slice(2)
      if (name === 'version' && eq < 0 && (argv[i + 1] === undefined || argv[i + 1].startsWith('--'))) {
        flags.version = true // bare --version prints the companion version; --version <id> is a value
      } else if (BOOLEAN_FLAGS.has(name)) {
        flags[name] = eq > 0 ? a.slice(eq + 1) !== 'false' : true
      } else if (eq > 0) {
        flags[name] = a.slice(eq + 1)
      } else {
        const v = argv[i + 1]
        if (v === undefined || v.startsWith('--')) throw Object.assign(new Error(`--${name} needs a value`), { exitCode: 2 })
        flags[name] = v
        i++
      }
    } else if (a === '-y') flags.yes = true
    else if (a === '-h') flags.help = true
    else positional.push(a)
  }
  return { flags, positional }
}

const COMMANDS = {
  init: (ctx) => cmdInit(ctx),
  status: (ctx) => cmdStatus(ctx),
  list: (ctx, p) => cmdList(ctx, p[0]),
  show: (ctx, p) => cmdShow(ctx, p[0]),
  verify: (ctx) => cmdVerify(ctx),
  recover: (ctx) => cmdRecover(ctx),
  'import-backup': (ctx, p) => cmdImportBackup(ctx, p[0]),
  'export-backup': (ctx, p) => cmdExportBackup(ctx, p[0]),
  'import-application': (ctx, p) => cmdImportApplication(ctx, p[0]),
  draft: (ctx) => cmdDraft(ctx),
  'add-evidence': (ctx) => cmdAddEvidence(ctx),
  comment: (ctx) => cmdComment(ctx),
  retract: (ctx, p) => cmdRetract(ctx, p[0]),
  conflicts: (ctx) => cmdConflicts(ctx),
  resolve: (ctx, p) => cmdResolve(ctx, p[0]),
  export: (ctx, p) => cmdExportPlaintext(ctx, p[0]),
  relocate: (ctx, p) => cmdRelocate(ctx, p[0]),
  backup: (ctx, p) => cmdBackup(ctx, p[0]),
  'restore-workspace': (ctx, p) => cmdRestoreWorkspace(ctx, p[0]),
  rekey: (ctx) => cmdRekey(ctx),
  catalog: (ctx, p) => cmdCatalog(ctx, p[0], p[1], { openUnlocked }),
  mcp: (ctx) => cmdMcp(ctx),
  'import-history': (ctx, p) => cmdImportHistory(ctx, p[0]),
  doctor: (ctx) => cmdDoctor(ctx),
}

export async function main(argv, io = {}) {
  const ctx = {
    env: io.env ?? process.env,
    cwd: io.cwd ?? process.cwd(),
    stdin: io.stdin ?? process.stdin,
    stdout: io.stdout ?? process.stdout,
    stderr: io.stderr ?? process.stderr,
    flags: {},
    cache: {},
  }
  let parsed
  try {
    parsed = parseArgs(argv)
  } catch (e) {
    ctx.stderr.write(`${e.message}\n`)
    return 2
  }
  ctx.flags = parsed.flags
  const [cmd, ...rest] = parsed.positional
  if (parsed.flags.version === true && !cmd) {
    ctx.stdout.write(`${COMPANION_VERSION}\n`)
    return 0
  }
  if (!cmd || parsed.flags.help || cmd === 'help') {
    ctx.stdout.write(HELP)
    return cmd || parsed.flags.help ? 0 : 2
  }
  const fn = COMMANDS[cmd]
  if (!fn) {
    ctx.stderr.write(`Unknown command "${cmd}". Run "aqua-companion --help".\n`)
    return 2
  }
  try {
    return (await fn(ctx, rest)) ?? 0
  } catch (e) {
    const code = typeof e?.exitCode === 'number' ? e.exitCode : e?.name === 'DecryptError' ? 4 : 1
    ctx.stderr.write(`aqua-companion: ${e?.message ?? e}\n`)
    if (ctx.env.AQUA_COMPANION_DEBUG && e?.stack) ctx.stderr.write(`${e.stack}\n`)
    return code
  }
}
