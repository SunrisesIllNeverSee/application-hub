#!/usr/bin/env node
// M09 W9 — acceptance runner for AT01–AT22 (directive §14).
//
// Runs every suite that carries evidence, collects per-test results, maps
// each acceptance test to the EXACT tests that demonstrate it (at-map.mjs),
// and writes
//   docs/evidence/m09-acceptance/results.json   (per AT: status, commands, assertions, artifacts)
//   docs/evidence/m09-acceptance.md             (readable table with evidence links)
// An AT passes only when every cited test ran and passed; a cited test that
// is missing (renamed, deleted) or failing fails the AT.
//
// Run from app/ (node_modules available):
//   node tests/acceptance/run-acceptance.mjs [--skip stage,...] [--only stage,...] [--agent]
//        [--scratch DIR]   scratch root for Postgres clusters, browser downloads, agent run (default: OS temp)
// Stages: unit acceptance vault companion db catalog-sql browser prod agent
//   browser: needs PLAYWRIGHT_MODULE (dir of a playwright package; playwright-core is taken from its node_modules)
//   db / catalog-sql: need initdb, pg_ctl and psql (local throwaway clusters, loopback only)
//   prod: runs `next build` + `next start` with placeholder Supabase values (never the real project)
//   agent: AT19 is read from the recorded real-agent outcome unless --agent re-runs it (headless claude)
// Every process this runner starts is stopped by PID when its stage ends.

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AT_MAP } from './at-map.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(here, '..', '..')
const REPO = path.resolve(APP, '..')
const EVID = path.join(REPO, 'docs', 'evidence', 'm09-acceptance')
const argv = process.argv.slice(2)
const opt = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null)
const STAGES = ['unit', 'acceptance', 'vault', 'companion', 'db', 'catalog-sql', 'browser', 'prod', 'agent']
const only = opt('--only')?.split(',')
const skip = new Set(opt('--skip')?.split(',') ?? [])
const enabled = (s) => (only ? only.includes(s) : !skip.has(s))
const SCRATCH = path.resolve(opt('--scratch') ?? fs.mkdtempSync(path.join(os.tmpdir(), 'aqua-acceptance-')))
fs.mkdirSync(SCRATCH, { recursive: true })
fs.mkdirSync(EVID, { recursive: true })

const HOME = os.homedir()
const USER = os.userInfo().username
function scrub(s) {
  let t = String(s ?? '')
  for (const [a, b] of [[SCRATCH, '<scratch>'], [REPO, '<repo>'], [HOME, '~']]) t = t.split(a).join(b)
  return t.split(USER).join('<user>')
}
const tests = new Map() // key → { status, suite, name, file, detail }
const stages = []
function record(key, status, meta = {}) { tests.set(key, { status, ...meta }) }
function log(...a) { console.log('[acceptance]', ...a) }

function run(cmd, args, { cwd = APP, env = {}, timeout = 30 * 60_000 } = {}) {
  const t = Date.now()
  const r = spawnSync(cmd, args, { cwd, env: { ...process.env, ...env }, encoding: 'utf8', timeout, maxBuffer: 256 * 1024 * 1024 })
  return { code: r.status ?? (r.signal ? 128 : 1), out: r.stdout ?? '', err: r.stderr ?? '', ms: Date.now() - t }
}
const stageRec = (name, command, res, extra = {}) => {
  const s = { stage: name, command: scrub(command), exit: res?.code ?? null, seconds: res ? Math.round(res.ms / 1000) : null, ...extra }
  stages.push(s)
  log(`${name}: exit ${s.exit}${extra.counts ? ' ' + JSON.stringify(extra.counts) : ''}`)
  return s
}
const countOf = (prefix) => {
  const v = [...tests.entries()].filter(([k]) => k.startsWith(prefix)).map(([, x]) => x.status)
  return { total: v.length, pass: v.filter((x) => x === 'pass').length, fail: v.filter((x) => x === 'fail').length, skip: v.filter((x) => x === 'skip').length }
}

