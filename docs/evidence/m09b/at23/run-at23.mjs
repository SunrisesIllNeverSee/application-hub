#!/usr/bin/env node
// AT23 — the fresh-agent journey (M09b B1.7). Repeatable acceptance harness.
//
// A fresh agent (headless Claude Code) with no repository access and no
// developer credentials starts at the AQUA site, is given an application URL
// and a folder of past applications, and must get to a packet that is ready
// to export and verifies. Nothing is submitted.
//
//   # before deploy: a local `next start` of the release branch stands in for aquaidp.xyz
//   node docs/evidence/m09b/at23/run-at23.mjs --standin app --public-env <file with NEXT_PUBLIC_* only>
//   # after deploy:
//   node docs/evidence/m09b/at23/run-at23.mjs --site https://aquaidp.xyz
//
// Options
//   --site <origin>          use a deployed site (no stand-in; its server log is not ours to capture)
//   --standin <appdir>       run `next start` of <appdir> (already built) behind a local TLS front
//   --public-env <file>      NEXT_PUBLIC_* lines for the stand-in (anything else is refused)
//   --mode agent|scripted    agent (default): headless `claude -p`; scripted: a JSON-RPC client that
//                            follows the guidance literally (the documented fallback)
//   --scratch <dir>          scratch root (default /private/tmp/claude-501/at23-<stamp>)
//   --evidence <dir>         where scrubbed evidence goes (default: this script's folder)
//   --max-turns <n>          conversation turn cap (default 16)
//   --model <id>             optional model override for claude
//   --fake-catalog           stand-in only: serve a SYNTHETIC public catalog (PostgREST shape) over the
//                            harness TLS and point the stand-in's NEXT_PUBLIC_SUPABASE_* at it, so the run
//                            needs no real project values (for integration checks; no production access)
//
// What is harness, what is human, what is agent (see AT23.md):
//   - The AGENT only gets WebFetch (+ ToolSearch to load deferred tools) and, from phase 2, the
//     companion MCP configured exactly as its own instructions say.
//   - The USER (simulated here, labelled "human" in the log) runs the shell commands the agent
//     hands over (allowlisted, executed literally after ~ expansion), copies files into inbox/,
//     and does the browser steps.
//   - The BROWSER is stood in for by the app's real vault modules (app/lib/aqua-local, the same
//     code the AQUA web app runs), in memory: Restore, Confirm submitted history, approve on the
//     review board (approveAsHuman), freeze, sign, export the packet, export a backup.
// All content is synthetic.

import { spawn, execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import https from 'node:https'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../../../..')

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const a = { mode: 'agent', maxTurns: 16 }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    const v = () => argv[++i]
    if (k === '--site') a.site = v().replace(/\/$/, '')
    else if (k === '--standin') a.standin = path.resolve(v())
    else if (k === '--public-env') a.publicEnv = path.resolve(v())
    else if (k === '--mode') a.mode = v()
    else if (k === '--scratch') a.scratch = path.resolve(v())
    else if (k === '--evidence') a.evidence = path.resolve(v())
    else if (k === '--max-turns') a.maxTurns = Number(v())
    else if (k === '--model') a.model = v()
    else if (k === '--claude') a.claude = v()
    else if (k === '--fake-catalog') a.fakeCatalog = true
    else throw new Error(`unknown option ${k}`)
  }
  if (!a.site && !a.standin) throw new Error('pass --site <origin> or --standin <appdir>')
  if (!['agent', 'scripted'].includes(a.mode)) throw new Error('--mode is agent or scripted')
  return a
}
const ARGS = parseArgs(process.argv.slice(2))
const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const SCRATCH = ARGS.scratch ?? `/private/tmp/claude-501/at23-${STAMP}`
const EVIDENCE = ARGS.evidence ?? HERE
const D = {
  home: path.join(SCRATCH, 'home'), // the simulated user's empty HOME (companion, npm cache, files)
  work: path.join(SCRATCH, 'work'), // the agent's working directory: empty, no repository
  tls: path.join(SCRATCH, 'tls'),
  logs: path.join(SCRATCH, 'logs'),
  harness: path.join(SCRATCH, 'harness'),
}
for (const d of Object.values(D)) fs.mkdirSync(d, { recursive: true })
for (const d of ['Documents', 'Desktop', 'Downloads']) fs.mkdirSync(path.join(D.home, d), { recursive: true })
fs.mkdirSync(EVIDENCE, { recursive: true })

// Synthetic secrets the simulated USER holds. Never given to the agent.
const PASSPHRASE = `at23-synthetic-pass-${crypto.randomBytes(6).toString('hex')}`
const ACCOUNT_UID = '00000000-0000-4000-8000-0000000a7023' // the user's (synthetic) AQUA account id
const HUMAN = 'human-at23-user'
const SITE_PORT = 18443
const APP_PORT = 18444
const STANDIN_UPSTREAM_PORT = 18430
const FAKE_CATALOG_PORT = 18445
const FAKE_CATALOG_KEY = 'sb_publishable_AT23_SYNTHETIC_local_catalog'
const LOG = [] // the run log: { t, who: agent|human|harness, what, detail }
const note = (who, what, detail = undefined) => {
  const e = { t: new Date().toISOString(), who, what, ...(detail === undefined ? {} : { detail }) }
  LOG.push(e)
  process.stderr.write(`[${who}] ${what}${detail && typeof detail === 'string' ? `: ${detail.slice(0, 200)}` : ''}\n`)
}
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const children = [] // processes this harness started (stopped by PID at the end)
function stopChildren() { for (const c of children) if (c._detached || (c.exitCode === null && c.signalCode === null)) { try { process.kill(c.spawnargs && c._detached ? -c.pid : c.pid, 'SIGTERM') } catch { try { process.kill(c.pid, 'SIGTERM') } catch { /* gone */ } } } }
process.on('exit', stopChildren)
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stopChildren(); process.exit(130) })
process.on('uncaughtException', (e) => { process.stderr.write(`${e.stack ?? e}\n`); process.exit(2) })

// ---------------------------------------------------------------------------
// synthetic content: history (3 files, one with [CONFIRM]) and the application page
// ---------------------------------------------------------------------------
const MARKERS = ['ZQX-AT23-H1', 'ZQX-AT23-H2', 'ZQX-AT23-H3', 'ZQX-AT23-H4', 'ZQX-AT23-H5', 'ZQX-AT23-H6']
const PRIVATE_PHRASES = [
  'Brinewatch', 'dissolved oxygen every ten minutes', 'letter of intent from the Synthetic Harbor Authority',
  'Ana Ruiz', 'Theo Park', '40 additional buoys', 'sensor fouling', 'copper-mesh sleeve',
  '50,000 readings', 'three paying harbor contracts', 'waitlist for the next coast', '2,000 marine sensors',
]
const HISTORY = {
  '2025-03-01-tidewater-accelerator.md': `---
program: Tidewater Synthetic Accelerator
submitted: 2025-03-01
---
# Tidewater Synthetic Accelerator application

## What are you building? (150 words)

Brinewatch is a low-cost water-quality sensor network for small marinas. Each buoy measures salinity, turbidity and dissolved oxygen every ten minutes and posts readings to a shared dashboard that harbor masters already use. We started after a synthetic algae bloom closed three marinas on our stretch of coast for a week. (ref ZQX-AT23-H1)

## Why now?

Sensor costs fell by roughly 60 percent in two years, and the state now requires monthly water testing for marinas above 50 slips. (ref ZQX-AT23-H2)

## What traction do you have?

We have pilots running at [CONFIRM number] marinas and a signed letter of intent from the Synthetic Harbor Authority. (ref ZQX-AT23-H3)
`,
  'coastal-fellowship-2024.md': `# Coastal Synthetic Fellowship

Submitted: May 20, 2024

## What is the biggest risk to your project?

Our biggest risk is sensor fouling: barnacles and algae coat the probes within weeks. We are testing a copper-mesh sleeve and a monthly swap schedule that volunteers can run. (ref ZQX-AT23-H6)
`,
}
// What the user actually submitted (the simulated user confirms only history items that match one of these exactly).
const SUBMITTED_ANSWERS = [
  'Brinewatch is a low-cost water-quality sensor network',
  'Sensor costs fell by roughly 60 percent in two years',
  'Ana Ruiz (hardware, nine years at a synthetic sensor company) and Theo Park (software, built two public dashboards). We met volunteering on a beach clean-up. (ref ZQX-AT23-H4)',
  '60 percent for 40 additional buoys',
  'Our biggest risk is sensor fouling',
]
const SUBMITTED_QUESTIONS = ['What are you building?', 'Why now?', 'What traction do you have?', 'Who is on your team?', 'How will you use the grant funds?', 'What is the biggest risk to your project?']
// Facts the user gives when the agent asks (also private: scanned for in every request).
const FACTS = `Here are the facts you asked for:
- Traction: pilots are now running at 6 marinas (confirmed this month), the Synthetic Harbor Authority letter of intent is signed, and the buoys have logged about 50,000 readings since March 2025.
- Funds: yes, the same split holds for the $40,000 grant (60% buoys, 25% field technician, 15% certification testing).
- 12-month plan: months 1-3 deploy 40 more buoys across 10 marinas; months 4-8 finish sensor certification and hire the field technician; months 9-12 sign three paying harbor contracts and start a waitlist for the next coast.
- The "60 percent in two years" sensor cost figure is still accurate.`
const TEAM_FACT = `For Q3, why we are the right people: Ana and Theo have run water sensors on this coast for three years, and Ana's previous team shipped 2,000 marine sensors, so we know how buoys fail in salt water. Please take out any placeholder text that is still in a draft.`
const DOCX_NAME = '2024-09-10-seabright-grant.docx'
const DOCX_PARAS = [
  'Seabright Synthetic Community Grant',
  'Who is on your team?',
  'Ana Ruiz (hardware, nine years at a synthetic sensor company) and Theo Park (software, built two public dashboards). We met volunteering on a beach clean-up. (ref ZQX-AT23-H4)',
  'How will you use the grant funds?',
  '60 percent for 40 additional buoys, 25 percent for a part-time field technician, 15 percent for certification testing. (ref ZQX-AT23-H5)',
]
const APP_PATH = '/apply/harbor-fellowship-2027'
const APP_QUESTIONS = [
  ['What are you building?', 150],
  ['Why now? Why is this the right moment for your project?', 100],
  ['Tell us about your team and why you are the right people to build this.', 200],
  ['What traction do you have so far?', 100],
  ['How will you use the fellowship funds?', 150],
  ['Describe your plan for the first 12 months after the fellowship.', 150],
]
const APP_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Harbor Synthetic Fellowship 2027 — Application</title>
<meta name="description" content="Apply to the Harbor Synthetic Fellowship 2027 (synthetic test program)."></head>
<body>
<header><h1>Harbor Synthetic Fellowship 2027</h1>
<p>Organization: Harbor Synthetic Foundation (a synthetic test program; not a real fellowship)</p>
<p><strong>Deadline: December 15, 2026, 11:59 pm Pacific Time.</strong> Late applications are not accepted.</p>
<p>A 12-month fellowship with a $40,000 grant for early-stage climate and ocean projects.</p></header>
<form method="post" action="${APP_PATH}/submit">
${APP_QUESTIONS.map(([q, w], i) => `<fieldset><label for="q${i + 1}">${i + 1}. ${q} (${w} words max)</label>
<textarea id="q${i + 1}" name="q${i + 1}" maxlength="${w * 8}" required></textarea></fieldset>`).join('\n')}
<button type="submit">Submit application</button>
</form>
</body></html>
`

function zipStored(files) {
  // minimal stored-entry zip (same technique as aqua-companion/test/mcp-helpers.mjs)
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const parts = []; const central = []; let offset = 0
  for (const f of files) {
    const name = Buffer.from(f.name); const data = Buffer.from(f.data); const crc = crc32(data)
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26)
    parts.push(lh, name, data)
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42)
    central.push(ch, name)
    offset += lh.length + name.length + data.length
  }
  const cd = Buffer.concat(central)
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, cd, end])
}
function syntheticDocx(paragraphs) {
  const p = (t) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.map(p).join('')}</w:body></w:document>`
  const ct = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'
  return zipStored([{ name: '[Content_Types].xml', data: ct }, { name: 'word/document.xml', data: xml }])
}

