#!/usr/bin/env node
// Read-only LIVE check of the public catalog with the real publishable/anon
// key (M09b). Prints counts and the project ref only — never row content,
// never the key.
//
//   node aqua-companion/scripts/live-catalog-check.mjs --env-file app/.env.local
//   node aqua-companion/scripts/live-catalog-check.mjs --well-known      (uses https://aquaidp.xyz/.well-known/aqua-catalog.json)
//
// The env file is read for NEXT_PUBLIC_SUPABASE_URL and
// NEXT_PUBLIC_SUPABASE_ANON_KEY only; every other line is ignored. A key that
// does not decode to anon / publishable is refused before any request.
import fs from 'node:fs'
import { assertPublicKey, fetchPublicCatalog, resolveCatalogConfig } from '../src/catalog.mjs'
import { endpointOrigin } from '../src/net.mjs'

function readEnvFile(p) {
  const want = new Set(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'])
  const out = {}
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && want.has(m[1])) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const args = process.argv.slice(2)
let cfg
if (args.includes('--well-known')) {
  cfg = await resolveCatalogConfig({ flags: {}, env: {}, cwd: process.cwd() })
  if (!cfg.configured) {
    console.error(`not configured: ${cfg.reason}`)
    process.exit(2)
  }
} else {
  const i = args.indexOf('--env-file')
  if (i < 0 || !args[i + 1]) {
    console.error('Usage: live-catalog-check.mjs --env-file <file> | --well-known')
    process.exit(2)
  }
  const env = readEnvFile(args[i + 1])
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('the env file has no NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
    process.exit(2)
  }
  const d = assertPublicKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  cfg = { configured: true, origin: endpointOrigin(env.NEXT_PUBLIC_SUPABASE_URL), key: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, key_role: d.role, key_kind: d.kind, project_ref: d.ref, source: 'env-file' }
}
const body = await fetchPublicCatalog(cfg)
const report = {
  source: cfg.source,
  project_ref: cfg.project_ref ?? new URL(cfg.origin).hostname.split('.')[0],
  key: { kind: cfg.key_kind, role: cfg.key_role },
  counts: { programs: body.programs.length, cycles: body.cycles.length, question_occurrences: body.questions.length, canonical_questions: body.canonical_questions.length },
  all_programs_canonical: body.programs.every((p) => p.source === 'canonical'),
}
console.log(JSON.stringify(report, null, 2))
