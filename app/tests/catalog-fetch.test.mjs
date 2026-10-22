// M09 W2 — SSRF guards and reuse signals for fetchPublicApplication.
// Fake resolver + fake fetch only: these tests never touch the network.
// Run: node --test tests/catalog-fetch.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  fetchPublicApplication,
  PublicFetchError,
  isBlockedAddress,
  assertFetchableUrlShape,
  robotsDisallows,
} from '../lib/catalog/fetch-public.ts'

const PAGE = '<html><head><title>Example Program — Apply</title></head><body><h1>Example Program</h1><p>Deadline: May 1, 2027 5pm ET</p><label for=a>What problem are you solving? (max 250 words)</label><textarea id=a></textarea></body></html>'

function harness(routes, dns = {}) {
  const calls = []
  const resolve = async (host) => {
    if (host in dns) { const v = dns[host]; if (v instanceof Error) throw v; return v }
    return ['93.184.216.34']
  }
  const fetch = async (url, init) => {
    calls.push(url)
    const r = routes[url]
    if (!r) return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } })
    if (typeof r === 'function') return r(init)
    return new Response(r.body ?? null, { status: r.status ?? 200, headers: r.headers ?? { 'content-type': 'text/html; charset=utf-8' } })
  }
  return { calls, deps: { resolve, fetch, now: () => new Date('2026-10-22T12:00:00Z') } }
}

async function rejectsWith(promise, code) {
  await assert.rejects(promise, (e) => {
    assert.ok(e instanceof PublicFetchError, `expected PublicFetchError, got ${e}`)
    assert.equal(e.code, code)
    assert.equal(e.extraction, undefined, 'no partial result on failure')
    return true
  })
}

test('happy path: snapshot hash, final url, reuse allowed, extraction — and no body returned', async () => {
  const { deps } = harness({
    'https://program.example.org/apply': { body: PAGE },
    'https://program.example.org/robots.txt': { body: 'User-agent: *\nDisallow: /admin\n', headers: { 'content-type': 'text/plain' } },
  })
  const r = await fetchPublicApplication('https://program.example.org/apply', deps)
  assert.equal(r.source.final_url, 'https://program.example.org/apply')
  assert.equal(r.source.status, 200)
  assert.equal(r.source.fetched_at, '2026-10-22T12:00:00.000Z')
  assert.equal(r.source.content_sha256, createHash('sha256').update(PAGE).digest('hex'))
  assert.equal(r.source.bytes, Buffer.byteLength(PAGE))
  assert.equal(r.source.reuse, 'allowed')
  assert.deepEqual(r.source.reuse_signals, ['robots.txt:allow'])
  assert.equal(r.extraction.occurrences[0].requirements.word_limit, 250)
  assert.equal(r.extraction.program.deadlines[0].timezone, 'ET')
  assert.ok(!JSON.stringify(r).includes('<textarea'), 'raw body is never part of the result')
})

test('private IP via DNS is refused before any request', async () => {
  const { calls, deps } = harness({}, { 'intranet.example.org': ['10.0.0.5'] })
  await rejectsWith(fetchPublicApplication('https://intranet.example.org/form', deps), 'blocked_address')
  assert.equal(calls.length, 0)
})

test('mixed public + private DNS answers are refused (any private address blocks)', async () => {
  const { calls, deps } = harness({}, { 'mixed.example.org': ['93.184.216.34', '127.0.0.1'] })
  await rejectsWith(fetchPublicApplication('https://mixed.example.org/', deps), 'blocked_address')
  assert.equal(calls.length, 0)
})

test('IP literals: loopback, metadata, decimal-encoded loopback, IPv6 ULA', async () => {
  const { calls, deps } = harness({})
  await rejectsWith(fetchPublicApplication('http://127.0.0.1/apply', deps), 'blocked_address')
  await rejectsWith(fetchPublicApplication('http://169.254.169.254/latest/meta-data/', deps), 'blocked_address')
  await rejectsWith(fetchPublicApplication('http://2130706433/', deps), 'blocked_address')
  await rejectsWith(fetchPublicApplication('http://[fd00::1]/', deps), 'blocked_address')
  await rejectsWith(fetchPublicApplication('http://[::ffff:10.0.0.1]/', deps), 'blocked_address')
  assert.equal(calls.length, 0)
})

