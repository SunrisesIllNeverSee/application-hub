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
  // M09b: every agent-facing surface, including the generated guidance data
  'lib/agent-content.mjs',
  'lib/agent-guidance.generated.json',
  'lib/agent-guidance.generated.mjs',
  'app/agents/page.tsx',
  'app/developers/page.tsx',
  'app/(auth)/login/page.tsx',
]

const GUIDANCE = JSON.parse(await readFile(join(APP, 'lib/agent-guidance.generated.json'), 'utf8'))
const { MARKDOWN_PAGES } = await import(new URL('../lib/agent-content.mjs', import.meta.url).href)

/**
 * The companion tarball paths are written by aqua-companion/scripts/pack-site.mjs.
 * Once packed (public/companion/latest.json exists) they must be real files;
 * before that they are accepted only while the generated guidance itself
 * says the tarball is not packed yet (sha256 "pending").
 */
async function companionPathOk(path) {
  if (!path.startsWith('/companion/')) return false
  if (await exists(join(APP, 'public', path))) return true
  const t = GUIDANCE.companion.tarball
  const advertised = [t.url, t.sha256_url, t.latest_url].map((u) => new URL(u).pathname)
  return !(await exists(join(APP, 'public/companion/latest.json'))) && t.packed === false && t.sha256 === 'pending' && advertised.includes(path)
}

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
        (await exists(join(APP, 'public', path))) ||
        // `.md` twins are served by middleware Markdown negotiation from MARKDOWN_PAGES
        (path.endsWith('.md') && Boolean(MARKDOWN_PAGES[path.slice(0, -3) || '/'])) ||
        (await companionPathOk(path))
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

test('/agents has a Markdown twin (/agents.md, Accept: text/markdown) built from the generated guidance', () => {
  const md = MARKDOWN_PAGES['/agents']
  assert.ok(md && md.length > 2000)
  assert.match(md, /^# AQUA agent guide/)
  assert.ok(md.includes(GUIDANCE.install.help))
  for (const t of GUIDANCE.tools) assert.ok(md.includes(`\`${t.name}\``), t.name)
})

test('once packed, the served companion tarball, its .sha256 and latest.json agree', async () => {
  const latestPath = join(APP, 'public/companion/latest.json')
  if (!(await exists(latestPath))) return // not packed yet (see companionPathOk)
  const latest = JSON.parse(await readFile(latestPath, 'utf8'))
  const file = join(APP, 'public', new URL(latest.url).pathname)
  assert.ok(await exists(file), 'tarball is served')
  const { createHash } = await import('node:crypto')
  const sha = createHash('sha256').update(await readFile(file)).digest('hex')
  assert.equal(sha, latest.sha256)
  assert.match(await readFile(`${file}.sha256`, 'utf8'), new RegExp(`^${sha}\\b`))
  assert.equal(GUIDANCE.companion.tarball.sha256, sha, 'generated guidance carries the served sha256')
})
