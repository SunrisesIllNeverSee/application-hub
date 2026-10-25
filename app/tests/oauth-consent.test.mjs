import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { loadConsentRequest, decideConsentRequest } from '../lib/oauth-consent.ts'

const AUTHORIZATION_ID = 'synthetic-authorization-request'
const DETAILS = {
  authorization_id: AUTHORIZATION_ID,
  redirect_uri: 'https://client.example/callback',
  client: { id: 'synthetic-client', name: 'Synthetic OAuth client', uri: 'https://client.example', logo_uri: '' },
  user: { id: '11111111-1111-4111-8111-111111111111', email: 'synthetic@example.test' },
  scope: 'openid profile email',
}

// Exercise the installed SDK's actual transport with an in-memory session.
// No real credentials, account, network, consent or workspace writes are used.
function sdk({ body = DETAILS, status = 200 } = {}) {
  const calls = []
  const encoded = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  const token = `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: DETAILS.user.id, exp: expiresAt })}.synthetic-signature`
  const session = JSON.stringify({ access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_at: expiresAt, expires_in: 3600, user: DETAILS.user })
  const client = createClient('https://consent-test.supabase.co', 'synthetic-publishable-key', {
    auth: {
      storageKey: 'synthetic-session', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false,
      storage: { getItem: (key) => key === 'synthetic-session' ? session : null, setItem() {}, removeItem() {} },
    },
    global: { fetch: async (url, init = {}) => {
      calls.push({ path: new URL(url).pathname, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : null, authorization: new Headers(init.headers).get('authorization') })
      return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    } },
  })
  return { oauth: client.auth.oauth, calls, token }
}

test('loads real client identity and scopes through the SDK without granting consent', async () => {
  const { oauth, calls, token } = sdk()
  assert.deepEqual(await loadConsentRequest(oauth, AUTHORIZATION_ID), DETAILS)
  assert.deepEqual(calls.map(({ path, method, body }) => ({ path, method, body })), [{
    path: `/auth/v1/oauth/authorizations/${AUTHORIZATION_ID}`, method: 'GET', body: null,
  }])
  assert.equal(calls[0].authorization, `Bearer ${token}`)
})

for (const action of ['approve', 'deny']) {
  test(`${action} uses the consent endpoint only after an explicit decision`, async () => {
    const redirect = 'https://client.example/callback?synthetic-result=complete'
    const { oauth, calls } = sdk({ body: { redirect_url: redirect } })
    assert.equal(await decideConsentRequest(oauth, AUTHORIZATION_ID, action), redirect)
    assert.deepEqual(calls.map(({ path, method, body }) => ({ path, method, body })), [{
      path: `/auth/v1/oauth/authorizations/${AUTHORIZATION_ID}/consent`, method: 'POST', body: { action },
    }])
  })
}

test('an expired authorization produces an actionable error rather than an anonymous prompt', async () => {
  const { oauth } = sdk({ status: 400, body: { message: 'Authorization request expired', code: 'validation_failed' } })
  await assert.rejects(loadConsentRequest(oauth, AUTHORIZATION_ID), /Could not load the authorization request/)
})

test('rejects a response without authorization details', async () => {
  const { oauth } = sdk({ body: {} })
  await assert.rejects(loadConsentRequest(oauth, AUTHORIZATION_ID), /returned no request details/)
})

test('an unidentified client cannot become an approval prompt', async () => {
  const { oauth } = sdk({ body: { authorization_id: AUTHORIZATION_ID, scope: 'openid' } })
  await assert.rejects(loadConsentRequest(oauth, AUTHORIZATION_ID), /application could not be identified/)
})

test('preserves a server redirect for an already-consented request without issuing a new approval', async () => {
  const payload = { redirect_url: 'https://client.example/callback?synthetic-result=existing-grant' }
  const { oauth, calls } = sdk({ body: payload })
  assert.deepEqual(await loadConsentRequest(oauth, AUTHORIZATION_ID), payload)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].method, 'GET')
})

test('a failed decision reports failure and never invents a redirect', async () => {
  const { oauth } = sdk({ status: 403, body: { message: 'Consent refused', code: 'forbidden' } })
  await assert.rejects(decideConsentRequest(oauth, AUTHORIZATION_ID, 'approve'), /approve could not be completed/)
})

test('missing redirect fails visibly after a decision', async () => {
  const { oauth } = sdk({ body: {} })
  await assert.rejects(decideConsentRequest(oauth, AUTHORIZATION_ID, 'deny'), /returned no redirect/)
})

test('unsupported decisions cannot call the consent API', async () => {
  const { oauth, calls } = sdk()
  await assert.rejects(decideConsentRequest(oauth, AUTHORIZATION_ID, 'automatic'), /Unsupported consent decision/)
  assert.equal(calls.length, 0)
})
