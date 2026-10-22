// The companion workspace: layout, manifest, encrypted record files, and the
// append-only audit log. See docs/SYNC.md for the authority model.

import fs from 'node:fs'
import path from 'node:path'
import {
  canonicalJson, decryptWithKeys, deriveWorkspaceKeys, encryptWithKeys, macHex, newSaltB64, newUuid,
  nowIso, sha256Hex, PBKDF2_ITERATIONS, DecryptError,
} from './crypto.mjs'
import {
  appendInside, existsInside, mkdirInside, normalizeRel, readInside, realRoot, replaceAtomicInside,
  resolveInside, walkInside, writeNewInside, PathSafetyError,
} from './fsafe.mjs'

export const COMPANION_VERSION = '0.2.0'
export const SCHEMA_VERSION = 1
export const MANIFEST = 'workspace.json'
export const MANIFEST_BACKUP = 'workspace.json.bak'
export const WORKSPACE_FORMAT = 'aqua-companion-workspace'
export const RECORD_FORMAT = 1
export const AUDIT_LOG = 'audit/companion.jsonl'
export const CONFLICT_LOG = 'audit/conflicts.jsonl'
/** One hash-chained line per agent (MCP) tool call: tool, tier, keyed args digest, result status. */
export const AGENT_LOG = 'audit/agent.jsonl'
/** Files the user places here are the only files the agent interface may read. */
export const INBOX_DIR = 'inbox'

export const AUTHORITY_STATEMENT =
  'The AQUA browser vault is the private authority. This folder holds (a) encrypted projections of vault backups, ' +
  '(b) staged local records that reach the vault only when you export them and restore the file in the browser, and ' +
  '(c) a cache of public catalog data. Nothing here syncs automatically, and nothing here can approve or sign an answer.'

export const LAYOUT_DIRS = [
  'applications/active',
  'applications/queued',
  'applications/submitted',
  'applications/intake',
  'catalog-cache/programs',
  'catalog-cache/questions',
  'catalog-cache/unclassified',
  'answers/drafts',
  'answers/approved',
  'answers/history',
  'facts',
  'evidence',
  'reviews/comments',
  'reviews/suggestions',
  'reviews/conflicts',
  'packets',
  'exports',
  'inbox',
  'audit/quarantine',
  'audit/vault-ledger',
]

/** Record kinds: where they live and how they behave. */
export const KINDS = {
  answer: { dirs: { projection: 'answers/history', staging: 'answers/drafts' } },
  version: { dirs: { projection: 'answers/history', staging: 'answers/drafts' } },
  provenance: { dirs: { projection: 'answers/history' } },
  approval: { dirs: { projection: 'answers/approved' }, decision: true },
  app_instance: { dirs: { projection: 'applications/active', staging: 'applications/queued' } },
  source_document: { dirs: { staging: 'applications/queued/sources' }, localOnly: true },
  intake: { dirs: { projection: 'applications/intake' } },
  catalog: { dirs: { projection: 'catalog-cache/programs' }, public: true },
  catalog_private: { dirs: { projection: 'catalog-cache/unclassified' } },
  fact: { dirs: { projection: 'facts' } },
  evidence: { dirs: { projection: 'evidence', staging: 'evidence' } },
  review: { dirs: { projection: 'reviews' }, decision: true },
  comment: { dirs: { projection: 'reviews/comments', staging: 'reviews/comments' } },
  suggestion: { dirs: { projection: 'reviews/suggestions' }, decision: true },
  packet: { dirs: { projection: 'packets' }, decision: true },
  signoff: { dirs: { projection: 'packets' }, decision: true },
  packet_state: { dirs: { projection: 'packets' } },
  event: { dirs: { projection: 'audit/vault-ledger' } },
  import: { dirs: { projection: 'audit/vault-ledger' } },
  conflict: { dirs: { staging: 'reviews/conflicts' }, localOnly: true },
  // Agent-interface records that never leave the workspace (not part of export-backup):
  evidence_request: { dirs: { staging: 'reviews/suggestions' }, localOnly: true },
  submission_observation: { dirs: { staging: 'packets/observations' }, localOnly: true },
}

export class WorkspaceError extends Error {
  constructor(message, exitCode = 1) {
    super(message)
    this.name = 'WorkspaceError'
    this.exitCode = exitCode
  }
}

