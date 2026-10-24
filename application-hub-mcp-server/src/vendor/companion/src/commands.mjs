// VENDORED from aqua-companion/src/commands.mjs. Do not edit: change the source and run
// `npm run vendor:companion` in application-hub-mcp-server/ (CI checks these copies).
// Command implementations. Every command that writes prints a plan and asks
// for consent (io.confirmPlan). Nothing here touches the network.

import fs from 'node:fs'
import path from 'node:path'
import {
  accountFingerprint, vaultAccountFingerprint, BACKUP_ACCOUNT_FP_SCHEME, canonicalJson, decryptText, decryptWithKeys, deriveWorkspaceKeys, encryptWithKeys, fieldEncrypter, macHex,
  KeyMismatchError,
  newSaltB64, newUuid, nowIso, sha256Hex, PBKDF2_ITERATIONS,
} from './crypto.mjs'
import {
  isWithin, mkdirInside, moveInside, normalizeRel, readInside, realRoot, replaceAtomicInside, resolveInside,
  resolveUserPath, walkInside, writeNewInside, writeNewUserFile, PathSafetyError,
} from './fsafe.mjs'
import { confirmPlan, err, getNewPassphrase, getPassphrase, getVaultSecret, out, UsageError } from './io.mjs'
import { extractApplication, MAX_INPUT_BYTES } from './extract.mjs'
import {
  buildEnvelope, normalizeVaultRecord, openEnvelope, payloadRecords, revealVaultRecord, toVaultRecord,
  COMPANION_PRODUCER, EXPORTABLE_KINDS,
} from './vault.mjs'
import {
  AGENT_LOG, AUDIT_LOG, COMPANION_VERSION, CONFLICT_LOG, KINDS, MANIFEST, MANIFEST_BACKUP, RECORD_FORMAT, WORKSPACE_FORMAT,
  Workspace, WorkspaceError, dirsForInit, isWorkspaceManifest, keyCheckText, newManifest, readManifestAt, recordAad, rid,
  splitRid, workspaceReadme,
} from './workspace.mjs'

const MAX_ENVELOPE_BYTES = 256 * 1024 * 1024
const DECISION_NOTE = 'Approvals, sign-offs, review decisions and suggestions are never merged, rewritten or exported by the companion.'


/** actor_id of everything the companion stages for the browser (M09 hardening M3). */
export const COMPANION_ACTOR_ID = 'aqua-companion'

export const PRIVACY_EXPLANATION = [
  'How the AQUA companion stores your data:',
  '  - Your AQUA browser vault stays the private authority. This folder is a local copy and staging area.',
  '  - Private records are encrypted with a passphrase you choose (AES-GCM-256, PBKDF2-SHA256, 210,000 iterations).',
  '    The passphrase is never saved. If you forget it, the encrypted files cannot be opened.',
  '  - Only ids, record kinds, checksums and public catalog data are stored as plain text.',
  '  - Nothing syncs automatically and nothing is sent over the network. Data moves only when you run',
  '    import-backup (browser backup file in) or export-backup (a file you restore in the browser).',
  '  - The companion never approves, signs or submits anything.',
]

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function keyFieldOf(kind) {
  return { answer: 'id', version: 'id', app_instance: 'instance_id', evidence: 'evidence_id', comment: 'comment_id' }[kind]
}

export async function openUnlocked(ctx, opts = {}) {
  const ws = Workspace.open(ctx)
  await ws.unlock(await getPassphrase(ctx), opts)
  warnRelocated(ctx, ws)
  return ws
}

function warnRelocated(ctx, ws) {
  if (ws.manifest?.relocated_to) {
    err(ctx, `Note: this workspace was copied to ${ws.manifest.relocated_to.path} on ${ws.manifest.relocated_to.at}. Use that copy; this one is no longer the current workspace.`)
  }
}

function readUserFile(ctx, p, maxBytes) {
  const abs = resolveUserPath(ctx.cwd, p)
  let st
  try {
    st = fs.statSync(abs)
  } catch {
    throw new UsageError(`File not found: ${p}`)
  }
  if (!st.isFile()) throw new UsageError(`Not a file: ${p}`)
  if (st.size > maxBytes) throw new UsageError(`File is too large (${st.size} bytes; limit ${maxBytes}).`)
  return { abs, bytes: fs.readFileSync(abs) }
}

/**
 * Validate an explicitly named output location. Inside the workspace only
 * exports/ is allowed. Never overwrites.
 */
function outputTarget(ws, ctx, p, { allowInside = true } = {}) {
  const abs = resolveUserPath(ctx.cwd, p)
  if (isWithin(ws.root, abs)) {
    if (!allowInside) throw new UsageError('Choose an output location outside the workspace folder.')
    const rel = path.relative(ws.root, abs).split(path.sep).join('/')
    if (!rel.startsWith('exports/')) throw new UsageError('Inside the workspace, output files may only go under exports/.')
    return { abs, insideRel: normalizeRel(rel) }
  }
  if (!fs.existsSync(path.dirname(abs))) throw new UsageError(`Output folder does not exist: ${path.dirname(abs)}`)
  return { abs, insideRel: null }
}

function writeOutput(ws, target, data) {
  if (fs.existsSync(target.abs)) throw new UsageError(`Refusing to overwrite existing file: ${target.abs}`)
  if (target.insideRel) writeNewInside(ws.root, target.insideRel, data)
  else writeNewUserFile(target.abs, data)
}

function countBy(items, f) {
  const m = {}
  for (const i of items) {
    const k = f(i)
    m[k] = (m[k] ?? 0) + 1
  }
  return m
}

