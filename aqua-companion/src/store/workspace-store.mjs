// WorkspaceStore — storage abstraction under Workspace (hosted-MCP path).
// The fs implementation is the default; a Supabase implementation
// implements this contract and keeps every Workspace caller unchanged.
// Keys/derive/unlock stay client-side — the store sees ciphertext only.
import fs from 'node:fs/promises'
import path from 'node:path'

const BAD = /[\0]/u
function inside(root, rel) {
  if (!rel || typeof rel !== 'string' || BAD.test(rel)) throw new Error(`bad path: ${JSON.stringify(rel)}`)
  const abs = path.resolve(root, rel)
  const r = path.resolve(root)
  if (abs !== r && !abs.startsWith(r + path.sep)) throw new Error(`path escapes workspace root: ${rel}`)
  if (abs === r) throw new Error(`path is the workspace root itself`)
  return abs
}
async function noSymlinks(abs, root) {
  // refuse if any existing component under root is a symlink
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
    async createManifest(m) { // exclusive create — refuse overwrite
      await noSymlinks(safe('workspace.json'), real)
      const fh = await fs.open(safe('workspace.json'), 'wx')
        .catch((e) => { throw e.code === 'EEXIST' ? Object.assign(new Error('manifest_exists'), { code: 'manifest_exists' }) : e })
      try { await fh.writeFile(JSON.stringify(m, null, 2)); await fh.sync() } finally { await fh.close() }
      return 1
    },
    async saveManifest(m) { // .bak + atomic replace, mirroring Workspace.saveManifest
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
    async replaceFile(p, bytes) { // write-new + rename; missing source errors
      const abs = safe(p); await noSymlinks(abs, real)
      await fs.access(abs).catch(() => { throw new Error(`missing_file:${p}`) })
      const tmp = abs + '.tmp-' + Math.random().toString(36).slice(2)
      const fh = await fs.open(tmp, 'w'); try { await fh.writeFile(bytes); await fh.sync() } finally { await fh.close() }
      await fs.rename(tmp, abs)
    },
    async fileExists(p) { return fs.access(safe(p)).then(() => true, () => false) },
    async moveFile(f, t) { // link+unlink: never overwrites (matches fsafe.moveInside)
      const a = safe(f), b = safe(t); await noSymlinks(a, real)
      await fs.mkdir(path.dirname(b), { recursive: true })
      await fs.access(b).then(() => { throw new Error('file_exists') }, () => {})
      await fs.link(a, b); await fs.unlink(a)
    },
    async listFiles(prefix = '') { // sorted; prefix must match a dir boundary
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
    async appendLog(logRelPath, line) { // full rel path e.g. 'audit/agent.jsonl'
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
    async tx(fn) { return fn() }, // local fs: caller's own serialization
  }
}

/** Hosted store — Supabase rows behind aqua_workspace_commit RPC (migration 064). */
export function createSupabaseStore(client, workspaceRowId) {
  // client = supabase-js with the caller's bearer JWT (RLS does isolation).
  throw new Error('createSupabaseStore: implement against migration 064 (scaffold)')
}

export const __scaffold = true