// node --test with the JSON reporter → tests map
function nodeTests(suite, files, cwd, env = {}) {
  const dest = path.join(SCRATCH, `${suite}.jsonl`)
  fs.rmSync(dest, { force: true })
  const args = ['--test', `--test-reporter=${path.join(here, 'json-reporter.mjs')}`, `--test-reporter-destination=${dest}`, ...files]
  const res = run(process.execPath, args, { cwd, env })
  if (fs.existsSync(dest)) {
    for (const line of fs.readFileSync(dest, 'utf8').split('\n').filter(Boolean)) {
      const d = JSON.parse(line)
      const file = d.file ? path.basename(d.file) : '?'
      record(`${suite}:${file}::${d.name}`, d.status, { suite, file, name: d.name, detail: d.error ? scrub(d.error) : undefined })
    }
  }
  return { res, command: `node --test ${files.map((f) => scrub(path.resolve(cwd, f))).join(' ')}` }
}

// ───────────────────────────── stages ─────────────────────────────
if (enabled('unit')) {
  const files = fs.readdirSync(path.join(APP, 'tests')).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => `tests/${f}`)
  const { res } = nodeTests('unit', files, APP)
  stageRec('unit', 'cd app && npm run -s test:unit   (node --test tests/*.test.mjs)', res, { counts: countOf('unit:') })
}
if (enabled('acceptance')) {
  const { res } = nodeTests('acc', ['tests/acceptance/at15-no-sync-claim.test.mjs'], APP)
  stageRec('acceptance', 'cd app && node --test tests/acceptance/at15-no-sync-claim.test.mjs', res, { counts: countOf('acc:at15') })
}
if (enabled('vault')) {
  const runners = ['lib/aqua-local/run-tests.mjs', 'lib/aqua-local/run-approval-tests.mjs', 'lib/aqua-local/run-intake-tests.mjs', 'lib/aqua-local/run-legacy-import-tests.mjs',
    'lib/aqua-local/run-packet-tests.mjs', 'lib/aqua-local/run-provider-contract-tests.mjs', 'lib/aqua-local/run-v5-tests.mjs', 'lib/aqua-local/run-history-tests.mjs', 'lib/aqua-local-client/run-session-tests.mjs', 'lib/aqua-local-client/run-score-tests.mjs']
  let worst = 0; let ms = 0
  for (const r of runners) {
    const res = run(process.execPath, [r])
    worst = Math.max(worst, res.code); ms += res.ms
    for (const l of res.out.split('\n')) {
      const m = /^(PASS|FAIL)\s+(.*)$/.exec(l.trim())
      if (m) record(`vault::${m[2].trim()}`, m[1] === 'PASS' ? 'pass' : 'fail', { suite: 'vault', file: path.basename(r), name: m[2].trim() })
    }
    if (res.code !== 0) record(`vault::runner ${path.basename(r)} exit`, 'fail', { suite: 'vault', file: path.basename(r), name: `runner exit ${res.code}`, detail: scrub(res.err.slice(-400)) })
  }
  stageRec('vault', 'cd app && npm run -s test:vault   (10 runner scripts)', { code: worst, ms }, { counts: countOf('vault::') })
}
if (enabled('companion')) {
  const files = fs.readdirSync(path.join(REPO, 'aqua-companion', 'test')).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => `aqua-companion/test/${f}`)
  const { res } = nodeTests('companion', files, REPO)
  stageRec('companion', 'node --test aqua-companion/test/*.test.mjs', res, { counts: countOf('companion:') })
}
if (enabled('db')) {
  const root = path.join(SCRATCH, 'pg-m09'); fs.rmSync(root, { recursive: true, force: true })
  const out = path.join(SCRATCH, 'db-results.json')
  const res = run('bash', [path.join(REPO, 'supabase', 'tests', 'm09', 'run_local.sh')], { cwd: REPO, env: { M09_PGROOT: root, M09_PGPORT: process.env.M09_PGPORT ?? '54336', M09_RESULTS_JSON: out } })
  if (fs.existsSync(out) && fs.statSync(out).size) for (const r of JSON.parse(fs.readFileSync(out, 'utf8'))) record(`db::${r.id}`, r.pass ? 'pass' : 'fail', { suite: 'db', name: `${r.id} ${r.descr}` })
  const tail = res.out.split('\n').filter((l) => /suite|ALL PASS|FAILURES|ROLLBACK/.test(l)).slice(-6)
  stageRec('db', 'M09_PGROOT=<scratch> supabase/tests/m09/run_local.sh', res, { counts: countOf('db::'), summary: tail.map(scrub) })
}
if (enabled('catalog-sql')) {
  const { res } = nodeTests('acc', ['tests/acceptance/catalog-promotion-sql.e2e.mjs'], APP, { M09_E2E_PGROOT: path.join(SCRATCH, 'pg-e2e'), M09_E2E_PGPORT: process.env.M09_E2E_PGPORT ?? '54338' })
  stageRec('catalog-sql', 'M09_E2E_PGROOT=<scratch> node --test tests/acceptance/catalog-promotion-sql.e2e.mjs', res, { counts: countOf('acc:catalog-promotion-sql') })
}