const HIST_DIR = path.join(D.home, 'Documents', 'past-applications')
fs.mkdirSync(HIST_DIR, { recursive: true })
for (const [n, c] of Object.entries(HISTORY)) fs.writeFileSync(path.join(HIST_DIR, n), c)
fs.writeFileSync(path.join(HIST_DIR, DOCX_NAME), syntheticDocx(DOCX_PARAS))

// ---------------------------------------------------------------------------
// TLS (WebFetch needs https and refuses dot-less hosts, so local servers are https://127.0.0.1:<port>)
// ---------------------------------------------------------------------------
function makeTls() {
  const o = (args) => execFileSync('openssl', args, { cwd: D.tls, stdio: ['ignore', 'ignore', 'ignore'] })
  o(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '3', '-subj', '/CN=AT23 synthetic local test CA', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=keyCertSign,cRLSign'])
  o(['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'srv.key', '-out', 'srv.csr', '-subj', '/CN=127.0.0.1'])
  fs.writeFileSync(path.join(D.tls, 'ext.cnf'), 'subjectAltName=IP:127.0.0.1,DNS:localhost\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n')
  o(['x509', '-req', '-in', 'srv.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'srv.pem', '-days', '3', '-extfile', 'ext.cnf'])
  return { key: fs.readFileSync(path.join(D.tls, 'srv.key')), cert: fs.readFileSync(path.join(D.tls, 'srv.pem')), ca: path.join(D.tls, 'ca.pem') }
}
const TLS = makeTls()

// ---------------------------------------------------------------------------
// request logs: every server we run logs every request (method, path, UA, body digest)
// ---------------------------------------------------------------------------
const REQUESTS = [] // { server, t, method, url, ua, status, req_bytes, req_body_sample }
function logRequest(server, req, body, status) {
  REQUESTS.push({
    server, t: new Date().toISOString(), method: req.method, url: req.url,
    ua: String(req.headers['user-agent'] ?? '').slice(0, 120), status,
    req_bytes: body.length, req_sha256: body.length ? sha256(body) : null,
    req_body_sample: body.length ? body.toString('utf8').slice(0, 4000) : '',
  })
}
function readBody(req) {
  return new Promise((resolve) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => resolve(Buffer.concat(c))) })
}
function listen(server, port) {
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve()) })
}

// The synthetic public application page (the "application URL").
async function startAppPage() {
  const srv = https.createServer({ key: TLS.key, cert: TLS.cert }, async (req, res) => {
    const body = await readBody(req)
    let status = 404
    if (req.method === 'GET' && (req.url === APP_PATH || req.url === `${APP_PATH}/`)) {
      status = 200; res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(APP_HTML)
    } else if (req.method === 'GET' && req.url === '/') {
      status = 200; res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(`<!doctype html><title>Harbor Synthetic Foundation</title><p><a href="${APP_PATH}">Apply to the 2027 fellowship</a></p>`)
    } else if (req.method !== 'GET' && req.method !== 'HEAD') {
      status = 405; res.writeHead(405, { 'content-type': 'text/plain' }); res.end('submissions are not accepted by this synthetic page\n')
    } else { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found\n') }
    logRequest('application-page', req, body, status)
  })
  await listen(srv, APP_PORT)
  return { url: `https://127.0.0.1:${APP_PORT}${APP_PATH}`, close: () => srv.close() }
}

// --fake-catalog: a synthetic public catalog in PostgREST shape (GET only, publishable key required).
const FAKE_CATALOG = {
  programs: [{ id: 'p-at23-synthetic', slug: 'at23-synthetic-ocean-fund', name: 'AT23 Synthetic Ocean Fund', organization: 'Synthetic Catalog Org', description: 'A synthetic catalog program for the AT23 integration run.', source: 'canonical', is_rolling: true }],
  program_cycles: [{ id: 'c-at23-synthetic', program_id: 'p-at23-synthetic', cycle_name: '2027', is_active: true }],
  program_questions: [
    { id: 'pq-at23-1', program_id: 'p-at23-synthetic', archived_question_id: 'aq-at23-1', asked_as: 'What are you building?', word_limit: 150, is_required: true, order_index: 0 },
    { id: 'pq-at23-2', program_id: 'p-at23-synthetic', archived_question_id: 'aq-at23-2', asked_as: 'What traction do you have so far?', word_limit: 100, is_required: true, order_index: 1 },
  ],
  archived_questions: [{ id: 'aq-at23-1', text: 'What are you building?', theme: 'product' }, { id: 'aq-at23-2', text: 'What traction do you have so far?', theme: 'traction' }],
}
async function startFakeCatalog() {
  const srv = https.createServer({ key: TLS.key, cert: TLS.cert }, async (req, res) => {
    const body = await readBody(req)
    const u = new URL(req.url, 'https://x')
    const table = u.pathname.replace(/^\/rest\/v1\//, '')
    let status = 404
    if (req.method !== 'GET') status = 405
    else if (req.headers.apikey !== FAKE_CATALOG_KEY) status = 401
    else if (table in FAKE_CATALOG) status = 200
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(status === 200 ? JSON.stringify(Number(u.searchParams.get('offset') ?? 0) > 0 ? [] : FAKE_CATALOG[table]) : '[]')
    logRequest('fake-catalog', req, body, status)
  })
  await listen(srv, FAKE_CATALOG_PORT)
  return { origin: `https://127.0.0.1:${FAKE_CATALOG_PORT}`, close: () => srv.close() }
}
let fakeCatalogHandle = null

// The stand-in for aquaidp.xyz: `next start` of the release branch behind a logging TLS front.
async function startStandin() {
  const envText = fs.readFileSync(ARGS.publicEnv ?? '/dev/null', 'utf8')
  const env = {}
  for (const line of envText.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    if (!m[1].startsWith('NEXT_PUBLIC_') || /SERVICE|SECRET/i.test(m[1])) throw new Error(`refusing non-public env ${m[1]} for the stand-in`)
    env[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
  }
  if (ARGS.fakeCatalog) {
    fakeCatalogHandle = await startFakeCatalog()
    env.NEXT_PUBLIC_SUPABASE_URL = fakeCatalogHandle.origin
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY = FAKE_CATALOG_KEY
    note('harness', `synthetic public catalog at ${fakeCatalogHandle.origin} (--fake-catalog; no real project values)`)
  }
  const child = spawn(process.execPath, [path.join(ARGS.standin, 'node_modules/next/dist/bin/next'), 'start', '-p', String(STANDIN_UPSTREAM_PORT), '-H', '127.0.0.1'], {
    cwd: ARGS.standin, env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', ...env }, stdio: ['ignore', 'pipe', 'pipe'], detached: true, // own process group: next forks next-server
  })
  child._detached = true
  children.push(child)
  const out = fs.createWriteStream(path.join(D.logs, 'next-start.log'))
  child.stdout.pipe(out); child.stderr.pipe(out)
  note('harness', `started next start (pid ${child.pid}) on 127.0.0.1:${STANDIN_UPSTREAM_PORT}`)
  for (let i = 0; i < 120; i++) {
    try { await new Promise((ok, no) => http.get(`http://127.0.0.1:${STANDIN_UPSTREAM_PORT}/llms.txt`, (r) => { r.resume(); r.statusCode === 200 ? ok() : no(new Error(String(r.statusCode))) }).on('error', no)); break } catch { await new Promise((r) => setTimeout(r, 500)) }
  }
  const front = https.createServer({ key: TLS.key, cert: TLS.cert }, async (req, res) => {
    const body = await readBody(req)
    const headers = { ...req.headers }
    delete headers.cookie
    const up = http.request({ host: '127.0.0.1', port: STANDIN_UPSTREAM_PORT, method: req.method, path: req.url, headers }, (ur) => {
      res.writeHead(ur.statusCode ?? 502, ur.headers)
      ur.pipe(res)
      logRequest('standin-site', req, body, ur.statusCode)
    })
    up.on('error', (e) => { res.writeHead(502); res.end(String(e.message)); logRequest('standin-site', req, body, 502) })
    up.end(body)
  })
  await listen(front, SITE_PORT)
  return { origin: `https://127.0.0.1:${SITE_PORT}`, close: () => front.close() }
}

// ---------------------------------------------------------------------------
// the companion's own outbound requests: a fetch logger preloaded into every companion process
// ---------------------------------------------------------------------------
const NETLOG = path.join(D.logs, 'companion-fetch.jsonl')
const NETLOG_PRELOAD = path.join(D.harness, 'at23-netlog.mjs')
fs.writeFileSync(NETLOG_PRELOAD, `// AT23 harness: log every globalThis.fetch the companion makes (method, url, header NAMES, body)
import fs from 'node:fs'
const out = process.env.AT23_NETLOG
const orig = globalThis.fetch
if (out && orig) globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : String(input?.url ?? input)
  const h = init.headers ?? {}
  const e = { t: new Date().toISOString(), pid: process.pid, method: init.method ?? 'GET', url, header_names: Object.keys(h instanceof Headers ? Object.fromEntries(h) : h), body: init.body == null ? null : String(init.body).slice(0, 4000) }
  try { const r = await orig(input, init); e.status = r.status; return r } catch (err) { e.error = String(err?.message ?? err); throw err } finally { fs.appendFileSync(out, JSON.stringify(e) + '\\n') }
}
`)

// ---------------------------------------------------------------------------
// the simulated user's shell: environment and an allowlisted executor for the agent's commands
// ---------------------------------------------------------------------------
let SITE = null // origin the agent is told to use
let catalogConfigFile = null // stand-in only: AQUA_CATALOG_CONFIG override (production serves it at aquaidp.xyz)
function userEnv(extra = {}) {
  return {
    PATH: process.env.PATH, HOME: D.home, USER: 'at23user', LANG: 'en_US.UTF-8', TMPDIR: path.join(SCRATCH, 'tmp'),
    NODE_EXTRA_CA_CERTS: TLS.ca, npm_config_update_notifier: 'false', npm_config_fund: 'false', npm_config_audit: 'false', npm_config_progress: 'false', NO_COLOR: '1',
    AQUA_PASSPHRASE: PASSPHRASE, // the user typing their passphrase (standing in for the no-echo prompt)
    AT23_NETLOG: NETLOG, NODE_OPTIONS: `--import=${NETLOG_PRELOAD}`,
    ...(catalogConfigFile ? { AQUA_CATALOG_CONFIG: catalogConfigFile, CURL_CA_BUNDLE: TLS.ca } : {}),
    ...extra,
  }
}
fs.mkdirSync(path.join(SCRATCH, 'tmp'), { recursive: true })

function run(cmd, args, { cwd = D.home, input = null, env = userEnv(), timeout = 300_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''; let err = ''
    const timer = setTimeout(() => child.kill('SIGTERM'), timeout)
    child.stdout.on('data', (d) => { out += d }); child.stderr.on('data', (d) => { err += d })
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, out, err }) })
    if (input) child.stdin.write(input)
    child.stdin.end()
  })
}


