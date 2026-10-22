// LF-25: local-first server write boundary — unit checks for the shared guard.
// Run: node --test tests/local-first-guard.test.mjs
// (Node 26 strips TypeScript types natively, so the .ts module imports directly.)

import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import {
  isLocalFirst,
  isProductionRuntime,
  refusePrivateWrite,
  refusePrivateTextFields,
  publicUrlForLocalFirstStorage,
  privateWriteRefusal,
  LOCAL_FIRST_REFUSAL_MESSAGE,
} from '../lib/local-first-guard.ts'
import { clientLocalFirst } from '../lib/aqua-local-client/flag.ts'
import { resolveLocalFirstBuildFlags } from '../lib/local-first-build.mjs'

const REFUSAL = 'local-first mode: private content stays on device'

test('refusal message is the contract string', () => {
  assert.equal(LOCAL_FIRST_REFUSAL_MESSAGE, REFUSAL)
})

test('isLocalFirst is off by default / with junk values', () => {
  delete process.env.AQUA_LOCAL_FIRST
  assert.equal(isLocalFirst(), false)
  for (const v of ['0', 'false', 'yes', 'on', '']) {
    process.env.AQUA_LOCAL_FIRST = v
    assert.equal(isLocalFirst(), false, `value ${v}`)
  }
})

test('isLocalFirst fails CLOSED in production unless explicitly 0/false (H1)', () => {
  for (const prod of [{ VERCEL_ENV: 'production' }, { NODE_ENV: 'production' }, { VERCEL_ENV: 'production', NODE_ENV: 'production' }]) {
    assert.equal(isLocalFirst({ ...prod }), true, `unset in ${JSON.stringify(prod)}`)
    for (const v of ['', 'yes', 'on', 'junk', ' ']) {
      assert.equal(isLocalFirst({ ...prod, AQUA_LOCAL_FIRST: v }), true, `junk ${JSON.stringify(v)} in prod`)
    }
    for (const v of ['0', 'false', ' FALSE ']) {
      assert.equal(isLocalFirst({ ...prod, AQUA_LOCAL_FIRST: v }), false, `explicit off ${v} in prod`)
    }
    assert.equal(isLocalFirst({ ...prod, AQUA_LOCAL_FIRST: '1' }), true)
  }
  // previews / dev keep the legacy default
  assert.equal(isLocalFirst({ VERCEL_ENV: 'preview', NODE_ENV: 'development' }), false)
  assert.equal(isLocalFirst({ NODE_ENV: 'test' }), false)
  assert.equal(isProductionRuntime({ VERCEL_ENV: 'preview' }), false)
})

test('refusePrivateWrite refuses in a production runtime with the flag unset', () => {
  const saved = { ...process.env }
  try {
    delete process.env.AQUA_LOCAL_FIRST
    process.env.VERCEL_ENV = 'production'
    const res = refusePrivateWrite()
    assert.ok(res instanceof Response)
    assert.equal(res.status, 403)
  } finally {
    for (const k of ['VERCEL_ENV', 'AQUA_LOCAL_FIRST']) { if (k in saved) process.env[k] = saved[k]; else delete process.env[k] }
  }
})

test('isLocalFirst engages on "1" and "true"', () => {
  for (const v of ['1', 'true']) {
    process.env.AQUA_LOCAL_FIRST = v
    assert.equal(isLocalFirst(), true, `value ${v}`)
  }
})

test('refusePrivateWrite returns null when flag is off', () => {
  delete process.env.AQUA_LOCAL_FIRST
  assert.equal(refusePrivateWrite(), null)
})

test('refusePrivateWrite returns honest 403 JSON when flag is on', async () => {
  process.env.AQUA_LOCAL_FIRST = '1'
  const res = refusePrivateWrite()
  assert.ok(res instanceof Response)
  assert.equal(res.status, 403)
  const body = await res.json()
  assert.equal(body.error, REFUSAL)
  assert.equal(body.local_first, true)
})

test('refusePrivateWrite merges extra detail fields', async () => {
  process.env.AQUA_LOCAL_FIRST = '1'
  const res = refusePrivateWrite({ detail: 'extra' })
  const body = await res.json()
  assert.equal(body.detail, 'extra')
  assert.equal(body.error, REFUSAL)
})

test('privateWriteRefusal payload is honest', () => {
  const body = privateWriteRefusal()
  assert.equal(body.error, REFUSAL)
  assert.equal(body.local_first, true)
})

// --- F-B7 field-level gate ---

test('refusePrivateTextFields is inert when flag is off', () => {
  delete process.env.AQUA_LOCAL_FIRST
  assert.equal(
    refusePrivateTextFields({ outcome_notes: 'private text' }, ['outcome_notes']),
    null,
  )
})