export function rid(kind, key) {
  return `${kind}:${key}`
}

export function splitRid(r) {
  const i = r.indexOf(':')
  return i < 0 ? { kind: null, key: r } : { kind: r.slice(0, i), key: r.slice(i + 1) }
}

/** Filename for a record. Filenames are NOT identity; the id inside is. */
export function fileNameFor(kind, key) {
  const safe = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(key) ? key : null
  return `${kind}-${safe ?? `h${hashName(key)}`}.json`
}

function hashName(key) {
  // short, deterministic, filesystem-safe name for ids that are not filename-safe
  let h = 0x811c9dc5
  for (const ch of key) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193) >>> 0
  return `${h.toString(16).padStart(8, '0')}${key.length.toString(16)}`
}

export function isWorkspaceManifest(obj) {
  return Boolean(obj && obj.format === WORKSPACE_FORMAT && typeof obj.workspace_id === 'string')
}

export function readManifestAt(root) {
  const p = path.join(root, MANIFEST)
  if (!fs.existsSync(p)) return null
  const st = fs.lstatSync(p)
  if (!st.isFile()) throw new PathSafetyError(`${MANIFEST} is not a regular file`)
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return { __unparseable: true }
  }
}

/** Find the workspace root: --workspace, AQUA_WORKSPACE, or cwd and its parents. */
export function locateWorkspace(ctx, { allowBroken = false } = {}) {
  const explicit = ctx.flags.workspace ?? ctx.env.AQUA_WORKSPACE
  const candidates = []
  if (explicit) {
    const abs = path.resolve(ctx.cwd, explicit)
    candidates.push(abs, path.join(abs, 'AQUA'))
  } else {
    let cur = path.resolve(ctx.cwd)
    for (;;) {
      candidates.push(cur, path.join(cur, 'AQUA'))
      const parent = path.dirname(cur)
      if (parent === cur) break
      cur = parent
    }
  }
  for (const c of candidates) {
    if (!fs.existsSync(path.join(c, MANIFEST))) {
      // recover can work from the manifest backup or the companion's own audit log
      if (allowBroken && (fs.existsSync(path.join(c, MANIFEST_BACKUP)) || fs.existsSync(path.join(c, 'audit', 'companion.jsonl')))) {
        return realRoot(c)
      }
      continue
    }
    const m = readManifestAt(c)
    if (m && (isWorkspaceManifest(m) || m.__unparseable)) return realRoot(c)
  }
  throw new WorkspaceError(
    explicit
      ? `No AQUA workspace found at ${explicit}. Run "aqua-companion init --path <folder>" to create one.`
      : 'No AQUA workspace found here. Pass --workspace <folder> or run "aqua-companion init --path <folder>".',
    2,
  )
}

export class Workspace {
  constructor(ctx, root, manifest) {
    this.ctx = ctx
    this.root = root
    this.manifest = manifest
    this.keys = null
    // MAC of the manifest as loaded; saveManifest refuses if the disk copy moved on
    this.loadedMac = manifest ? manifest.manifest_mac ?? null : undefined
  }

  static open(ctx, { allowBrokenManifest = false } = {}) {
    const root = locateWorkspace(ctx, { allowBroken: allowBrokenManifest })
    const manifest = readManifestAt(root)
    if (!manifest || manifest.__unparseable) {
      if (!allowBrokenManifest) {
        throw new WorkspaceError(`${MANIFEST} is unreadable. Run "aqua-companion recover" to rebuild it.`, 4)
      }
      return new Workspace(ctx, root, null)
    }
    if (manifest.schema_version > SCHEMA_VERSION) {
      throw new WorkspaceError(
        `This workspace uses schema ${manifest.schema_version}; this companion supports ${SCHEMA_VERSION}. Update aqua-companion.`,
      )
    }
    return new Workspace(ctx, root, manifest)
  }

  get records() {
    return this.manifest.records
  }