test('localhost / internal names, bad schemes, ports and credentials are refused', async () => {
  const { calls, deps } = harness({})
  await rejectsWith(fetchPublicApplication('http://localhost/apply', deps), 'blocked_host')
  await rejectsWith(fetchPublicApplication('http://metadata.google.internal/', deps), 'blocked_host')
  await rejectsWith(fetchPublicApplication('file:///etc/passwd', deps), 'blocked_scheme')
  await rejectsWith(fetchPublicApplication('ftp://program.example.org/', deps), 'blocked_scheme')
  await rejectsWith(fetchPublicApplication('https://program.example.org:8443/', deps), 'blocked_port')
  await rejectsWith(fetchPublicApplication('https://user:pass@program.example.org/apply', deps), 'credentials_in_url')
  await rejectsWith(fetchPublicApplication('not a url', deps), 'invalid_url')
  assert.equal(calls.length, 0)
})

test('redirect to a private address is re-checked and refused', async () => {
  const { calls, deps } = harness({
    'https://program.example.org/apply': { status: 302, body: null, headers: { location: 'https://internal.example.org/form' } },
  }, { 'internal.example.org': ['192.168.1.20'] })
  await rejectsWith(fetchPublicApplication('https://program.example.org/apply', deps), 'blocked_address')
  assert.deepEqual(calls, ['https://program.example.org/apply'])
})

test('redirect to a metadata IP literal is refused', async () => {
  const { deps } = harness({
    'https://program.example.org/apply': { status: 301, body: null, headers: { location: 'http://169.254.169.254/latest' } },
  })
  await rejectsWith(fetchPublicApplication('https://program.example.org/apply', deps), 'blocked_address')
})

test('more than 3 redirects is refused; 3 is fine', async () => {
  const chain = (n) => {
    const routes = {}
    for (let i = 0; i < n; i++) routes[`https://program.example.org/r${i}`] = { status: 302, body: null, headers: { location: `/r${i + 1}` } }
    routes[`https://program.example.org/r${n}`] = { body: PAGE }
    return routes
  }
  const ok = harness(chain(3))
  const r = await fetchPublicApplication('https://program.example.org/r0', { ...ok.deps, checkRobots: false })
  assert.equal(r.source.final_url, 'https://program.example.org/r3')
  assert.equal(r.source.redirects.length, 3)
  const bad = harness(chain(4))
  await rejectsWith(fetchPublicApplication('https://program.example.org/r0', { ...bad.deps, checkRobots: false }), 'too_many_redirects')
})

test('oversized: declared content-length and streamed body both refused', async () => {
  const big = 'x'.repeat(5000)
  const a = harness({ 'https://program.example.org/a': { body: big, headers: { 'content-type': 'text/html', 'content-length': String(big.length) } } })
  await rejectsWith(fetchPublicApplication('https://program.example.org/a', { ...a.deps, maxBytes: 1000 }), 'too_large')
  const b = harness({
    'https://program.example.org/b': () => new Response(new ReadableStream({
      pull(c) { c.enqueue(new TextEncoder().encode('y'.repeat(600))) }, // never ends on its own
    }), { status: 200, headers: { 'content-type': 'text/html' } }),
  })
  await rejectsWith(fetchPublicApplication('https://program.example.org/b', { ...b.deps, maxBytes: 1000 }), 'too_large')
})

test('wrong or missing content-type is refused', async () => {
  const { deps } = harness({
    'https://program.example.org/form.pdf': { body: '%PDF-1.7', headers: { 'content-type': 'application/pdf' } },
    'https://program.example.org/blob': { body: new TextEncoder().encode('data'), headers: {} }, // bytes → no default content-type
    'https://program.example.org/api': { body: '{}', headers: { 'content-type': 'application/json' } },
  })
  await rejectsWith(fetchPublicApplication('https://program.example.org/form.pdf', deps), 'bad_content_type')
  await rejectsWith(fetchPublicApplication('https://program.example.org/blob', deps), 'bad_content_type')
  await rejectsWith(fetchPublicApplication('https://program.example.org/api', deps), 'bad_content_type')
})

