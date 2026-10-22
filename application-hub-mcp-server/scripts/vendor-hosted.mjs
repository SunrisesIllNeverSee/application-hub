// Copy the shared catalog core (src/catalog/*.mjs) and TOOLS.json into the
// hosted route (app/app/api/mcp/_vendor/). One source: the copies are never
// edited by hand, and --check (CI, app tests) fails if they drift.
//   node scripts/vendor-hosted.mjs          write the copies
//   node scripts/vendor-hosted.mjs --check  exit 1 if any copy differs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src', 'catalog')
export const DEST = path.resolve(ROOT, '..', 'app', 'app', 'api', 'mcp', '_vendor')
const HEADER = (rel) => `// VENDORED from application-hub-mcp-server/${rel}. Do not edit: change the source and run\n// \`npm run vendor:hosted\` in application-hub-mcp-server/ (CI checks these copies).\n`

export function plan() {
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.mjs')).sort()
  const out = files.map((f) => ({ dest: path.join(DEST, 'catalog', f), body: HEADER(`src/catalog/${f}`) + fs.readFileSync(path.join(SRC, f), 'utf8') }))
  out.push({ dest: path.join(DEST, 'TOOLS.json'), body: fs.readFileSync(path.join(ROOT, 'TOOLS.json'), 'utf8') })
  return out
}

export function drift() {
  const want = plan()
  const problems = []
  for (const f of want) {
    const have = fs.existsSync(f.dest) ? fs.readFileSync(f.dest, 'utf8') : null
    if (have !== f.body) problems.push(path.relative(ROOT, f.dest))
  }
  const dir = path.join(DEST, 'catalog')
  const extra = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => !want.some((w) => path.basename(w.dest) === f)) : []
  for (const f of extra) problems.push(`${path.relative(ROOT, path.join(dir, f))} (not in src/catalog)`)
  return problems
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes('--check')) {
    const p = drift()
    if (p.length) {
      process.stderr.write(`Hosted vendored copies are out of date:\n  ${p.join('\n  ')}\nRun: npm run vendor:hosted (in application-hub-mcp-server/)\n`)
      process.exit(1)
    }
    process.stdout.write('Hosted vendored copies are up to date.\n')
  } else {
    for (const f of plan()) {
      fs.mkdirSync(path.dirname(f.dest), { recursive: true })
      fs.writeFileSync(f.dest, f.body)
    }
    process.stdout.write(`vendored ${plan().length} files into ${path.relative(path.resolve(ROOT, '..'), DEST)}/\n`)
  }
}
