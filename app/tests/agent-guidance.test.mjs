// M09b B0.2–B0.4 / B1.1 / B1.5 — agent guidance is generated from the tool
// registry, describes the local-first companion path, never carries legacy
// or privileged instructions, and the public catalog config publishes only a
// publishable/anon key.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import {
  assertPublishableKey, buildCatalogConfig, isPlaceholderValue, PublishableKeyError, CATALOG_TABLES,
} from '../lib/public-catalog-config.mjs'

const APP = new URL('..', import.meta.url).pathname
const REPO = join(APP, '..')
const read = (p) => readFile(join(APP, p), 'utf8')
const GUIDANCE = JSON.parse(await readFile(join(APP, 'lib/agent-guidance.generated.json'), 'utf8'))

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) await walk(p, out)
    else out.push(p)
  }
  return out
}

const jwt = (payload) => `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.c2lnbmF0dXJl`

// --- generated guidance ----------------------------------------------------

test('generated guidance is up to date with the tool registry (gen-agent-guidance --check)', () => {
  const outText = execFileSync(process.execPath, [join(REPO, 'scripts/gen-agent-guidance.mjs'), '--check'], { encoding: 'utf8' })
  assert.match(outText, /up to date/)
})

test('counts are derived from the tool list, never hand-written', () => {
  assert.equal(GUIDANCE.total, GUIDANCE.tools.length)
  assert.ok(GUIDANCE.total >= 15)
  const byTier = {}
  for (const t of GUIDANCE.tools) byTier[t.tier] = (byTier[t.tier] ?? 0) + 1
  assert.deepEqual(Object.fromEntries(GUIDANCE.tiers.map((t) => [t.tier, t.count])), byTier)
  for (const t of GUIDANCE.tools) assert.ok(['read', 'private_write', 'human_consent', 'human_only'].includes(t.tier), `${t.name}: ${t.tier}`)
})

test('llms.txt, llms-full.txt and /agents.md carry the generated count, install line and every tool', async () => {
  const { MARKDOWN_PAGES } = await import(new URL('../lib/agent-content.mjs', import.meta.url).href)
  for (const [name, text] of [['llms.txt', await read('public/llms.txt')], ['llms-full.txt', await read('public/llms-full.txt')], ['/agents.md', MARKDOWN_PAGES['/agents']]]) {
    assert.ok(text.includes(GUIDANCE.install.help), `${name}: install line`)
    assert.ok(text.includes(`${GUIDANCE.total} tools`), `${name}: tool count`)
    for (const t of GUIDANCE.tools) assert.ok(text.includes(t.name), `${name}: ${t.name}`)
    // the local-first path, end to end
    for (const must of [/locate_workspace/, /init_workspace/, /elicitation/, /requires_human/, /import_history/, /\/history/, /sync_from_vault_export/, /export-backup/, /aqua-catalog\.json/, /https:\/\/aquaidp\.xyz\/mcp/, /https:\/\/aquaidp\.xyz\/mcp: live/, /never travels through the model/, /[Ii]ntentionally absent/]) {
      assert.match(text, must, `${name}: ${must}`)
    }
    assert.match(text, /npx -y aqua-mcp-server/, `${name}: aqua-mcp-server from npm is the primary install`)
    assert.doesNotMatch(text, /not yet published|once OWNER publishes|GB1\)/, `${name}: no stale not-yet-published claim`)
    assert.match(text, /[Ff]allback/, `${name}: the tarball is named as the fallback`)
  }
})

test('Contribution Exchange is reduced to one short pointer to signalaf.com/exchange', async () => {
  for (const f of ['public/llms.txt', 'public/llms-full.txt']) {
    const text = await read(f)
    assert.match(text, /https:\/\/signalaf\.com\/exchange/)
    assert.doesNotMatch(text, /api\/exchange\/proposals|NOTICE → CHECK|counterparty agent/i, f)
    assert.ok((text.match(/Exchange/g) ?? []).length <= 3, `${f}: exchange mentioned only briefly`)
  }
})

// --- forbidden legacy / privileged instructions -----------------------------

const FORBIDDEN = [/SUPABASE_SERVICE_ROLE/i, /user_token/i, /npx -y aqua-mcp-server@1/i, /user supabase session/i]
async function agentFacingFiles() {
  const files = [
    join(APP, 'public/llms.txt'), join(APP, 'public/llms-full.txt'),
    join(APP, 'lib/agent-content.mjs'), join(APP, 'lib/agent-guidance.generated.json'), join(APP, 'lib/agent-guidance.generated.mjs'),
    join(APP, 'app/agents/page.tsx'), join(APP, 'app/developers/page.tsx'), join(APP, 'app/mcp/page.tsx'), join(APP, 'app/(auth)/login/page.tsx'),
    join(REPO, 'aqua-companion/README.md'),
    ...(await walk(join(APP, 'app/.well-known'))),
    ...(await walk(join(APP, 'public/.well-known'))),
    ...(await walk(join(REPO, 'aqua-companion/docs'))).filter((f) => f.endsWith('.md')),
  ]
  return files
}

test('no agent-facing file mentions service-role keys, user_token, the 1.x install line or "user Supabase session"', async () => {
  const hits = []
  for (const f of await agentFacingFiles()) {
    const text = await readFile(f, 'utf8')
    for (const re of FORBIDDEN) if (re.test(text)) hits.push(`${relative(REPO, f)} ~ ${re}`)
  }
  assert.deepEqual(hits, [])
})