function fmtCounts(m) {
  const parts = Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k} ${v}`)
  return parts.length ? parts.join(', ') : 'none'
}

/** Decode all live entries of the given kinds -> [{rid, entry, data}] */
export async function decodeKinds(ws, kinds) {
  const outRows = []
  for (const [r, e] of Object.entries(ws.records)) {
    if (!kinds.includes(e.kind) || ['archived', 'missing', 'tombstoned'].includes(e.status)) continue
    const d = await ws.decodeEntry(r)
    outRows.push({ rid: r, entry: e, data: d.data })
  }
  return outRows
}

async function accountBindingFp(ws) {
  return (await accountBinding(ws))?.account_fp ?? null
}

/** Decrypted binding: { account_fp (from --account) | null, vault_account_fp (from the backup) | null }, or null when unbound. */
async function accountBinding(ws) {
  const b = ws.manifest.account_binding
  if (!b?.binding_enc) return null
  const d = JSON.parse(await decryptWithKeys(ws.keys, b.binding_enc))
  return { account_fp: d.account_fp ?? null, vault_account_fp: d.vault_account_fp ?? null }
}

/** The authenticated in-payload account fingerprint of a browser backup, or null (older backups). */
export function backupPayloadAccountFp(payload) {
  if (payload?.account_fp_scheme !== BACKUP_ACCOUNT_FP_SCHEME) return null
  return typeof payload.account_fp === 'string' && /^[0-9a-f]{64}$/.test(payload.account_fp) ? payload.account_fp : null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * M09 hardening (a): account decision for import-backup. PURE.
 *   binding     — current workspace binding (accountBinding) or null
 *   payloadFp   — fingerprint inside the backup payload, or null (older backup)
 *   flag        — { fp, vaultFp, isUid } for --account, or null
 * Returns { ok: true, check, bind } (bind = new binding to store, or null)
 * or { ok: false, code, message }. With a fingerprint in the backup the
 * workspace binds automatically (no --account needed) and later backups are
 * compared against it; a mismatch is refused unless allowMismatch.
 */
export function decideAccountBinding({ binding, payloadFp, flag, allowMismatch }) {
  const refuseOther = { ok: false, code: 5, message: 'This backup belongs to a different AQUA account than this workspace. Nothing was imported. Use a separate workspace per account, or pass --allow-account-mismatch if you are sure.' }
  const mismatchAllowed = (bind = null) => ({ ok: true, check: 'mismatch_allowed', bind })
  // --account that is a uid can be checked against the in-payload fingerprint directly.
  const flagContradictsPayload = !!(payloadFp && flag?.isUid && flag.vaultFp !== payloadFp)

  if (!binding) {
    if (payloadFp) {
      if (flagContradictsPayload && !allowMismatch) {
        return { ok: false, code: 5, message: 'The --account you named is not the account this backup was exported from. Nothing was imported.' }
      }
      return { ok: true, check: 'bound_from_backup', bind: { account_fp: flag?.fp ?? null, vault_account_fp: payloadFp } }
    }
    if (flag) return { ok: true, check: 'bound', bind: { account_fp: flag.fp, vault_account_fp: null } }
    if (allowMismatch) return { ok: true, check: 'unbound', bind: null }
    return { ok: false, code: 5, message: 'First import: pass --account <your AQUA account id or sign-in email>. The workspace is bound to that account so another account\'s backup cannot be mixed in. (Backups exported by a current AQUA browser bind automatically.) Nothing was imported.' }
  }

  // Bound workspace. The authenticated fingerprint decides when both sides have one.
  if (payloadFp && binding.vault_account_fp) {
    if (payloadFp !== binding.vault_account_fp) return allowMismatch ? mismatchAllowed() : refuseOther
    if (flag && binding.account_fp && flag.fp !== binding.account_fp && !(flag.isUid && flag.vaultFp === payloadFp)) {
      return allowMismatch ? mismatchAllowed() : refuseOther
    }
    return { ok: true, check: 'match', bind: null }
  }

  // Legacy --account binding, or a backup without a fingerprint: the flag decides (as before).
  if (binding.account_fp) {
    if (!flag) {
      if (allowMismatch) return mismatchAllowed()
      return { ok: false, code: 5, message: 'This workspace is bound to an AQUA account. Pass --account <your account id or sign-in email> so the backup can be checked. Nothing was imported.' }
    }
    if (flag.fp !== binding.account_fp) return allowMismatch ? mismatchAllowed() : refuseOther
    if (flagContradictsPayload) return allowMismatch ? mismatchAllowed() : refuseOther
    // learn the backup's fingerprint so the next import binds automatically
    return { ok: true, check: 'match', bind: payloadFp ? { account_fp: binding.account_fp, vault_account_fp: payloadFp } : null }
  }

  // Bound from a backup fingerprint, but this backup has none (older export).
  if (flag?.isUid) {
    if (flag.vaultFp === binding.vault_account_fp) return { ok: true, check: 'match', bind: { account_fp: flag.fp, vault_account_fp: binding.vault_account_fp } }
    return allowMismatch ? mismatchAllowed() : refuseOther
  }
  if (allowMismatch) return mismatchAllowed()
  return { ok: false, code: 5, message: 'This backup carries no account fingerprint (older export) and this workspace was bound from a backup. Export a fresh backup from the AQUA browser, or pass --account <your account id> (the uid shown in AQUA). Nothing was imported.' }
}

function resolveInitTarget(ctx, p) {
  const base = resolveUserPath(ctx.cwd, p ?? '.')
  const root = path.basename(base) === 'AQUA' ? base : path.join(base, 'AQUA')
  return { base, root }
}

function dirIsEmpty(dir) {
  return fs.readdirSync(dir).filter((n) => n !== '.DS_Store').length === 0
}

/** Refuses unless `root` is absent or an empty directory. */
function assertFreshRoot(ctx, root, what) {
  if (!fs.existsSync(root)) {
    try {
      if (fs.lstatSync(root).isSymbolicLink()) throw new UsageError(`${root} is a dangling symlink; refusing.`)
    } catch (e) {
      if (e instanceof UsageError) throw e
    }
    return
  }
  const st = fs.lstatSync(root)
  if (st.isSymbolicLink()) throw new UsageError(`${root} is a symlink; choose a real folder. Nothing was changed.`)
  if (!st.isDirectory()) throw new UsageError(`${root} exists and is not a folder. Nothing was changed.`)
  const m = readManifestAt(root)
  if (m && isWorkspaceManifest(m)) {
    throw new WorkspaceError(
      `An AQUA workspace already exists at ${root} (id ${m.workspace_id}). Nothing was changed. Run "aqua-companion status --workspace ${root}".`,
      2,
    )
  }
  if (!dirIsEmpty(root)) {
    throw new UsageError(`${root} already exists, is not empty, and is not an AQUA workspace. ${what} refuses to write there. Nothing was changed.`)
  }
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

export async function cmdInit(ctx) {
  const { base, root } = resolveInitTarget(ctx, ctx.flags.path)
  // An existing workspace AT the given path (user pointed at the AQUA folder's parent or itself)
  for (const cand of [base, root]) {
    if (fs.existsSync(path.join(cand, MANIFEST))) {
      const m = readManifestAt(cand)
      if (m && (isWorkspaceManifest(m) || m.__unparseable)) {
        throw new WorkspaceError(
          `An AQUA workspace already exists at ${cand}${m.workspace_id ? ` (id ${m.workspace_id})` : ''}. Nothing was changed. Run "aqua-companion status --workspace ${cand}".`,
          2,
        )
      }
    }
  }
  assertFreshRoot(ctx, root, 'init')
  for (const l of PRIVACY_EXPLANATION) out(ctx, l)
  out(ctx)
  const lines = []
  if (!fs.existsSync(base)) lines.push(`create folder ${base}`)
  lines.push(`${fs.existsSync(root) ? 'use empty folder' : 'create folder'} ${root}`)
  lines.push(`create ${dirsForInit().length} subfolders (applications/, catalog-cache/, answers/, facts/, evidence/, reviews/, packets/, exports/, audit/)`)
  lines.push(`create ${MANIFEST} (workspace manifest) and README.txt`)
  lines.push('no existing file is modified or overwritten')
  if (!(await confirmPlan(ctx, `initialize an AQUA workspace at ${root}`, lines))) return 0
  const passphrase = await getNewPassphrase(ctx)

  fs.mkdirSync(base, { recursive: true, mode: 0o700 })
  if (!fs.existsSync(root)) fs.mkdirSync(root, { mode: 0o700 })
  const real = realRoot(root)
  for (const d of dirsForInit()) mkdirInside(real, d)
  const { manifest, keys } = await newManifest(passphrase)
  const ws = new Workspace(ctx, real, manifest)
  ws.keys = keys
  writeNewInside(real, 'README.txt', workspaceReadme(manifest))
  manifest.manifest_mac = await ws.manifestMac(manifest)
  writeNewInside(real, MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
  await ws.audit('init', { workspace_id: manifest.workspace_id, schema_version: manifest.schema_version, companion_version: COMPANION_VERSION })
  out(ctx, `Created AQUA workspace ${manifest.workspace_id} at ${real}`)
  out(ctx, 'Next: export a backup from the AQUA browser vault, then run "aqua-companion import-backup <file> --account <your account id>".')
  return 0
}

// ---------------------------------------------------------------------------
// status / list / show
// ---------------------------------------------------------------------------

export async function cmdStatus(ctx) {
  const ws = Workspace.open(ctx)
  warnRelocated(ctx, ws)
  const m = ws.manifest
  const entries = Object.values(m.records)
  const live = entries.filter((e) => e.status !== 'archived' && e.kind !== 'conflict')
  const openConflicts = entries.filter((e) => e.kind === 'conflict' && e.conflict_status === 'open').length
  const summary = {
    workspace: ws.root,
    workspace_id: m.workspace_id,
    schema_version: m.schema_version,
    companion_version: m.companion_version,
    created_at: m.created_at,
    account_bound: Boolean(m.account_binding),
    projections: countBy(live.filter((e) => e.authority === 'projection'), (e) => e.kind),
    staging: countBy(live.filter((e) => e.authority === 'staging'), (e) => e.kind),
    staging_status: countBy(live.filter((e) => e.authority === 'staging'), (e) => e.status),
    absent_from_last_import: live.filter((e) => e.absent_from_last_import).length,
    open_conflicts: openConflicts,
    last_import: m.imports.at(-1) ?? null,
    last_export: m.exports.at(-1) ?? null,
    pending_rekey: Boolean(m.pending_rekey),
    relocated_to: m.relocated_to,
  }
  if (ctx.flags.json) {
    out(ctx, JSON.stringify(summary, null, 2))
    return 0
  }
  out(ctx, `AQUA workspace ${m.workspace_id}`)
  out(ctx, `  folder:        ${ws.root}`)
  out(ctx, `  schema:        ${m.schema_version} (created ${m.created_at} by companion ${m.companion_version})`)
  out(ctx, `  authority:     browser vault (this folder holds projections + staging; no automatic sync)`)
  out(ctx, `  account:       ${m.account_binding ? `bound on ${m.account_binding.bound_at}` : 'not bound yet (binds on first import-backup)'}`)
  out(ctx, `  projections:   ${fmtCounts(summary.projections)}`)
  out(ctx, `  staging:       ${fmtCounts(summary.staging)} [${fmtCounts(summary.staging_status)}]`)
  if (summary.absent_from_last_import) out(ctx, `  absent:        ${summary.absent_from_last_import} projection(s) were not in the last vault backup (kept, not deleted)`)
  out(ctx, `  conflicts:     ${openConflicts} open${openConflicts ? ' (run "aqua-companion conflicts")' : ''}`)
  out(ctx, `  last import:   ${summary.last_import ? summary.last_import.at : 'never'}`)
  out(ctx, `  last export:   ${summary.last_export ? summary.last_export.at : 'never'}`)
  if (m.pending_rekey) out(ctx, '  WARNING: a passphrase change was interrupted; run "aqua-companion rekey" to finish it.')
  out(ctx, 'Integrity is not checked by status; run "aqua-companion verify".')
  return 0
}

export async function cmdList(ctx, kindArg) {
  const ws = Workspace.open(ctx)
  let kind = kindArg ?? null
  if (kind && !KINDS[kind] && KINDS[kind.replace(/s$/, '')]) kind = kind.replace(/s$/, '')
  if (kind && !KINDS[kind]) throw new UsageError(`Unknown kind "${kindArg}". Kinds: ${Object.keys(KINDS).join(', ')}`)
  const rows = Object.entries(ws.records)
    .filter(([, e]) => (!kind || e.kind === kind) && (ctx.flags.all || e.status !== 'archived'))
    .sort(([a], [b]) => a.localeCompare(b))
  if (ctx.flags.json) {
    out(ctx, JSON.stringify(rows.map(([r, e]) => ({ id: r, ...e })), null, 2))
    return 0
  }
  for (const [r, e] of rows) {
    const flags = [e.status, e.absent_from_last_import ? 'absent-from-last-import' : null, e.conflict_status ?? null].filter(Boolean).join(',')
    out(ctx, `${r}\t${e.authority}\t${e.scope}\t${flags}\t${e.path}`)
  }
  out(ctx, `${rows.length} record(s)`)
  return 0
}

/** Readable form of a record: projections get their vault *_enc fields decrypted (vault secret). */
async function displayData(ctx, e, data) {
  if (e.authority !== 'projection' || e.scope === 'public') return data
  if (e.kind === 'version') return normalizeVaultRecord('version', data, null)
  if (JSON.stringify(data).includes('_enc"')) return revealVaultRecord(e.kind, data, await getVaultSecret(ctx))
  return data
}

export const EXPOSURE_NOTICE =
  'EXPOSURE NOTICE: decrypted private content follows. Anything that can see this terminal (scrollback, logs, screen sharing, AI agents reading output) can read it.'

export async function cmdShow(ctx, id) {
  if (!id) throw new UsageError('Usage: aqua-companion show <id> [--reveal]')
  const ws = Workspace.open(ctx)
  const r = ws.resolveId(id)
  const e = ws.records[r]
  if (!ctx.flags.reveal) {
    out(ctx, JSON.stringify(ctx.flags.json ? { id: r, entry: e } : { id: r, ...e }, null, 2))
    if (e.scope !== 'public') out(ctx, 'Content is encrypted. Add --reveal to decrypt it to this terminal.')
    return 0
  }
  await ws.unlock(await getPassphrase(ctx))
  const d = await ws.readRecord(r)
  const data = await displayData(ctx, e, d.data)
  if (e.scope !== 'public') err(ctx, EXPOSURE_NOTICE)
  if (ctx.flags.json) out(ctx, JSON.stringify({ id: r, entry: e, data }, null, 2))
  else {
    out(ctx, JSON.stringify({ id: r, ...e }, null, 2))
    out(ctx, JSON.stringify(data, null, 2))
  }
  await ws.audit('show_reveal', { record_id: r })
  return 0
}

// ---------------------------------------------------------------------------
// verify / recover
// ---------------------------------------------------------------------------

async function auditChainProblems(ws, log) {
  const problems = []
  let abs
  try {
    abs = resolveInside(ws.root, log)
  } catch (e) {
    return [`${log}: ${e.message}`]
  }
  if (!fs.existsSync(abs)) return problems
  const lines = readInside(ws.root, log).toString('utf8').split('\n').filter(Boolean)
  let prev = null
  for (const [i, line] of lines.entries()) {
    let obj
    try {
      obj = JSON.parse(line)
    } catch {
      problems.push(`${log} line ${i + 1}: not JSON`)
      prev = await sha256Hex(line)
      continue
    }
    if (obj.prev !== prev) problems.push(`${log} line ${i + 1}: hash chain broken (log edited or truncated)`)
    prev = await sha256Hex(line)
  }
  return problems
}

/** Returns { problems: [], notes: [] }. */
export async function verifyWorkspace(ws, { decrypt = true } = {}) {
  const problems = []
  const notes = []
  const m = ws.manifest
  if (decrypt) {
    const expected = await ws.manifestMac(m)
    if (expected !== m.manifest_mac) problems.push(`${MANIFEST}: integrity MAC mismatch (edited outside the companion)`)
  }
  if (m.pending_rekey) problems.push('a passphrase change was interrupted (pending_rekey); run rekey')
  const referenced = new Set()
  for (const [r, e] of Object.entries(m.records)) {
    if (e.status === 'missing') {
      notes.push(`${r}: recorded as missing by an earlier recover`)
      continue
    }
    let abs
    try {
      abs = resolveInside(ws.root, e.path)
    } catch (err2) {
      problems.push(`${r}: unsafe path in manifest (${err2.message})`)
      continue
    }
    referenced.add(normalizeRel(e.path))
    if (!fs.existsSync(abs)) {
      problems.push(`${r}: file missing (${e.path})`)
      continue
    }
    const bytes = readInside(ws.root, e.path)
    if ((await sha256Hex(bytes)) !== e.sha256) problems.push(`${r}: checksum mismatch, file changed outside the companion (${e.path})`)
    if (!decrypt) continue
    try {
      const d = await ws.decodeFile(e.path)
      if (d.meta.id !== r.split('#')[0]) problems.push(`${r}: id inside ${e.path} is ${d.meta.id}`)
      if (d.meta.kind !== e.kind) problems.push(`${r}: kind inside ${e.path} is ${d.meta.kind}`)
      if (d.meta.workspace_id !== m.workspace_id) problems.push(`${r}: file belongs to workspace ${d.meta.workspace_id}`)
      if (d.contentMac !== e.content_mac) problems.push(`${r}: content does not match the manifest`)
    } catch (err2) {
      if (err2 instanceof KeyMismatchError && m.pending_rekey) notes.push(`${r}: already under the new passphrase of the unfinished rekey`)
      else problems.push(`${r}: cannot be read (${err2.message})`)
    }
  }
  const { files, symlinks, other } = ws.recordFiles()
  for (const f of files) if (!referenced.has(f)) problems.push(`orphan file not in the manifest: ${f}`)
  for (const f of walkInside(ws.root).files.filter((x) => x.includes('.tmp-'))) {
    notes.push(`leftover temporary file from an interrupted write (safe to delete after checking): ${f}`)
  }
  for (const s of symlinks) problems.push(`symlink inside the workspace (never followed): ${s}`)
  for (const o of other) problems.push(`unexpected special file: ${o}`)
  problems.push(...(await auditChainProblems(ws, AUDIT_LOG)))
  problems.push(...(await auditChainProblems(ws, CONFLICT_LOG)))
  problems.push(...(await auditChainProblems(ws, AGENT_LOG)))
  const open = Object.values(m.records).filter((e) => e.kind === 'conflict' && e.conflict_status === 'open').length
  if (open) notes.push(`${open} open conflict(s) need a decision (aqua-companion conflicts)`)
  return { problems, notes }
}

export async function cmdVerify(ctx) {
  const ws = Workspace.open(ctx, { allowBrokenManifest: true })
  if (!ws.manifest) {
    out(ctx, `FAIL ${MANIFEST} is missing or unreadable. Run "aqua-companion recover".`)
    return 4
  }
  const decrypt = !ctx.flags['structure-only']
  if (decrypt) await ws.unlock(await getPassphrase(ctx), { allowManifestMismatch: true, allowPendingRekey: true })
  const { problems, notes } = await verifyWorkspace(ws, { decrypt })
  if (ctx.flags.json) out(ctx, JSON.stringify({ ok: problems.length === 0, problems, notes }, null, 2))
  else {
    for (const p of problems) out(ctx, `PROBLEM ${p}`)
    for (const n of notes) out(ctx, `NOTE ${n}`)
    const n = Object.keys(ws.manifest.records).length
    out(ctx, problems.length ? `FAIL ${problems.length} problem(s). Run "aqua-companion recover" to rebuild the index and quarantine damaged files.` : `OK ${n} record(s) verified${decrypt ? ' and decrypted' : ' (structure only)'}.`)
  }
  return problems.length ? 4 : 0
}

/** Reconstruct a manifest skeleton from record files when workspace.json is gone. */
async function reconstructManifest(ctx, root, passphrase) {
  const probe = new Workspace(ctx, root, { workspace_id: null, records: {} })
  const { files } = probe.recordFiles()
  const heads = []
  for (const f of files) {
    try {
      const h = JSON.parse(readInside(root, f).toString('utf8'))
      if (h?.aqua_record === RECORD_FORMAT && h.enc?.salt_b64) heads.push(h)
    } catch {
      /* ignored; handled as corrupt later */
    }
  }
  if (!heads.length) throw new WorkspaceError('Cannot rebuild: no encrypted record files found to recover the key parameters from.', 4)
  const tally = countBy(heads, (h) => `${h.workspace_id}|${h.enc.salt_b64}|${h.enc.iters}`)
  const [best] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
  const [workspace_id, salt_b64, iters] = best.split('|')
  const keys = await deriveWorkspaceKeys(passphrase, salt_b64, Number(iters))
  const sample = heads.find((h) => h.enc.salt_b64 === salt_b64)
  await decryptWithKeys(keys, sample.enc, recordAad(sample)) // throws on wrong passphrase
  const { manifest } = await newManifest(passphrase)
  manifest.workspace_id = workspace_id
  manifest.kdf = { alg: 'PBKDF2-SHA256', iters: Number(iters), salt_b64 }
  manifest.key_check = await encryptWithKeys(keys, keyCheckText(workspace_id))
  manifest.rebuilt_at = nowIso()
  return manifest
}

export async function cmdRecover(ctx) {
  const ws = Workspace.open(ctx, { allowBrokenManifest: true })
  const passphrase = await getPassphrase(ctx)
  const notes = []
  let baseManifest = ws.manifest
  let manifestBroken = false
  if (!baseManifest) {
    manifestBroken = true
    let bak = null
    try {
      bak = JSON.parse(readInside(ws.root, MANIFEST_BACKUP).toString('utf8'))
    } catch {
      bak = null
    }
    if (bak && isWorkspaceManifest(bak)) {
      baseManifest = bak
      notes.push(`${MANIFEST} unreadable; starting from ${MANIFEST_BACKUP}`)
    } else {
      baseManifest = await reconstructManifest(ctx, ws.root, passphrase)
      notes.push(`${MANIFEST} unreadable and no usable backup; key parameters recovered from record files`)
    }
  }
  ws.manifest = structuredClone(baseManifest)
  await ws.unlock(passphrase, { allowManifestMismatch: true, allowPendingRekey: true })
  if (ws.manifest.pending_rekey) {
    throw new WorkspaceError('A passphrase change is unfinished. Run "aqua-companion rekey" first (old passphrase in AQUA_PASSPHRASE, new one in AQUA_NEW_PASSPHRASE); recover would misread re-keyed files.', 4)
  }
  const macOk = (await ws.manifestMac(ws.manifest)) === ws.manifest.manifest_mac

  const { files, symlinks, other } = ws.recordFiles()
  const valid = new Map() // path -> decoded
  const corrupt = []
  const otherKey = []
  for (const f of files) {
    try {
      const d = await ws.decodeFile(f)
      if (d.meta.workspace_id !== ws.manifest.workspace_id) throw new Error('belongs to another workspace')
      valid.set(f, d)
    } catch (e) {
      if (e instanceof KeyMismatchError) otherKey.push(f)
      else corrupt.push({ path: f, reason: e.message })
    }
  }
  if (otherKey.length) {
    // Never quarantine readable-in-principle data: these files use a different key
    // (e.g. the index came from an old backup and the passphrase has changed since).
    throw new WorkspaceError(
      `${otherKey.length} file(s) are encrypted under a different passphrase than this index (first: ${otherKey[0]}). Nothing was changed. Use the current passphrase, or restore a matching workspace backup.`,
      4,
    )
  }
  const newRecords = {}
  const byPath = new Map(Object.entries(ws.manifest.records).map(([r, e]) => [e.path, [r, e]]))
  const adopted = []
  const missing = []
  const updated = []
  // 1) manifest entries whose file is still valid
  for (const [r, e] of Object.entries(ws.manifest.records)) {
    const d = valid.get(e.path)
    if (d && d.meta.id === r.split('#')[0]) {
      const ne = { ...e }
      if (ne.content_mac !== d.contentMac) {
        updated.push(r)
        ne.content_changed_at = nowIso() // flagged: content differs from what the index recorded
      }
      ne.sha256 = d.fileSha
      ne.content_mac = d.contentMac
      if (ne.status === 'missing') ne.status = 'live'
      newRecords[r] = ne
    } else {
      missing.push(r)
      newRecords[r] = { ...e, status: 'missing', missing_since: nowIso() }
    }
  }
  // 2) valid files that the manifest does not reference
  for (const [f, d] of valid) {
    const ref = byPath.get(f)
    if (ref && newRecords[ref[0]]?.status !== 'missing') continue
    let r = d.meta.id
    if (newRecords[r] && newRecords[r].status !== 'missing') {
      r = `${d.meta.id}#recovered-${newUuid().slice(0, 8)}`
    }
    const base = {
      kind: d.meta.kind,
      path: f,
      authority: d.meta.authority,
      scope: d.meta.scope,
      ...(d.meta.source_vault_id ? { source_vault_id: d.meta.source_vault_id } : {}),
      sha256: d.fileSha,
      content_mac: d.contentMac,
      status: r.includes('#recovered-') ? 'archived' : 'live',
      created_at: d.meta.created_at,
      updated_at: nowIso(),
      recovered: true,
    }
    if (d.meta.kind === 'conflict') {
      base.record_id = d.data.record_id
      base.conflict_status = d.data.resolution ? 'resolved' : 'open'
    }
    newRecords[r] = base
    adopted.push(r)
  }
  const stamp = nowIso().replace(/[:.]/g, '-')
  const lines = [
    ...notes,
    `${Object.keys(newRecords).length - adopted.length - missing.length} record(s) intact`,
    ...(macOk ? [] : [`${MANIFEST} failed its integrity check; the rebuilt index will be signed again (review the list below)`]),
    `${updated.length} record(s) whose content differs from the index will be accepted as they are now${updated.length ? `: ${updated.slice(0, 5).join(', ')}${updated.length > 5 ? ', ...' : ''}` : ''}`,
    `${adopted.length} unindexed file(s) adopted into the index${adopted.some((r) => r.includes('#recovered-')) ? ' (duplicates kept as archived copies)' : ''}`,
    `${missing.length} entr(ies) marked missing (kept in the index for provenance)`,
    `${corrupt.length} damaged file(s) moved to audit/quarantine/${stamp}/ (never deleted)`,
    `${symlinks.length + other.length} symlink/special file(s) moved to quarantine (never followed)`,
  ]
  if (!(await confirmPlan(ctx, 'recover the workspace index', lines))) return 0
  for (const c of corrupt) moveInside(ws.root, c.path, `audit/quarantine/${stamp}/${c.path}`)
  for (const s of [...symlinks, ...other]) {
    const from = path.join(ws.root, ...s.split('/'))
    const toRel = `audit/quarantine/${stamp}/${s}`
    mkdirInside(ws.root, path.posix.dirname(toRel))
    const to = resolveInside(ws.root, toRel)
    if (fs.existsSync(to)) throw new PathSafetyError(`quarantine target exists: ${toRel}`)
    fs.renameSync(from, to) // moves the link itself, never its target
  }
  ws.manifest.records = newRecords
  if (ws.manifest.pending_rekey) notes.push('pending passphrase change left in place; run rekey to finish it')
  await ws.saveManifest()
  await ws.audit('recover', {
    manifest_rebuilt: manifestBroken,
    manifest_mac_failed: !macOk,
    content_changed: updated,
    intact: Object.keys(newRecords).length - adopted.length - missing.length,
    adopted: adopted.length,
    missing: missing.length,
    quarantined: corrupt.length + symlinks.length + other.length,
    quarantine_dir: `audit/quarantine/${stamp}`,
  })
  for (const c of corrupt) out(ctx, `quarantined ${c.path}: ${c.reason}`)
  out(ctx, 'Recovery complete. Run "aqua-companion verify" to confirm.')
  return 0
}

