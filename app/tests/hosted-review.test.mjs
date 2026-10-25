// m10 — the review surface's hosted-workspace wiring (client side).
// lib/aqua-hosted.ts is the only module that POSTs to /api/workspace/*;
// these tests pin its request shape (Bearer token, exact body, server-built
// approve mode) and prove the local vault path is unchanged: the hosted
// helper does no storage work and 'hosted_review' stays a server-side via
// the local writer still refuses.
// All content synthetic. Run: node --test tests/hosted-review.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

import { hostedInit, hostedApprove, findHostedWorkspace, HostedApiError, HOSTED_VIA, readHostedReview, canApproveHostedCard } from '../lib/aqua-hosted.ts'
import { createMemoryStorage } from '../lib/aqua-local/vault.ts'
import { createAnswerWithVersion, recordHumanApproval, listApprovals, VaultScopeError } from '../lib/aqua-local/repo.ts'
import { canonicalJson } from '../lib/aqua-local/crypto.ts'

const TOKEN = 'synthetic-access-token'
const VERSION_ID = 'bbbbbbbb-1111-2222-3333-444444444444'
const SECRET = 'synthetic-hosted-secret'

const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex')
const CONTENT_SHA = sha(canonicalJson({ title: 'Synthetic answer', body: 'Synthetic body text' }))

test('hosted review reads the authenticated resource and fails honestly on unavailable or malformed data', async () => {
  const data = { status: 'ok', applications: [] }
  const { calls, fetchImpl } = fakeFetch({ status: 200, body: { jsonrpc: '2.0', id: 'browser-hosted-review', result: { contents: [{ uri: 'aqua://workspace/status', text: JSON.stringify(data) }] } } })
  assert.deepEqual(await readHostedReview(TOKEN, { fetchImpl }), data)
  assert.equal(calls[0].url, '/mcp')
  assert.equal(calls[0].init.headers.authorization, `Bearer ${TOKEN}`)
  assert.equal(JSON.parse(calls[0].init.body).method, 'resources/read')
  for (const body of [
    { error: { code: -32002 } },
    { result: { contents: [] } },
    { result: { contents: [{ uri: 'aqua://workspace/status', text: '{broken' }] } },
    { result: { contents: [{ uri: 'aqua://workspace/status', text: JSON.stringify({ status: 'ok', applications: [{ instance_id: 'x', review: { cards: [] } }] }) }] } },
  ]) await assert.rejects(() => readHostedReview(TOKEN, { fetchImpl: fakeFetch({ status: 200, body }).fetchImpl }), HostedApiError)
})

test('hosted approval controls require intact displayed wording and a question, and do not reopen an approval', () => {
  const card = { integrity_ok: true, context: { original_question: 'What is your company name?' }, answer: { body: 'Synthetic company' }, approval: { state: 'not_approved' } }
  assert.equal(canApproveHostedCard(card), true)
  assert.equal(canApproveHostedCard({ ...card, integrity_ok: false }), false)
  assert.equal(canApproveHostedCard({ ...card, answer: null }), false)
  assert.equal(canApproveHostedCard({ ...card, answer: { body: ' ' } }), false)
  assert.equal(canApproveHostedCard({ ...card, context: { original_question: null } }), false)
  assert.equal(canApproveHostedCard({ ...card, approval: { state: 'approved' } }), false)
  assert.equal(canApproveHostedCard({ ...card, history_source: { placeholder_found: true } }), false)
})

/** Fake fetch that captures requests and replies with a canned body. */
function fakeFetch(reply = { status: 200, body: { status: 'ok' } }) {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'content-type': 'application/json' },
    })
  }
  return { calls, fetchImpl }
}

// ---------------------------------------------------------------------------
// hostedInit — explicit consent plus the separate human approval secret
// ---------------------------------------------------------------------------

test('hostedInit POSTs explicit consent and the human secret with the caller Bearer token', async () => {
  const { calls, fetchImpl } = fakeFetch({ status: 201, body: { status: 'ok', workspace_id: 'ws-1' } })
  const res = await hostedInit(TOKEN, SECRET, { fetchImpl, baseUrl: 'https://app.test' })
  assert.equal(res.status, 'ok')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://app.test/api/workspace/init')
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.headers.authorization, `Bearer ${TOKEN}`)
  assert.equal(calls[0].init.headers['content-type'], 'application/json')
  assert.deepEqual(JSON.parse(calls[0].init.body), { consent_hosted_workspace: true, approval_secret: SECRET })
})