test('refusePrivateTextFields refuses named free-text fields under flag', async () => {
  process.env.AQUA_LOCAL_FIRST = '1'
  const res = refusePrivateTextFields(
    { status: 'accepted', outcome_notes: 'my private interview notes' },
    ['outcome_notes', 'program_feedback'],
  )
  assert.ok(res instanceof Response)
  assert.equal(res.status, 403)
  const body = await res.json()
  assert.equal(body.error, REFUSAL)
  assert.equal(body.local_first, true)
  assert.deepEqual(body.refused_fields, ['outcome_notes'])
})

test('refusePrivateTextFields permits structured/metadata-only payloads', () => {
  process.env.AQUA_LOCAL_FIRST = '1'
  for (const body of [
    { status: 'accepted' },
    { status: 'waitlisted', interview_date: '2026-10-11', would_recommend: 4 },
    { outcome_notes: null, program_feedback: null }, // explicit clear
    { outcome_notes: '', program_feedback: '   ' }, // empty string
    { program_url: 'https://x.example', kind: 'grant' },
  ]) {
    assert.equal(
      refusePrivateTextFields(body, ['outcome_notes', 'program_feedback', 'notes', 'questions_text']),
      null,
      JSON.stringify(body),
    )
  }
})

test('refusePrivateTextFields refuses non-string field values too', async () => {
  process.env.AQUA_LOCAL_FIRST = '1'
  const res = refusePrivateTextFields({ notes: { nested: 'text' } }, ['notes'])
  assert.ok(res instanceof Response)
  assert.equal(res.status, 403)
})

test('refusePrivateTextFields lists every refused field', async () => {
  process.env.AQUA_LOCAL_FIRST = '1'
  const res = refusePrivateTextFields(
    { outcome_notes: 'a', program_feedback: 'b' },
    ['outcome_notes', 'program_feedback'],
  )
  const body = await res.json()
  assert.deepEqual(body.refused_fields, ['outcome_notes', 'program_feedback'])
})

// --- FB7R-01 URL sanitize (called only under flag) ---

test('publicUrlForLocalFirstStorage strips query + fragment from stored URL', () => {
  const r = publicUrlForLocalFirstStorage('https://example.com/grant?utm=x&essay=PRIVATE#frag')
  assert.equal(r.url, 'https://example.com/grant')
  assert.equal(r.refuse, undefined)
})

test('publicUrlForLocalFirstStorage preserves path + port', () => {
  const r = publicUrlForLocalFirstStorage('https://example.com:8443/a/b/c?x=1')
  assert.equal(r.url, 'https://example.com:8443/a/b/c')
})

test('publicUrlForLocalFirstStorage refuses userinfo URLs with honest 403', async () => {
  const r = publicUrlForLocalFirstStorage('https://user:secret@example.com/grant')
  assert.equal(r.url, undefined)
  assert.equal(r.refuse.status, 403)
  const body = await r.refuse.json()
  assert.equal(body.local_first, true)
})

test('publicUrlForLocalFirstStorage 400s on unparseable URL', async () => {
  const r = publicUrlForLocalFirstStorage('not a url')
  assert.equal(r.refuse.status, 400)
})

// Route-wiring checks: the helper is tested above; these assert the actual
// routes invoke it — a code-level canary for the persona-egress boundary
// (IR-038) and the build-time flag pairing (IR-015).
test('smart-matcher route refuses user_persona under local-first (wiring)', () => {
  const src = readFileSync(new URL('../app/api/hub/smart-matcher/route.ts', import.meta.url), 'utf8')
  assert.ok(src.includes('refusePrivateTextFields'), 'route must call refusePrivateTextFields')
  assert.ok(src.includes("'user_persona'"), 'route must name user_persona as a private field')
  // the pre-auth refusal must run BEFORE the auth check — the boundary
  // drops private text regardless of caller identity
  const refuseIdx = src.indexOf('refusePrivateTextFields(preBody')
  const authIdx = src.indexOf('getRequestUser(req)')
  assert.ok(refuseIdx > -1 && authIdx > -1 && refuseIdx < authIdx,
    'persona refusal must run before auth')
})

test('next.config fails the build on local-first flag mismatch (wiring)', () => {
  const src = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8')
  assert.ok(/AQUA_LOCAL_FIRST/.test(src) && /NEXT_PUBLIC_AQUA_LOCAL_FIRST/.test(src))
  assert.ok(/throw|Error/.test(src), 'mismatch must throw, not warn')
  assert.match(src, /resolveLocalFirstBuildFlags\(process\.env\)/, 'next.config runs the shared build resolver')
  const lib = readFileSync(new URL('../lib/local-first-build.mjs', import.meta.url), 'utf8')
  assert.match(lib, /VERCEL_ENV \?\? ''\)\.trim\(\) === 'production'/, 'Vercel production requires both flags explicitly')
})

// ─── M09 review M4: client gate fails closed under the same conditions ──────