  /**
   * Derive keys, check the key-check value and the manifest MAC. An
   * interrupted passphrase change (pending_rekey) blocks normal use until
   * "rekey" finishes it.
   */
  async unlock(passphrase, { allowManifestMismatch = false, allowPendingRekey = false } = {}) {
    const m = this.manifest
    const keys = await deriveWorkspaceKeys(passphrase, m.kdf.salt_b64, m.kdf.iters)
    let ok = false
    try {
      ok = (await decryptWithKeys(keys, m.key_check)) === keyCheckText(m.workspace_id)
    } catch {
      ok = false
    }
    if (!ok) throw new DecryptError('Wrong passphrase for this workspace.')
    this.keys = keys
    if (m.pending_rekey && !allowPendingRekey) {
      throw new WorkspaceError(
        'A passphrase change was interrupted. Finish it with "aqua-companion rekey" (old passphrase in AQUA_PASSPHRASE, new one in AQUA_NEW_PASSPHRASE).',
        4,
      )
    }
    if (!allowManifestMismatch) {
      const expected = await this.manifestMac(m)
      if (expected !== m.manifest_mac) {
        throw new WorkspaceError(`${MANIFEST} was changed outside the companion (integrity check failed). Run "aqua-companion verify", then "recover".`, 4)
      }
    }
    return this
  }

  async manifestMac(m) {
    const { manifest_mac: _m, ...rest } = m
    return macHex(this.keys, canonicalJson(rest))
  }

  async contentMac(data) {
    return macHex(this.keys, canonicalJson(data))
  }

  /**
   * Save the manifest. Refuses when the file on disk changed since this run
   * loaded it (another companion run saved in between): no last-write-wins
   * on the index either.
   */
  async saveManifest({ expectAbsent = false } = {}) {
    if (!expectAbsent && this.loadedMac !== undefined) {
      const onDisk = readManifestAt(this.root)
      const diskMac = onDisk && !onDisk.__unparseable ? onDisk.manifest_mac ?? null : null
      if (diskMac !== this.loadedMac) {
        throw new WorkspaceError(
          'The workspace was changed by another aqua-companion run while this one was working. Nothing in the index was overwritten; run "aqua-companion verify" (and "recover" to adopt any files this run wrote), then try again.',
          4,
        )
      }
    }
    this.manifest.updated_at = nowIso()
    this.manifest.manifest_mac = await this.manifestMac(this.manifest)
    const text = `${JSON.stringify(this.manifest, null, 2)}\n`
    if (existsInside(this.root, MANIFEST)) {
      replaceAtomicInside(this.root, MANIFEST_BACKUP, readInside(this.root, MANIFEST))
    }
    replaceAtomicInside(this.root, MANIFEST, text)
    this.loadedMac = this.manifest.manifest_mac
  }

  /** Append one hash-chained line to an audit log. Never rewritten. */
  async audit(op, details = {}, log = AUDIT_LOG) {
    let prev = null
    let seq = 1
    if (existsInside(this.root, log)) {
      const lines = readInside(this.root, log).toString('utf8').split('\n').filter(Boolean)
      if (lines.length) {
        prev = await sha256Hex(lines[lines.length - 1])
        try {
          seq = (JSON.parse(lines[lines.length - 1]).seq ?? lines.length) + 1
        } catch {
          seq = lines.length + 1
        }
      }
    }
    const entry = { seq, at: nowIso(), op, ...details, prev }
    appendInside(this.root, log, `${JSON.stringify(entry)}\n`)
    return entry
  }

  /** Choose a NEW file path for a record (never reuses an existing file). */
  allocatePath(kind, authority, key, dirOverride = null) {
    const spec = KINDS[kind]
    if (!spec) throw new WorkspaceError(`unknown record kind: ${kind}`)
    const dir = dirOverride ?? spec.dirs[authority] ?? spec.dirs.projection ?? spec.dirs.staging
    const base = fileNameFor(kind, key)
    let rel = `${dir}/${base}`
    for (let n = 2; existsInside(this.root, rel); n++) rel = `${dir}/${base.replace(/\.json$/, `.${n}.json`)}`
    return normalizeRel(rel)
  }

  /** Serialize a record file. Private data is encrypted; public catalog data is plaintext. */
  async encodeRecord({ kind, key, authority, scope, source_vault_id, data, created_at }, keys = this.keys) {
    const head = {
      aqua_record: RECORD_FORMAT,
      workspace_id: this.manifest.workspace_id,
      id: rid(kind, key),
      kind,
      scope,
      authority,
      created_at: created_at ?? nowIso(),
    }
    if (source_vault_id) head.source_vault_id = source_vault_id
    if (scope === 'public') head.data = data
    else head.enc = await encryptWithKeys(keys, canonicalJson(data), recordAad(head))
    head.sha256 = await sha256Hex(canonicalJson(head))
    return `${JSON.stringify(head, null, 2)}\n`
  }