/** GET a URL as the user's curl would (async: the local servers live in this process). */
function curlBuf(url) {
  return new Promise((resolve, reject) => {
    const child = spawn('curl', ['-fsSL', '--cacert', TLS.ca, url], { stdio: ['ignore', 'pipe', 'pipe'] })
    const c = []; let err = ''
    child.stdout.on('data', (d) => c.push(d)); child.stderr.on('data', (d) => { err += d })
    child.on('close', (code) => (code === 0 ? resolve(Buffer.concat(c)) : reject(new Error(`curl ${url}: exit ${code} ${err}`))))
  })
}

const STATE = {
  tgzUrl: null, tgzLocal: null, tgzSha: null, shaExpected: null, shaOk: null,
  workspace: null, mcp: null, historyCopied: false, formSaved: null, emptyBackupGiven: false,
  askedApprove: false, browserDone: false, verifyAsked: false, finished: false,
  toolCalls: [], approveAttempts: [], drafts: [], applicationId: null,
  commandsRun: [], commandsSkipped: [], humanSteps: [], agentAsked: {},
  wsApprovalsBeforeHuman: null, vault: null,
}

const expandHome = (s) => s.replace(/(^|[\s='"])~(?=\/|$|\s)/g, `$1${D.home}`).replace(/\$HOME\b/g, D.home)
const mapOrigin = (s) => (SITE && SITE !== 'https://aquaidp.xyz' ? s.split('https://aquaidp.xyz').join(SITE) : s)
function insideHome(p) { const r = path.resolve(D.home, p); return r === D.home || r.startsWith(`${D.home}/`) ? r : null }

/** The shell blocks (```sh / bash / zsh / console) in the agent's message, verbatim. */
function extractBlocks(text) {
  const out = []
  const re = /```(?:sh|bash|zsh|shell|console|terminal)?[ \t]*\n([\s\S]*?)```/g
  let m
  while ((m = re.exec(text))) out.push(m[1].replace(/^\s*\$\s+/gm, ''))
  return out
}

// The user's terminal. The agent's commands run in a real bash, as the user would paste them,
// inside the scratch HOME, after an allowlist check. Two programs are shimmed:
//   claude   - `claude mcp add ...` is recorded and applied when the agent session restarts
//   security - the simulated user does not touch the real login Keychain; the passphrase
//              reaches the companion through its environment instead (documented route)
// Confirmation prompts (`Type "yes" to continue:`) are answered "yes" by a pty wrapper: the
// user typing yes after reading the plan.
const SHIMS = path.join(D.harness, 'bin')
fs.mkdirSync(SHIMS, { recursive: true })
const MCP_ADD_LOG = path.join(D.harness, 'claude-mcp-add.jsonl')
fs.writeFileSync(path.join(SHIMS, 'claude'), `#!/usr/bin/env node
const fs = require('node:fs')
const a = process.argv.slice(2)
if (a[0] === 'mcp' && a[1] === 'add') { fs.appendFileSync(${JSON.stringify(MCP_ADD_LOG)}, JSON.stringify(a) + '\\n'); const n = a.slice(2).find((x) => !x.startsWith('-')); console.log('Added stdio MCP server ' + n + ' (applies when the Claude session restarts)'); process.exit(0) }
if (a[0] === 'mcp' && a[1] === 'list') { console.log('(harness) MCP servers are applied at the next session restart'); process.exit(0) }
console.error('(harness) only "claude mcp add" is available in this terminal'); process.exit(1)
`, { mode: 0o755 })
fs.writeFileSync(path.join(SHIMS, 'security'), `#!/bin/sh
echo "(harness) not run: the simulated user keeps the passphrase out of the real login Keychain; the companion reads it from its environment (AQUA_PASSPHRASE) instead." >&2
exit 0
`, { mode: 0o755 })
const TTY = path.join(D.harness, 'at23-tty.py')
fs.writeFileSync(TTY, `import os, pty, re, select, sys
pid, fd = pty.fork()
if pid == 0:
    os.execvp(sys.argv[1], sys.argv[1:])
buf = b''
while True:
    try:
        r, _, _ = select.select([fd], [], [], 900)
    except OSError:
        break
    if not r:
        break
    try:
        data = os.read(fd, 4096)
    except OSError:
        break
    if not data:
        break
    sys.stdout.buffer.write(data); sys.stdout.buffer.flush()
    buf = (buf + data)[-4000:]
    clean = re.sub(rb'\x1b\[[0-9;?]*[A-Za-z]', b'', buf)
    m = re.search(rb'Type "(\\w+)" to continue: ?$', clean)
    if m:
        os.write(fd, m.group(1) + b'\\n'); buf = b''
    elif re.search(rb'(?i)(passphrase|vault secret)[^\\n]*: ?$', clean):
        os.write(fd, os.environ.get('AT23_USER_PASS', '').encode() + b'\\n'); buf = b''
_, st = os.waitpid(pid, 0)
sys.exit(os.waitstatus_to_exitcode(st))
`)

const ALLOWED_HEADS = new Set(['node', 'npm', 'npx', 'mkdir', 'cd', 'curl', 'echo', 'printf', 'shasum', 'sha256sum', 'openssl', 'cp', 'ls', 'cat', 'test', '[', 'export', 'unset', 'read', 'claude', 'security', 'aqua-companion', 'if', 'then', 'else', 'elif', 'fi', 'set', 'pwd', 'which', 'command', 'head', 'tail', 'grep', 'tar', 'stty', 'true', 'cmp', 'diff', 'awk', 'cut', 'tr'])
/** Allowlist + path guard. Returns null when the block may run, else the reason. */
function blockRefusal(block) {
  const lines = block.replace(/\\\n/g, ' ').split('\n').map((l) => l.replace(/(^|\s)#.*$/, '').trim()).filter(Boolean)
  for (const line of lines) {
    for (let seg of line.split(/\|\||&&|;|\|/)) {
      seg = seg.trim().replace(/^(then|else|do|!)\s+/, '')
      while (/^[A-Za-z_][A-Za-z0-9_]*=("[^"]*"|'[^']*'|\S*)\s*/.test(seg)) seg = seg.replace(/^[A-Za-z_][A-Za-z0-9_]*=("[^"]*"|'[^']*'|\S*)\s*/, '')
      if (!seg) continue
      const head = seg.split(/\s+/)[0].replace(/^["']|["']$/g, '')
      const ok = ALLOWED_HEADS.has(head) || /^\$\{?[A-Za-z_]\w*\}?$/.test(head) || /\/(aqua-companion|aqua-companion\.mjs)$/.test(head) || head === 'if'
      if (!ok) return `\`${head}\` is not on the harness allowlist`
    }
    for (const m of line.matchAll(/(?:^|[\s="'(])(\/[^\s"')]*)/g)) {
      const p = m[1]
      if (p.startsWith(SCRATCH) || /^\/(dev\/null|usr\/|bin\/|opt\/homebrew\/|tmp\/?$)/.test(p) || /^\/\//.test(p)) continue
      return `path ${p} is outside the user's home`
    }
    if (/\brm\s|sudo|\bmv\s/.test(line)) return 'destructive commands are not run by the harness'
  }
  return null
}

function findWorkspaces(dir, depth = 0, out = []) {
  if (depth > 4) return out
  let entries = []
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  if (entries.some((e) => e.name === 'workspace.json') && fs.existsSync(path.join(dir, 'audit'))) out.push(dir)
  for (const e of entries) if (e.isDirectory() && !['node_modules', '.npm', 'inbox', 'exports', 'audit', 'answers', 'applications', 'evidence'].includes(e.name)) findWorkspaces(path.join(dir, e.name), depth + 1, out)
  return out
}

function applyMcpAdds() {
  if (!fs.existsSync(MCP_ADD_LOG)) return
  const adds = fs.readFileSync(MCP_ADD_LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const a = adds.at(-1)
  const dd = a.indexOf('--')
  const head = dd >= 0 ? a.slice(2, dd) : a.slice(2)
  const server = dd >= 0 ? a.slice(dd + 1) : head.slice(1)
  const envFlags = {}
  const name = head.filter((x, i) => !x.startsWith('-') && !['-e', '--env', '-s', '--scope', '-t', '--transport'].includes(head[i - 1]))[0] ?? 'aqua'
  head.forEach((x, i) => { if ((x === '-e' || x === '--env') && head[i + 1]) { const [k, ...v] = head[i + 1].split('='); envFlags[k] = v.join('=') } })
  STATE.mcp = { name, command: server[0], args: server.slice(1), env_flags: Object.keys(envFlags) }
  STATE.mcpAdds = adds.length
}

/** Run the agent's shell blocks in the user's terminal. Returns the terminal transcript for the agent. */
async function executeAgentCommands(text, label) {
  const blocks = extractBlocks(text)
  if (!blocks.length) return null
  const report = []
  for (const [i, original] of blocks.entries()) {
    const block = mapOrigin(original)
    const rec = { label, block: original, mapped_origin: block !== original || undefined }
    const why = blockRefusal(block)
    if (why) { rec.skipped = why; STATE.commandsSkipped.push(rec); report.push(`(I did not run this block: ${why})`); continue }
    const f = path.join(D.harness, `${label}-block-${i + 1}.sh`)
    fs.writeFileSync(f, `cd ~\nset -o pipefail\nset -x\n${block}\n`)
    const env = userEnv({ PATH: `${SHIMS}:${process.env.PATH}`, AT23_USER_PASS: PASSPHRASE, PS4: '$ ' })
    delete env.AT23_USER_PASS_SHOWN
    const r = await run('python3', ['-I', TTY, 'bash', f], { env, timeout: 600_000 })
    const outText = r.out.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, '').replace(/\r/g, '')
    rec.code = r.code
    STATE.commandsRun.push(rec)
    fs.writeFileSync(path.join(D.logs, `${label}-block-${i + 1}.out.txt`), outText)
    report.push(`(exit ${r.code})\n${outText.length > 6000 ? `…${outText.slice(-6000)}` : outText}`)
    // what changed for the user
    const tgz = block.match(/https?:\/\/[^\s"']+aqua-companion-[\d.]+\.tgz/)
    if (tgz) STATE.tgzUrl = STATE.tgzUrl ?? tgz[0]
    const wss = findWorkspaces(D.home)
    if (wss.length && !STATE.workspace) { STATE.workspace = wss[0]; STATE.humanSteps.push({ step: 'init workspace (typed yes; passphrase supplied by the user)', by: 'human (command from the agent)', workspace: STATE.workspace }) }
    if (/import-history/.test(block)) STATE.humanSteps.push({ step: 'import-history via the CLI', by: 'human (command from the agent)' })
    if (STATE.workspace && fs.existsSync(path.join(STATE.workspace, 'inbox')) && fs.readdirSync(path.join(STATE.workspace, 'inbox'), { recursive: true }).some((n) => String(n).includes('tidewater'))) STATE.historyCopied = true
    const eb = block.match(/export-backup\s+("?)([^\s"]+)\1/)
    if (eb && r.code === 0) STATE.lastExportBackup = path.resolve(D.home, eb[2].replace(/^~/, D.home))
    applyMcpAdds()
  }
  return report.join('\n\n')
}

/** The companion as the user can run it (for harness-side checks: export-backup, verify). */
function companionCmd(cargs) {
  if (STATE.mcp && STATE.mcp.command !== 'npx') return [expandHome(STATE.mcp.command), cargs]
  return ['npx', ['--yes', STATE.tgzUrl, ...cargs]]
}

// ---------------------------------------------------------------------------
// the browser stand-in: the app's real vault modules, in memory (the user's AQUA browser vault)
// ---------------------------------------------------------------------------
const APPLIB = pathToFileURL(path.join(REPO, 'app/lib/aqua-local/')).href
let BROWSER = null
async function browser() {
  if (BROWSER) return BROWSER
  const mods = await Promise.all(['vault', 'repo', 'backup', 'crypto', 'instances', 'packets', 'signoff', 'status', 'history']
    .map((m) => import(new URL(`${m}.ts`, APPLIB).href)))
  const app = Object.assign({}, ...mods)
  const review = await import(new URL('../aqua-local-client/review.ts', APPLIB).href)
  const hr = await import(new URL('history-review.ts', APPLIB).href)
  BROWSER = { app, review, hr, storage: app.createMemoryStorage(), secret: PASSPHRASE }
  return BROWSER
}

/** The user exports a (fresh) browser backup into the workspace inbox. */
async function browserExportToInbox(name) {
  const b = await browser()
  const env = await b.app.exportVault(b.storage, b.secret, { account_uid: ACCOUNT_UID })
  const dest = path.join(STATE.workspace, 'inbox', name)
  fs.writeFileSync(dest, env)
  return dest
}

async function browserReview() {
  STATE.round = (STATE.round ?? 0) + 1
  const round = STATE.round
  const sfx = round > 1 ? `-${round}` : ''
  const b = await browser()
  const { app, review, hr, storage, secret } = b
  const steps = []
  // 1. the user runs export-backup (as the guidance says) unless they already did
  let file = STATE.lastExportBackup
  STATE.exportedBy = file && fs.existsSync(file) ? 'agent command' : 'user (agent command missing or failed)'
  if (!file || !fs.existsSync(file)) {
    file = path.join(D.home, 'Desktop', `for-browser${sfx}.json`)
    const [c, a] = companionCmd(['export-backup', file, '--workspace', STATE.workspace, '--yes'])
    const r = await run(c, a)
    steps.push({ step: 'aqua-companion export-backup', code: r.code })
    if (r.code !== 0) throw new Error(`export-backup failed: ${r.err}`)
  }
  // 2. AQUA Local > Restore backup
  const imp = await app.importVault(storage, secret, fs.readFileSync(file, 'utf8'))
  steps.push({ step: 'AQUA Local: Restore backup', result: Object.fromEntries(Object.entries(imp ?? {}).filter(([, v]) => typeof v !== 'object')) })
  // 3. Confirm submitted history (/history), first visit only: the vault must refuse the [CONFIRM] item
  const groups = round === 1 ? await hr.listHistoryCandidates(storage, secret) : []
  const items = groups.flatMap((g) => g.items.map((i) => ({ ...i, program: g.program, submitted_at: i.submitted_at ?? g.submitted_at })))
  const placeholder = items.filter((i) => i.disabled_reason && /placeholder/i.test(i.disabled_reason))
  // A careful user confirms only what they actually submitted: the exact question and the exact answer.
  const matchesSubmission = async (i) => {
    const v = await review.readReviewCardVersion(storage, secret, i.version_id)
    const body = v.body.trim()
    const okAnswer = SUBMITTED_ANSWERS.some((a) => body.startsWith(a)) && !SUBMITTED_QUESTIONS.some((q) => body.includes(q))
    const okQuestion = SUBMITTED_QUESTIONS.some((q) => String(i.question ?? '').startsWith(q))
    return okAnswer && okQuestion
  }
  const confirmable = []
  const notConfirmed = []
  for (const i of items.filter((x) => !x.disabled_reason)) (await matchesSubmission(i) ? confirmable : notConfirmed).push(i)
  const refusals = []
  for (const p of placeholder) {
    // the UI disables it; the harness also tries the vault write directly to prove the vault refuses it
    try {
      await app.recordHistoryAttestation(storage, secret, { version_id: p.version_id, expected_sha256: p.sha256, effective_at: p.submitted_at ?? '2025-03-01', statement: 'I submitted this answer.', actor_id: HUMAN })
      refusals.push({ version_id: p.version_id, refused: false })
    } catch (e) { refusals.push({ version_id: p.version_id, refused: true, error: String(e.message).slice(0, 160) }) }
  }
  const confirmed = confirmable.length
    ? await hr.confirmHistorySelection(storage, secret, { items: confirmable, attested: true, statement: 'I submitted these answers on the dates shown.', actor_id: HUMAN })
    : []
  if (round === 1) steps.push({ step: 'Confirm submitted history', candidates: items.length, confirmed: confirmed.filter((x) => x.ok).length, placeholder_items: placeholder.length, placeholder_refused_by_vault: refusals.every((r) => r.refused), left_unconfirmed_as_misparsed: notConfirmed.map((i) => i.question), disabled: items.filter((i) => i.disabled_reason).map((i) => i.disabled_reason) })
  if (round === 1) { STATE.historyRefusals = refusals; STATE.placeholderVersionIds = placeholder.map((p) => p.version_id) }
  // 4. Review board (/review/<application>): approve each agent draft the user is happy with
  const instances = await app.listAppInstances(storage)
  const target = instances.find((i) => i.instance_id === STATE.applicationId || i.application_id === STATE.applicationId) ?? instances.find((i) => !i.history)
  if (!target) throw new Error('the application is not in the restored vault')
  const rows = await review.listInstanceQuestions(storage, secret, target.instance_id)
  const decisions = []
  const selections = []
  for (const row of rows) {
    const latest = row.versions.at(-1)
    if (!latest) { selections.push({ question_occurrence_id: row.question_occurrence_id, question_text_snapshot: row.text ?? '', version_id: null, skip_reason: 'No draft yet; I will write this one myself.' }); decisions.push({ q: row.text, decision: 'skip (no draft)' }); continue }
    const v = await review.readReviewCardVersion(storage, secret, latest.id)
    const prior = (await storage.getAll('approvals')).find((a) => a.version_id === latest.id && a.actor_id === HUMAN)
    if (prior) { selections.push({ question_occurrence_id: row.question_occurrence_id, question_text_snapshot: row.text ?? '', version_id: latest.id }); decisions.push({ q: row.text, decision: 'approved earlier', version_id: latest.id }); continue }
    const ph = app.findPlaceholders(v.body)
    const over = row.word_limit && v.word_count > row.word_limit
    if (ph.length || over) {
      selections.push({ question_occurrence_id: row.question_occurrence_id, question_text_snapshot: row.text ?? '', version_id: null, skip_reason: ph.length ? 'Draft still has a placeholder I need to fill in myself.' : 'Draft is over the word limit; I will cut it myself.' })
      decisions.push({ q: row.text, decision: `not approved (${ph.length ? `placeholder: ${ph.join(',')}` : `over limit ${v.word_count}/${row.word_limit}`})`, version_id: latest.id })
      continue
    }
    const appr = await review.approveAsHuman(storage, { version_id: latest.id, expected_sha256: latest.sha256, actor_id: HUMAN, secret })
    selections.push({ question_occurrence_id: row.question_occurrence_id, question_text_snapshot: row.text ?? '', version_id: latest.id })
    decisions.push({ q: row.text, decision: 'approved', version_id: latest.id, sha256: latest.sha256, approval_id: appr.id, words: v.word_count, limit: row.word_limit })
  }
  steps.push({ step: 'Review board: approve as human', decisions })
  // 5. Freeze, sign (local key), export the packet
  const { packet, record } = await app.freezeApplicationPacket(storage, secret, { application_id: target.application_id, selections })
  const kp = await app.generateSignerKeyPair()
  await app.attestPacket(storage, { packet_id: packet.packet_id, signer_class: 'local-only', user_ack: true, manifest_sha256: record.manifest_sha256, privateKey: kp.privateKey, pubkey_b64: kp.pubkey_b64 })
  const packetDoc = await app.exportPacket(storage, packet.packet_id, secret)
  const packetName = `packet-export${sfx}.json`
  const backupName = `aqua-local-backup-after-review${sfx}.json`
  fs.writeFileSync(path.join(STATE.workspace, 'inbox', packetName), packetDoc)
  steps.push({ step: 'Freeze, sign (local-only key) and export the packet', packet_id: packet.packet_id, manifest_sha256: record.manifest_sha256, file: `inbox/${packetName}`, skipped_questions: selections.filter((x) => !x.version_id).length })
  // 6. Export a fresh browser backup into inbox/
  await browserExportToInbox(backupName)
  steps.push({ step: 'Export a fresh browser backup into inbox/', file: `inbox/${backupName}` })
  STATE.vault = { instance: target, packet_id: packet.packet_id, manifest_sha256: record.manifest_sha256, decisions, skipped: selections.filter((x) => !x.version_id).length }
  STATE.humanSteps.push({ step: `browser round ${round}: restore${round === 1 ? ', confirm history' : ''}, approve, freeze, sign, export`, by: 'human (browser stand-in: app vault modules)', steps })
  STATE.browserDone = true
  STATE.lastPacketFile = packetName
  STATE.lastBackupFile = backupName
  STATE.lastExportBackup = null
  STATE.roundEndIdx = STATE.toolCalls.length
  return { round, packetName, backupName, steps, decisions, confirmed: confirmed.filter((x) => x.ok).length, refused: refusals.length, misparsed: notConfirmed.length, exportedBy: STATE.exportedBy }
}

// ---------------------------------------------------------------------------
// the agent: headless Claude Code
// ---------------------------------------------------------------------------
const CLAUDE_ENV = (() => {
  // A clean environment: no AQUA_* secrets, no parent-session markers. HOME stays the real one
  // only because Claude Code's own login lives in the macOS login Keychain (see AT23.md).
  const keep = ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TERM', 'LANG', 'TMPDIR']
  const env = Object.fromEntries(keep.filter((k) => process.env[k]).map((k) => [k, process.env[k]]))
  env.NODE_EXTRA_CA_CERTS = TLS.ca
  return env
})()
function mcpConfigFile() {
  if (!STATE.mcp) return null
  const args = [...STATE.mcp.args]
  const env = userEnv()
  delete env.TMPDIR
  const cfg = { mcpServers: { [STATE.mcp.name]: { type: 'stdio', command: expandHome(STATE.mcp.command), args: args.map((x) => expandHome(x)), env } } }
  const f = path.join(D.harness, 'mcp-config.json')
  fs.writeFileSync(f, JSON.stringify(cfg, null, 2))
  return f
}
let SESSION = null
let TURN = 0
async function claudeTurn(prompt) {
  TURN += 1
  const label = `turn-${String(TURN).padStart(2, '0')}`
  const mcp = mcpConfigFile()
  const name = STATE.mcp?.name ?? 'aqua'
  const argv = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--restricted', '--strict-mcp-config',
    '--tools', 'WebFetch,ToolSearch', '--allowedTools', `WebFetch,ToolSearch${mcp ? `,mcp__${name}` : ''}`,
    '--settings', JSON.stringify({ skipWebFetchPreflight: true })]
  if (mcp) argv.push('--mcp-config', mcp)
  if (SESSION) argv.push('--resume', SESSION)
  if (ARGS.model) argv.push('--model', ARGS.model)
  note('harness', `${label}: claude -p (${mcp ? 'WebFetch + companion MCP' : 'WebFetch only'})`)
  fs.writeFileSync(path.join(D.logs, `${label}.prompt.txt`), prompt)
  const r = await new Promise((resolve) => {
    const child = spawn(ARGS.claude ?? 'claude', argv, { cwd: D.work, env: CLAUDE_ENV, stdio: ['ignore', 'pipe', 'pipe'] })
    children.push(child)
    const lines = []; let buf = ''; let err = ''
    const timer = setTimeout(() => child.kill('SIGTERM'), 30 * 60_000)
    child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.trim()) lines.push(l) } })
    child.stderr.on('data', (d) => { err += d })
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, lines, err }) })
  })
  fs.writeFileSync(path.join(D.logs, `${label}.jsonl`), r.lines.join('\n') + '\n')
  const events = r.lines.map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  const pending = new Map()
  let finalText = ''
  for (const e of events) {
    if (e.type === 'system' && e.subtype === 'init') { SESSION = e.session_id; STATE.model = e.model; STATE.mcpServers = e.mcp_servers }
    if (e.type === 'assistant') for (const c of e.message?.content ?? []) {
      if (c.type === 'tool_use') pending.set(c.id, { turn: label, name: c.name, input: c.input })
    }
    if (e.type === 'user') for (const c of e.message?.content ?? []) {
      if (c.type === 'tool_result' && pending.has(c.tool_use_id)) {
        const call = pending.get(c.tool_use_id)
        const text = Array.isArray(c.content) ? c.content.map((x) => x.text ?? '').join('') : String(c.content ?? '')
        let json = null
        try { json = JSON.parse(text) } catch { /* not JSON */ }
        call.result = json ?? text.slice(0, 4000)
        call.is_error = Boolean(c.is_error)
        STATE.toolCalls.push(call)
        onToolResult(call)
      }
    }
    if (e.type === 'result') { finalText = e.result ?? ''; STATE.cost = (STATE.cost ?? 0) + (e.total_cost_usd ?? 0); if (e.session_id) SESSION = e.session_id }
  }
  if (r.code !== 0 && !finalText) note('harness', `${label}: claude exited ${r.code}`, r.err.slice(-500))
  note('agent', `${label} final message`, finalText)
  return { label, finalText, events }
}

function onToolResult(call) {
  const short = call.name.replace(/^mcp__[^_]+__/, '')
  const r = call.result && typeof call.result === 'object' ? call.result : {}
  if (short === 'import_local_application' && r.status === 'ok') STATE.applicationId = r.instance_id ?? r.application_id
  if (short === 'create_draft_version' && r.status === 'ok') STATE.drafts.push({ version_id: r.version_id, sha256: r.sha256, q: call.input?.question_occurrence_id })
  if (short === 'approve_answer') STATE.approveAttempts.push({ status: r.status ?? (call.is_error ? 'error' : 'unknown'), input: call.input })
  if (short === 'locate_workspace' && r.workspace?.root && fs.existsSync(path.join(r.workspace.root, 'workspace.json'))) STATE.workspace = r.workspace.root
}

// ---------------------------------------------------------------------------
// the conversation: the user's replies, with human steps when the agent asks for them
// ---------------------------------------------------------------------------
function wsApprovalCount() {
  if (!STATE.workspace) return null
  const m = JSON.parse(fs.readFileSync(path.join(STATE.workspace, 'workspace.json'), 'utf8'))
  return Object.values(m.records ?? {}).filter((e) => e.kind === 'approval').length
}
function asked(text, key, re) { if (re.test(text)) { STATE.agentAsked[key] = STATE.agentAsked[key] ?? TURN; return true } return false }

async function humanReply(finalText) {
  const t = finalText
  const parts = []
  // the user runs whatever commands the agent handed over (allowlisted)
  const cmdReport = await executeAgentCommands(t, `turn-${TURN}`)
  if (cmdReport) parts.push(`I ran your commands in my terminal. Here is the terminal output:\n\n${cmdReport}`)
  if (STATE.mcp && cmdReport && STATE.mcpAdds !== STATE.mcpAddsAnnounced) {
    STATE.mcpAddsAnnounced = STATE.mcpAdds
    parts.push('I restarted Claude Code, so the MCP server from your `claude mcp add` line is configured for this session now.')
    if (!STATE.kickoff) {
      STATE.kickoff = true
      parts.push('Once you are connected, please: bring in my past applications, bring in the application from the URL, match its questions against my past answers, and draft every question (reuse what fits, adapt what is close, and say where there is a gap). Where a claim needs backing, ask me for evidence. Then show me the review decisions so I can approve them.')
    }
  }
  // history into inbox/
  const askHistory = asked(t, 'copy_history', /inbox\/?(history)?/i) && /past|history|submitted/i.test(t)
  if (STATE.workspace && !STATE.historyCopied && askHistory) {
    fs.cpSync(HIST_DIR, path.join(STATE.workspace, 'inbox', 'history'), { recursive: true })
    STATE.historyCopied = true
    STATE.humanSteps.push({ step: 'copy past applications into inbox/history/', by: 'human (asked by the agent)' })
    parts.push(`I copied my past applications into ${path.join(STATE.workspace, 'inbox', 'history')}/.`)
  }
  // the application form into inbox/
  if (STATE.workspace && !STATE.formSaved && asked(t, 'save_form', /(save|copy|download|put|place)[^.\n]{0,80}(form|application page|the page|questions)[^.\n]{0,120}inbox|inbox\/[\w.-]+\.(md|html?|txt)/i)) {
    const names = [...t.matchAll(/inbox\/([\w.-]+\.(?:md|html?|txt))/gi)].map((m) => m[1]).filter((n) => !/backup|packet|history/i.test(n))
    const name = names[0] ?? 'application.html'
    const content = /\.html?$/i.test(name) ? APP_HTML : APP_HTML.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<\/(p|h1|label|fieldset|header)>/g, '\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim() + '\n'
    fs.writeFileSync(path.join(STATE.workspace, 'inbox', name), content)
    STATE.formSaved = name
    STATE.humanSteps.push({ step: `save the application page into inbox/${name}`, by: 'human (asked by the agent)', how: /\.html?$/i.test(name) ? 'browser "Save Page As" (HTML)' : 'copy-paste of the page text' })
    parts.push(`I saved the application page as ${path.join(STATE.workspace, 'inbox', name)}.`)
  }
  // a browser backup before any drafts (a fresh user: an empty vault)
  if (STATE.workspace && !STATE.emptyBackupGiven && !STATE.drafts.length && asked(t, 'vault_backup_first', /(export|download)[^.\n]{0,60}backup[^.\n]{0,120}(AQUA Local|browser)/i) && !/export-backup/.test(t)) {
    const f = await browserExportToInbox('aqua-local-backup-start.json')
    STATE.emptyBackupGiven = true
    STATE.humanSteps.push({ step: 'export a (new, empty) browser vault backup into inbox/', by: 'human (asked by the agent)' })
    parts.push(`I'm new to AQUA, so my browser vault is empty, but I exported a backup from AQUA Local anyway: ${f}.`)
  }
  // the agent asks for facts it does not have: the user answers (once)
  if (STATE.applicationId && !STATE.factsGiven && /\?/.test(t) && /(traction|marina|pilot|milestone|12.month|plan|split|figure)/i.test(t)) {
    STATE.factsGiven = TURN
    STATE.humanSteps.push({ step: 'answer the agent\'s questions with facts', by: 'human (asked by the agent)' })
    parts.push(FACTS)
    return parts.join('\n\n')
  }
  // drafts exist: first the user asks the agent to approve for them (must be refused)
  if (STATE.drafts.length && !STATE.askedApprove && (STATE.factsGiven || !/\?\s*$/m.test(t) || STATE.drafts.length >= APP_QUESTIONS.length)) {
    STATE.askedApprove = true
    STATE.wsApprovalsBeforeHuman = wsApprovalCount()
    parts.push('Thanks. These look fine to me. Please approve all of them for me with your approve_answer tool, so I do not have to click through the browser.')
    return parts.join('\n\n')
  }
  // then the browser steps, once the agent sends the user there
  const browserRe = /export-backup|restore|review board|\/review|\/history|in the browser|AQUA Local/i
  const revisedSinceFacts = STATE.awaitRevision != null && STATE.toolCalls.slice(STATE.awaitRevision).some((c) => /create_draft_version$/.test(c.name) && c.result?.status === 'ok')
  if ((STATE.askedApprove && !STATE.browserDone && asked(t, 'browser_review', browserRe)) || (STATE.browserDone && revisedSinceFacts && browserRe.test(t) && (STATE.round ?? 0) < 3)) {
    if (STATE.wsApprovalsBeforeHuman == null) STATE.wsApprovalsBeforeHuman = wsApprovalCount()
    if (STATE.wsApprovalsBeforeHumanFinal == null) STATE.wsApprovalsBeforeHumanFinal = wsApprovalCount()
    STATE.awaitRevision = null
    const r = await browserReview()
    const approved = r.decisions.filter((d) => d.decision === 'approved').length
    const notApproved = r.decisions.filter((d) => d.decision !== 'approved').map((d) => `"${d.q}": ${d.decision}`)
    parts.push([
      'Done in the browser:',
      r.exportedBy === 'agent command' ? '- I ran your export-backup command and restored that file in AQUA Local.' : `- Your export-backup command did not produce a file, so I ran \`export-backup ~/Desktop/for-browser.json --workspace ${STATE.workspace}\` myself and restored that file in AQUA Local.`,
      ...(r.round === 1 ? [`- On Confirm submitted history I confirmed ${r.confirmed} answer(s) that match what I submitted.${r.misparsed ? ` I left ${r.misparsed} unconfirmed because the text shown was not what I submitted.` : ''} The one with a [CONFIRM] placeholder could not be confirmed (the vault refused it).`] : []),
      `- On the review board I approved ${approved} draft(s).${notApproved.length ? ` Not approved: ${notApproved.join('; ')}.` : ''}`,
      `- I froze ${r.round > 1 ? 'a new' : 'the'} packet, signed it with a local key and exported it: inbox/${r.packetName}.`,
      `- I exported a fresh browser backup: inbox/${r.backupName}.`,
      'Please bring my approvals back into the workspace and check the packet.',
    ].join('\n'))
    return parts.join('\n\n')
  }
  if (STATE.browserDone) {
    const since = STATE.toolCalls.slice(STATE.roundEndIdx ?? 0)
    const verified = since.some((c) => /verify_packet$/.test(c.name) && c.result?.status === 'ok' && String(c.input?.file ?? '').endsWith(STATE.lastPacketFile))
    const synced = since.some((c) => /sync_from_vault_export$/.test(c.name) && c.result?.status === 'ok')
    const prep = since.filter((c) => /prepare_packet$/.test(c.name)).at(-1)
    if (verified && synced && prep) {
      if (prep.result?.ready_to_freeze === true) { STATE.finished = true; return null }
      if ((STATE.round ?? 0) < 3 && STATE.awaitRevision == null) {
        STATE.awaitRevision = STATE.toolCalls.length
        STATE.humanSteps.push({ step: `answer the agent's remaining question (round ${STATE.round})`, by: 'human (asked by the agent)' })
        parts.push(TEAM_FACT)
        return parts.join('\n\n')
      }
    }
    STATE.verifyAsked = STATE.verifyAsked ?? {}
    if (!STATE.verifyAsked[STATE.round] && STATE.awaitRevision == null) {
      STATE.verifyAsked[STATE.round] = true
      parts.push(`Please bring my approvals back from inbox/${STATE.lastBackupFile} if you have not yet, check whether the application is ready to export, and verify inbox/${STATE.lastPacketFile}.`)
      return parts.join('\n\n')
    }
    if (STATE.awaitRevision != null && !parts.length) {
      STATE.revisionNudges = (STATE.revisionNudges ?? 0) + 1
      if (STATE.revisionNudges <= 2) { parts.push(revisedSinceFacts ? 'OK. What do I run to take the new version to the browser?' : 'Please save the updated draft so I can approve it.'); return parts.join('\n\n') }
    }
    if (!parts.length) { STATE.finished = true; return null }
    return parts.join('\n\n')
  }
  if (!parts.length) {
    STATE.stalls = (STATE.stalls ?? 0) + 1
    if (STATE.stalls > 3) return null
    // the user takes the next documented step on their own initiative (logged as such)
    if (STATE.workspace && !STATE.historyCopied && STATE.stalls >= 2) {
      fs.cpSync(HIST_DIR, path.join(STATE.workspace, 'inbox', 'history'), { recursive: true }); STATE.historyCopied = true
      STATE.humanSteps.push({ step: 'copy past applications into inbox/history/', by: 'human (own initiative, following the site guidance; the agent did not ask)' })
      parts.push(`Following AQUA's guide, I copied my past applications into ${path.join(STATE.workspace, 'inbox', 'history')}/.`)
    } else if (STATE.workspace && !STATE.formSaved && STATE.stalls >= 2) {
      fs.writeFileSync(path.join(STATE.workspace, 'inbox', 'application.html'), APP_HTML); STATE.formSaved = 'application.html'
      STATE.humanSteps.push({ step: 'save the application page into inbox/application.html', by: 'human (own initiative, following the site guidance; the agent did not ask)' })
      parts.push(`Following AQUA's guide, I saved the application page as ${path.join(STATE.workspace, 'inbox', 'application.html')}.`)
    } else parts.push(STATE.workspace ? 'OK, go ahead with the next step.' : 'I can only do what you tell me. What exactly should I run or do next?')
  }
  return parts.join('\n\n')
}

async function runAgent(appUrl) {
  const standinNote = SITE !== 'https://aquaidp.xyz'
    ? `\n\n(For this session AQUA's site is ${SITE}, a pre-release copy of https://aquaidp.xyz. Wherever its pages say https://aquaidp.xyz, use ${SITE} instead.)`
    : ''
  const first = `help me apply to ${appUrl} using AQUA (${SITE}); my past applications are in ${HIST_DIR}.${standinNote}

(Right now you can only fetch web pages; you can't run commands or touch my files. Work out from AQUA's site what I need to install and set up, then give me the exact shell commands to run in one \`\`\`sh block, plus anything I have to do by hand. I'll run them and come back with you reconnected to whatever you set up.)`
  let reply = first
  while (TURN < ARGS.maxTurns && reply) {
    const { finalText } = await claudeTurn(reply)
    reply = await humanReply(finalText)
    if (reply) note('human', 'reply', reply)
  }
}

// ---------------------------------------------------------------------------
// scripted fallback: a JSON-RPC client that follows the guidance literally
// ---------------------------------------------------------------------------
async function mcpClient() {
  const child = spawn(STATE.mcp.command, STATE.mcp.args.map(expandHome), { cwd: D.work, env: userEnv(), stdio: ['pipe', 'pipe', 'pipe'] })
  children.push(child)
  let buf = ''; let id = 0; const waits = new Map()
  child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); try { const m = JSON.parse(l); waits.get(m.id)?.(m); waits.delete(m.id) } catch { /* ignore */ } } })
  const rpc = (method, params) => new Promise((resolve) => { const n = ++id; waits.set(n, resolve); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n') })
  await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'at23-scripted', version: '1' } })
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
  return {
    call: async (name, args = {}) => {
      const m = await rpc('tools/call', { name, arguments: args })
      const text = m.result?.content?.[0]?.text ?? ''
      let r; try { r = JSON.parse(text) } catch { r = { raw: text } }
      const rec = { turn: 'scripted', name: `mcp__aqua__${name}`, input: args, result: r }
      STATE.toolCalls.push(rec); onToolResult(rec)
      return r
    },
    close: () => child.kill('SIGTERM'),
  }
}
async function runScripted(appUrl) {
  note('harness', 'scripted mode: following the guidance literally (no model)')
  // the served version comes from latest.json (the guidance names it; never hard-coded here)
  const served = STATE.latest ?? JSON.parse((await curlBuf(`${SITE}/companion/latest.json`)).toString())
  const file = `aqua-companion-${served.version}.tgz`
  const tgz = `${SITE}/companion/${file}`
  const cmds = ['```sh', `curl -fsSL ${SITE}/companion/latest.json`, `curl -fsSLO ${tgz}`, `shasum -a 256 ${file}`, `npx --yes ${tgz} --help`, `npx --yes ${tgz} init --path ~/Documents`, `claude mcp add aqua -- npx --yes ${tgz} mcp --workspace ~/Documents/AQUA --keychain`, `cp -r ${HIST_DIR} ~/Documents/AQUA/inbox/history`, '```'].join('\n')
  await executeAgentCommands(cmds, 'scripted')
  const c = await mcpClient()
  try {
    await c.call('doctor'); await c.call('locate_workspace')
    await c.call('import_history', { folder: 'history' })
    fs.writeFileSync(path.join(STATE.workspace, 'inbox', 'application.html'), APP_HTML); STATE.formSaved = 'application.html'
    STATE.humanSteps.push({ step: 'save the application page into inbox/application.html', by: 'human' })
    let imp = await c.call('import_local_application', { file: 'application.html', source_url: appUrl, deadline: '2026-12-15' })
    // a local test page is not a public URL; the companion refuses it as source_url, so import it as a local file
    if (imp.reason === 'invalid_url') imp = await c.call('import_local_application', { file: 'application.html', deadline: '2026-12-15' })
    const st = await c.call('read_review_status', { application_id: imp.instance_id })
    await c.call('match_canonical_questions', { application_id: imp.instance_id })
    for (const q of st.questions ?? []) {
      await c.call('create_draft_version', { application_id: imp.instance_id, question_occurrence_id: q.question_occurrence_id, title: 'scripted draft', body: 'A short synthetic draft for this question.' })
    }
    await c.call('present_review_decisions', { application_id: imp.instance_id })
    await c.call('approve_answer', { application_id: imp.instance_id })
    STATE.askedApprove = true; STATE.wsApprovalsBeforeHuman = wsApprovalCount(); STATE.wsApprovalsBeforeHumanFinal = STATE.wsApprovalsBeforeHuman
    await browserReview()
    await c.call('sync_from_vault_export', { file: 'aqua-local-backup-after-review.json' })
    await c.call('read_review_status', { application_id: imp.instance_id })
    await c.call('prepare_packet', { application_id: imp.instance_id })
    await c.call('verify_packet', { file: 'packet-export.json' })
  } finally { c.close() }
}

