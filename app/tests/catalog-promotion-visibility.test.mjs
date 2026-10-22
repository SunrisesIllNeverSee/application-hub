// M09 W3: catalog visibility — registry slugs remain a floor, curated
// source='canonical' publishes are also approved.
// Run: node --test tests/catalog-promotion-visibility.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CANONICAL_PROGRAM_SLUGS, approvedProgramsFilter, restrictToApprovedPrograms } from '../lib/canonical-catalog.ts'

function fakeQuery() {
  const calls = []
  const q = {
    calls,
    or(f) { calls.push(['or', f]); return q },
    in(c, v) { calls.push(['in', c, v]); return q },
    eq(c, v) { calls.push(['eq', c, v]); return q },
  }
  return q
}

test('restrictToApprovedPrograms applies slug-floor OR source=canonical in one or() filter', () => {
  const q = fakeQuery()
  assert.equal(restrictToApprovedPrograms(q), q)
  assert.equal(q.calls.length, 1)
  const [kind, filter] = q.calls[0]
  assert.equal(kind, 'or')
  assert.equal(filter, 'slug.in.("yc-summer-2026","founding-500","redbud-vc","cyberfund-monastery","3xcapital"),source.eq.canonical')
})

test('no existing approved program loses visibility: every registry slug is in the filter', () => {
  const f = approvedProgramsFilter()
  for (const s of CANONICAL_PROGRAM_SLUGS) assert.ok(f.includes(`"${s}"`), s)
})

test('empty or unsafe registries degrade to source=canonical only (well-formed filter)', () => {
  assert.equal(approvedProgramsFilter([]), 'source.eq.canonical')
  assert.equal(approvedProgramsFilter(['ok-slug', 'bad,slug', 'x).or(id.neq.0']), 'slug.in.("ok-slug"),source.eq.canonical')
})

test('a curated publish (source=canonical, slug not in registry) matches the filter semantics', () => {
  // Evaluate the filter the way PostgREST would for a few rows.
  const f = approvedProgramsFilter()
  const slugs = f.match(/slug\.in\.\(([^)]*)\)/)[1].split(',').map((s) => s.replace(/"/g, ''))
  const approved = (row) => slugs.includes(row.slug) || row.source === 'canonical'
  assert.equal(approved({ slug: 'northwind-spring-2027', source: 'canonical' }), true)
  assert.equal(approved({ slug: 'yc-summer-2026', source: 'canonical' }), true)
  assert.equal(approved({ slug: 'synthetic-seed', source: 'seeded' }), false)
  assert.equal(approved({ slug: 'fundingcake-x', source: 'fundingcake' }), false)
})