// Long-running processes (dev / prod server, deny-proxy): started here, stopped by PID.
const started = []
function startProc(name, cmd, args, env, logFile) {
  const fd = fs.openSync(logFile, 'w')
  const child = spawn(cmd, args, { cwd: APP, env: { ...process.env, ...env }, stdio: ['ignore', fd, fd], detached: true })
  started.push({ name, pid: child.pid })
  return child
}
function stopAll() {
  for (const p of started.splice(0)) {
    try { process.kill(-p.pid, 'SIGTERM') } catch { try { process.kill(p.pid, 'SIGTERM') } catch { /* gone */ } }
  }
}
process.on('exit', stopAll)
async function waitHttp(url, ms = 180_000) {
  const t = Date.now()
  while (Date.now() - t < ms) {
    try { const r = await fetch(url, { redirect: 'manual' }); if (r.status > 0) return true } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}
const PROXY_PORT = Number(process.env.ACCEPTANCE_PROXY_PORT ?? 39871)
const serverEnv = (proxyLog) => ({
  NEXT_PUBLIC_AQUA_LOCAL_FIRST: '1', AQUA_LOCAL_FIRST: '1', NEXT_TELEMETRY_DISABLED: '1',
  // placeholder project: never the real one; the service-role key is never set
  NEXT_PUBLIC_SUPABASE_URL: 'https://acceptance0ref.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'acceptance-dummy-anon-key', SUPABASE_SERVICE_ROLE_KEY: '',
  NEXT_PUBLIC_POSTHOG_KEY: '', NODE_USE_ENV_PROXY: '1', HTTP_PROXY: `http://127.0.0.1:${PROXY_PORT}`, HTTPS_PROXY: `http://127.0.0.1:${PROXY_PORT}`, NO_PROXY: 'localhost,127.0.0.1',
  ACCEPTANCE_PROXY_LOG: proxyLog,
})

if (enabled('browser')) {
  const port = Number(process.env.ACCEPTANCE_DEV_PORT ?? 3977)
  const base = `http://localhost:${port}`
  const proxyLog = path.join(SCRATCH, 'dev-proxy-log.json')
  startProc('deny-proxy', process.execPath, [path.join(here, 'deny-proxy.mjs'), String(PROXY_PORT), proxyLog], {}, path.join(SCRATCH, 'deny-proxy.out'))
  startProc('next-dev', process.execPath, [path.join(APP, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', String(port)], serverEnv(proxyLog), path.join(SCRATCH, 'next-dev.out'))
  const up = await waitHttp(`${base}/dev/journey`)
  const pw = process.env.PLAYWRIGHT_MODULE
  if (!up || !pw) {
    stageRec('browser', 'next dev + playwright', { code: 1, ms: 0 }, { error: !up ? 'dev server did not start' : 'PLAYWRIGHT_MODULE not set' })
  } else {
    // warm the harness routes (first compile is slow)
    for (const p of ['/dev/journey', '/dev/journey?path=mine', '/dev/review-harness']) await fetch(base + p).catch(() => {})
    const env = { PLAYWRIGHT_MODULE: pw, PW_CORE: path.join(pw, '..', 'playwright-core'), BASE_URL: base, REVIEW_BASE_URL: base, WORK_DIR: path.join(SCRATCH, 'journey-work') }
    const r1 = run(process.execPath, ['tests/e2e/review-ui.e2e.mjs'], { env })
    const e2e = path.join(REPO, 'docs', 'evidence', 'm09-review-ui', 'e2e-results.json')
    if (fs.existsSync(e2e)) for (const x of JSON.parse(fs.readFileSync(e2e, 'utf8'))) record(`browser:review-ui::${x.name}`, x.ok ? 'pass' : 'fail', { suite: 'browser', file: 'review-ui.e2e.mjs', name: x.name })
    stageRec('browser:review-ui', `REVIEW_BASE_URL=${base} PLAYWRIGHT_MODULE=<playwright> node tests/e2e/review-ui.e2e.mjs`, r1, { counts: countOf('browser:review-ui') })
    const r2 = run(process.execPath, ['tests/browser/journey.browser.mjs'], { env })
    const jr = path.join(env.WORK_DIR, 'results.json')
    if (fs.existsSync(jr)) {
      const rs = JSON.parse(fs.readFileSync(jr, 'utf8'))
      fs.copyFileSync(jr, path.join(REPO, 'docs', 'evidence', 'm09-journey', 'results.json'))
      for (const x of rs) {
        if (x.path && x.viewport && x.verify_exit !== undefined) {
          record(`browser:journey::${x.viewport} ${x.path} A→H`, x.verify_exit === 0 && x.steps.some((s) => s.startsWith('F: ready to freeze')) ? 'pass' : 'fail', { suite: 'browser', file: 'journey.browser.mjs', name: `${x.viewport} ${x.path} A→H (${x.instance_id_prefix}…; D: ${x.classifications.join(', ')}; ${x.verify_summary})` })
        }
        if (x.privacy) {
          record('browser:journey::privacy: no request body carries private content', x.privacy.request_bodies_with_private_content === 0 && x.privacy.extract_url_bodies_url_only ? 'pass' : 'fail', { suite: 'browser', file: 'journey.browser.mjs', name: `privacy: ${JSON.stringify(x.privacy)}` })
        }
        if (x.path === 'mine') record(`browser:journey::${x.viewport} my applications lists all instances`, x.all_submitted ? 'pass' : 'fail', { suite: 'browser', file: 'journey.browser.mjs', name: `${x.viewport} instance list: ${x.instances} instances, all submitted` })
        if (x.path === 'reopen') record(`browser:journey::${x.viewport} reopened instance is read-only`, x.historical_readonly ? 'pass' : 'fail', { suite: 'browser', file: 'journey.browser.mjs', name: `${x.viewport} historical view read-only` })
      }
    }
    if (r2.code !== 0) record('browser:journey::walk exit', 'fail', { suite: 'browser', file: 'journey.browser.mjs', name: 'walk exit', detail: scrub(r2.out.split('\n').filter((l) => /FAIL/.test(l)).slice(0, 3).join(' | ')) })
    stageRec('browser:journey', `PW_CORE=<playwright-core> BASE_URL=${base} node tests/browser/journey.browser.mjs`, r2, { counts: countOf('browser:journey') })
    const r3 = run(process.execPath, ['tests/acceptance/acceptance.browser.mjs'], { env })
    const ar = path.join(EVID, 'browser-results.json')
    if (fs.existsSync(ar)) for (const c of JSON.parse(fs.readFileSync(ar, 'utf8')).checks) record(`browser:acceptance::${c.at} ${c.name}`, c.pass ? 'pass' : 'fail', { suite: 'browser', file: 'acceptance.browser.mjs', name: `${c.at} ${c.name}`, detail: c.detail === undefined ? undefined : JSON.stringify(c.detail).slice(0, 300) })
    stageRec('browser:acceptance', `PLAYWRIGHT_MODULE=<playwright> BASE_URL=${base} node tests/acceptance/acceptance.browser.mjs`, r3, { counts: countOf('browser:acceptance') })
    if (fs.existsSync(proxyLog)) {
      const hosts = [...new Set(JSON.parse(fs.readFileSync(proxyLog, 'utf8')).map((x) => x.host))]
      stages.at(-1).server_outbound_attempts_refused_by_deny_proxy = hosts
    }
  }
  stopAll()
}

if (enabled('prod')) {
  const port = Number(process.env.ACCEPTANCE_PROD_PORT ?? 3978)
  const base = `http://localhost:${port}`
  const proxyLog = path.join(SCRATCH, 'prod-proxy-log.json')
  const nextBin = path.join(APP, 'node_modules', 'next', 'dist', 'bin', 'next')
  const build = run(process.execPath, [nextBin, 'build'], { env: { ...serverEnv(proxyLog), NODE_USE_ENV_PROXY: '', HTTP_PROXY: '', HTTPS_PROXY: '' }, timeout: 20 * 60_000 })
  stageRec('prod:build', 'NEXT_PUBLIC_AQUA_LOCAL_FIRST=1 AQUA_LOCAL_FIRST=1 NEXT_PUBLIC_SUPABASE_URL=<placeholder> next build', build)
  if (build.code === 0) {
    startProc('deny-proxy', process.execPath, [path.join(here, 'deny-proxy.mjs'), String(PROXY_PORT), proxyLog], {}, path.join(SCRATCH, 'deny-proxy-prod.out'))
    startProc('next-start', process.execPath, [nextBin, 'start', '-p', String(port)], serverEnv(proxyLog), path.join(SCRATCH, 'next-start.out'))
    await waitHttp(`${base}/`)
    const cases = [
      ['/apply', 'redirect /login?next=%2Fapply'], ['/apply?path=mine', 'redirect /login (next has no url=)'], ['/apply/LA-x', 'redirect /login'],
      ['/review/x', 'redirect /login?next=%2Freview%2Fx'], ['/history', 'redirect /login?next=%2Fhistory'], ['/admin/catalog', '404 (curators only)'],
      ['/aqua-local', 'redirect /login'], ['/questions', 'redirect /login'], ['/dev/journey', '404 (harness)'], ['/dev/review-harness', '404 (harness)'],
      ['/apply?url=https%3A%2F%2Fprogram.example.org%2Fapply', '303 to #url= fragment (M5)'],
    ]
    const observed = []
    for (const [p, expect] of cases) {
      let r; try { r = await fetch(base + p, { redirect: 'manual' }) } catch (e) { r = null }
      const loc = r?.headers.get('location') ?? ''
      const status = r?.status ?? 0
      let pass
      if (expect.startsWith('redirect')) {
        const lp = loc ? new URL(loc, base) : null
        pass = [302, 303, 307, 308].includes(status) && lp?.pathname === '/login' && !(lp.searchParams.get('next') ?? '').includes('url=') && (!expect.includes('next=') || lp.search.includes(expect.split('next=')[1].split(' ')[0]))
      } else if (expect.startsWith('404')) pass = status === 404
      else pass = status === 303 && loc.includes('#url=') && !loc.split('#')[0].includes('url=')
      const loc2 = loc ? loc.replace(base, '') : ''
      observed.push({ path: p, status, location: loc2, expect })
      record(`prod::${p} → ${expect}`, pass ? 'pass' : 'fail', { suite: 'prod', file: 'next start', name: `${p} → ${status}${loc2 ? ' ' + loc2 : ''} (expected ${expect})` })
    }
    // M09b hosted read-only MCP: /mcp is both the docs page (browser GET) and the
    // Streamable HTTP endpoint (POST JSON-RPC, rewritten to /api/mcp by middleware).
    const hostedCount = JSON.parse(fs.readFileSync(path.join(APP, 'app', 'api', 'mcp', '_vendor', 'TOOLS.json'), 'utf8')).counts.hosted
    {
      let r; let body = null
      try {
        r = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) })
        body = await r.json().catch(() => null)
      } catch { r = null }
      const n = Array.isArray(body?.result?.tools) ? body.result.tools.length : null
      const expect = `200 JSON-RPC tools/list with ${hostedCount} hosted tools`
      observed.push({ path: 'POST /mcp tools/list', status: r?.status ?? 0, location: '', tools: n, expect })
      record(`prod::POST /mcp tools/list → ${expect}`, r?.status === 200 && n === hostedCount ? 'pass' : 'fail', { suite: 'prod', file: 'next start', name: `POST /mcp tools/list → ${r?.status ?? 0}, ${n} tools (expected ${expect})` })
    }
    {
      let r; let html = ''
      try { r = await fetch(`${base}/mcp`, { headers: { accept: 'text/html,application/xhtml+xml' } }); html = await r.text() } catch { r = null }
      const ctype = r?.headers.get('content-type') ?? ''
      const expect = '200 text/html docs page'
      observed.push({ path: 'GET /mcp (browser)', status: r?.status ?? 0, location: '', content_type: ctype.split(';')[0], expect })
      record(`prod::GET /mcp (browser) → ${expect}`, r?.status === 200 && ctype.startsWith('text/html') && /aqua-mcp-server 2\.0/i.test(html) ? 'pass' : 'fail', { suite: 'prod', file: 'next start', name: `GET /mcp → ${r?.status ?? 0} ${ctype.split(';')[0]} (expected ${expect})` })
    }
    stageRec('prod:routes', `next start -p ${port}; unauthenticated GET of protected routes (redirect: manual); hosted MCP POST /mcp tools/list and browser GET /mcp`, { code: [...tests.entries()].filter(([k]) => k.startsWith('prod::')).every(([, t]) => t.status === 'pass') ? 0 : 1, ms: 0 }, { observed })
    if (fs.existsSync(proxyLog)) stages.at(-1).server_outbound_attempts_refused_by_deny_proxy = [...new Set(JSON.parse(fs.readFileSync(proxyLog, 'utf8')).map((x) => x.host))]
  }
  stopAll()
}

if (enabled('agent')) {
  const outcomeFile = path.join(EVID, 'at19', 'outcome.json')
  let res = null
  if (argv.includes('--agent')) res = run(process.execPath, ['tests/acceptance/at19-real-agent.mjs', '--model', opt('--model') ?? 'sonnet'], { env: { AT19_ROOT: path.join(SCRATCH, 'at19') }, timeout: 20 * 60_000 })
  if (fs.existsSync(outcomeFile)) {
    const o = JSON.parse(fs.readFileSync(outcomeFile, 'utf8'))
    for (const c of o.checks) record(`agent::${c.name}`, c.pass ? 'pass' : 'fail', { suite: 'agent', file: 'at19-real-agent.mjs', name: `${c.name} (${o.mode}, ${o.generated_at})` })
    stageRec('agent', res ? 'AT19_ROOT=<scratch> node tests/acceptance/at19-real-agent.mjs --model sonnet' : `recorded run ${o.generated_at} (re-run with --agent)`, res ?? { code: o.pass ? 0 : 1, ms: 0 }, { mode: o.mode, recorded: !res, counts: countOf('agent::') })
  } else stageRec('agent', 'no recorded outcome', { code: 1, ms: 0 })
}

// ───────────────────────────── AT evaluation ─────────────────────────────
const SUITE_STAGE = { unit: 'unit', acc: 'acceptance', vault: 'vault', companion: 'companion', db: 'db', browser: 'browser', prod: 'prod', agent: 'agent' }
const ranStage = (key) => enabled(stageOf(key))
function stageOf(ref) {
  if (ref.startsWith('acc:catalog-promotion-sql')) return 'catalog-sql'
  return SUITE_STAGE[ref.split(/::|:/)[0]] ?? 'unknown'
}
const ats = AT_MAP.map((at) => {
  const assertions = at.refs.map((ref) => {
    const t = tests.get(ref)
    if (t) return { ref, status: t.status, suite: t.suite, file: t.file, name: t.name, ...(t.detail ? { detail: t.detail } : {}) }
    return { ref, status: ranStage(ref) ? 'missing' : 'not_run' }
  })
  const bad = assertions.filter((a) => a.status === 'fail' || a.status === 'missing')
  const notRun = assertions.filter((a) => a.status === 'not_run' || a.status === 'skip')
  const status = bad.length ? 'fail' : notRun.length === assertions.length ? 'not_run' : notRun.length ? 'partial' : at.partial ? 'partial' : 'pass'
  return { id: at.id, title: at.title, expected: at.expected, status, key_assertion: at.key, note: at.note ?? null, artifacts: at.artifacts, commands: [...new Set(at.refs.map(stageOf).flatMap((st) => stages.filter((s) => s.stage === st || s.stage.startsWith(`${st}:`)).map((s) => s.command)))], assertions }
})

const totals = {}
for (const [k, v] of tests) { const s = k.split(/::|:/)[0]; totals[s] ??= { total: 0, pass: 0, fail: 0, skip: 0 }; totals[s].total++; totals[s][v.status === 'pass' ? 'pass' : v.status === 'fail' ? 'fail' : 'skip']++ }
const out = {
  milestone: 'M09', generated_at: new Date().toISOString(), branch: run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: REPO }).out.trim(), commit: run('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO }).out.trim(),
  node: process.version, stages, totals,
  summary: { pass: ats.filter((a) => a.status === 'pass').length, partial: ats.filter((a) => a.status === 'partial').length, fail: ats.filter((a) => a.status === 'fail').length, not_run: ats.filter((a) => a.status === 'not_run').length },
  acceptance: ats,
}
const json = scrub(JSON.stringify(out, null, 2))
fs.writeFileSync(path.join(EVID, 'results.json'), json + '\n')

