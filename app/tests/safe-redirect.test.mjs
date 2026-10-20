// P0 auth (AUTH-06 / EI-08): safe return-path helper.
// Run: node --test tests/safe-redirect.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  sanitizeNextPath,
  safeNextPath,
  resolveSafeRedirect,
  buildAuthCallbackUrl,
  DEFAULT_NEXT_PATH,
} from '../lib/safe-redirect.ts'

const REJECTED = [
  ['protocol-relative', '//evil.com'],
  ['triple slash', '///evil.com'],
  ['slash backslash', '/\\evil.com'],
  ['slash backslash slash', '/\\/evil.com'],
  ['encoded protocol-relative (no leading slash)', '%2F%2Fevil.com'],
  ['encoded second slash', '/%2F/evil.com'],
  ['encoded backslash', '/%5Cevil.com'],
  ['double-encoded second slash', '/%252F/evil.com'],
  ['tab-prefixed //', '\t//evil.com'],
  ['tab inside //', '/\t/evil.com'],
  ['newline inside //', '/\n/evil.com'],
  ['carriage return inside //', '/\r/evil.com'],
  ['leading space', ' /dash'],
  ['leading space before //', ' //evil.com'],
  ['https absolute', 'https://evil.com'],
  ['http absolute', 'http://evil.com/x'],
  ['javascript scheme', 'javascript:alert(1)'],
  ['data scheme', 'data:text/html,<script>1</script>'],
  ['bare host', 'evil.com/path'],
  ['empty', ''],
  ['backslash anywhere', '/ok\\path'],
  ['dot-segment to //', '/..//evil.com'],
  ['malformed escape', '/%E0%A4%A'],
  ['null byte', '/ok\u0000'],
  ['non-string number', 42],
  ['null', null],
  ['undefined', undefined],
]

for (const [name, input] of REJECTED) {
  test(`rejects ${name}`, () => {
    assert.equal(sanitizeNextPath(input), null, JSON.stringify(input))
    assert.equal(safeNextPath(input), DEFAULT_NEXT_PATH)
    assert.equal(safeNextPath(input, '/dash'), '/dash')
  })
}

test('accepts valid same-origin paths and keeps query and hash', () => {
  for (const p of [
    '/dash',
    '/applications',
    '/applications/some-slug',
    '/api/teams/accept?token=abc123def456abc123def456',
    '/profile/settings?team=joined',
    '/reset-password',
    '/a?x=1&y=2#frag',
    '/applications?next=%2Fdash',
  ]) {
    assert.equal(sanitizeNextPath(p), p, p)
  }
})

test('rejects a long path', () => {
  assert.equal(sanitizeNextPath('/' + 'a'.repeat(3000)), null)
})

test('resolveSafeRedirect always stays on the request origin', () => {
  const origin = 'https://aquaidp.xyz'
  for (const input of ['//evil.com', '/\\evil.com', 'https://evil.com', '/..//evil.com', '\t//evil.com']) {
    const url = resolveSafeRedirect(input, origin)
    assert.equal(url.origin, origin, input)
    assert.equal(url.pathname, DEFAULT_NEXT_PATH, input)
  }
  const ok = resolveSafeRedirect('/api/teams/accept?token=zzzzzzzzzzzzzzzz', origin, '/dash')
  assert.equal(ok.href, 'https://aquaidp.xyz/api/teams/accept?token=zzzzzzzzzzzzzzzz')
})

test('buildAuthCallbackUrl appends next only when valid', () => {
  const o = 'https://aquaidp.xyz'
  assert.equal(buildAuthCallbackUrl(o), `${o}/auth/callback`)
  assert.equal(buildAuthCallbackUrl(o, null), `${o}/auth/callback`)
  assert.equal(buildAuthCallbackUrl(o, '//evil.com'), `${o}/auth/callback`)
  assert.equal(buildAuthCallbackUrl(o, '/reset-password'), `${o}/auth/callback?next=%2Freset-password`)
  assert.equal(
    buildAuthCallbackUrl(o, '/api/teams/accept?token=abc'),
    `${o}/auth/callback?next=${encodeURIComponent('/api/teams/accept?token=abc')}`
  )
})