// ---------------------------------------------------------------------------
// import-backup
// ---------------------------------------------------------------------------

function submittedApplications(payload) {
  const submittedPackets = new Set(
    (payload.packet_states ?? []).filter((s) => s.state === 'submitted_external_observed').map((s) => s.packet_id),
  )
  return new Set((payload.packets ?? []).filter((p) => submittedPackets.has(p.id)).map((p) => p.application_id))
}

function placementDir(kind, item, submittedApps) {
  if (kind === 'app_instance') {
    return submittedApps.has(item.record.application_id) ? 'applications/submitted' : 'applications/active'
  }
  if (kind === 'catalog') return `catalog-cache/${item.bucket}`
  return null
}

export async function cmdImportBackup(ctx, file) {
  if (!file) throw new UsageError('Usage: aqua-companion import-backup <vault-backup.json> [--account <id>]')
  const ws = await openUnlocked(ctx)
  const vaultSecret = await getVaultSecret(ctx)
  const { bytes } = readUserFile(ctx, file, MAX_ENVELOPE_BYTES)
  const { payload, header, envelope_sha256 } = await openEnvelope(vaultSecret, bytes.toString('utf8'))
  // The marker inside the (authenticated) payload is decisive; the outer field is a courtesy.
  if (payload.companion_export || header.producer === COMPANION_PRODUCER) {
    throw new UsageError(
      'This file was produced by aqua-companion export-backup. Restore it in the browser first, then export a fresh backup from the browser and import that.',
    )
  }

  // --- account identity ---
  // M09 hardening: browser backups now carry an account fingerprint INSIDE
  // the authenticated payload; when present the workspace binds to it
  // automatically and other accounts' backups are refused. Older backups
  // (no fingerprint) fall back to the --account the user names.
  const allowMismatch = Boolean(ctx.flags['allow-account-mismatch'])
  const flagValue = ctx.flags.account ? String(ctx.flags.account) : null
  const flag = flagValue
    ? { fp: await accountFingerprint(flagValue), vaultFp: await vaultAccountFingerprint(vaultSecret, flagValue), isUid: UUID_RE.test(flagValue.trim()) }
    : null
  const payloadFp = backupPayloadAccountFp(payload)
  const decision = decideAccountBinding({ binding: await accountBinding(ws), payloadFp, flag, allowMismatch })
  if (!decision.ok) throw new WorkspaceError(decision.message, decision.code)
  const bindNow = !!decision.bind
  const accountCheck = decision.check

  // --- classify ---
  const submittedApps = submittedApplications(payload)
  const plan = { new: [], same: [], refresh: [], promote: [], conflict: [], decided: [], pending: [], move: [] }
  const seen = new Map()
  const openConflicts = new Set(
    Object.values(ws.records).filter((e) => e.kind === 'conflict' && e.conflict_status === 'open').map((e) => `${e.record_id}|${e.vault_mac}`),
  )
  for (const item of payloadRecords(payload)) {
    const r = rid(item.kind, item.key)
    const mac = await ws.contentMac(item.record)
    if (seen.has(r)) {
      // A vault store never holds two rows with one key; two different ones means a malformed file.
      if (seen.get(r) !== mac) throw new WorkspaceError(`The backup contains two different records with id ${r}. Nothing was imported.`, 4)
      continue
    }
    seen.set(r, mac)
    const e = ws.records[r]
    const dir = placementDir(item.kind, item, submittedApps)
    const decided = (ws.manifest.conflict_decisions[r] ?? []).some((d) => d.vault_mac === mac)
    const pending = openConflicts.has(`${r}|${mac}`)
    if (!e || e.status === 'missing') plan.new.push({ r, item, mac, dir, replacesMissing: Boolean(e) })
    else if (e.authority === 'projection') {
      if (e.content_mac === mac) {
        plan.same.push({ r })
        if (dir && path.posix.dirname(e.path) !== dir) plan.move.push({ r, dir })
      } else if (item.kind === 'catalog') plan.refresh.push({ r, item, mac, dir })
      else if (decided) plan.decided.push({ r })
      else if (pending) plan.pending.push({ r })
      else plan.conflict.push({ r, item, mac, e })
    } else {
      // staging record that came back from the vault
      let same = false
      if (EXPORTABLE_KINDS.includes(item.kind)) {
        try {
          const norm = await normalizeVaultRecord(item.kind, item.record, vaultSecret)
          same = (await ws.contentMac(norm)) === e.content_mac
        } catch {
          same = false
        }
      }
      if (same) plan.promote.push({ r })
      else if (decided) plan.decided.push({ r })
      else if (pending) plan.pending.push({ r })
      else plan.conflict.push({ r, item, mac, e })
    }
  }
  const absent = Object.entries(ws.records).filter(
    ([r, e]) => e.authority === 'projection' && e.status !== 'archived' && !e.catalog_source && !seen.has(r),
  )

  const lines = [
    `decrypted vault backup (format v${payload.format_version}, exported ${payload.exported_at}); integrity verified`,
    `new projections: ${fmtCounts(countBy(plan.new, (x) => x.item.kind))}${plan.new.some((x) => x.replacesMissing) ? ` (${plan.new.filter((x) => x.replacesMissing).length} restore files recorded as missing)` : ''}`,
    `unchanged: ${plan.same.length}`,
    `staged records confirmed in the vault: ${plan.promote.length}`,
    `public catalog entries refreshed (old copy kept): ${plan.refresh.length}`,
    `conflicts (same id, different content) recorded for your decision, nothing overwritten: ${plan.conflict.length}`,
    ...(plan.decided.length ? [`differences you already decided to keep the workspace copy for: ${plan.decided.length}`] : []),
    ...(plan.pending.length ? [`differences already waiting as open conflicts (not duplicated): ${plan.pending.length}`] : []),
    ...(absent.length ? [`${absent.length} projection(s) are not in this backup; they are kept and flagged, never deleted`] : []),
    ...(plan.move.length ? [`${plan.move.length} application(s) move between active/submitted folders`] : []),
    ({
      bound_from_backup: 'bind this workspace to the AQUA account this backup was exported from (fingerprint inside the backup, stored encrypted)',
      bound: 'bind this workspace to the AQUA account given (fingerprint stored encrypted)',
      match: bindNow ? 'account matches this workspace (binding updated with the backup\'s account fingerprint)' : 'account matches this workspace',
      mismatch_allowed: 'ACCOUNT MISMATCH accepted with --allow-account-mismatch',
      unbound: 'no account binding (--allow-account-mismatch)',
    })[accountCheck],
    DECISION_NOTE,
  ]
  if (!(await confirmPlan(ctx, `import a vault backup into ${ws.root}`, lines))) return 0

  const batch_id = `IB-${newUuid()}`
  const store = (item) => `${item.store}:${item.key}`
  for (const x of plan.new) {
    if (x.replacesMissing) ws.records[`${x.r}#missing-${batch_id}`] = { ...ws.records[x.r], status: 'missing', replaced_by_batch: batch_id }
    ws.records[x.r] = await ws.writeRecord({
      kind: x.item.kind, key: x.item.key, authority: 'projection', source_vault_id: store(x.item), data: x.item.record, dir: x.dir,
      extra: { import_batch: batch_id },
    })
  }
  for (const x of plan.refresh) {
    const old = ws.records[x.r]
    ws.records[`${x.r}#superseded-${batch_id}`] = { ...old, status: 'archived', superseded_by_batch: batch_id }
    ws.records[x.r] = await ws.writeRecord({
      kind: x.item.kind, key: x.item.key, authority: 'projection', source_vault_id: store(x.item), data: x.item.record, dir: x.dir,
      extra: { import_batch: batch_id },
    })
  }
  for (const x of plan.promote) {
    const e = ws.records[x.r]
    // a locally retracted record stays retracted here; the vault copy is the browser's business
    if (e.status !== 'tombstoned') e.status = 'in_vault'
    Object.assign(e, { vault_seen_at: nowIso(), updated_at: nowIso() })
  }
  for (const x of plan.move) {
    const e = ws.records[x.r]
    const to = ws.allocatePath(e.kind, 'projection', splitRid(x.r).key, x.dir)
    moveInside(ws.root, e.path, to)
    await ws.audit('placement', { record_id: x.r, from: e.path, to })
    Object.assign(e, { path: to, updated_at: nowIso() })
  }
  for (const x of plan.conflict) {
    const conflict_id = `CF-${newUuid()}`
    const data = {
      conflict_id,
      record_id: x.r,
      kind: x.item.kind,
      detected_at: nowIso(),
      import_batch: batch_id,
      workspace: { authority: x.e.authority, content_mac: x.e.content_mac, path: x.e.path },
      vault: { content_mac: x.mac, source_vault_id: store(x.item), record: x.item.record },
    }
    ws.records[rid('conflict', conflict_id)] = await ws.writeRecord({
      kind: 'conflict', key: conflict_id, authority: 'staging', data, extra: { record_id: x.r, conflict_status: 'open', vault_mac: x.mac },
    })
    await ws.audit('conflict_detected', {
      conflict_id, record_id: x.r, kind: x.item.kind, workspace_mac: x.e.content_mac.slice(0, 16), vault_mac: x.mac.slice(0, 16), import_batch: batch_id,
    }, CONFLICT_LOG)
  }
  const now = nowIso()
  for (const [r, e] of Object.entries(ws.records)) {
    if (e.authority !== 'projection' || e.status === 'archived' || e.catalog_source) continue
    if (seen.has(r)) delete e.absent_from_last_import
    else e.absent_from_last_import = batch_id
  }
  if (bindNow) {
    const prev = ws.manifest.account_binding
    ws.manifest.account_binding = {
      bound: true,
      bound_at: prev?.bound_at ?? now,
      binding_enc: await encryptWithKeys(ws.keys, canonicalJson({
        account_fp: decision.bind.account_fp,
        vault_account_fp: decision.bind.vault_account_fp,
        source: decision.bind.vault_account_fp ? (decision.bind.account_fp ? 'flag+backup' : 'backup') : 'flag',
      })),
    }
  }
  const counts = {
    new: plan.new.length, unchanged: plan.same.length, promoted: plan.promote.length, refreshed: plan.refresh.length,
    conflicts: plan.conflict.length, absent: absent.length,
  }
  ws.manifest.imports.push({ batch_id, at: now, envelope_sha256, format_version: payload.format_version, exported_at: payload.exported_at, counts })
  await ws.saveManifest()
  await ws.audit('import_backup', { batch_id, envelope_sha256, counts, account_check: accountCheck })
  out(ctx, `Imported batch ${batch_id}: ${plan.new.length} new, ${plan.same.length} unchanged, ${plan.promote.length} confirmed, ${plan.conflict.length} conflict(s).`)
  if (plan.conflict.length) out(ctx, 'Conflicts need an explicit decision: run "aqua-companion conflicts".')
  return 0
}

