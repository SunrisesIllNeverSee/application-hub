// VENDORED from aqua-companion/src/store/workspace-store.mjs. Do not edit: change the source and run
// `npm run vendor:companion` in application-hub-mcp-server/ (CI checks these copies).
// WorkspaceStore — storage abstraction under Workspace (hosted-MCP path).
// The fs implementation is the default; the Supabase implementation is the
// hosted path. Keys/derive/unlock stay client-side — the store sees
// ciphertext only. Semantics match createFsStore exactly (O_EXCL put,
// never-overwrite move, atomic replace, dir-boundary list).
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { resolveInside } from '../fsafe.mjs'

const BAD = /[\0]/u
function inside(root, rel) {
  if (!rel || typeof rel !== 'string' || BAD.test(rel)) throw new Error(`bad path: ${JSON.stringify(rel)}`)
  const abs = resolveInside(root, rel)  // fsafe: normalization + escape + symlink rules
  if (abs === path.resolve(root)) throw new Error(`path is the workspace root itself`)
  return abs
}
async function noSymlinks(abs, root) {
  let cur = path.resolve(root)
  const parts = path.relative(root, abs).split(path.sep)
  for (const p of parts) {
    cur = path.join(cur, p)
    const st = await fs.lstat(cur).catch(() => null)
    if (st?.isSymbolicLink()) throw new Error(`symlink refused: ${cur}`)
  }
}

/** Local filesystem store — the default; zero behavior change for Workspace callers. */
export function createFsStore(root) {
  const real = path.resolve(root)
  const safe = (rel) => inside(real, rel)
  return {
    async loadManifest() {
      const buf = await fs.readFile(safe('workspace.json')).catch(() => null)
      return buf ? { manifest: JSON.parse(buf.toString('utf8')), rev: null } : null
    },
    async createManifest(m) {
      await noSymlinks(safe('workspace.json'), real)
      const fh = await fs.open(safe('workspace.json'), 'wx')
        .catch((e) => { throw e.code === 'EEXIST' ? Object.assign(new Error('manifest_exists'), { code: 'manifest_exists' }) : e })
      try { await fh.writeFile(JSON.stringify(m, null, 2)); await fh.sync() } finally { await fh.close() }
      return 1
    },
    async saveManifest(m) {
      const abs = safe('workspace.json')
      await fs.copyFile(abs, abs + '.bak').catch(() => {})
      const tmp = abs + '.tmp-' + Math.random().toString(36).slice(2)
      const fh = await fs.open(tmp, 'w'); try { await fh.writeFile(JSON.stringify(m, null, 2)); await fh.sync() } finally { await fh.close() }
      await fs.rename(tmp, abs)
      return null
    },
    async getFile(p) {
      const abs = safe(p); await noSymlinks(abs, real)
      return fs.readFile(abs).catch(() => null)
    },
    async putNewFile(p, bytes) {
      const abs = safe(p); await noSymlinks(abs, real)
      await fs.mkdir(path.dirname(abs), { recursive: true })
      const fh = await fs.open(abs, 'wx')
        .catch((e) => { throw e.code === 'EEXIST' ? Object.assign(new Error('file_exists'), { code: 'file_exists' }) : e })
      try { await fh.writeFile(bytes); await fh.sync() } finally { await fh.close() }
    },
    async replaceFile(p, bytes) {
      const abs = safe(p); await noSymlinks(abs, real)
      await fs.access(abs).catch(() => { throw new Error(`missing_file:${p}`) })
      const tmp = abs + '.tmp-' + Math.random().toString(36).slice(2)
      const fh = await fs.open(tmp, 'w'); try { await fh.writeFile(bytes); await fh.sync() } finally { await fh.close() }
      await fs.rename(tmp, abs)
    },
    async fileExists(p) { return fs.access(safe(p)).then(() => true, () => false) },
    async moveFile(f, t) {
      const a = safe(f), b = safe(t); await noSymlinks(a, real)
      await fs.mkdir(path.dirname(b), { recursive: true })
      await fs.access(b).then(() => { throw new Error('file_exists') }, () => {})
      await fs.link(a, b); await fs.unlink(a)
    },
    async listFiles(prefix = '') {
      const out = []
      const walk = async (dir) => {
        for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
          const full = path.join(dir, e.name), rel = path.relative(real, full)
          if (e.isDirectory()) await walk(full)
          else if (!prefix || rel === prefix || rel.startsWith(prefix.endsWith('/') ? prefix : prefix + '/')) out.push(rel)
        }
      }
      await walk(real)
      return out.sort()
    },
    async appendLog(logRelPath, line) {
      const abs = safe(logRelPath); await noSymlinks(abs, real)
      await fs.mkdir(path.dirname(abs), { recursive: true })
      await fs.appendFile(abs, line + '\n')
    },
    async readLogTail(logRelPath) {
      const buf = await fs.readFile(safe(logRelPath), 'utf8').catch(() => null)
      if (!buf) return { lastLine: null }
      const lines = buf.trimEnd().split('\n')
      return { lastLine: lines[lines.length - 1] || null }
    },
    async tx(fn) { return fn() },
  }
}