  /**
   * Write a NEW record file and return its manifest entry (caller saves the
   * manifest). Never overwrites.
   */
  async writeRecord({ kind, key, authority, scope = 'private', source_vault_id = null, data, dir = null, extra = {} }) {
    if (KINDS[kind]?.public) scope = 'public'
    const relPath = this.allocatePath(kind, authority, key, dir)
    const text = await this.encodeRecord({ kind, key, authority, scope, source_vault_id, data })
    writeNewInside(this.root, relPath, text)
    const now = nowIso()
    return {
      kind,
      path: relPath,
      authority,
      scope,
      ...(source_vault_id ? { source_vault_id } : {}),
      sha256: await sha256Hex(text),
      content_mac: await this.contentMac(data),
      status: 'live',
      created_at: now,
      updated_at: now,
      ...extra,
    }
  }

  /** Parse + verify + decrypt a record file. Throws on any integrity failure. */
  async decodeFile(relPath, { keysBySalt = null } = {}) {
    const bytes = readInside(this.root, relPath)
    const fileSha = await sha256Hex(bytes)
    let rec
    try {
      rec = JSON.parse(bytes.toString('utf8'))
    } catch {
      throw new WorkspaceError(`${relPath}: not valid JSON`)
    }
    if (!rec || rec.aqua_record !== RECORD_FORMAT || typeof rec.id !== 'string' || typeof rec.kind !== 'string') {
      throw new WorkspaceError(`${relPath}: not an AQUA record file`)
    }
    const { sha256: selfSha, ...head } = rec
    if ((await sha256Hex(canonicalJson(head))) !== selfSha) throw new WorkspaceError(`${relPath}: record checksum mismatch`)
    let data
    if (rec.scope === 'public') data = rec.data
    else {
      let keys = this.keys
      if (keysBySalt && rec.enc?.salt_b64 && keysBySalt[rec.enc.salt_b64]) keys = keysBySalt[rec.enc.salt_b64]
      data = JSON.parse(await decryptWithKeys(keys, rec.enc, recordAad(rec)))
    }
    return { meta: rec, data, fileSha, contentMac: this.keys ? await this.contentMac(data) : null }
  }

  /** Read a record by workspace id (exact rid, or a bare key when unique). */
  resolveId(idOrKey) {
    if (this.records[idOrKey]) return idOrKey
    let matches = Object.keys(this.records).filter((r) => splitRid(r).key === idOrKey)
    // provenance / signoff / packet_state share their key with a version or packet
    if (matches.length > 1) {
      const primary = matches.filter((r) => !['provenance', 'signoff', 'packet_state'].includes(splitRid(r).kind))
      if (primary.length === 1) matches = primary
    }
    if (matches.length === 1) return matches[0]
    if (matches.length > 1) throw new WorkspaceError(`Ambiguous id ${idOrKey}; use one of: ${matches.join(', ')}`, 2)
    throw new WorkspaceError(`No record with id ${idOrKey}.`, 2)
  }

  async readRecord(idOrKey) {
    return this.decodeEntry(this.resolveId(idOrKey))
  }

  /**
   * Manifest-driven read: the file must decrypt, carry the indexed id and
   * kind, and match the indexed content MAC (so an older or swapped file is
   * refused even if it is internally consistent).
   */
  async decodeEntry(r) {
    const entry = this.records[r]
    if (!entry) throw new WorkspaceError(`No record with id ${r}.`, 2)
    if (entry.status === 'missing') throw new WorkspaceError(`${r} is recorded as missing (its file was lost or quarantined).`, 4)
    let decoded
    try {
      decoded = await this.decodeFile(entry.path)
    } catch (e) {
      if (e.code === 'ENOENT') throw new WorkspaceError(`${r}: file missing (${entry.path}). Run "aqua-companion verify".`, 4)
      throw e
    }
    if (decoded.meta.id !== r.split('#')[0] || decoded.meta.kind !== entry.kind) {
      throw new WorkspaceError(`${entry.path}: id or kind inside the file does not match the manifest. Run "aqua-companion verify".`, 4)
    }
    if (decoded.contentMac !== entry.content_mac) {
      throw new WorkspaceError(`${r}: content does not match the manifest (changed outside the companion). Run "aqua-companion verify".`, 4)
    }
    return { rid: r, entry, ...decoded }
  }