test('upstream HTTP errors, DNS failures and network errors fail closed', async () => {
  const { deps } = harness({
    'https://program.example.org/down': { status: 503, body: 'down', headers: { 'content-type': 'text/html' } },
    'https://program.example.org/boom': () => { throw new TypeError('socket hang up') },
  }, { 'nxdomain.example.org': new Error('ENOTFOUND') })
  await assert.rejects(fetchPublicApplication('https://program.example.org/down', deps), (e) => e.code === 'http_error' && e.status === 503)
  await rejectsWith(fetchPublicApplication('https://nxdomain.example.org/', deps), 'dns_failed')
  await rejectsWith(fetchPublicApplication('https://program.example.org/boom', deps), 'network_error')
})

test('timeout aborts and yields no partial result', async () => {
  const { deps } = harness({
    'https://program.example.org/slow': (init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
  })
  await rejectsWith(fetchPublicApplication('https://program.example.org/slow', { ...deps, timeoutMs: 30 }), 'timeout')
})

test('reuse signals: robots Disallow, meta noai, X-Robots-Tag, robots unavailable', async () => {
  const dis = harness({
    'https://program.example.org/apply': { body: PAGE },
    'https://program.example.org/robots.txt': { body: 'User-agent: *\nDisallow: /apply\n', headers: { 'content-type': 'text/plain' } },
  })
  const r1 = await fetchPublicApplication('https://program.example.org/apply', dis.deps)
  assert.equal(r1.source.reuse, 'disallowed')
  assert.ok(r1.source.reuse_signals.includes('robots.txt:disallow'))

  const meta = harness({
    'https://program.example.org/apply': { body: PAGE.replace('<title>', '<meta name="robots" content="noai"><title>') },
    'https://program.example.org/robots.txt': { status: 404, body: '', headers: { 'content-type': 'text/plain' } },
  })
  const r2 = await fetchPublicApplication('https://program.example.org/apply', meta.deps)
  assert.equal(r2.source.reuse, 'disallowed')
  assert.ok(r2.source.reuse_signals.includes('meta-robots:noai'))
  assert.ok(r2.source.reuse_signals.includes('robots.txt:absent(404)'))

  const hdr = harness({
    'https://program.example.org/apply': { body: PAGE, headers: { 'content-type': 'text/html', 'x-robots-tag': 'noindex' } },
  })
  const r3 = await fetchPublicApplication('https://program.example.org/apply', hdr.deps)
  assert.equal(r3.source.reuse, 'disallowed')

  const unk = harness({
    'https://program.example.org/apply': { body: PAGE },
    'https://program.example.org/robots.txt': { status: 500, body: 'err', headers: { 'content-type': 'text/plain' } },
  })
  const r4 = await fetchPublicApplication('https://program.example.org/apply', unk.deps)
  assert.equal(r4.source.reuse, 'unknown')
})

test('isBlockedAddress policy table', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '64:ff9b::a9fe:a9fe', '2002:c0a8:0101::1', '2001:db8::1']) {
    assert.equal(isBlockedAddress(ip), true, ip)
  }
  for (const ip of ['93.184.216.34', '8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
    assert.equal(isBlockedAddress(ip), false, ip)
  }
})

test('assertFetchableUrlShape accepts public http(s) on default ports', () => {
  assert.equal(assertFetchableUrlShape('https://program.example.org/apply').hostname, 'program.example.org')
  assert.equal(assertFetchableUrlShape('http://program.example.org:80/').port, '')
})

