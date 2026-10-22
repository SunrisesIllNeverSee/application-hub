// Guards against dead ends in agent/human discovery surfaces: every
// https://aquaidp.xyz/<path> advertised in the discovery documents must map to
// a real route, page or public file, and no user-facing file may link the
// retired mos2es.xyz domain (it only appears in vercel.json host redirects).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'

const APP = new URL('..', import.meta.url).pathname

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue
    const p = join(dir, entry.name)
    if (entry.isDirectory()) await walk(p, out)
    else out.push(p)
  }
  return out
}

async function exists(p) {
  try { await stat(p); return true } catch { return false }
}

// Route segments under app/app, with (group) folders removed.
async function routeTable() {
  const files = (await walk(join(APP, 'app'))).filter((f) => /\/(page|route)\.tsx?$/.test(f))
  return files.map((f) =>
    relative(join(APP, 'app'), f)
      .split('/')
      .slice(0, -1)
      .filter((seg) => !/^\(.*\)$/.test(seg)),
  )
}

function matches(segments, pathSegs) {
  let i = 0
  for (const seg of segments) {
    if (/^\[\[?\.\.\./.test(seg)) return true
    if (i >= pathSegs.length) return false
    if (!/^\[.*\]$/.test(seg) && seg !== pathSegs[i]) return false
    i++
  }
  return i === pathSegs.length
}

const DISCOVERY = [
  'app/.well-known',
  'public/llms.txt',
  'public/llms-full.txt',
  'public/.well-known',
]

test('every advertised aquaidp.xyz path resolves to a route, page or public file', async () => {
  const routes = await routeTable()
  const sources = []
  for (const d of DISCOVERY) {
    const p = join(APP, d)
    if (!(await exists(p))) continue
    if ((await stat(p)).isDirectory()) sources.push(...(await walk(p)))
    else sources.push(p)
  }
  const dead = []
  for (const file of sources) {
    const text = await readFile(file, 'utf8')
    for (const m of text.matchAll(/https:\/\/aquaidp\.xyz(\/[A-Za-z0-9._\-/]*)?/g)) {
      const path = (m[1] || '/').replace(/[.]+$/, '').replace(/\/$/, '') || '/'
      const segs = path.split('/').filter(Boolean)
      const ok =
        path === '/' ||
        // API base URL (servers/anchor entries), not a page.
        path === '/api' ||
        // Next metadata routes (app/sitemap.ts, app/robots.ts).
        (path === '/sitemap.xml' && (await exists(join(APP, 'app', 'sitemap.ts')))) ||
        (path === '/robots.txt' && ((await exists(join(APP, 'app', 'robots.ts'))) || (await exists(join(APP, 'public', 'robots.txt'))))) ||
        routes.some((r) => matches(r, segs)) ||
        (await exists(join(APP, 'public', path)))
      if (!ok) dead.push(`${relative(APP, file)} → ${path}`)
    }
  }
  assert.deepEqual([...new Set(dead)], [])
})

test('/.well-known paths are not rewritten by markdown negotiation', async () => {
  const mw = await readFile(join(APP, 'middleware.ts'), 'utf8')
  assert.match(mw, /NON_NEGOTIATED_PREFIXES = \[[^\]]*'\/\.well-known\/'/)
})

test('no user-facing file links the retired mos2es.xyz domain', async () => {
  const files = [
    ...(await walk(join(APP, 'app'))),
    ...(await walk(join(APP, 'components'))),
    ...(await walk(join(APP, 'public'))),
  ].filter((f) => /\.(tsx?|mjs|js|txt|json|md)$/.test(f))
  const hits = []
  for (const f of files) {
    if ((await readFile(f, 'utf8')).includes('mos2es.xyz')) hits.push(relative(APP, f))
  }
  assert.deepEqual(hits, [])
})
