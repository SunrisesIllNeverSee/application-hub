// Copy aqua-companion's runtime source (src/, vendor/lib/, config/) into
// src/vendor/companion/ so the published package has no file: dependency.
// One source: the copies are never edited by hand, and --check (CI) fails
// if they drift.
//   node scripts/vendor-companion.mjs          write the copies
//   node scripts/vendor-companion.mjs --check  exit 1 if any copy differs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.resolve(ROOT, '..', 'aqua-companion')
export const DEST = path.join(ROOT, 'src', 'vendor', 'companion')
const DIRS = ['src', 'vendor', 'config']
const HEADER = (rel) => `// VENDORED from aqua-companion/${rel}. Do not edit: change the source and run\n// \`npm run vendor:companion\` in application-hub-mcp-server/ (CI checks these copies).\n`

function walk(dir, base) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p, base))
    else if (e.isFile()) out.push(path.relative(base, p))
  }
  return out
}

export function plan() {
  const out = []
  for (const d of DIRS) {
    const abs = path.join(SRC, d)
    if (!fs.existsSync(abs)) continue
    for (const rel of walk(abs, SRC)) {
      const body = fs.readFileSync(path.join(SRC, rel), 'utf8')
      out.push({ dest: path.join(DEST, rel), body: rel.endsWith('.mjs') ? HEADER(rel) + body : body })
    }
  }
  return out
}

export function write() {
  const want = plan()
  for (const f of want) {
    fs.mkdirSync(path.dirname(f.dest), { recursive: true })
    fs.writeFileSync(f.dest, f.body)
  }
  return want.length
}

export function drift() {
  const want = plan()
  const problems = []
  for (const f of want) {
    const have = fs.existsSync(f.dest) ? fs.readFileSync(f.dest, 'utf8') : null
    if (have !== f.body) problems.push(path.relative(ROOT, f.dest))
  }
  if (fs.existsSync(DEST)) {
    for (const rel of walk(DEST, DEST)) {
      if (!want.some((w) => path.join(rel) === rel && w.dest === path.join(DEST, rel))) problems.push(`${path.relative(ROOT, path.join(DEST, rel))} (not in aqua-companion)`)
    }
  }
  return problems
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes('--check')) {
    const p = drift()
    if (p.length) {
      process.stderr.write(`Vendored companion copies are out of date:\n  ${p.join('\n  ')}\nRun: npm run vendor:companion (in application-hub-mcp-server/)\n`)
      process.exit(1)
    }
    process.exit(0)
  }
  process.stdout.write(`vendored ${write()} files into ${path.relative(ROOT, DEST)}\n`)
}