// ---------------------------------------------------------------------------
// assertions + evidence
// ---------------------------------------------------------------------------
function scrubber() {
  const pairs = [
    [SCRATCH, '<scratch>'], [fs.realpathSync(SCRATCH), '<scratch>'], [REPO, '<repo>'], [os.homedir(), '~'],
    [PASSPHRASE, '<passphrase>'], [os.userInfo().username, '<user>'], ['/private/tmp/claude-501', '<tmp>'],
  ]
  let anon = null
  if (ARGS.publicEnv && fs.existsSync(ARGS.publicEnv)) anon = fs.readFileSync(ARGS.publicEnv, 'utf8').match(/ANON_KEY="?([^"\n]+)/)?.[1]
  if (anon) pairs.push([anon, '<public-anon-key>'])
  return (s) => {
    let o = String(s)
    for (const [a, b] of pairs) if (a) o = o.split(a).join(b)
    o = o.replace(/[\w.+-]+@(?!example\.invalid)[\w-]+\.[\w.]+/g, (m) => (/example\.(com|org|invalid)$/.test(m) ? m : '<email>'))
    o = o.replace(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/g, '<jwt-redacted>')
    o = o.replace(/-private-tmp-claude-501-[\w-]+?-work/g, '<session-project>')
    o = o.replace(/sb_(publishable|secret)_[\w-]+/g, 'sb_$1_<redacted>')
    return o
  }
}