// ---------------------------------------------------------------------------
// export-backup
// ---------------------------------------------------------------------------

export async function cmdExportBackup(ctx, outFile) {
  if (!outFile) throw new UsageError('Usage: aqua-companion export-backup <out.json>')
  const ws = await openUnlocked(ctx)
  const target = outputTarget(ws, ctx, outFile)
  if (fs.existsSync(target.abs)) throw new UsageError(`Refusing to overwrite existing file: ${target.abs}`)
  const rows = []
  for (const [r, e] of Object.entries(ws.records)) {
    if (e.authority !== 'staging' || !EXPORTABLE_KINDS.includes(e.kind) || e.status !== 'live') continue
    rows.push({ r, e, data: (await ws.decodeEntry(r)).data })
  }
  // dependency checks: everything referenced must exist in the vault or this export
  const has = (kind, key) => Boolean(ws.records[rid(kind, key)]) && !['archived', 'missing'].includes(ws.records[rid(kind, key)].status)
  const exporting = new Set(rows.map((x) => x.r))
  const problems = []
  for (const x of rows) {
    if (x.e.kind === 'version') {
      if (!has('answer', x.data.answer_id)) problems.push(`${x.r}: its answer ${x.data.answer_id} is unknown`)
      if (x.data.parent_version_id && !has('version', x.data.parent_version_id)) problems.push(`${x.r}: parent version ${x.data.parent_version_id} is unknown`)
    }
    if (x.e.kind === 'comment' && !has('version', x.data.version_id)) problems.push(`${x.r}: version ${x.data.version_id} is unknown`)
  }
  if (problems.length) throw new WorkspaceError(`Cannot export:\n  ${problems.join('\n  ')}`)
  if (!rows.length) {
    out(ctx, 'Nothing to export: there are no staged drafts, local applications, evidence or comments waiting for the browser.')
    return 0
  }
  const lines = [
    `staged records: ${fmtCounts(countBy(rows, (x) => x.e.kind))}`,
    'encrypted with your browser vault secret as an aqua-local-backup v2 file',
    `write ${target.abs} (new file; nothing is overwritten)`,
    DECISION_NOTE,
    'In the browser: open the AQUA Local page (/aqua-local) and use Restore backup. Restored records arrive as drafts; anything restored stays unattested until you approve it there.',
  ]
  if (!(await confirmPlan(ctx, 'export staged records for the browser vault', lines))) return 0
  const vaultSecret = await getVaultSecret(ctx)
  const payload = {
    format_version: 2,
    exported_at: nowIso(),
    answers: [], versions: [], approvals: [], packets: [], provenance: [], imports: [], signoffs: [],
    packet_states: [], catalog_cache: [], events: [], app_instances: [], facts: [], evidence: [], reviews: [],
    comments: [], suggestions: [],
  }
  const storeFor = { answer: 'answers', version: 'versions', app_instance: 'app_instances', evidence: 'evidence', comment: 'comments' }
  const encField = await fieldEncrypter(vaultSecret)
  for (const x of rows) payload[storeFor[x.e.kind]].push(await toVaultRecord(x.e.kind, x.data, encField))
  // inside the encrypted payload (backup.ts ignores unknown payload fields); stops re-import as "vault" data
  payload.companion_export = { producer: COMPANION_PRODUCER, companion_version: COMPANION_VERSION, workspace_id: ws.manifest.workspace_id }
  const fp = await accountBindingFp(ws)
  const text = await buildEnvelope(vaultSecret, payload, { account_fp: fp })
  writeOutput(ws, target, text)
  const sha = await sha256Hex(text)
  const now = nowIso()
  for (const x of rows) Object.assign(ws.records[x.r], { exported_at: now, updated_at: now })
  const counts = countBy(rows, (x) => x.e.kind)
  ws.manifest.exports.push({ at: now, envelope_sha256: sha, counts, record_ids: [...exporting] })
  await ws.saveManifest()
  await ws.audit('export_backup', { envelope_sha256: sha, counts, output_inside_workspace: Boolean(target.insideRel) })
  out(ctx, `Wrote ${target.abs} (${rows.length} record(s)). Restore it in the AQUA browser vault.`)
  return 0
}