test('M4: client flag fails closed in production builds; explicit values win; dev keeps legacy off', () => {
  for (const env of ['production', ' production ']) {
    for (const v of [undefined, '', 'yes', 'on', ' ']) assert.equal(clientLocalFirst(v, env), true, `unset/junk ${JSON.stringify(v)} in ${env}`)
    for (const v of ['0', 'false', ' FALSE ']) assert.equal(clientLocalFirst(v, env), false, `explicit off ${v}`)
    for (const v of ['1', 'true', 'TRUE']) assert.equal(clientLocalFirst(v, env), true)
  }
  for (const env of [undefined, 'development', 'test']) {
    assert.equal(clientLocalFirst(undefined, env), false, `unset in ${env}`)
    assert.equal(clientLocalFirst('1', env), true)
  }
})

test('M4: server guard and client gate agree on every flag/environment combination', () => {
  const values = [undefined, '', '1', 'true', '0', 'false', 'junk']
  const envs = [
    { NODE_ENV: 'production' }, { NODE_ENV: 'production', VERCEL_ENV: 'preview' },
    { NODE_ENV: 'development' }, {},
  ]
  for (const e of envs) for (const v of values) {
    // a matched pair (same value on both sides) must resolve identically
    assert.equal(
      isLocalFirst({ ...e, AQUA_LOCAL_FIRST: v }),
      clientLocalFirst(v, e.NODE_ENV),
      `pair ${JSON.stringify(v)} in ${JSON.stringify(e)}`,
    )
  }
})

test('M4: build resolver — previews/self-hosted default both ON, mismatches and unset Vercel production refused', () => {
  const prod = { NODE_ENV: 'production' }
  // neither set, self-hosted / preview production build → both on, client default made explicit
  for (const e of [prod, { ...prod, VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'preview' }]) {
    const r = resolveLocalFirstBuildFlags(e)
    assert.equal(r.serverOn, true); assert.equal(r.clientOn, true)
    assert.deepEqual(r.defaults, { NEXT_PUBLIC_AQUA_LOCAL_FIRST: '1' })
  }
  // explicit matched pairs
  assert.equal(resolveLocalFirstBuildFlags({ ...prod, AQUA_LOCAL_FIRST: '1', NEXT_PUBLIC_AQUA_LOCAL_FIRST: '1' }).clientOn, true)
  assert.equal(resolveLocalFirstBuildFlags({ ...prod, AQUA_LOCAL_FIRST: '0', NEXT_PUBLIC_AQUA_LOCAL_FIRST: '0' }).clientOn, false)
  assert.deepEqual(resolveLocalFirstBuildFlags({ ...prod, AQUA_LOCAL_FIRST: '1', NEXT_PUBLIC_AQUA_LOCAL_FIRST: '1' }).defaults, {})
  // server explicitly off but client unset in a production build: effective mismatch
  assert.throws(() => resolveLocalFirstBuildFlags({ ...prod, AQUA_LOCAL_FIRST: '0' }), /mismatch/)
  assert.throws(() => resolveLocalFirstBuildFlags({ ...prod, NEXT_PUBLIC_AQUA_LOCAL_FIRST: 'false' }), /mismatch/)
  assert.throws(() => resolveLocalFirstBuildFlags({ AQUA_LOCAL_FIRST: '1' }), /mismatch/)
  // Vercel production: explicit configuration required
  assert.throws(() => resolveLocalFirstBuildFlags({ ...prod, VERCEL_ENV: 'production' }), /ON by default in production/)
  assert.equal(resolveLocalFirstBuildFlags({ ...prod, VERCEL_ENV: 'production', AQUA_LOCAL_FIRST: '0', NEXT_PUBLIC_AQUA_LOCAL_FIRST: '0' }).serverOn, false)
  // dev: legacy off, no defaults
  const dev = resolveLocalFirstBuildFlags({ NODE_ENV: 'development' })
  assert.equal(dev.serverOn, false); assert.equal(dev.clientOn, false); assert.deepEqual(dev.defaults, {})
})

test('M4: vault pages and client surfaces gate on the shared fail-closed flag', () => {
  for (const rel of ['../app/(app)/aqua-local/page.tsx', '../app/(app)/history/page.tsx']) {
    const src = readFileSync(new URL(rel, import.meta.url), 'utf8')
    assert.match(src, /from '@\/lib\/aqua-local-client\/flag'/, rel)
    assert.match(src, /if \(!LOCAL_FIRST\) notFound\(\)/, rel)
  }
  const editor = readFileSync(new URL('../components/AnswerEditor.tsx', import.meta.url), 'utf8')
  assert.match(editor, /import \{ LOCAL_FIRST \} from '@\/lib\/aqua-local-client\/flag'/)
  const flag = readFileSync(new URL('../lib/aqua-local-client/flag.ts', import.meta.url), 'utf8')
  assert.match(flag, /= process\.env\.NEXT_PUBLIC_AQUA_LOCAL_FIRST/, 'literal read so Next inlines it')
  assert.match(flag, /= process\.env\.NODE_ENV/)
})

test('health route reports the effective (fail-closed) flag', () => {
  const src = readFileSync(new URL('../app/api/health/route.ts', import.meta.url), 'utf8')
  assert.match(src, /local_first: isLocalFirst\(\)/)
})
