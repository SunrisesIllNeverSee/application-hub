// WorkspaceStore — storage abstraction under Workspace (hosted-MCP path).
// The fs implementation (fsafe.mjs) is the default; a Supabase implementation
// implements this contract and keeps every Workspace caller unchanged.
// Keys/derive/unlock stay client-side — the store sees ciphertext only.
import fs from 'node:fs/promises'
import path from 'node:path'

/** Local filesystem store — the default; zero behavior change. */
export function createFsStore(root) {
  const inside = (p) => {
    const abs = path.resolve(root, p)
    if (!abs.startsWith(path.resolve(root) + path.sep) && abs !== path.resolve(root))
      throw new Error(`path escapes workspace root: ${p}`)
    return abs
  }
  return {
    async loadManifest() {
      const buf = await fs.readFile(inside('workspace.json')).catch(() => null)
      return buf ? { manifest: JSON.parse(buf.toString('utf8')), rev: null } : null
    },
    async createManifest(m) { await fs.writeFile(inside('workspace.json'), JSON.stringify(m, null, 2)); return 1 },
    async saveManifest(m) { await fs.writeFile(inside('workspace.json'), JSON.stringify(m, null, 2)); return null },
    async getFile(p) { return fs.readFile(inside(p)).catch(() => null) },
    async putNewFile(p, bytes) {
      const abs = inside(p); await fs.mkdir(path.dirname(abs), { recursive: true })
      const fh = await fs.open(abs, 'wx').catch((e) => { if (e.code === 'EEXIST') throw Object.assign(new Error('file_exists'), { code: 'file_exists' }); throw e })
      try { await fh.writeFile(bytes) } finally { await fh.close() }
    },
    async replaceFile(p, bytes) {
      const abs = inside(p)
      const tmp = abs + '.tmp-' + Math.random().toString(36).slice(2)
      await fs.writeFile(tmp, bytes); await fs.rename(tmp, abs)
    },
    async fileExists(p) { return fs.access(inside(p)).then(() => true, () => false) },
    async moveFile(f, t) { const a = inside(f), b = inside(t); await fs.mkdir(path.dirname(b), { recursive: true }); await fs.rename(a, b) },
    async listFiles(prefix = '') {
      const out = []
      const walk = async (dir) => {
        for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
          const rel = path.relative(root, path.join(dir, e.name))
          if (e.isDirectory()) await walk(path.join(dir, e.name))
          else if (!prefix || rel.startsWith(prefix)) out.push(rel)
        }
      }
      await walk(root); return out
    },
    async appendLog(name, line) {
      const abs = inside(`audit/${name}`)
      await fs.mkdir(path.dirname(abs), { recursive: true })
      await fs.appendFile(abs, line + '\n')
    },
    async readLogTail(name) {
      const buf = await fs.readFile(inside(`audit/${name}`), 'utf8').catch(() => null)
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
