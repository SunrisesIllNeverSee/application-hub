import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { appendVaryAccept, preferredType } from '../lib/accept.mjs'
import { MARKDOWN_PAGES, NOT_FOUND_MARKDOWN } from '../lib/agent-content.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(here, '..')
const read = (relativePath) => readFile(path.join(appRoot, relativePath), 'utf8')

test('Accept negotiation follows q-values, specificity, and explicit rejection', () => {
  assert.equal(preferredType('text/markdown'), 'text/markdown')
  assert.equal(preferredType('text/markdown;q=0.5, text/html;q=0.9'), 'text/html')
  assert.equal(preferredType('text/html;q=0, */*;q=1'), 'text/markdown')
  assert.equal(preferredType('application/pdf'), null)
  assert.equal(preferredType('*/*'), 'text/html')
})

test('Vary preserves framework dimensions and includes Accept once', () => {
  const headers = new Headers({
    Vary: 'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch',
  })
  appendVaryAccept(headers)
  appendVaryAccept(headers)
  const vary = headers.get('Vary') ?? ''
  assert.match(vary, /rsc/i)
  assert.equal(vary.toLowerCase().split('accept').length - 1, 1)
})

test('public HTML routes declare Accept in framework and Vercel Vary headers', async () => {
  const config = await read('next.config.mjs')
  const vercel = JSON.parse(await read('vercel.json'))
  const expected = 'Accept, RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch'
  assert.ok(config.includes(expected))

  const expectedRoutes = ['/', '/about', '/about/scoring', '/contact', '/privacy']
  for (const pathname of expectedRoutes) {
    const entry = vercel.headers.find((e) => e.source === pathname)
    assert.ok(entry, `missing Vercel Vary route ${pathname}`)
    assert.ok(entry.headers.some((h) => h.key === 'Vary' && h.value === expected), `Vercel Vary value mismatch for ${pathname}`)
    assert.equal(entry.override, true, `Vercel Vary for ${pathname} must override Next.js internal Vary`)
  }
})

test('canonical Markdown pages are substantial and semantically structured', () => {
  for (const pathname of ['/', '/about', '/contact', '/privacy', '/about/scoring']) {
    const body = MARKDOWN_PAGES[pathname]
    assert.ok(body, `missing Markdown for ${pathname}`)
    assert.match(body, /^# /)
    assert.ok(body.length > 500, `${pathname} Markdown is too thin`)
  }
  assert.match(MARKDOWN_PAGES['/'], /^## /m)
})

test('Markdown 404 gives agents recovery surfaces', () => {
  assert.match(NOT_FOUND_MARKDOWN, /^# 404/m)
  assert.match(NOT_FOUND_MARKDOWN, /llms\.txt/)
  assert.match(NOT_FOUND_MARKDOWN, /sitemap\.xml/)
  assert.match(NOT_FOUND_MARKDOWN, /\/about/)
})

test('llms.txt contains when-to-use and invocation guidance', async () => {
  const llms = await read('public/llms.txt')
  assert.match(llms, /## When to use AQUA/)
  assert.match(llms, /## How agents should use AQUA/)
  assert.match(llms, /Accept: text\/markdown/)
  assert.match(llms, /local\/stdio/)
  assert.match(llms, /Do not use AQUA as an admissions oracle/)
})

test('homepage source contains canonical metadata and required JSON-LD identities', async () => {
  const source = await read('app/page.tsx')
  assert.match(source, /alternates:\s*\{ canonical: '\/' \}/)
  assert.match(source, /images:\s*\[\{ url: '\/opengraph-image'/)
  assert.match(source, /application\/ld\+json/)
  assert.match(source, /'@type': 'SoftwareApplication'/)
  assert.match(source, /'@type': 'Organization'/)
  assert.match(source, /'@type': 'PostalAddress'/)
  assert.match(source, /contactPoint/)
  assert.match(source, /AQUA Application Hub turns repeated application work/)
})

test('trust anchor pages are substantial, canonical, and have heading hierarchy', async () => {
  for (const pathname of ['app/about/page.tsx', 'app/contact/page.tsx', 'app/privacy/page.tsx']) {
    const source = await read(pathname)
    assert.ok(source.length > 2500, `${pathname} is too thin`)
    assert.match(source, /alternates:\s*\{ canonical:/)
    assert.match(source, /<h1/)
    assert.match(source, /<h2/)
  }
})

test('custom 404 and sitemap expose recovery and trust endpoints', async () => {
  const notFound = await read('app/not-found.tsx')
  const sitemap = await read('app/sitemap.ts')

  assert.match(notFound, /\/llms\.txt/)
  assert.match(notFound, /\/sitemap\.xml/)
  assert.match(notFound, /\/about/)

  for (const pathname of ['/about', '/about/scoring', '/contact', '/privacy']) {
    assert.ok(sitemap.includes(pathname), `sitemap missing ${pathname}`)
  }
})