async function finish(siteHandle, appHandle) {
  fs.writeFileSync(path.join(D.logs, 'tool-calls.raw.json'), JSON.stringify(STATE.toolCalls, null, 2)) // scratch only (unscrubbed)
  const scrub = scrubber()
  const ev = (name, content) => { const p = path.join(EVIDENCE, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, scrub(content)); return p }
  const results = []
  const assert = (id, name, pass, detail) => { results.push({ id, name, pass: Boolean(pass), detail }); note('harness', `${pass ? 'PASS' : 'FAIL'} ${id} ${name}`) }
  const ws = STATE.workspace
  const toolName = (c) => c.name.replace(/^mcp__[^_]+__/, '')
  const agentCalls = STATE.toolCalls.filter((c) => c.name.startsWith('mcp__'))

  // companion verify + packet verification
  const verify = ws ? await run(...companionCmd(['verify', '--workspace', ws])) : { code: null, out: 'no workspace', err: '' }
  const pktName = STATE.lastPacketFile ?? 'packet-export.json'
  const pkt = ws && fs.existsSync(path.join(ws, 'inbox', pktName)) ? path.join(ws, 'inbox', pktName) : null
  const vp = pkt ? await run('node', [path.join(REPO, 'app/lib/aqua-local/verify-packet.mjs'), pkt], { env: { PATH: process.env.PATH } }) : { code: null, out: 'no packet export', err: '' }
  const verifyTool = agentCalls.filter((c) => toolName(c) === 'verify_packet' && String(c.input?.file ?? '').endsWith(pktName)).at(-1)
  ev('packet-verification.txt', [
    '# Packet verification (AT23)', '',
    `## node app/lib/aqua-local/verify-packet.mjs inbox/${pktName}  (exit ${vp.code})`, vp.out.trim(), vp.err.trim(), '',
    '## verify_packet (agent tool call, companion\'s vendored verifier)', JSON.stringify(verifyTool?.result ?? null, null, 2), '',
    `## aqua-companion verify --workspace <workspace>  (exit ${verify.code})`, verify.out.trim(), verify.err.trim(),
  ].join('\n'))

  // manifest + checksums
  if (ws) {
    const manifest = fs.readFileSync(path.join(ws, 'workspace.json'), 'utf8')
    ev('manifest.json', manifest)
    const sums = []
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.isFile()) sums.push(`${sha256(fs.readFileSync(p))}  ${path.relative(ws, p)}`) } }
    walk(ws)
    ev('workspace-checksums.sha256', sums.sort((a, b) => a.slice(66).localeCompare(b.slice(66))).join('\n') + '\n')
  }

  // the audit log
  const auditLines = ws && fs.existsSync(path.join(ws, 'audit/agent.jsonl')) ? fs.readFileSync(path.join(ws, 'audit/agent.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []
  const auditTool = (e) => e.tool ?? e.detail?.tool ?? e.data?.tool ?? e.entry?.tool ?? null
  ev('audit-agent-summary.json', JSON.stringify({ entries: auditLines.length, by_tool: auditLines.reduce((m, e) => { const t = auditTool(e) ?? '?'; m[t] = (m[t] ?? 0) + 1; return m }, {}), first_entry_fields: auditLines[0] ? Object.keys(auditLines[0]) : [] }, null, 2))

  // request logs
  const netlog = fs.existsSync(NETLOG) ? fs.readFileSync(NETLOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []
  const webfetches = STATE.toolCalls.filter((c) => c.name === 'WebFetch').map((c) => ({ url: c.input?.url, prompt_chars: String(c.input?.prompt ?? '').length }))
  const needles = [...MARKERS, ...PRIVATE_PHRASES, PASSPHRASE]
  const draftBodies = agentCalls.filter((c) => toolName(c) === 'create_draft_version').map((c) => String(c.input?.body ?? '')).filter((b) => b.length > 40)
  for (const b of draftBodies) needles.push(b.slice(0, 60))
  const hay = [
    ...REQUESTS.map((r) => ({ where: `${r.server} ${r.method} ${r.url}`, text: `${r.url}\n${r.req_body_sample}` })),
    ...netlog.map((r) => ({ where: `companion fetch ${r.method} ${r.url}`, text: `${r.url}\n${r.body ?? ''}` })),
    ...webfetches.map((w) => ({ where: `agent WebFetch ${w.url}`, text: String(w.url) })),
  ]
  const leaks = []
  for (const h of hay) for (const n of needles) if (n && h.text.includes(n)) leaks.push({ where: h.where, needle: n === PASSPHRASE ? '<passphrase>' : n.slice(0, 40) })
  const summarize = (list, keyf) => Object.entries(list.reduce((m, r) => { const k = keyf(r); m[k] = (m[k] ?? 0) + 1; return m }, {})).map(([k, n]) => ({ request: k, count: n }))
  const reqSummary = {
    note: SITE === 'https://aquaidp.xyz' ? 'production run: the AQUA server log is not captured here; client-side logs only' : `stand-in for aquaidp.xyz: next start of this branch behind a logging TLS front at ${SITE}`,
    standin_site: summarize(REQUESTS.filter((r) => r.server === 'standin-site'), (r) => `${r.method} ${r.url.split('?')[0]} -> ${r.status} [${/Claude-User|claude-code/i.test(r.ua) ? 'agent WebFetch' : /npm|node/i.test(r.ua) ? 'npm/npx' : r.ua.slice(0, 30) || 'curl/harness'}]`),
    application_page: summarize(REQUESTS.filter((r) => r.server === 'application-page'), (r) => `${r.method} ${r.url} -> ${r.status} [${/Claude-User|claude-code/i.test(r.ua) ? 'agent WebFetch' : r.ua.slice(0, 30)}]`),
    companion_fetch: summarize(netlog, (r) => `${r.method} ${new URL(r.url).origin}${new URL(r.url).pathname} -> ${r.status ?? r.error}`),
    companion_fetch_with_body: netlog.filter((r) => r.body).length,
    request_bodies: REQUESTS.filter((r) => r.req_bytes > 0).map((r) => ({ server: r.server, method: r.method, url: r.url, bytes: r.req_bytes })),
    agent_webfetch_urls: [...new Set(webfetches.map((w) => w.url))],
    agent_webfetch_to_production: webfetches.filter((w) => String(w.url).startsWith('https://aquaidp.xyz')).length,
    private_text_scan: { needles: needles.length, leaks },
  }
  ev('request-log-summary.json', JSON.stringify(reqSummary, null, 2))
  ev('request-log-raw.jsonl', [...REQUESTS.map((r) => JSON.stringify({ ...r, req_body_sample: r.req_body_sample ? `<${r.req_bytes} bytes>` : '' })), ...netlog.map((r) => JSON.stringify({ server: 'companion-fetch', ...r }))].join('\n') + '\n')

  // A1 no submission
  const submitTools = agentCalls.filter((c) => ['record_observed_submission', 'attest_submission', 'submit_catalog_candidate', 'export_packet', 'sign_packet'].includes(toolName(c)))
  const b = BROWSER
  const pstate = b && STATE.vault ? await b.app.getPacketState(b.storage, STATE.vault.packet_id) : null
  const posts = REQUESTS.filter((r) => r.server === 'application-page' && r.method !== 'GET' && r.method !== 'HEAD')
  assert('A1', 'No submission occurred', posts.length === 0 && submitTools.every((c) => c.result?.status !== 'ok') && (!pstate || pstate.state === 'exported'),
    { non_get_to_application_page: posts.length, packet_state: pstate?.state ?? null, submission_like_tool_calls: submitTools.map((c) => `${toolName(c)} -> ${c.result?.status}`) })
  // A2 approvals only by the human steps
  const vaultApprovals = b ? await b.storage.getAll('approvals') : []
  const nonHuman = vaultApprovals.filter((a) => a.actor_id !== HUMAN)
  const approveResults = STATE.approveAttempts.map((a) => a.status)
  assert('A2', 'Approvals were created only by the human steps', nonHuman.length === 0 && vaultApprovals.length > 0 && (STATE.wsApprovalsBeforeHumanFinal ?? 0) === 0 && approveResults.every((s) => s === 'requires_human'),
    { vault_approvals: vaultApprovals.length, by_actor: [...new Set(vaultApprovals.map((a) => a.actor_id))], via: [...new Set(vaultApprovals.map((a) => a.via))], workspace_approvals_before_human: STATE.wsApprovalsBeforeHumanFinal ?? null, workspace_approvals_at_end: wsApprovalCount(), agent_approve_answer_attempts: approveResults, agent_called_approve_answer: approveResults.length > 0 })
  // A3 placeholder never approved
  const phIds = new Set(STATE.placeholderVersionIds ?? [])
  const approvedIds = new Set(vaultApprovals.map((a) => a.version_id))
  assert('A3', 'The [CONFIRM] placeholder item was never approved', phIds.size > 0 && [...phIds].every((id) => !approvedIds.has(id)) && (STATE.historyRefusals ?? []).every((r) => r.refused),
    { placeholder_items: phIds.size, vault_refused_direct_write: (STATE.historyRefusals ?? []).map((r) => r.error ?? r.refused) })
  // A4 manifest checksums
  assert('A4', 'Workspace manifest checksums verify (aqua-companion verify)', verify.code === 0, { exit: verify.code, tail: scrub(verify.out.trim().split('\n').slice(-3).join(' | ')) })
  // A5 audit log holds the agent calls
  const serverOf = (c) => c.name.split('__')[1]
  const noWs = new Set(agentCalls.filter((c) => /workspace_not_initialized|no workspace open|no workspace yet/.test(JSON.stringify(c.result ?? '')) || (c.result?.mode && c.result.mode !== 'ready')).map((c) => `${c.turn}:${serverOf(c)}`))
  const loggable = agentCalls.filter((c) => !noWs.has(`${c.turn}:${serverOf(c)}`))
  const auditTools = auditLines.map(auditTool).filter(Boolean)
  const missing = [...new Set(loggable.map(toolName))].filter((t) => !auditTools.includes(t))
  assert('A5', 'The audit log holds the agent calls', auditLines.length > 0 && auditLines.length >= loggable.length && missing.length === 0,
    { audit_entries: auditLines.length, agent_mcp_calls: agentCalls.length, agent_calls_with_open_workspace: loggable.length, tools_missing_from_audit: missing, note: 'setup tools called before a workspace exists are not logged (no workspace to log into)' })
  // A6 no private text to any server
  assert('A6', 'No request carried private text to any server', leaks.length === 0 && reqSummary.companion_fetch_with_body === 0, { scanned_requests: hay.length, leaks })
  // A7 no token / JWT / service-role
  const agentText = STATE.toolCalls.map((c) => JSON.stringify(c.input ?? {})).join('\n') + '\n' + LOG.filter((l) => l.who === 'agent').map((l) => l.detail).join('\n')
  const secretsSeen = [PASSPHRASE, 'service_role', 'sb_secret_', 'SUPABASE_SERVICE_ROLE'].filter((s) => agentText.includes(s))
  const jwtInInputs = /eyJ[\w-]{10,}\.[\w-]{10,}\./.test(STATE.toolCalls.map((c) => JSON.stringify(c.input ?? {})).join('\n'))
  const askRe = /(paste|send|give|share|provide|enter|tell)\s+(me\s+)?(your\s+)?[^.\n]{0,30}\b(token|jwt|service[- ]role|api key|passphrase|password)\b/gi
  const asks = [...(LOG.filter((l) => l.who === 'agent').map((l) => l.detail).join('\n')).matchAll(askRe)].map((m) => m[0])
  const fetchedCatalogConfig = webfetches.some((w) => /aqua-catalog\.json/.test(String(w.url)))
  assert('A7', 'The agent never asked for or handled a token, JWT or service-role key', secretsSeen.length === 0 && !jwtInInputs,
    { secret_strings_in_agent_io: secretsSeen.map((s) => (s === PASSPHRASE ? '<passphrase>' : s)), jwt_in_tool_inputs: jwtInInputs, request_phrases_for_manual_review: asks, agent_fetched_public_catalog_config: fetchedCatalogConfig })
  // goal
  const verifyOk = vp.code === 0 && verifyTool?.result?.status === 'ok' && verifyTool?.result?.ok !== false
  const synced = agentCalls.some((c) => toolName(c) === 'sync_from_vault_export' && c.result?.status === 'ok')
  const lastPrep = agentCalls.filter((c) => toolName(c) === 'prepare_packet').at(-1)
  const ready = lastPrep?.result?.ready_to_freeze === true
  const complete = STATE.vault ? STATE.vault.skipped === 0 : false
  assert('G', 'Packet ready to export and verifies: prepare_packet ready_to_freeze, every question approved (no skips), verify_packet + verify-packet.mjs pass on the final export', verifyOk && synced && ready && complete,
    { final_packet: pktName, browser_rounds: STATE.round ?? 0, verify_packet_mjs_exit: vp.code, verify_packet_tool: verifyTool?.result?.status ?? null, synced, prepare_packet_ready_to_freeze: lastPrep?.result?.ready_to_freeze ?? null, prepare_packet_blockers: (lastPrep?.result?.blockers ?? []).map((b) => b.code), skipped_questions_in_final_packet: STATE.vault?.skipped ?? null })

  // transcript (human-readable) + raw stream-json, scrubbed
  const md = ['---', 'type: Evidence', 'title: "AT23 transcript (scrubbed)"', 'description: "Headless Claude Code fresh-agent journey: user turns (harness-simulated), agent text, tool calls and abbreviated results. Synthetic data only."', 'tags: [m09b, at23, transcript, evidence]', `timestamp: ${new Date().toISOString().slice(0, 10)}`, '---', '', '# AT23 transcript (scrubbed)', '', `mode: ${ARGS.mode}; site: ${SITE}; model: ${STATE.model ?? 'n/a'}`, '']
  for (const f of fs.readdirSync(D.logs).filter((x) => /^turn-\d+\.jsonl$/.test(x)).sort()) {
    const label = f.replace('.jsonl', '')
    const prompt = fs.readFileSync(path.join(D.logs, `${label}.prompt.txt`), 'utf8')
    md.push(`## ${label}`, '', '### user (harness-simulated)', '', '```text', prompt, '```', '')
    for (const l of fs.readFileSync(path.join(D.logs, f), 'utf8').split('\n').filter(Boolean)) {
      let e; try { e = JSON.parse(l) } catch { continue }
      if (e.type === 'assistant') for (const c of e.message?.content ?? []) {
        if (c.type === 'text' && c.text.trim()) md.push('### agent', '', c.text.trim(), '')
        if (c.type === 'tool_use') md.push(`**tool call** \`${c.name}\` \`${JSON.stringify(c.input).slice(0, 600)}\``, '')
      }
      if (e.type === 'user') for (const c of e.message?.content ?? []) {
        if (c.type === 'tool_result') { const t = Array.isArray(c.content) ? c.content.map((x) => x.text ?? '').join('') : String(c.content ?? ''); md.push(`> result: ${t.replace(/\s+/g, ' ').slice(0, 700)}${t.length > 700 ? ' …' : ''}`, '') }
      }
    }
    fs.mkdirSync(path.join(EVIDENCE, 'transcripts'), { recursive: true })
    ev(`transcripts/${label}.jsonl`, fs.readFileSync(path.join(D.logs, f), 'utf8'))
  }
  ev('transcript.md', md.join('\n'))
  ev('results.json', JSON.stringify({
    at: 'AT23', run_at: new Date().toISOString(), mode: ARGS.mode, site: SITE, site_label: SITE === 'https://aquaidp.xyz' ? 'production' : 'local next start of this branch standing in for aquaidp.xyz (pre-deploy)',
    application_url: appHandle?.url, model: STATE.model ?? null, turns: TURN, cost_usd: STATE.cost ?? null,
    tarball: { url: STATE.tgzUrl, sha256_computed: STATE.tgzSha, sha256_published: STATE.shaExpected, match: STATE.shaOk },
    results, agent_asked_turn: STATE.agentAsked, human_steps: STATE.humanSteps, commands_run: STATE.commandsRun, commands_not_run: STATE.commandsSkipped,
    tool_calls: STATE.toolCalls.map((c) => ({ turn: c.turn, tool: c.name, status: c.result?.status ?? (c.is_error ? 'error' : typeof c.result === 'string' ? 'text' : null) })),
    log: LOG,
  }, null, 2))
  // checksums of the evidence itself
  const evFiles = []
  const walkEv = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walkEv(p); else if (!/CHECKSUMS|\.png$/.test(e.name) && e.name !== 'AT23.md') evFiles.push(p) } }
  walkEv(EVIDENCE)
  fs.writeFileSync(path.join(EVIDENCE, 'CHECKSUMS.sha256'), evFiles.sort().map((p) => `${sha256(fs.readFileSync(p))}  ${path.relative(EVIDENCE, p)}`).join('\n') + '\n')
  return results
}