test('robotsDisallows: agent groups, longest match, Allow override, wildcards', () => {
  const txt = 'User-agent: *\nDisallow: /private\nAllow: /private/apply\nDisallow: /*.pdf$\n\nUser-agent: otherbot\nDisallow: /\n'
  assert.equal(robotsDisallows(txt, '/apply'), false)
  assert.equal(robotsDisallows(txt, '/private/x'), true)
  assert.equal(robotsDisallows(txt, '/private/apply'), false)
  assert.equal(robotsDisallows(txt, '/files/form.pdf'), true)
  assert.equal(robotsDisallows('User-agent: aqua\nDisallow: /\n\nUser-agent: *\nAllow: /\n', '/apply'), true)
  assert.equal(robotsDisallows('User-agent: *\nDisallow:\n', '/apply'), false)
})

// ─── M09 hardening L1: non-dotted-decimal IPv4 literal forms ─────────────────
test('L1: hex / octal / decimal / short-form IPv4 literals to private ranges are refused', async () => {
  const { calls, deps } = harness({})
  const literals = [
    'http://0x7f000001/', 'http://0x7f.0.0.1/', 'http://0x7F.0x00.0x00.0x01/', // hex → 127.0.0.1
    'http://0177.0.0.1/', 'http://017700000001/', 'http://00000177.0.0.01/',  // octal → 127.0.0.1
    'http://2130706433/', 'http://127.1/', 'http://127.0.1/',                 // decimal / short forms
    'http://0xa9fea9fe/', 'http://2852039166/', 'http://0251.0376.0251.0376/', // 169.254.169.254 metadata
    'http://0xa.0.0.1/', 'http://012.0.0.1/', 'http://167772161/',            // 10.0.0.1
    'http://0xc0a80001/', 'http://0300.0250.0.1/',                            // 192.168.0.1
    'http://0/', 'http://0x0/',                                               // 0.0.0.0
  ]
  for (const u of literals) await rejectsWith(fetchPublicApplication(u, deps), 'blocked_address')
  assert.equal(calls.length, 0, 'no request for any encoded private literal')
  // the WHATWG parser canonicalizes these before the guard runs
  assert.equal(assertFetchableUrlShape('http://8.8.8.8/').hostname, '8.8.8.8')
  assert.equal(assertFetchableUrlShape('http://0x08080808/').hostname, '8.8.8.8', 'a PUBLIC hex literal canonicalizes and is not blocked')
})

test('L1: raw non-canonical literal strings never pass isBlockedAddress as public', () => {
  for (const raw of ['0x7f000001', '0177.0.0.1', '2130706433', '127.1', '0x7f.1', '1.2.3', '256.1.1.1']) {
    assert.equal(isBlockedAddress(raw), true, raw)
  }
})

// ─── M09 hardening L2: oversized responses tear the socket down ──────────────
test('L2: too_large destroys the response connection (declared and streamed)', async () => {
  let destroyed = 0
  const mk = (body, headers) => ({ status: 200, headers: new Headers(headers), body, destroy: () => { destroyed++ } })
  const declared = harness({ 'https://program.example.org/a': () => mk(new Response('x'.repeat(5000)).body, { 'content-type': 'text/html', 'content-length': '5000' }) })
  await rejectsWith(fetchPublicApplication('https://program.example.org/a', { ...declared.deps, maxBytes: 1000 }), 'too_large')
  assert.equal(destroyed, 1, 'declared oversize destroys before reading')
  const streamed = harness({
    'https://program.example.org/b': () => mk(new ReadableStream({ pull(c) { c.enqueue(new TextEncoder().encode('y'.repeat(600))) } }), { 'content-type': 'text/html' }),
  })
  await rejectsWith(fetchPublicApplication('https://program.example.org/b', { ...streamed.deps, maxBytes: 1000 }), 'too_large')
  assert.equal(destroyed, 2, 'streamed oversize destroys mid-read')
})

// ─── M09 hardening M1: outbound concurrency caps ─────────────────────────────
import { OutboundFetchLimiter, outboundFetchLimiter, OUTBOUND_FETCH_LIMITS } from '../lib/rate-limit.ts'