// ---------------------------------------------------------------------------
// import-application / draft / add-evidence / comment / retract
// ---------------------------------------------------------------------------

export async function cmdImportApplication(ctx, file) {
  if (!file) throw new UsageError('Usage: aqua-companion import-application <file.(txt|md|json|html)> [--title T] [--org O]')
  const ws = await openUnlocked(ctx)
  const { abs, bytes } = readUserFile(ctx, file, MAX_INPUT_BYTES)
  if (bytes.includes(0)) throw new UsageError('This looks like a binary file. Supported now: txt, md, json, html.')
  const text = bytes.toString('utf8')
  const overrides = {}
  if (ctx.flags.title) overrides.title = ctx.flags.title
  if (ctx.flags.org) overrides.org = ctx.flags.org
  if (ctx.flags['cycle-year']) overrides.cycle_year = Number(ctx.flags['cycle-year'])
  if (ctx.flags.deadline) overrides.deadline = ctx.flags.deadline
  const tpl = extractApplication(path.basename(abs), text, overrides)
  const prepared = await prepareLocalApplication({
    template: tpl,
    file_name: path.basename(abs),
    media_type: tpl.media_type,
    bytes_sha256: await sha256Hex(bytes),
    text,
  })
  const { instance, source } = prepared
  out(ctx, `Extracted from ${path.basename(abs)} (exact wording kept; review it before you rely on it):`)
  out(ctx, `  title: ${tpl.title}${tpl.org ? ` | org: ${tpl.org}` : ''}`)
  for (const q of instance.local_template.questions) {
    const lim = [q.word_limit ? `${q.word_limit} words` : null, q.char_limit ? `${q.char_limit} chars` : null, q.required ? 'required' : null].filter(Boolean).join(', ')
    out(ctx, `  ${q.order + 1}. ${q.text}${lim ? `  [${lim}]` : ''}`)
  }
  if (!(await confirmPlan(ctx, 'stage a local application', prepared.lines))) return 0
  await commitLocalApplication(ws, prepared)
  out(ctx, `Staged ${instance.instance_id}. Draft answers with "aqua-companion draft --application ${instance.instance_id} --question <LQ-id> --body-file <file>".`)
  void source
  return 0
}

/**
 * Build (but do not write) a staged local-only application and the encrypted
 * copy of its source document. `template` = { title, org, cycle_year,
 * deadline, questions: [{ text, word_limit, char_limit, required, section_id }] }
 * plus optional extra template fields (kept inside the encrypted template).
 */
export async function prepareLocalApplication({ template, file_name, media_type, bytes_sha256, text, source_extra = {}, template_extra = {} }) {
  const instance_id = `LA-${newUuid()}`
  const questions = template.questions.map((q, i) => ({
    question_occurrence_id: `LQ-${newUuid()}`,
    canonical_question_id: null,
    text: q.text,
    word_limit: q.word_limit ?? null,
    char_limit: q.char_limit ?? null,
    required: q.required ?? false,
    section_id: q.section_id ?? null,
    options: q.options ?? null,
    order: i,
  }))
  const created_at = nowIso()
  const local_template = {
    title: template.title, org: template.org ?? '', cycle_year: template.cycle_year ?? null, deadline: template.deadline ?? null,
    sections: [], questions, ...template_extra,
  }
  const instance = {
    instance_id,
    application_id: instance_id,
    program_id: null,
    ap_serial: null,
    cycle_id: null,
    template_revision_sha: null,
    question_refs: questions.map((q) => ({ question_occurrence_id: q.question_occurrence_id, canonical_question_id: null, order: q.order })),
    source: { kind: 'file', ref: file_name },
    local_template,
    created_at,
  }
  const source_id = `LS-${newUuid()}`
  const source = { source_id, instance_id, file_name, media_type, bytes_sha256, text, ...source_extra }
  const lines = [
    `stage local-only application ${instance_id} with ${questions.length} question(s) (private, encrypted)`,
    `keep an encrypted copy of the source document (${source_id}, sha256 ${bytes_sha256.slice(0, 16)}...)`,
    'nothing is published to the public catalog; the application reaches the browser vault only through export-backup',
  ]
  return { instance, source, lines }
}

export async function commitLocalApplication(ws, { instance, source }, { via = 'cli' } = {}) {
  ws.records[rid('app_instance', instance.instance_id)] = await ws.writeRecord({ kind: 'app_instance', key: instance.instance_id, authority: 'staging', data: instance, extra: { local_only: true } })
  ws.records[rid('source_document', source.source_id)] = await ws.writeRecord({ kind: 'source_document', key: source.source_id, authority: 'staging', data: source })
  await ws.saveManifest()
  await ws.audit('import_application', {
    instance_id: instance.instance_id, source_id: source.source_id, question_count: instance.question_refs.length, source_sha256: source.bytes_sha256,
    ...(via !== 'cli' ? { via } : {}),
  })
}

export async function findInstance(ws, appId) {
  const apps = await decodeKinds(ws, ['app_instance'])
  return apps.find((a) => a.data.instance_id === appId || a.data.application_id === appId) ?? null
}

export async function cmdDraft(ctx) {
  const bodyFile = ctx.flags['body-file']
  if (!bodyFile || (!ctx.flags.parent && !(ctx.flags.application && ctx.flags.question))) {
    throw new UsageError('Usage: aqua-companion draft (--application <id> --question <id> | --parent <version-id>) --body-file <file> [--title T]')
  }
  const ws = await openUnlocked(ctx)
  const body = readUserFile(ctx, bodyFile, MAX_INPUT_BYTES).bytes.toString('utf8')
  const evidence_ids = ctx.flags.evidence ? String(ctx.flags.evidence).split(',').map((s) => s.trim()).filter(Boolean) : null
  const prepared = await prepareDraft(ws, {
    application: ctx.flags.application, question: ctx.flags.question, parent: ctx.flags.parent, title: ctx.flags.title, body, evidence_ids,
  })
  if (!(await confirmPlan(ctx, 'save a draft answer version', prepared.lines))) return 0
  await commitDraft(ws, prepared)
  out(ctx, `Saved draft ${prepared.version.id}.`)
  return 0
}

/**
 * Build (but do not write) a staged draft version. Either `parent` (a
 * version id) or `application` + `question`. A draft is always a NEW
 * immutable version with a new id; it starts unapproved and nothing carries
 * an approval forward. Throws UsageError on bad references.
 */
