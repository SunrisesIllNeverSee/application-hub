// Guard: no retired Claude model IDs in code, and the import route targets Haiku 5.5.
// Run: node --test tests/model-ids.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const repo = join(root, '..')
const SKIP = new Set(['node_modules', '.next', 'tests', 'test', 'coverage', 'dist', 'build'])
const EXT = /\.(ts|tsx|js|mjs)$/
// Claude 2.x, 3.x (incl. 3.5/3.7) and instant model IDs are retired.
const RETIRED = /claude-(instant|2|3)[\w.-]*/g

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (EXT.test(name)) yield p
  }
}

test('no retired Claude model IDs in app, mcp-server or extension code', () => {
  const hits = []
  const dirs = ['app/app', 'app/lib', 'app/components', 'webextension', 'application-hub-mcp-server/src']
  for (const d of dirs) {
    const abs = join(repo, d)
    if (!existsSync(abs)) continue
    for (const f of walk(abs)) {
      const m = readFileSync(f, 'utf8').match(RETIRED)
      if (m) hits.push(`${f}: ${m.join(', ')}`)
    }
  }
  assert.deepEqual(hits, [])
})

test('application import route targets claude-haiku-5-5', () => {
  const src = readFileSync(join(root, 'app/api/import/application/route.ts'), 'utf8')
  assert.ok(src.includes('claude-haiku-5-5'))
  assert.equal(RETIRED.test(src), false)
})
