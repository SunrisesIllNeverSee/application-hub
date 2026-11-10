// Guard: no retired Claude model IDs in app code. Run: node --test tests/model-ids.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKIP = new Set(['node_modules', '.next', 'tests', 'coverage'])
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

test('no retired Claude model IDs in app code', () => {
  const hits = []
  for (const dir of ['app', 'lib', 'components']) {
    for (const f of walk(join(root, dir))) {
      const m = readFileSync(f, 'utf8').match(RETIRED)
      if (m) hits.push(`${f}: ${m.join(', ')}`)
    }
  }
  assert.deepEqual(hits, [])
})

test('application import route uses claude-haiku-5-5', () => {
  const src = readFileSync(join(root, 'app/api/import/application/route.ts'), 'utf8')
  assert.match(src, /const MODEL = 'claude-haiku-5-5'/)
})