export async function prepareDraft(ws, { application, question, parent: parentId, title: titleIn, body, evidence_ids, method = 'manual', provenance = null, derived_from = null, extra = {}, extra_refs = [] }) {
  if (typeof body !== 'string' || !body.replace(/[\s​-‍⁠﻿]/g, '').length) throw new UsageError('The draft body is empty.')
  if (body.length > MAX_INPUT_BYTES) throw new UsageError('The draft body is too large.')
  const title = titleIn ?? 'Draft'
  let answer = null
  let answerIsNew = false
  let parent = null
  if (parentId) {
    const pr = rid('version', parentId)
    if (!ws.records[pr] || ['archived', 'missing', 'tombstoned'].includes(ws.records[pr].status)) throw new UsageError(`Unknown parent version ${parentId}.`)
    parent = (await ws.decodeEntry(pr)).data
    answer = { id: parent.answer_id }
  } else {
    if (!application || !question) throw new UsageError('A draft needs either a parent version or an application and a question.')
    const inst = await findInstance(ws, application)
    if (!inst) throw new UsageError(`Unknown application ${application}. Import it with import-application or import-backup first.`)
    // User-added questions (question_add records) live in the folded model,
    // not inst.data.question_refs — the caller passes their ids as extra_refs.
    if (!inst.data.question_refs.some((q) => q.question_occurrence_id === question) && !(extra_refs ?? []).includes(question)) {
      throw new UsageError(`Question ${question} is not part of application ${application}.`)
    }
    const scope = { application_id: inst.data.application_id, question_occurrence_id: question }
    const answers = await decodeKinds(ws, ['answer'])
    const existing = answers.find((a) => a.data.scope?.application_id === scope.application_id && a.data.scope?.question_occurrence_id === scope.question_occurrence_id)
    if (existing) {
      answer = existing.data
      const versions = (await decodeKinds(ws, ['version'])).filter((v) => v.data.answer_id === answer.id)
      versions.sort((a, b) => a.data.created_at.localeCompare(b.data.created_at) || a.data.id.localeCompare(b.data.id))
      parent = versions.at(-1)?.data ?? null
    } else {
      answer = { id: newUuid(), scope, created_at: nowIso() }
      answerIsNew = true
    }
  }
  for (const id of evidence_ids ?? []) {
    const er = ws.records[rid('evidence', id)]
    if (!er || ['archived', 'missing', 'tombstoned'].includes(er.status)) throw new UsageError(`Unknown evidence ${id}.`)
  }
  const version = {
    id: newUuid(),
    answer_id: answer.id,
    parent_version_id: parent?.id ?? null,
    title,
    body,
    sha256: await sha256Hex(canonicalJson({ title, body })),
    method,
    provenance,
    created_at: nowIso(),
    immutable: true,
    ...(evidence_ids?.length ? { evidence_ids } : {}),
    ...(derived_from ? { derived_from } : {}),
  }
  const lines = [
    `${answerIsNew ? 'new answer' : 'existing answer'} ${answer.id}`,
    `new draft version ${version.id}${parent ? ` (child of ${parent.id})` : ''}, sha256 ${version.sha256.slice(0, 16)}...`,
    'the draft is unapproved; an earlier approval never carries over. Approve it in the browser after restoring.',
  ]
  return { answer, answerIsNew, parent, version, lines, extra }
}

export async function commitDraft(ws, { answer, answerIsNew, version, extra = {} }, { via = 'cli' } = {}) {
  if (answerIsNew) ws.records[rid('answer', answer.id)] = await ws.writeRecord({ kind: 'answer', key: answer.id, authority: 'staging', data: answer, extra })
  ws.records[rid('version', version.id)] = await ws.writeRecord({ kind: 'version', key: version.id, authority: 'staging', data: version, extra })
  await ws.saveManifest()
  await ws.audit('draft', {
    version_id: version.id, answer_id: answer.id, parent_version_id: version.parent_version_id, sha256: version.sha256,
    ...(via !== 'cli' ? { via, method: version.method } : {}),
  })
}

export async function cmdAddEvidence(ctx) {
  const kind = ctx.flags.kind ?? 'note'
  if (!['document', 'url', 'passage', 'note'].includes(kind)) throw new UsageError('--kind must be document, url, passage or note')
  if (!ctx.flags.title) throw new UsageError('Usage: aqua-companion add-evidence --title T [--kind note|passage|url|document] [--excerpt-file F] [--url U] [--file DOC] [--link version:<id>]')
  const ws = await openUnlocked(ctx)
  const excerpt = ctx.flags['excerpt-file'] ? readUserFile(ctx, ctx.flags['excerpt-file'], MAX_INPUT_BYTES).bytes.toString('utf8') : null
  const fileSha = ctx.flags.file ? await sha256Hex(readUserFile(ctx, ctx.flags.file, 64 * 1024 * 1024).bytes) : null
  const prepared = await prepareEvidence(ws, {
    kind, title: ctx.flags.title, excerpt, url: ctx.flags.url ?? null, file_sha256: fileSha,
    links: ctx.flags.link ? String(ctx.flags.link).split(',') : [],
  })
  if (!(await confirmPlan(ctx, 'stage evidence', prepared.lines))) return 0
  await commitEvidence(ws, prepared)
  out(ctx, `Saved evidence ${prepared.rec.evidence_id}.`)
  return 0
}

/** Build (but do not write) a staged evidence record. Verification is always 'unverified'. */
export async function prepareEvidence(ws, { kind, title, excerpt = null, url = null, file_sha256 = null, links: linkSpecs = [], extra_fields = {} }) {
  if (!['document', 'url', 'passage', 'note'].includes(kind)) throw new UsageError('evidence kind must be document, url, passage or note')
  if (typeof title !== 'string' || !title.trim()) throw new UsageError('evidence needs a title')
  if (kind === 'url' && !url) throw new UsageError("evidence kind 'url' requires a url")
  if (kind === 'passage' && !excerpt) throw new UsageError("evidence kind 'passage' requires an excerpt")
  const content_sha256 = file_sha256 ?? (await sha256Hex(canonicalJson({ kind, title, excerpt: excerpt || null, url: url || null })))
  const links = []
  for (const l of linkSpecs) {
    const [target_kind, target_id] = String(l).split(':')
    if (!['version', 'fact', 'claim'].includes(target_kind) || !target_id) throw new UsageError(`a link must look like version:<id>, fact:<id> or claim:<id> (got ${l})`)
    if (target_kind === 'version' && !ws.records[rid('version', target_id)]) throw new UsageError(`Unknown version ${target_id}.`)
    links.push({ target_kind, target_id })
  }
  const rec = {
    evidence_id: newUuid(),
    kind,
    title,
    ...(excerpt ? { excerpt } : {}),
    ...(url ? { url } : {}),
    content_sha256,
    captured_at: nowIso(),
    verification: 'unverified',
    freshness_checked_at: null,
    links,
    ...extra_fields,
  }
  const lines = [
    `new ${kind} evidence ${rec.evidence_id} (private, encrypted), content sha256 ${content_sha256.slice(0, 16)}...`,
    `${links.length} link(s)`,
    "verification is 'unverified'; the companion never marks evidence as checked",
  ]
  return { rec, lines }
}

export async function commitEvidence(ws, { rec }, { via = 'cli' } = {}) {
  ws.records[rid('evidence', rec.evidence_id)] = await ws.writeRecord({ kind: 'evidence', key: rec.evidence_id, authority: 'staging', data: rec })
  await ws.saveManifest()
  await ws.audit('add_evidence', { evidence_id: rec.evidence_id, kind: rec.kind, links: rec.links.length, ...(via !== 'cli' ? { via } : {}) })
}

export async function cmdComment(ctx) {
  if (!ctx.flags.version || !ctx.flags['body-file']) throw new UsageError('Usage: aqua-companion comment --version <id> --body-file <file> [--reply-to <comment-id>]')
  const ws = await openUnlocked(ctx)
  const vr = rid('version', ctx.flags.version)
  if (!ws.records[vr]) throw new UsageError(`Unknown version ${ctx.flags.version}.`)
  const version = (await ws.decodeEntry(vr)).data
  const body = readUserFile(ctx, ctx.flags['body-file'], MAX_INPUT_BYTES).bytes.toString('utf8')
  if (!body.trim()) throw new UsageError('The comment is empty.')
  let thread_id = `TH-${newUuid()}`
  let parent_comment_id = null
  if (ctx.flags['reply-to']) {
    const cr = rid('comment', ctx.flags['reply-to'])
    if (!ws.records[cr]) throw new UsageError(`Unknown comment ${ctx.flags['reply-to']}.`)
    const parent = (await ws.decodeEntry(cr)).data
    if (parent.answer_id !== version.answer_id) throw new UsageError('A reply must be on the same answer as the comment it replies to.')
    thread_id = parent.thread_id
    parent_comment_id = parent.comment_id
  }
  const rec = {
    comment_id: newUuid(),
    answer_id: version.answer_id,
    version_id: version.id,
    version_sha256: version.sha256,
    thread_id,
    parent_comment_id,
    body,
    // M09 hardening M3: a comment staged here was NOT written in the browser
    // review UI. It is exported as an agent-class comment and shown there as
    // "From companion — review" (it never counts as the user's own review).
    actor_class: 'agent',
    actor_id: COMPANION_ACTOR_ID,
    via: 'companion',
    at: nowIso(),
  }
  if (!(await confirmPlan(ctx, 'stage a comment', [`comment ${rec.comment_id} on version ${version.id} (bound to sha256 ${version.sha256.slice(0, 16)}...)`]))) return 0
  ws.records[rid('comment', rec.comment_id)] = await ws.writeRecord({ kind: 'comment', key: rec.comment_id, authority: 'staging', data: rec })
  await ws.saveManifest()
  await ws.audit('comment', { comment_id: rec.comment_id, version_id: version.id })
  out(ctx, `Saved comment ${rec.comment_id}.`)
  return 0
}

export async function cmdRetract(ctx, id) {
  if (!id) throw new UsageError('Usage: aqua-companion retract <id> [--reason TEXT]')
  const ws = await openUnlocked(ctx)
  const r = ws.resolveId(id)
  const e = ws.records[r]
  if (e.authority !== 'staging' || e.kind === 'conflict') {
    throw new UsageError('Only staged local records can be retracted here. Vault records are changed in the browser, which stays authoritative.')
  }
  if (e.status === 'tombstoned') throw new UsageError(`${r} is already retracted.`)
  const lines = [
    `mark ${r} as retracted (tombstone); the file is kept, never deleted`,
    'retracted records are no longer exported',
    ...(e.status === 'in_vault' || e.exported_at ? ['this record was already exported; retracting here does NOT remove it from the browser vault'] : []),
  ]
  if (!(await confirmPlan(ctx, 'retract a staged record', lines))) return 0
  e.tombstone = { at: nowIso(), reason_given: Boolean(ctx.flags.reason), previous_status: e.status }
  e.status = 'tombstoned'
  e.updated_at = nowIso()
  await ws.saveManifest()
  await ws.audit('retract', { record_id: r })
  out(ctx, `Retracted ${r}.`)
  return 0
}

// ---------------------------------------------------------------------------
// conflicts / resolve
// ---------------------------------------------------------------------------

export async function cmdConflicts(ctx) {
  const ws = Workspace.open(ctx)
  const rows = Object.entries(ws.records).filter(([, e]) => e.kind === 'conflict' && (ctx.flags.all || e.conflict_status === 'open'))
  if (ctx.flags.json) {
    out(ctx, JSON.stringify(rows.map(([r, e]) => ({ conflict_id: splitRid(r).key, record_id: e.record_id, status: e.conflict_status, detected_at: e.created_at })), null, 2))
    return 0
  }
  if (!rows.length) {
    out(ctx, ctx.flags.all ? 'No conflicts recorded.' : 'No open conflicts.')
    return 0
  }
  for (const [r, e] of rows) {
    out(ctx, `${splitRid(r).key}\t${e.conflict_status}\trecord ${e.record_id}\tdetected ${e.created_at}`)
  }
  out(ctx, 'Decide each with: aqua-companion resolve <conflict-id> --keep vault|workspace|both')
  return 0
}