// ---------------------------------------------------------------------------
// hostedApprove — Bearer + server-built body (no record_b64)
// ---------------------------------------------------------------------------

test('hostedApprove carries the Bearer token and the server-built body shape', async () => {
  const { calls, fetchImpl } = fakeFetch({
    status: 200,
    body: { status: 'ok', version_id: VERSION_ID, version_sha256: CONTENT_SHA, actor_id: 'u-1', via: HOSTED_VIA },
  })
  const res = await hostedApprove(
    { version_id: VERSION_ID, expected_sha256: CONTENT_SHA, actor_id: 'u-1', approval_secret: SECRET },
    TOKEN,
    { fetchImpl },
  )
  assert.equal(res.status, 'ok')
  assert.equal(calls.length, 1)
  const { url, init } = calls[0]
  assert.equal(url, '/api/workspace/approve')
  assert.equal(init.method, 'POST')
  assert.equal(init.headers.authorization, `Bearer ${TOKEN}`)
  const body = JSON.parse(init.body)
  assert.deepEqual(body, {
    version_id: VERSION_ID,
    expected_sha256: CONTENT_SHA,
    via: 'hosted_review',
    actor_id: 'u-1',
    approval_secret: SECRET,
  })
  assert.ok(!('record_b64' in body), 'server-built mode: the client never ships a record')
})

test('hostedApprove omits actor_id when not given', async () => {
  const { calls, fetchImpl } = fakeFetch()
  await hostedApprove({ version_id: VERSION_ID, expected_sha256: CONTENT_SHA, approval_secret: SECRET }, TOKEN, { fetchImpl })
  const body = JSON.parse(calls[0].init.body)
  assert.equal(body.via, 'hosted_review')
  assert.ok(!('actor_id' in body))
})

// ---------------------------------------------------------------------------
// Honest error surfacing
// ---------------------------------------------------------------------------

test('non-2xx error bodies surface as HostedApiError with code + detail', async () => {
  const { fetchImpl } = fakeFetch({ status: 409, body: { error: 'sha256_mismatch', detail: 'stored hash differs' } })
  await assert.rejects(
    () => hostedApprove({ version_id: VERSION_ID, expected_sha256: CONTENT_SHA, approval_secret: SECRET }, TOKEN, { fetchImpl }),
    (e) => e instanceof HostedApiError && e.status === 409 && e.code === 'sha256_mismatch' && /stored hash differs/.test(e.message),
  )
  const nf = fakeFetch({ status: 404, body: { error: 'version_not_found' } })
  await assert.rejects(
    () => hostedApprove({ version_id: VERSION_ID, expected_sha256: CONTENT_SHA, approval_secret: SECRET }, TOKEN, { fetchImpl: nf.fetchImpl }),
    (e) => e instanceof HostedApiError && e.status === 404 && e.code === 'version_not_found',
  )
  // a non-JSON or empty error body still reports the HTTP status honestly
  const opaque = {
    calls: [],
    fetchImpl: async (url, init) => {
      opaque.calls.push({ url, init })
      return new Response('upstream exploded', { status: 502 })
    },
  }
  await assert.rejects(
    () => hostedInit(TOKEN, SECRET, { fetchImpl: opaque.fetchImpl }),
    (e) => e instanceof HostedApiError && e.status === 502 && e.code === 'http_502',
  )
})

test('a local-first refusal maps to the machine code, not a sentence', async () => {
  const { fetchImpl } = fakeFetch({
    status: 403,
    body: { error: 'local-first mode: private content stays on device', local_first: true, surface: 'hosted_workspace_init' },
  })
  await assert.rejects(
    () => hostedInit(TOKEN, SECRET, { fetchImpl }),
    (e) => e instanceof HostedApiError && e.status === 403 && e.code === 'local_first' && /local-first mode/.test(e.message),
  )
})