test('M1: OutboundFetchLimiter enforces global and per-host caps; release is idempotent', () => {
  const l = new OutboundFetchLimiter({ maxGlobal: 2, maxPerHost: 1 })
  const g1 = l.acquireGlobal(); const g2 = l.acquireGlobal()
  assert.ok(g1 && g2)
  assert.equal(l.acquireGlobal(), null, 'global cap')
  g1(); g1() // double release must not free two slots
  assert.ok(l.acquireGlobal())
  assert.equal(l.acquireGlobal(), null)
  const h = l.acquireHost('Program.Example.org.')
  assert.ok(h)
  assert.equal(l.acquireHost('program.example.org'), null, 'per-host cap, host normalized')
  assert.ok(l.acquireHost('other.example.org'), 'other hosts unaffected')
  h(); h()
  assert.ok(l.acquireHost('program.example.org'))
  assert.ok(OUTBOUND_FETCH_LIMITS.maxGlobal >= 1 && OUTBOUND_FETCH_LIMITS.maxPerHost >= 1)
})

function gatedHarness() {
  const gates = []
  const fetch = async (url) => {
    if (url.endsWith('/robots.txt')) return new Response('', { status: 404, headers: { 'content-type': 'text/plain' } })
    await new Promise((r) => gates.push(r))
    return new Response(PAGE, { status: 200, headers: { 'content-type': 'text/html' } })
  }
  return { gates, deps: { resolve: async () => ['93.184.216.34'], fetch, now: () => new Date('2026-10-22T12:00:00Z') } }
}
const tick = () => new Promise((r) => setTimeout(r, 5))

test('M1: global cap refuses extra concurrent fetches with busy, then frees on completion', async () => {
  const limiter = new OutboundFetchLimiter({ maxGlobal: 1, maxPerHost: 5 })
  const { gates, deps } = gatedHarness()
  const first = fetchPublicApplication('https://a.example.org/apply', { ...deps, limiter })
  await tick()
  await rejectsWith(fetchPublicApplication('https://b.example.org/apply', { ...deps, limiter }), 'busy')
  gates.shift()()
  await first
  assert.deepEqual(limiter.stats(), { global: 0, hosts: {} }, 'all slots released')
  const again = fetchPublicApplication('https://b.example.org/apply', { ...deps, limiter })
  await tick(); gates.shift()(); await again
})

test('M1: per-host cap refuses a second concurrent fetch to the same target host only', async () => {
  const limiter = new OutboundFetchLimiter({ maxGlobal: 10, maxPerHost: 1 })
  const { gates, deps } = gatedHarness()
  const first = fetchPublicApplication('https://victim.example.org/a', { ...deps, limiter })
  await tick()
  await rejectsWith(fetchPublicApplication('https://VICTIM.example.org/b', { ...deps, limiter }), 'busy')
  const other = fetchPublicApplication('https://other.example.org/a', { ...deps, limiter })
  await tick()
  gates.splice(0).forEach((g) => g())
  await first; await other
  assert.deepEqual(limiter.stats(), { global: 0, hosts: {} })
})

test('M1: a redirect into a host at capacity is refused; failures release their slots', async () => {
  const limiter = new OutboundFetchLimiter({ maxGlobal: 10, maxPerHost: 1 })
  const hold = limiter.acquireHost('busy.example.org')
  const { deps } = harness({ 'https://start.example.org/a': { status: 302, headers: { location: 'https://busy.example.org/x' } } })
  await rejectsWith(fetchPublicApplication('https://start.example.org/a', { ...deps, limiter }), 'busy')
  hold()
  const blocked = harness({}, { 'internal.example.org': ['10.0.0.1'] })
  await rejectsWith(fetchPublicApplication('https://internal.example.org/', { ...blocked.deps, limiter }), 'blocked_address')
  assert.deepEqual(limiter.stats(), { global: 0, hosts: {} }, 'no slot leaked on any failure path')
})

test('M1: the default path uses the shared process-wide limiter', async () => {
  const before = outboundFetchLimiter.stats().global
  const { deps } = harness({ 'https://program.example.org/apply': { body: PAGE } })
  await fetchPublicApplication('https://program.example.org/apply', deps)
  assert.equal(outboundFetchLimiter.stats().global, before)
})