function forkKey(kind) {
  return kind === 'app_instance' ? `LA-${newUuid()}` : newUuid()
}

export async function cmdResolve(ctx, conflictId) {
  const keep = ctx.flags.keep
  if (!conflictId || !['vault', 'workspace', 'both'].includes(keep)) {
    throw new UsageError('Usage: aqua-companion resolve <conflict-id> --keep vault|workspace|both')
  }
  const ws = await openUnlocked(ctx)
  const cr = conflictId.startsWith('conflict:') ? conflictId : rid('conflict', conflictId)
  const ce = ws.records[cr]
  if (!ce) throw new UsageError(`Unknown conflict ${conflictId}.`)
  if (ce.conflict_status !== 'open') throw new UsageError(`Conflict ${conflictId} is already resolved.`)
  const c = (await ws.decodeEntry(cr)).data
  const target = ws.records[c.record_id]
  const { key } = splitRid(c.record_id)
  const isDecision = Boolean(KINDS[c.kind]?.decision)
  const canFork = !isDecision && EXPORTABLE_KINDS.includes(c.kind) && target?.authority === 'staging'
  const lines = []
  if (keep === 'vault') {
    lines.push(`install the vault copy of ${c.record_id} as the current projection`)
    lines.push('move the workspace copy to reviews/conflicts/archived/ (kept, never deleted)')
  } else if (keep === 'workspace') {
    lines.push(`keep the workspace copy of ${c.record_id} unchanged`)
    lines.push('the vault copy stays in the conflict record; this exact vault version will not be raised again')
  } else {
    lines.push(`install the vault copy of ${c.record_id} as the current projection`)
    lines.push(canFork
      ? 'keep the workspace copy as a separate staged record with a NEW id (variant_of the original), exportable later'
      : `keep the workspace copy as an archived version (${isDecision ? 'decisions are never duplicated as live records' : 'projections cannot be forked'})`)
  }
  lines.push('this decision is recorded in audit/conflicts.jsonl')
  if (!(await confirmPlan(ctx, `resolve conflict ${splitRid(cr).key}`, lines))) return 0

  const now = nowIso()
  const resolution = { keep, at: now }
  const archiveTarget = async () => {
    if (!target) return null
    const to = ws.allocatePath(target.kind, target.authority, key, 'reviews/conflicts/archived')
    moveInside(ws.root, target.path, to)
    const archivedRid = `${c.record_id}#archived-${splitRid(cr).key}`
    ws.records[archivedRid] = { ...target, path: to, status: 'archived', archived_by_conflict: splitRid(cr).key, updated_at: now }
    return archivedRid
  }
  const installVault = async () => {
    ws.records[c.record_id] = await ws.writeRecord({
      kind: c.kind, key, authority: 'projection', source_vault_id: c.vault.source_vault_id, data: c.vault.record,
      extra: { installed_by_conflict: splitRid(cr).key },
    })
  }
  if (keep === 'vault') {
    resolution.archived = await archiveTarget()
    await installVault()
  } else if (keep === 'workspace') {
    ;(ws.manifest.conflict_decisions[c.record_id] ??= []).push({ conflict_id: splitRid(cr).key, keep: 'workspace', vault_mac: c.vault.content_mac, at: now })
  } else {
    if (canFork) {
      const wsData = (await ws.decodeEntry(c.record_id)).data
      const newKey = forkKey(c.kind)
      const forked = { ...wsData, [keyFieldOf(c.kind)]: newKey }
      if (c.kind === 'app_instance' && wsData.application_id === wsData.instance_id) forked.application_id = newKey
      ws.records[rid(c.kind, newKey)] = await ws.writeRecord({
        kind: c.kind, key: newKey, authority: 'staging', data: forked, extra: { variant_of: c.record_id, forked_by_conflict: splitRid(cr).key },
      })
      resolution.forked_as = rid(c.kind, newKey)
    }
    resolution.archived = await archiveTarget()
    await installVault()
  }
  Object.assign(ce, { conflict_status: 'resolved', resolution, updated_at: now })
  await ws.saveManifest()
  await ws.audit('conflict_resolved', { conflict_id: splitRid(cr).key, record_id: c.record_id, keep, ...(resolution.forked_as ? { forked_as: resolution.forked_as } : {}) }, CONFLICT_LOG)
  await ws.audit('resolve', { conflict_id: splitRid(cr).key, record_id: c.record_id, keep })
  out(ctx, `Resolved ${splitRid(cr).key}: kept ${keep}.`)
  return 0
}

// ---------------------------------------------------------------------------
// export --plaintext
// ---------------------------------------------------------------------------

function mdFrontMatter(r, e) {
  return ['---', `id: ${JSON.stringify(r)}`, `kind: ${e.kind}`, `authority: ${e.authority}`, `scope: ${e.scope}`, `sha256: ${e.sha256}`, `exported_at: ${nowIso()}`, 'exposure: plaintext export made on explicit request; NOT encrypted', '---', ''].join('\n')
}

function renderMarkdown(r, e, data) {
  const fm = mdFrontMatter(r, e)
  switch (e.kind) {
    case 'version':
      return `${fm}\n# ${data.title || 'Untitled'}\n\n${data.body}\n`
    case 'app_instance': {
      const t = data.local_template
      if (!t) return `${fm}\n# Application ${data.instance_id}\n\nCatalog-backed instance (program ${data.program_id ?? 'unknown'}). Questions are referenced by id:\n\n${data.question_refs.map((q) => `- ${q.question_occurrence_id}`).join('\n')}\n`
      const qs = t.questions.map((q, i) => {
        const lim = [q.word_limit ? `${q.word_limit} words` : null, q.char_limit ? `${q.char_limit} characters` : null, q.required ? 'required' : null].filter(Boolean).join(', ')
        return `${i + 1}. ${q.text}${lim ? ` _(${lim})_` : ''} \`${q.question_occurrence_id}\``
      })
      return `${fm}\n# ${t.title}\n\n${t.org ? `Organization: ${t.org}\n\n` : ''}${t.deadline ? `Deadline: ${t.deadline}\n\n` : ''}## Questions\n\n${qs.join('\n')}\n`
    }
    case 'comment':
      return `${fm}\n# Comment on version ${data.version_id}\n\n${data.body}\n`
    case 'evidence':
      return `${fm}\n# ${data.title}\n\n${data.url ? `URL: ${data.url}\n\n` : ''}${data.excerpt ? `> ${data.excerpt.split('\n').join('\n> ')}\n\n` : ''}Verification: ${data.verification}\n`
    case 'source_document':
      return `${fm}\n# Source document ${data.file_name}\n\n\`\`\`\n${data.text}\n\`\`\`\n`
    default:
      return `${fm}\n# ${e.kind} ${r}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`
  }
}

export async function cmdExportPlaintext(ctx, which) {
  if (!ctx.flags.plaintext) {
    throw new UsageError('export writes UNENCRYPTED files and needs --plaintext. For an encrypted file use "export-backup" (for the browser) or "backup" (whole workspace).')
  }
  if (!which || !ctx.flags.out) throw new UsageError('Usage: aqua-companion export --plaintext <id|all> --out <folder>')
  const ws = await openUnlocked(ctx)
  const rows = which === 'all'
    ? Object.entries(ws.records).filter(([, e]) => e.status !== 'archived' && e.status !== 'missing' && e.kind !== 'conflict')
    : [[ws.resolveId(which), ws.records[ws.resolveId(which)]]]
  const outAbs = resolveUserPath(ctx.cwd, ctx.flags.out)
  let insideRel = null
  if (isWithin(ws.root, outAbs)) {
    insideRel = path.relative(ws.root, outAbs).split(path.sep).join('/')
    if (!insideRel.startsWith('exports/')) throw new UsageError('Inside the workspace, plaintext exports may only go under exports/.')
  }
  if (fs.existsSync(outAbs) && !dirIsEmpty(outAbs)) throw new UsageError(`${outAbs} is not empty. Choose a new or empty folder; nothing is overwritten.`)
  const warning = [
    `PLAINTEXT EXPORT WARNING: ${rows.length} record(s) will be written UNENCRYPTED to ${outAbs}.`,
    'Anyone or anything that can read that folder (cloud sync, backups, search indexing, other apps, AI agents) can read them.',
    'The companion cannot protect, track or delete those files afterwards.',
  ]
  for (const w of warning) err(ctx, w)
  const lines = [...warning, 'write one Markdown file per record plus INDEX.md; nothing is overwritten']
  if (!(await confirmPlan(ctx, 'export records as plaintext Markdown', lines, { word: 'expose' }))) return 0
  // decrypt everything BEFORE writing, so a wrong secret or damaged record leaves no partial export
  const decoded = []
  for (const [r, e] of rows) decoded.push([r, e, await displayData(ctx, e, (await ws.decodeEntry(r)).data)])
  if (insideRel) mkdirInside(ws.root, insideRel)
  else fs.mkdirSync(outAbs, { recursive: true, mode: 0o700 })
  const index = ['# AQUA plaintext export', '', `Exported ${nowIso()} from workspace ${ws.manifest.workspace_id}. These files are NOT encrypted.`, '']
  const used = new Set()
  for (const [r, e, data] of decoded) {
    let name = path.basename(e.path).replace(/\.json$/, '.md')
    for (let n = 2; used.has(name); n++) name = name.replace(/(\.\d+)?\.md$/, `.${n}.md`)
    used.add(name)
    const md = renderMarkdown(r, e, data)
    if (insideRel) writeNewInside(ws.root, `${insideRel}/${name}`, md)
    else writeNewUserFile(path.join(outAbs, name), md)
    index.push(`- [${r}](${name}) (${e.kind}, ${e.authority})`)
  }
  const idx = `${index.join('\n')}\n`
  if (insideRel) writeNewInside(ws.root, `${insideRel}/INDEX.md`, idx)
  else writeNewUserFile(path.join(outAbs, 'INDEX.md'), idx)
  await ws.audit('plaintext_export', { count: rows.length, out_dir: outAbs, selection: which === 'all' ? 'all' : rows[0][0] })
  out(ctx, `Wrote ${rows.length} plaintext file(s) to ${outAbs}.`)
  return 0
}

// ---------------------------------------------------------------------------
// relocate / backup / restore-workspace / rekey
// ---------------------------------------------------------------------------