// Markdown table
const rel = (p) => path.posix.relative('docs/evidence', p)
const esc = (s) => String(s).replace(/\|/g, '\\|')
const lines = []
lines.push('| AT | Test | Status | Key assertion | Evidence |', '|---|---|---|---|---|')
for (const a of ats) {
  const n = a.assertions.length; const p = a.assertions.filter((x) => x.status === 'pass').length
  lines.push(`| ${a.id} | ${esc(a.title)} | **${a.status.toUpperCase()}** (${p}/${n}) | ${esc(a.key_assertion)}${a.note ? ` _${esc(a.note)}_` : ''} | ${a.artifacts.map((x) => `[${path.basename(x)}](${rel(x)})`).join(', ')} |`)
}
const stageLines = ['| Stage | Command | Exit | Tests (pass/total) |', '|---|---|---|---|']
for (const s of stages) stageLines.push(`| ${s.stage} | \`${esc(s.command)}\` | ${s.exit} | ${s.counts ? `${s.counts.pass}/${s.counts.total}${s.counts.fail ? `, ${s.counts.fail} fail` : ''}` : '—'} |`)
const tpl = path.join(here, 'm09-acceptance.template.md')
let md = fs.readFileSync(tpl, 'utf8')
md = md.replace('{{GENERATED}}', `${out.generated_at} · branch \`${out.branch}\` @ \`${out.commit}\` · Node ${out.node}`)
  .replace('{{SUMMARY}}', `**${out.summary.pass} pass · ${out.summary.partial} partial · ${out.summary.fail} fail · ${out.summary.not_run} not run** (of 22)`)
  .replace('{{TABLE}}', lines.join('\n'))
  .replace('{{STAGES}}', stageLines.join('\n'))
  .replace('{{TOTALS}}', Object.entries(totals).map(([k, v]) => `${k}: ${v.pass}/${v.total}${v.fail ? ` (${v.fail} fail)` : ''}${v.skip ? ` (${v.skip} skipped)` : ''}`).join(' · '))
fs.writeFileSync(path.join(REPO, 'docs', 'evidence', 'm09-acceptance.md'), scrub(md))
log('summary', JSON.stringify(out.summary), 'totals', JSON.stringify(totals))
for (const a of ats) if (a.status !== 'pass') log(a.id, a.status, a.assertions.filter((x) => x.status !== 'pass').map((x) => `${x.status}: ${x.ref}`).join(' | '))
stopAll()
process.exitCode = out.summary.fail ? 1 : 0