test('no agent-facing surface tells agents to clone and build the legacy server or to pass a JWT to MCP', async () => {
  for (const f of ['public/llms.txt', 'public/llms-full.txt', 'app/.well-known/mcp/route.ts', 'app/developers/page.tsx', 'app/mcp/page.tsx', 'lib/agent-content.mjs']) {
    const text = await read(f)
    assert.doesNotMatch(text, /git clone[^\n]*application-hub[^\n]*\n?[^\n]*npm run build/i, f)
    assert.doesNotMatch(text, /SUPABASE_ACCESS_TOKEN|session JWT/i, f)
    assert.doesNotMatch(text, /\b(27|31) (registered )?tools\b/, f)
  }
})

// --- /login noscript ------------------------------------------------------

test('/login renders server-side <noscript> guidance for non-JS clients and agents', async () => {
  const page = await read('app/(auth)/login/page.tsx')
  assert.doesNotMatch(page, /^'use client'/m, 'page.tsx is a server component')
  assert.match(page, /<noscript>/)
  assert.match(page, /\/agents/)
  assert.match(page, /\/llms\.txt/)
  assert.match(page, /<LoginClient \/>/)
  const client = await read('app/(auth)/login/LoginClient.tsx')
  assert.match(client, /^'use client'/m)
})

// --- /.well-known/aqua-catalog.json -------------------------------------------

test('assertPublishableKey accepts publishable and anon keys only; service_role is a hard refusal', () => {
  assert.equal(assertPublishableKey('sb_publishable_AbC123_x-y'), 'publishable')
  assert.equal(assertPublishableKey(jwt({ role: 'anon', ref: 'synthetic' })), 'anon_jwt')
  const refuse = (k, code) => assert.throws(() => assertPublishableKey(k), (e) => e instanceof PublishableKeyError && e.code === code, code)
  refuse(jwt({ role: 'service_role' }), 'service_role')
  refuse(jwt({ role: 'authenticated' }), 'wrong_role')
  refuse(jwt({}), 'wrong_role')
  refuse('sb_secret_synthetic000', 'secret_key')
  refuse('my-service_role-key', 'service_role')
  refuse('not-a-key', 'unrecognized')
  refuse('', 'missing')
  // the message never echoes the key
  try { assertPublishableKey(jwt({ role: 'service_role', marker: 'ZQX-KEY' })) } catch (e) { assert.doesNotMatch(e.message, /ZQX|eyJ/) }
})

test('catalog config: placeholders give 503, a service-role key gives 500 (never served), anon gives the contract', () => {
  assert.equal(isPlaceholderValue('placeholder'), true)
  assert.equal(isPlaceholderValue('https://placeholder.supabase.co'), true)
  const ph = buildCatalogConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder' })
  assert.equal(ph.ok, false)
  assert.equal(ph.status, 503)
  assert.equal(ph.body.error, 'catalog_not_configured')
  const sr = jwt({ role: 'service_role' })
  const bad = buildCatalogConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic-ref.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: sr })
  assert.equal(bad.status, 500)
  assert.ok(!JSON.stringify(bad.body).includes(sr), 'the refused key is never in the body')
  const anon = jwt({ role: 'anon', ref: 'synthetic-ref' })
  const ok = buildCatalogConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic-ref.supabase.co/', NEXT_PUBLIC_SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: sr })
  assert.equal(ok.ok, true)
  assert.deepEqual(Object.keys(ok.body), ['version', 'supabase_url', 'publishable_key', 'tables', 'notes'])
  assert.equal(ok.body.version, 1)
  assert.equal(ok.body.supabase_url, 'https://synthetic-ref.supabase.co')
  assert.equal(ok.body.publishable_key, anon)
  assert.deepEqual(ok.body.tables, { ...CATALOG_TABLES })
  assert.ok(!JSON.stringify(ok.body).includes(sr), 'only NEXT_PUBLIC_ values are read')
  assert.equal(buildCatalogConfig({ NEXT_PUBLIC_SUPABASE_URL: 'http://synthetic-ref.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: anon }).ok, false, 'https only')
})

test('the route reads only NEXT_PUBLIC_ env values and next.config refuses a service-role key at build time', async () => {
  const route = await read('app/.well-known/aqua-catalog.json/route.ts')
  assert.match(route, /buildCatalogConfig\(process\.env\)/)
  assert.doesNotMatch(route, /SERVICE_ROLE/)
  const lib = await read('lib/public-catalog-config.mjs')
  assert.doesNotMatch(lib, /env\.SUPABASE_SERVICE/)
  const cfg = await read('next.config.mjs')
  assert.match(cfg, /assertPublishableKey\(k\)/)
  const r = (env) => {
    try {
      execFileSync(process.execPath, ['--input-type=module', '-e', "await import('./next.config.mjs')"], { cwd: APP, env: { PATH: process.env.PATH, ...env }, stdio: 'pipe' })
      return 'ok'
    } catch (e) {
      return String(e.stderr)
    }
  }
  assert.equal(r({ NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt({ role: 'anon' }) }), 'ok')
  assert.equal(r({ NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder' }), 'ok')
  assert.match(r({ NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt({ role: 'service_role' }) }), /refused at build time/)
  assert.match(r({ NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_synthetic' }), /refused at build time/)
})

test('/.well-known/mcp is the local-first manifest generated from the same data', async () => {
  const src = await read('app/.well-known/mcp/route.ts')
  assert.match(src, /agent-guidance\.generated\.mjs/)
  assert.match(src, /toolCount: G\.total/)
  assert.doesNotMatch(src, /SUPABASE_URL|SUPABASE_ANON_KEY|1\.0\.1/)
  assert.ok((await stat(join(APP, 'app/.well-known/aqua-catalog.json/route.ts'))).isFile())
})