  liveEntries(filter = () => true) {
    return Object.entries(this.records).filter(([, e]) => e.status !== 'archived' && filter(e))
  }

  /** All files under record directories (for orphan detection / recovery). */
  recordFiles() {
    const all = walkInside(this.root)
    const files = all.files.filter(
      (f) => f.endsWith('.json') && !f.startsWith('audit/quarantine/') && !f.startsWith('exports/') && !f.startsWith(`${INBOX_DIR}/`) &&
        f !== MANIFEST && f !== MANIFEST_BACKUP && !f.includes('.tmp-'),
    )
    return { files, symlinks: all.symlinks, other: all.other }
  }
}

/** AES-GCM additional data for a record file: binds ciphertext to its workspace, id and kind. */
export function recordAad(head) {
  return `aqua-companion/record/v1|${head.workspace_id}|${head.id}|${head.kind}`
}

export function keyCheckText(workspaceId) {
  return `aqua-companion-key-check:v1:${workspaceId}`
}

/** Build a fresh manifest object (caller writes it). */
export async function newManifest(passphrase) {
  const workspace_id = `WS-${newUuid()}`
  const salt_b64 = newSaltB64()
  const keys = await deriveWorkspaceKeys(passphrase, salt_b64, PBKDF2_ITERATIONS)
  const now = nowIso()
  const manifest = {
    format: WORKSPACE_FORMAT,
    schema_version: SCHEMA_VERSION,
    workspace_id,
    created_at: now,
    updated_at: now,
    companion_version: COMPANION_VERSION,
    authority: {
      private_authority: 'aqua-browser-vault',
      workspace_role: ['projection', 'staging', 'public-catalog-cache'],
      statement: AUTHORITY_STATEMENT,
      automatic_sync: false,
      last_write_wins: false,
    },
    bridge: { format: 'aqua-local-backup', backup_format_version: 2 },
    encryption: {
      cipher: 'AES-GCM-256',
      record_scope: 'every private record file is encrypted; only ids, kinds, authority, scope and checksums are plaintext',
      public_plaintext: ['catalog-cache/programs', 'catalog-cache/questions'],
    },
    kdf: { alg: 'PBKDF2-SHA256', iters: PBKDF2_ITERATIONS, salt_b64 },
    key_check: await encryptWithKeys(keys, keyCheckText(workspace_id)),
    pending_rekey: null,
    account_binding: null,
    records: {},
    conflict_decisions: {},
    imports: [],
    exports: [],
    relocated_to: null,
    relocated_from: null,
  }
  return { manifest, keys }
}

export function dirsForInit() {
  return LAYOUT_DIRS.slice()
}

export function workspaceReadme(manifest) {
  return [
    'AQUA companion workspace',
    '========================',
    '',
    `Workspace id: ${manifest.workspace_id}`,
    `Created: ${manifest.created_at} by aqua-companion ${manifest.companion_version}`,
    '',
    AUTHORITY_STATEMENT,
    '',
    'Files here are managed by aqua-companion. Private records are encrypted with your',
    'workspace passphrase (AES-GCM-256, PBKDF2-SHA256 210,000 iterations). The passphrase',
    'is never stored. If you lose it, the encrypted records cannot be read.',
    '',
    'Plaintext appears only in: workspace.json (ids, kinds, checksums, no answer text),',
    'catalog-cache/programs and catalog-cache/questions (public catalog data), audit/*.jsonl',
    '(operation log: ids, counts and checksums only), and anything YOU export with',
    '"aqua-companion export --plaintext".',
    '',
    'Run "aqua-companion verify" to check integrity and "aqua-companion recover" to repair.',
    'Do not rename or edit files by hand; identity lives inside each file and in workspace.json.',
    '',
  ].join('\n')
}

export { mkdirInside, writeNewInside, resolveInside }
