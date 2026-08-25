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
    assert.ok(vercel.headers.some((entry) => entry.source === pathname && entry.headers.some((header) => header.key === 'Vary' && header.value === expected)), `missing Vercel Vary route ${pathname}`)
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
  assert.match(llms, /stdio/)
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

  for (const pathname of ['/about', '/about/scoring', '/contact', '/privacy', '/developers']) {
    assert.ok(sitemap.includes(pathname), `sitemap missing ${pathname}`)
  }
})

test('OpenAPI spec is published with typed operations and ProblemDetails', async () => {
  const source = await read('app/openapi.json/route.ts')
  assert.match(source, /openapi:\s*'3\.0\.3'/)
  assert.match(source, /operationId/)
  assert.match(source, /ProblemDetails/)
  assert.match(source, /matchQuestion/)
  assert.match(source, /intakeApplication/)
  assert.match(source, /captureAnswer/)
  assert.match(source, /smartMatcher/)
  assert.match(source, /stressTestAnswer/)
})

test('MCP manifest is published at /.well-known/mcp', async () => {
  const source = await read('app/.well-known/mcp/route.ts')
  assert.match(source, /application-hub-mcp-server/)
  assert.match(source, /stdio/)
  assert.match(source, /toolCount/)
  assert.match(source, /toolCategories/)
})

test('developer portal documents API, MCP, and auth', async () => {
  const source = await read('app/developers/page.tsx')
  assert.match(source, /OpenAPI/)
  assert.match(source, /MCP/)
  assert.match(source, /Authentication/i)
  assert.match(source, /Bearer JWT/)
  assert.match(source, /ProblemDetails/)
  assert.match(source, /Appfeeder/)
  assert.match(source, /alternates:\s*\{ canonical: '\/developers' \}/)
})

test('homepage links to developer resources and API spec', async () => {
  const source = await read('app/page.tsx')
  assert.match(source, /href="\/developers"/)
  assert.match(source, /href="\/openapi\.json"/)
})

test('llms.txt references developer portal, OpenAPI, and MCP manifest', async () => {
  const llms = await read('public/llms.txt')
  assert.match(llms, /\/developers/)
  assert.match(llms, /\/openapi\.json/)
  assert.match(llms, /\.well-known\/mcp/)
  assert.match(llms, /OpenAPI 3\.0\.3/)
  assert.match(llms, /27 tools/)
  assert.match(llms, /npx -y application-hub-mcp-server/)
  assert.match(llms, /npmjs\.com/)
})

test('MCP server is published on npm with bin entry', async () => {
  const pkg = JSON.parse(await read('../application-hub-mcp-server/package.json'))
  assert.equal(pkg.name, 'application-hub-mcp-server')
  assert.ok(pkg.bin, 'package.json must have a bin field for CLI use')
  assert.ok(pkg.bin['application-hub-mcp-server'], 'bin must map to dist/index.js')
  assert.match(pkg.description, /AQUA Application Hub/)
  assert.equal(pkg.license, 'MIT')
})

test('homepage JSON-LD includes WebSite entity and npm sameAs for brand discoverability', async () => {
  const source = await read('app/page.tsx')
  assert.match(source, /'@type': 'WebSite'/)
  assert.match(source, /npmjs\.com/)
  assert.match(source, /alternateName.*mos2es\.xyz/)
})
