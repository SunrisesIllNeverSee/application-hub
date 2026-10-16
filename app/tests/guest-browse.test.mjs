// M08-PRD-003/004 (owner d4b/d5): guest + un-onboarded browse gate.
// Run: node --test tests/guest-browse.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { isBrowseOnlyPath } from '../lib/browse-gate.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(here, '..')
const read = (rel) => readFile(path.join(appRoot, rel), 'utf8')

test('browse gate allows the catalog, program detail, and public timeline', () => {
  for (const p of ['/applications', '/applications/some-program-slug', '/applications/timeline']) {
    assert.equal(isBrowseOnlyPath(p), true, p)
  }
})

test('browse gate denies submit and every non-catalog surface', () => {
  for (const p of [
    '/applications/submit',
    '/applications/submit/anything',
    '/workspace',
    '/workspace/abc',
    '/aqua-local',
    '/dash',
    '/onboarding',
    '/',
    '/login',
  ]) {
    assert.equal(isBrowseOnlyPath(p), false, p)
  }
})

test('submit denial covers the whole /applications/submit branch', () => {
  // deny-by-prefix: a hypothetical slug collision fails closed, never open
  assert.equal(isBrowseOnlyPath('/applications/submitted'), false)
  assert.equal(isBrowseOnlyPath('/applications/submit/x'), false)
})

test('middleware and (app)/layout share the single predicate', async () => {
  const mw = await read('middleware.ts')
  const layout = await read('app/(app)/layout.tsx')
  assert.match(mw, /isBrowseOnlyPath\(pathname\)/)
  assert.match(layout, /isBrowseOnlyPath\(reqPath\)/)
  // No inline re-implementation of the gate (drift between the two layers)
  assert.doesNotMatch(mw, /startsWith\('\/applications\/'\)/)
  assert.doesNotMatch(layout, /startsWith\('\/applications\/'\)/)
})

test('guests never receive personal surfaces', async () => {
  const page = await read('app/(app)/applications/page.tsx')
  // tab=mine is coerced to discover for signed-out users
  assert.match(page, /resolvedParams\.tab === 'mine' && user/)
  // guest banner points at sign-in, not workspace actions
  assert.match(page, /Browsing as a guest/)
})

test('public viewers never see non-approved catalog (d4b/WS7) — allowlist semantics', async () => {
  const gate = await read('lib/browse-gate.ts')
  // every non-approved source enumerated: seeded, fundingcake (explicitly
  // barred by owner), community, funder — only future 'canonical' passes
  assert.match(gate, /"seeded"/)
  assert.match(gate, /"fundingcake"/)
  assert.match(gate, /"community"/)
  assert.match(gate, /"funder"/)
  assert.match(gate, /export function restrictToApprovedPrograms/)
  for (const rel of [
    'app/(app)/applications/page.tsx',
    'app/(app)/applications/[slug]/page.tsx',
    'app/(app)/applications/timeline/page.tsx',
  ]) {
    const src = await read(rel)
    assert.match(src, /restrictToApprovedPrograms/, rel)
  }
  const page = await read('app/(app)/applications/page.tsx')
  // funders directory (synthetic aggregates) redirects public viewers
  assert.match(page, /view === 'funders'[\s\S]{0,80}redirect\('\/applications'\)/)
})