test('a transport failure is a HostedApiError (status 0), never a silent ok', async () => {
  const fetchImpl = async () => {
    throw new Error('network down')
  }
  await assert.rejects(
    () => hostedInit(TOKEN, SECRET, { fetchImpl }),
    (e) => e instanceof HostedApiError && e.status === 0 && e.code === 'request_failed',
  )
})

// ---------------------------------------------------------------------------
// findHostedWorkspace — the hosted signal is the caller's own row
// ---------------------------------------------------------------------------

test('init and approve reject absent or short approval secrets before making a request', async () => {
  const { calls, fetchImpl } = fakeFetch()
  for (const value of [undefined, '', ' short ', '       ']) {
    for (const invoke of [
      () => hostedInit(TOKEN, value, { fetchImpl }),
      () => hostedApprove({ version_id: VERSION_ID, expected_sha256: CONTENT_SHA, approval_secret: value }, TOKEN, { fetchImpl }),
    ]) {
      await assert.rejects(invoke, (error) => error instanceof HostedApiError && error.code === 'approval_secret_required')
    }
  }
  assert.equal(calls.length, 0)
})

test('the human secret is normalized consistently with the server and stays out of URLs and headers', async () => {
  const { calls, fetchImpl } = fakeFetch()
  await hostedInit(TOKEN, `  ${SECRET}  `, { fetchImpl })
  await hostedApprove({ version_id: VERSION_ID, expected_sha256: CONTENT_SHA, approval_secret: `  ${SECRET}  ` }, TOKEN, { fetchImpl })
  for (const { url, init } of calls) {
    assert.equal(JSON.parse(init.body).approval_secret, SECRET)
    assert.ok(!url.includes(SECRET))
    assert.ok(!JSON.stringify(init.headers).includes(SECRET))
  }
})

test('findHostedWorkspace returns the caller row or null, and surfaces lookup errors', async () => {
  const withRow = {
    from: () => ({
      select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [{ id: 'ws-row-1', workspace_key: 'WS-x' }], error: null }) }) }),
    }),
  }
  assert.deepEqual(await findHostedWorkspace(withRow), { id: 'ws-row-1', workspace_key: 'WS-x' })

  const empty = {
    from: () => ({ select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }),
  }
  assert.equal(await findHostedWorkspace(empty), null)

  const failing = {
    from: () => ({ select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: null, error: { code: 'PGRST205', message: 'table missing' } }) }) }) }),
  }
  await assert.rejects(
    () => findHostedWorkspace(failing),
    (e) => e instanceof HostedApiError && e.code === 'workspace_lookup_failed',
  )
})

// ---------------------------------------------------------------------------
// The local vault path is unchanged: hostedApprove writes nothing locally
// and 'hosted_review' is still refused by the local writer.
// ---------------------------------------------------------------------------

test('the local approval path is unchanged — vault approval still binds the content hash', async () => {
  const storage = createMemoryStorage()
  const { version } = await createAnswerWithVersion(
    storage,
    SECRET,
    { application_id: 'app-1', question_occurrence_id: 'q-1' },
    { title: 'Synthetic answer', body: 'Synthetic body text', method: 'manual' },
  )
  // vault version.sha256 IS the hosted content hash sha256(canonicalJson({title,body}))
  assert.equal(version.sha256, CONTENT_SHA)
  const rec = await recordHumanApproval(storage, {
    version_id: version.id,
    expected_sha256: version.sha256,
    actor_id: 'u-1',
    via: 'review_ui',
    secret: SECRET,
  })
  assert.equal(rec.decision, 'approved')
  assert.equal(rec.actor_class, 'human')
  assert.equal((await listApprovals(storage)).length, 1)
})

test("'hosted_review' stays a server-side via — the local writer still refuses it", async () => {
  const storage = createMemoryStorage()
  const { version } = await createAnswerWithVersion(
    storage,
    SECRET,
    { application_id: 'app-1', question_occurrence_id: 'q-1' },
    { title: 'Synthetic answer', body: 'Synthetic body text', method: 'manual' },
  )
  await assert.rejects(
    () =>
      recordHumanApproval(storage, {
        version_id: version.id,
        expected_sha256: version.sha256,
        actor_id: 'u-1',
        via: 'hosted_review',
        secret: SECRET,
      }),
    VaultScopeError,
  )
  assert.equal((await listApprovals(storage)).length, 0, 'nothing was written')
})