export async function cmdRelocate(ctx, newPath) {
  if (!newPath) throw new UsageError('Usage: aqua-companion relocate <new-folder>')
  const ws = await openUnlocked(ctx)
  const { root: destRoot } = resolveInitTarget(ctx, newPath)
  if (isWithin(ws.root, destRoot) || isWithin(destRoot, ws.root)) throw new UsageError('The new location must be outside the current workspace (and not contain it).')
  assertFreshRoot(ctx, destRoot, 'relocate')
  const { problems } = await verifyWorkspace(ws)
  if (problems.length) throw new WorkspaceError(`Fix the workspace before moving it (run verify / recover). First problem: ${problems[0]}`, 4)
  const tree = walkInside(ws.root)
  if (tree.symlinks.length || tree.other.length) throw new WorkspaceError('The workspace contains symlinks or special files; run recover first.', 4)
  const lines = [
    `copy ${tree.files.length} file(s) to ${destRoot}`,
    'verify every copied file (checksums + decryption) before finishing',
    'leave the original folder in place; delete it yourself after checking the new copy',
    'record the move in both workspaces\' audit logs',
  ]
  if (!(await confirmPlan(ctx, 'relocate the workspace', lines))) return 0
  fs.mkdirSync(path.dirname(destRoot), { recursive: true, mode: 0o700 })
  if (!fs.existsSync(destRoot)) fs.mkdirSync(destRoot, { mode: 0o700 })
  const dest = realRoot(destRoot)
  for (const f of tree.files) {
    const bytes = readInside(ws.root, f)
    writeNewInside(dest, f, bytes)
    if ((await sha256Hex(readInside(dest, f))) !== (await sha256Hex(bytes))) throw new WorkspaceError(`copy verification failed for ${f}; the original is untouched`)
  }
  const destCtx = { ...ctx, flags: { ...ctx.flags, workspace: dest } }
  const dws = Workspace.open(destCtx)
  dws.keys = ws.keys
  const check = await verifyWorkspace(dws)
  if (check.problems.length) throw new WorkspaceError(`The copy did not verify (${check.problems[0]}). The original is untouched.`, 4)
  const at = nowIso()
  dws.manifest.relocated_from = { path: ws.root, at }
  dws.manifest.relocated_to = null
  await dws.saveManifest()
  await dws.audit('relocated_in', { from: ws.root })
  ws.manifest.relocated_to = { path: dest, at }
  await ws.saveManifest()
  await ws.audit('relocated_out', { to: dest })
  out(ctx, `Copied and verified the workspace at ${dest}. The original at ${ws.root} is unchanged apart from a relocation note; remove it yourself when you are satisfied.`)
  return 0
}

export async function cmdBackup(ctx, outFile) {
  if (!outFile) throw new UsageError('Usage: aqua-companion backup <out-file>')
  const ws = await openUnlocked(ctx)
  const target = outputTarget(ws, ctx, outFile, { allowInside: false })
  if (fs.existsSync(target.abs)) throw new UsageError(`Refusing to overwrite existing file: ${target.abs}`)
  const tree = walkInside(ws.root)
  if (tree.symlinks.length || tree.other.length) throw new WorkspaceError('The workspace contains symlinks or special files; run recover first.', 4)
  const lines = [`bundle ${tree.files.length} file(s) into one encrypted file (workspace passphrase)`, `write ${target.abs} (new file)`]
  if (!(await confirmPlan(ctx, 'create an encrypted workspace backup', lines))) return 0
  const files = []
  for (const f of tree.files) {
    const bytes = readInside(ws.root, f)
    files.push({ path: f, sha256: await sha256Hex(bytes), b64: bytes.toString('base64') })
  }
  const created_at = nowIso()
  const bundle = { format: 'aqua-companion-workspace-bundle', v: 1, workspace_id: ws.manifest.workspace_id, created_at, companion_version: COMPANION_VERSION, files }
  const blob = await encryptWithKeys(ws.keys, JSON.stringify(bundle))
  const text = `${JSON.stringify({ format: 'aqua-companion-backup', backup_version: 1, workspace_id: ws.manifest.workspace_id, created_at, file_count: files.length, ...blob }, null, 2)}\n`
  writeOutput(ws, target, text)
  await ws.audit('backup', { file_count: files.length, sha256: await sha256Hex(text) })
  out(ctx, `Wrote encrypted workspace backup ${target.abs} (${files.length} files). Restore with "aqua-companion restore-workspace <file> --path <folder>".`)
  return 0
}

export async function cmdRestoreWorkspace(ctx, file) {
  if (!file) throw new UsageError('Usage: aqua-companion restore-workspace <backup-file> [--path <folder>]')
  const { bytes } = readUserFile(ctx, file, MAX_ENVELOPE_BYTES * 2)
  let env
  try {
    env = JSON.parse(bytes.toString('utf8'))
  } catch {
    throw new UsageError('Not a companion workspace backup (invalid JSON).')
  }
  if (env?.format !== 'aqua-companion-backup') throw new UsageError('Not a companion workspace backup.')
  const { root } = resolveInitTarget(ctx, ctx.flags.path)
  assertFreshRoot(ctx, root, 'restore-workspace')
  const passphrase = await getPassphrase(ctx)
  const bundle = JSON.parse(await decryptText(passphrase, env))
  if (bundle.format !== 'aqua-companion-workspace-bundle' || bundle.workspace_id !== env.workspace_id || !Array.isArray(bundle.files)) {
    throw new UsageError('Backup contents do not match its header.')
  }
  const paths = new Set()
  for (const f of bundle.files) {
    if (!f || typeof f.path !== 'string' || typeof f.b64 !== 'string' || typeof f.sha256 !== 'string') throw new WorkspaceError('backup file list is malformed', 4)
    const norm = normalizeRel(f.path)
    if (paths.has(norm)) throw new WorkspaceError(`backup lists ${norm} twice`, 4)
    paths.add(norm)
    if ((await sha256Hex(Buffer.from(f.b64, 'base64'))) !== f.sha256) throw new WorkspaceError(`backup file damaged: ${f.path}`, 4)
  }
  if (!paths.has(MANIFEST)) throw new WorkspaceError('backup has no workspace.json', 4)
  const lines = [`restore workspace ${bundle.workspace_id} (${bundle.files.length} files, backed up ${bundle.created_at}) into ${root}`, 'no existing file is overwritten']
  if (!(await confirmPlan(ctx, 'restore a workspace backup', lines))) return 0
  fs.mkdirSync(path.dirname(root), { recursive: true, mode: 0o700 })
  if (!fs.existsSync(root)) fs.mkdirSync(root, { mode: 0o700 })
  const real = realRoot(root)
  for (const f of bundle.files) writeNewInside(real, f.path, Buffer.from(f.b64, 'base64'))
  const rws = Workspace.open({ ...ctx, flags: { ...ctx.flags, workspace: real } })
  await rws.unlock(passphrase)
  await rws.audit('restored_from_workspace_backup', { backup_created_at: bundle.created_at, backup_sha256: await sha256Hex(bytes) })
  out(ctx, `Restored workspace ${bundle.workspace_id} to ${real}. Run "aqua-companion verify --workspace ${real}".`)
  return 0
}

export async function cmdRekey(ctx) {
  const ws = Workspace.open(ctx)
  const oldPass = await getPassphrase(ctx)
  await ws.unlock(oldPass, { allowPendingRekey: true })
  const oldKeys = ws.keys
  const newPass = await getNewPassphrase(ctx, 'AQUA_NEW_PASSPHRASE')
  if (newPass === oldPass) throw new UsageError('The new passphrase is the same as the current one.')
  const m = ws.manifest
  let newKeys
  if (m.pending_rekey) {
    newKeys = await deriveWorkspaceKeys(newPass, m.pending_rekey.kdf.salt_b64, m.pending_rekey.kdf.iters)
    try {
      if ((await decryptWithKeys(newKeys, m.pending_rekey.key_check)) !== keyCheckText(m.workspace_id)) throw new Error('x')
    } catch {
      throw new UsageError('This is not the new passphrase of the interrupted change. Use the same new passphrase as before.')
    }
    const lines = ['finish the interrupted passphrase change: re-encrypt the remaining record files under the new passphrase', 'the old passphrase stops working when this finishes']
    if (!(await confirmPlan(ctx, 'finish changing the workspace passphrase', lines))) return 0
  } else {
    const private_ = Object.values(m.records).filter((e) => e.scope !== 'public' && e.status !== 'missing').length
    const lines = [`re-encrypt ${private_} private record file(s) under the new passphrase (new salt)`, 'each file is replaced atomically; an interruption can be finished by running rekey again', 'the old passphrase stops working when this finishes']
    if (!(await confirmPlan(ctx, 'change the workspace passphrase', lines))) return 0
    // decryptability pre-check before touching anything
    for (const e of Object.values(m.records)) if (e.status !== 'missing') await ws.decodeFile(e.path)
    const salt_b64 = newSaltB64()
    newKeys = await deriveWorkspaceKeys(newPass, salt_b64, PBKDF2_ITERATIONS)
    m.pending_rekey = { kdf: { alg: 'PBKDF2-SHA256', iters: PBKDF2_ITERATIONS, salt_b64 }, key_check: await encryptWithKeys(newKeys, keyCheckText(m.workspace_id)), started_at: nowIso() }
    await ws.saveManifest()
  }
  const keysBySalt = { [oldKeys.salt_b64]: oldKeys, [newKeys.salt_b64]: newKeys }
  let n = 0
  for (const e of Object.values(m.records)) {
    if (e.status === 'missing') continue
    const d = await ws.decodeFile(e.path, { keysBySalt })
    if (e.scope !== 'public' && d.meta.enc.salt_b64 !== newKeys.salt_b64) {
      const { key } = splitRid(d.meta.id)
      const text = await ws.encodeRecord(
        { kind: d.meta.kind, key, authority: d.meta.authority, scope: d.meta.scope, source_vault_id: d.meta.source_vault_id, data: d.data, created_at: d.meta.created_at },
        newKeys,
      )
      replaceAtomicInside(ws.root, e.path, text)
      e.sha256 = await sha256Hex(text)
      n++
    } else {
      e.sha256 = d.fileSha // already under the new key (interrupted run) or public
    }
    e.content_mac = await macHex(newKeys, canonicalJson(d.data))
  }
  // conflict decisions and the account binding are keyed to the MAC/encryption key
  ws.keys = newKeys
  for (const [recordId, decisions] of Object.entries(m.conflict_decisions)) {
    for (const dcs of decisions) {
      const ce = m.records[rid('conflict', dcs.conflict_id)]
      if (!ce || ce.status === 'missing') continue
      const c = (await ws.decodeFile(ce.path, { keysBySalt })).data
      dcs.vault_mac = await macHex(newKeys, canonicalJson(c.vault.record))
    }
    m.conflict_decisions[recordId] = decisions
  }
  if (m.account_binding?.binding_enc) {
    const plain = m.account_binding.binding_enc.salt_b64 === newKeys.salt_b64
      ? await decryptWithKeys(newKeys, m.account_binding.binding_enc)
      : await decryptWithKeys(oldKeys, m.account_binding.binding_enc)
    m.account_binding.binding_enc = await encryptWithKeys(newKeys, plain)
  }
  m.kdf = m.pending_rekey.kdf
  m.key_check = m.pending_rekey.key_check
  m.pending_rekey = null
  await ws.saveManifest()
  // the backup copy of the manifest must not keep the old key check / binding
  replaceAtomicInside(ws.root, MANIFEST_BACKUP, readInside(ws.root, MANIFEST))
  await ws.audit('rekey', { reencrypted: n })
  out(ctx, `Passphrase changed; ${n} file(s) re-encrypted. The old passphrase no longer opens this workspace.`)
  return 0
}

export { WORKSPACE_FORMAT }