// PostgREST bytea returns "\x<hex>" or base64 depending on accept headers.
function decodeFile(v) {
  if (v == null) return null
  if (typeof v === 'string' && v.startsWith('\\x')) return Buffer.from(v.slice(2), 'hex')
  return Buffer.from(v, 'base64')
}
const hex = (bytes) => '\\x' + Buffer.from(bytes).toString('hex')
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const norm = (p) => {
  const n = path.posix.normalize(String(p).replaceAll('\\', '/'))
  if (n === '..' || n.startsWith('../') || path.posix.isAbsolute(n)) throw new Error(`bad path: ${JSON.stringify(p)}`)
  return n
}
const err = (code) => Object.assign(new Error(code), { code })

/**
 * Hosted store — Supabase rows behind migration 064.
 * @param client supabase-js client built with the caller's bearer JWT
 *               (RLS enforces account isolation; never service_role).
 * @param workspaceRowId aqua_workspaces.id (uuid).
 * File ops go through direct table calls (unique-conflict = file_exists);
 * saveManifest goes through the aqua_workspace_commit CAS RPC, which
 * additionally computes sha256 and appends audit in one transaction.
 */
export function createSupabaseStore(client, workspaceRowId) {
  const T_WS = 'aqua_workspaces', T_REC = 'aqua_workspace_records', T_AUD = 'aqua_workspace_audit'
  let rev = null
  return {
    async loadManifest() {
      const { data, error } = await client.from(T_WS).select('manifest, manifest_rev').eq('id', workspaceRowId).single()
      if (error || !data) return null
      rev = data.manifest_rev
      return { manifest: data.manifest, rev }
    },
    async createManifest(m) {
      const { error } = await client.from(T_WS).insert({ id: workspaceRowId, workspace_key: m.workspace_id, manifest: m })
      if (error) throw error.code === '23505' ? err('manifest_exists') : err(error.message)
      rev = 1; return 1
    },
    async saveManifest(m, expectRev = rev, ops = [], audit = []) {
      const { data, error } = await client.rpc('aqua_workspace_commit', {
        p_workspace_id: workspaceRowId, p_expected_rev: expectRev,
        p_manifest: m, p_ops: ops, p_audit: audit,
      })
      if (error) throw error.code === 'P0404' ? err('manifest_rev_conflict') : err(error.message)
      rev = data; return rev
    },
    async getFile(p) {
      const { data, error } = await client.from(T_REC).select('file').eq('workspace_id', workspaceRowId).eq('path', norm(p)).single()
      return error || !data ? null : decodeFile(data.file)
    },
    async putNewFile(p, bytes) {
      const { error } = await client.from(T_REC).insert({ workspace_id: workspaceRowId, path: norm(p), sha256: sha(bytes), file: hex(bytes) })
      if (error) throw error.code === '23505' ? err('file_exists') : err(error.message)
    },
    async replaceFile(p, bytes) {
      const { data, error } = await client.from(T_REC).update({ file: hex(bytes), sha256: sha(bytes) })
        .eq('workspace_id', workspaceRowId).eq('path', norm(p)).select('path')
      if (error) throw err(error.message)
      if (!data?.length) throw err(`missing_file:${p}`)
    },
    async fileExists(p) { return fileExists(p) },
    async moveFile(f, t) {
      f = norm(f); t = norm(t)
      if (await fileExists(t)) throw err('file_exists')
      const { data, error } = await client.from(T_REC).update({ path: t }).eq('workspace_id', workspaceRowId).eq('path', f).select('path')
      if (error) throw error.code === '23505' ? err('file_exists') : err(error.message)
      if (!data?.length) throw err(`missing_file:${f}`)
    },
    async listFiles(prefix = '') {
      const { data, error } = await client.from(T_REC).select('path').eq('workspace_id', workspaceRowId).order('path')
      if (error) throw err(error.message)
      const pre = prefix.endsWith('/') ? prefix : prefix + '/'
      return (data ?? []).map((r) => r.path).filter((p) => !prefix || p === prefix || p.startsWith(pre))
    },
    async appendLog(logRelPath, line) {
      const tail = await readLogTail(logRelPath)
      let seq = 1, prev = null
      if (tail.lastLine) {
        try { seq = (JSON.parse(tail.lastLine).seq ?? 0) + 1 } catch { seq = 2 }
        prev = sha(Buffer.from(tail.lastLine, 'utf8'))  // engine: sha256 of the raw previous line text
      }
      const entry = (() => { try { return JSON.parse(line) } catch { return { text: line } } })()
      const { error } = await client.from(T_AUD).insert({ workspace_id: workspaceRowId, log_name: logRelPath, seq, entry, prev })
      if (error) throw err(error.message)
    },
    async readLogTail(logRelPath) { return readLogTail(logRelPath) },
    async tx(fn) { return fn() }, // atomic bundles go through saveManifest's ops/audit params
  }
  async function fileExists(p) {
    const { data } = await client.from(T_REC).select('path', { head: false }).eq('workspace_id', workspaceRowId).eq('path', norm(p)).limit(1)
    return (data?.length ?? 0) > 0
  }
  async function readLogTail(logRelPath) {
    const { data, error } = await client.from(T_AUD).select('entry').eq('workspace_id', workspaceRowId).eq('log_name', logRelPath).order('seq', { ascending: false }).limit(1)
    if (error || !data?.length) return { lastLine: null }
    return { lastLine: typeof data[0].entry === 'string' ? data[0].entry : JSON.stringify(data[0].entry) }
  }
}
