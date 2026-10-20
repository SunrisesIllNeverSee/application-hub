// P0 auth (EI-01..EI-03, EI-06, EI-11): pure invite / provider / site-url helpers.
// Run: node --test tests/team-invite.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildInviteAcceptUrl,
  buildInviteAcceptPath,
  isValidInviteToken,
  mapDeliveryStatus,
  escapeHtml,
  inviteDeliveryNotice,
  rpcResultToStatus,
  teamStatusBanner,
} from '../lib/team-invite.ts'
import { getSiteUrl, DEFAULT_SITE_URL } from '../lib/site-url.ts'
import { parseEnabledProviders } from '../lib/auth-providers.ts'

test('invite URL targets the real handler on the canonical host', () => {
  assert.equal(
    buildInviteAcceptUrl('https://aquaidp.xyz', 'abc123'),
    'https://aquaidp.xyz/api/teams/accept?token=abc123'
  )
  assert.equal(
    buildInviteAcceptUrl('https://aquaidp.xyz/', 'a b'),
    'https://aquaidp.xyz/api/teams/accept?token=a%20b'
  )
  assert.ok(!buildInviteAcceptUrl('https://aquaidp.xyz', 'x').includes('application-hub-chi'))
  assert.equal(buildInviteAcceptPath('abc'), '/api/teams/accept?token=abc')
})

test('getSiteUrl uses NEXT_PUBLIC_SITE_URL, defaults to aquaidp.xyz, ignores junk', () => {
  const prev = process.env.NEXT_PUBLIC_SITE_URL
  try {
    delete process.env.NEXT_PUBLIC_SITE_URL
    assert.equal(getSiteUrl(), DEFAULT_SITE_URL)
    assert.equal(DEFAULT_SITE_URL, 'https://aquaidp.xyz')
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.test/'
    assert.equal(getSiteUrl(), 'https://example.test')
    process.env.NEXT_PUBLIC_SITE_URL = 'not a url'
    assert.equal(getSiteUrl(), DEFAULT_SITE_URL)
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = prev
  }
})

test('delivery mapping: sent only on 2xx with a key', () => {
  assert.equal(mapDeliveryStatus({ apiKeyPresent: false }), 'not_configured')
  assert.equal(mapDeliveryStatus({ apiKeyPresent: false, httpStatus: 200 }), 'not_configured')
  assert.equal(mapDeliveryStatus({ apiKeyPresent: true, httpStatus: 200 }), 'sent')
  assert.equal(mapDeliveryStatus({ apiKeyPresent: true, httpStatus: 202 }), 'sent')
  assert.equal(mapDeliveryStatus({ apiKeyPresent: true, httpStatus: 403 }), 'failed')
  assert.equal(mapDeliveryStatus({ apiKeyPresent: true, httpStatus: 422 }), 'failed')
  assert.equal(mapDeliveryStatus({ apiKeyPresent: true, httpStatus: 500 }), 'failed')
  assert.equal(mapDeliveryStatus({ apiKeyPresent: true, httpStatus: 301 }), 'failed')
  assert.equal(mapDeliveryStatus({ apiKeyPresent: true, threw: true }), 'failed')
  assert.equal(mapDeliveryStatus({ apiKeyPresent: true }), 'failed')
})

test('UI notice never claims email sent unless delivery is sent', () => {
  const sent = inviteDeliveryNotice('sent', 'a@b.co')
  assert.equal(sent.showLink, false)
  assert.match(sent.message, /email sent/i)
  const nc = inviteDeliveryNotice('not_configured', 'a@b.co')
  assert.equal(nc.showLink, true)
  assert.match(nc.message, /not sent/i)
  assert.match(nc.message, /email provider not configured/i)
  const failed = inviteDeliveryNotice('failed', 'a@b.co')
  assert.equal(failed.showLink, true)
  assert.doesNotMatch(failed.message, /email sent/i)
  assert.equal(inviteDeliveryNotice(undefined, 'a@b.co').showLink, true)
})

test('escapeHtml neutralises markup in team names', () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="a()">&'`),
    '&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;'
  )
})

test('invite token format check', () => {
  assert.equal(isValidInviteToken('a'.repeat(48)), true)
  assert.equal(isValidInviteToken('short'), false)
  assert.equal(isValidInviteToken('../../etc/passwd/aaaaaaaa'), false)
  assert.equal(isValidInviteToken(null), false)
})

test('RPC result mapping follows the shared contract', () => {
  assert.equal(rpcResultToStatus({ ok: true, team_id: 'x', status: 'joined' }), 'joined')
  assert.equal(rpcResultToStatus({ ok: true, team_id: 'x', status: 'already_member' }), 'already_member')
  assert.equal(rpcResultToStatus({ ok: false, error: 'invalid_or_used' }), 'invalid_or_used')
  assert.equal(rpcResultToStatus({ ok: false, error: 'expired' }), 'expired')
  assert.equal(rpcResultToStatus({ ok: false, error: 'email_mismatch' }), 'email_mismatch')
  assert.equal(rpcResultToStatus({ ok: false, error: 'not_authenticated' }), 'error')
  assert.equal(rpcResultToStatus({ ok: false, error: 'surprise' }), 'error')
  assert.equal(rpcResultToStatus(null), 'error')
  assert.equal(rpcResultToStatus('nope'), 'error')
})

test('team status banner maps known values only', () => {
  assert.equal(teamStatusBanner('joined')?.tone, 'success')
  assert.equal(teamStatusBanner('already_member')?.tone, 'success')
  for (const s of ['invalid_or_used', 'expired', 'email_mismatch', 'missing_token', 'error']) {
    assert.equal(teamStatusBanner(s)?.tone, 'error', s)
  }
  assert.equal(teamStatusBanner('<script>'), null)
  assert.equal(teamStatusBanner(undefined), null)
})

test('provider gating fails closed', () => {
  const all = parseEnabledProviders({ external: { github: true, google: true, linkedin_oidc: true } })
  assert.deepEqual(all, { github: true, google: true, linkedin_oidc: true })
  // live state at diagnosis time: only github enabled, legacy linkedin disabled
  assert.deepEqual(
    parseEnabledProviders({ external: { github: true, google: false, linkedin: false, linkedin_oidc: false, email: true } }),
    { github: true, google: false, linkedin_oidc: false }
  )
  // legacy "linkedin" must not enable the linkedin_oidc button
  assert.equal(parseEnabledProviders({ external: { linkedin: true } }).linkedin_oidc, false)
  // truthy-but-not-true values, missing or malformed payloads
  assert.equal(parseEnabledProviders({ external: { github: 'true' } }).github, false)
  for (const bad of [null, undefined, {}, [], 'x', { external: null }, { external: 'x' }]) {
    assert.deepEqual(parseEnabledProviders(bad), { github: false, google: false, linkedin_oidc: false })
  }
})

test('login error messages: callback failure and provider errors', async () => {
  const { describeAuthError } = await import('../lib/auth-messages.ts')
  assert.match(describeAuthError('auth_callback_failed'), /could not complete your sign-in/i)
  assert.match(describeAuthError('access_denied'), /cancelled|not allowed/i)
  assert.equal(describeAuthError(null), null)
  assert.doesNotMatch(describeAuthError('weird', 'Call 555-0100 for support'), /555-0100/)
  assert.match(describeAuthError('weird'), /Sign-in failed/)
  assert.ok(describeAuthError('weird', 'x'.repeat(500)).length < 260)
})
