// Copy the shared catalog core (src/catalog/*.mjs) and TOOLS.json into the
// hosted route (app/app/api/mcp/_vendor/). One source: the copies are never
// edited by hand, and --check (CI, app tests) fails if they drift.
//   node scripts/vendor-hosted.mjs          write the copies
//   node scripts/vendor-hosted.mjs --check  exit 1 if any copy differs
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src', 'catalog')
const COMPANION_SRC = path.join(ROOT, 'src', 'vendor', 'companion', 'src')
export const DEST = path.resolve(ROOT, '..', 'app', 'app', 'api', 'mcp', '_vendor')
const HEADER = (rel) => `// VENDORED from application-hub-mcp-server/${rel}. Do not edit: change the source and run\n// \`npm run vendor:hosted\` in application-hub-mcp-server/ (CI checks these copies).\n`

/**
 * Workspace tool definitions for the authenticated workspace surface of the
 * hosted /mcp route (POST /mcp with a Bearer token). The companion registry
 * stays the single source: this extracts the wire-level fields (name, tier,
 * title, description, inputSchema, setup/network/writes flags) into a pure
 * data module, because the route must only ship data — the handlers stay in
 * the companion and are reached through a per-request session.
 */
function workspaceToolDefs() {
  const req = createRequire(import.meta.url)
  let TOOLS
  try {
    TOOLS = req(path.join(COMPANION_SRC, 'mcp-tools.mjs')).TOOLS
  } catch (e) {
    throw new Error(`cannot load vendored companion mcp-tools (${e.message}); run \`npm run vendor:companion\` first`)
  }
  return TOOLS.filter((t) => t.tier !== 'privileged').map((t) => ({
    name: t.name, tier: t.tier, title: t.title, description: t.description, inputSchema: t.inputSchema,
    ...(t.setup ? { setup: true } : {}), ...(t.network ? { network: true } : {}), ...(t.writes ? { writes: t.writes } : {}),
  }))
}

export function plan() {
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.mjs')).sort()
  const out = files.map((f) => ({ dest: path.join(DEST, 'catalog', f), body: HEADER(`src/catalog/${f}`) + fs.readFileSync(path.join(SRC, f), 'utf8') }))
  out.push({ dest: path.join(DEST, 'TOOLS.json'), body: fs.readFileSync(path.join(ROOT, 'TOOLS.json'), 'utf8') })
  // The hosted store adapter keeps its source layout (store/ + sibling
  // imports like ../fsafe.mjs) so vendored relative imports still resolve.
  for (const rel of [path.join('store', 'workspace-store.mjs'), 'fsafe.mjs', 'crypto.mjs']) {
    const src = path.join(COMPANION_SRC, rel)
    if (!fs.existsSync(src)) throw new Error(`src/vendor/companion/src/${rel} is missing; run \`npm run vendor:companion\` first`)
    out.push({ dest: path.join(DEST, 'workspace', rel), body: HEADER(`src/vendor/companion/src/${rel}`) + fs.readFileSync(src, 'utf8') })
  }
  out.push({
    dest: path.join(DEST, 'workspace', 'workspace-tools.mjs'),
    body: '// VENDORED-GENERATED from application-hub-mcp-server/src/vendor/companion/src/mcp-tools.mjs (the TOOLS registry).\n// Do not edit: change the source and run `npm run vendor:companion` then `npm run vendor:hosted`\n// in application-hub-mcp-server/ (CI checks these copies).\n' +
      `export const WORKSPACE_TOOL_DEFS = ${JSON.stringify(workspaceToolDefs(), null, 2)}\n`,
  })
  return out
}

export function drift() {
  const want = plan()
  const problems = []
  for (const f of want) {
    const have = fs.existsSync(f.dest) ? fs.readFileSync(f.dest, 'utf8') : null
    if (have !== f.body) problems.push(path.relative(ROOT, f.dest))
  }
  const walk = (dir, base, acc = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p, base, acc)
      else if (e.isFile()) acc.push(path.relative(base, p))
    }
    return acc
  }
  for (const [dir, label] of [[path.join(DEST, 'catalog'), 'src/catalog'], [path.join(DEST, 'workspace'), 'the workspace plan']]) {
    const extra = fs.existsSync(dir) ? walk(dir, dir).filter((f) => !want.some((w) => w.dest === path.join(dir, f))) : []
    for (const f of extra) problems.push(`${path.relative(ROOT, path.join(dir, f))} (not in ${label})`)
  }
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
