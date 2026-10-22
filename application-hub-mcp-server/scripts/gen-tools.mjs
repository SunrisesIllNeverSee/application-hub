// Generate TOOLS.json from the registry (src/node/registry.mjs).
//   node scripts/gen-tools.mjs          write TOOLS.json
//   node scripts/gen-tools.mjs --check  exit 1 if TOOLS.json is out of date (CI)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildManifest } from '../src/node/registry.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const MANIFEST_PATH = path.join(ROOT, 'TOOLS.json')
export const render = () => `${JSON.stringify(buildManifest(), null, 2)}\n`

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const want = render()
  if (process.argv.includes('--check')) {
    const have = fs.existsSync(MANIFEST_PATH) ? fs.readFileSync(MANIFEST_PATH, 'utf8') : ''
    if (have !== want) {
      process.stderr.write('TOOLS.json is out of date. Run: npm run manifest (in application-hub-mcp-server/)\n')
      process.exit(1)
    }
    process.stdout.write('TOOLS.json is up to date.\n')
  } else {
    fs.writeFileSync(MANIFEST_PATH, want)
    const m = JSON.parse(want)
    process.stdout.write(`wrote TOOLS.json: ${Object.entries(m.counts).map(([k, v]) => `${k}=${v}`).join(', ')}\n`)
  }
}