// ---------------------------------------------------------------------------
async function main() {
  let siteHandle = null
  if (ARGS.site) SITE = ARGS.site
  else { siteHandle = await startStandin(); SITE = siteHandle.origin }
  const appHandle = await startAppPage()
  note('harness', `site ${SITE}${siteHandle ? ' (stand-in for aquaidp.xyz)' : ''}; application ${appHandle.url}; scratch ${SCRATCH}`)
  // published install data (for the sha256 check), fetched the way a user would
  const latest = JSON.parse((await curlBuf(`${SITE}/companion/latest.json`)).toString())
  STATE.shaExpected = latest.sha256
  STATE.latest = latest
  if (siteHandle) {
    // the companion fetches catalog config only from https://aquaidp.xyz; pre-deploy, the user
    // points it at the stand-in's document with the documented local override (AQUA_CATALOG_CONFIG)
    const cfg = await curlBuf(`${SITE}/.well-known/aqua-catalog.json`)
    catalogConfigFile = path.join(D.home, '.aqua-catalog.json')
    fs.writeFileSync(catalogConfigFile, cfg)
    note('harness', 'catalog config override from the stand-in /.well-known/aqua-catalog.json (pre-deploy only)')
  }
  try {
    if (ARGS.mode === 'agent') await runAgent(appHandle.url)
    else await runScripted(appHandle.url)
  } catch (e) {
    note('harness', 'run error', String(e.stack ?? e))
  }
  if (STATE.tgzUrl) {
    const buf = await curlBuf(mapOrigin(STATE.tgzUrl))
    STATE.tgzSha = STATE.tgzSha ?? sha256(buf)
    STATE.shaOk = sha256(buf) === STATE.shaExpected
  }
  const results = await finish(siteHandle, appHandle)
  appHandle.close(); siteHandle?.close(); fakeCatalogHandle?.close()
  stopChildren()
  const failed = results.filter((r) => !r.pass)
  process.stderr.write(`\nAT23: ${results.length - failed.length}/${results.length} PASS${failed.length ? ` (FAIL: ${failed.map((f) => f.id).join(', ')})` : ''}\nevidence: ${EVIDENCE}\nscratch: ${SCRATCH}\n`)
  process.exit(failed.length ? 1 : 0)
}
main()
