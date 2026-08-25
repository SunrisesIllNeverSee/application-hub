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

test('lib/jsonld.ts exports reusable JSON-LD builders', async () => {
  const source = await read('lib/jsonld.ts')
  assert.match(source, /export function breadcrumbList/)
  assert.match(source, /export function faqPage/)
  assert.match(source, /export function definedTerm/)
  assert.match(source, /export function itemList/)
  assert.match(source, /BreadcrumbList/)
  assert.match(source, /FAQPage/)
  assert.match(source, /DefinedTerm/)
  assert.match(source, /ItemList/)
})

test('sub-pages include BreadcrumbList JSON-LD', async () => {
  const jsonld = await read('lib/jsonld.ts')
  assert.match(jsonld, /BreadcrumbList/, 'lib/jsonld should export breadcrumbList builder')
  for (const pathname of ['app/about/page.tsx', 'app/about/scoring/page.tsx', 'app/contact/page.tsx', 'app/privacy/page.tsx', 'app/developers/page.tsx', 'app/agents/page.tsx']) {
    const source = await read(pathname)
    assert.match(source, /BREADCRUMBS/, `${pathname} should import BREADCRUMBS from lib/jsonld`)
    assert.match(source, /application\/ld\+json/, `${pathname} should render JSON-LD script tag`)
  }
})

test('FAQ page exists with FAQPage schema and 15 Q&A pairs', async () => {
  const source = await read('app/faq/page.tsx')
  assert.match(source, /faqPage/)
  assert.match(source, /FAQPage/)
  assert.match(source, /alternates:\s*\{ canonical: '\/faq' \}/)
  assert.match(source, /What is AQUA Application Hub/)
  assert.match(source, /Is AQUA an admissions oracle/)
  assert.match(source, /How does answer reuse work/)
  assert.match(source, /What is Smart Matcher/)
  assert.match(source, /What is fit score/)
  assert.match(source, /What is significance score/)
  assert.match(source, /What is the application graph/)
  assert.match(source, /What is answer lineage/)
  assert.match(source, /How does the MCP server work/)
  assert.match(source, /Does AQUA rank applicants/)
  assert.match(source, /Does AQUA influence admissions decisions/)
  assert.match(source, /How do I get started/)
})

test('scoring page includes DefinedTerm JSON-LD for 5 scoring concepts', async () => {
  const source = await read('app/about/scoring/page.tsx')
  assert.match(source, /SCORING_TERMS/, 'scoring page should import SCORING_TERMS')
  const jsonld = await read('lib/jsonld.ts')
  assert.match(jsonld, /DefinedTerm/, 'lib/jsonld should export definedTerm builder')
  assert.match(jsonld, /Significance Score/)
  assert.match(jsonld, /Fit Score/)
  assert.match(jsonld, /Composite Score/)
  assert.match(jsonld, /Heat Score/)
  assert.match(jsonld, /Program Value Score/)
})

test('hub page (/applications) includes ItemList JSON-LD for the program list', async () => {
  // /hub is a permanent redirect to /applications (next.config.mjs), so the
  // canonical program-list page is /applications. The ItemList is rendered
  // in the discover tab where the public program list is shown.
  const source = await read('app/(app)/applications/page.tsx')
  assert.match(source, /import \{ itemList \} from '@\/lib\/jsonld'/, 'applications page should import itemList from lib/jsonld')
  assert.match(source, /itemList\(/, 'applications page should call itemList()')
  assert.match(source, /application\/ld\+json/, 'applications page should render a JSON-LD script tag for ItemList')
  const jsonld = await read('lib/jsonld.ts')
  assert.match(jsonld, /'@type': 'ItemList'/, 'lib/jsonld itemList builder should emit ItemList type')
})

test('FAQ markdown content exists for content negotiation', () => {
  const body = MARKDOWN_PAGES['/faq']
  assert.ok(body, 'missing Markdown for /faq')
  assert.match(body, /^# /)
  assert.ok(body.length > 500, '/faq Markdown is too thin')
  assert.match(body, /What is AQUA Application Hub/)
})

test('sitemap includes /faq', async () => {
  const sitemap = await read('app/sitemap.ts')
  assert.match(sitemap, /\/faq/)
})

test('llms.txt includes /faq', async () => {
  const llms = await read('public/llms.txt')
  assert.match(llms, /\/faq/)
})

// ─── Phase 3: Content layer tests ──────────────────────────────────────────

test('lib/jsonld.ts exports HowTo and comparisonArticle builders', async () => {
  const source = await read('lib/jsonld.ts')
  assert.match(source, /export function howTo/, 'lib/jsonld should export howTo builder')
  assert.match(source, /export function comparisonArticle/, 'lib/jsonld should export comparisonArticle builder')
  assert.match(source, /HowTo/, 'lib/jsonld should reference HowTo type')
  assert.match(source, /Article/, 'lib/jsonld should reference Article type')
})

test('5 concept pages exist with DefinedTerm + BreadcrumbList JSON-LD', async () => {
  const concepts = [
    { path: 'app/concepts/answer-reuse/page.tsx', term: 'Answer Reuse', crumb: 'conceptAnswerReuse' },
    { path: 'app/concepts/fit-score/page.tsx', term: 'Opportunity Fit Score', crumb: 'conceptFitScore' },
    { path: 'app/concepts/application-graph/page.tsx', term: 'Application Graph', crumb: 'conceptApplicationGraph' },
    { path: 'app/concepts/answer-lineage/page.tsx', term: 'Answer Lineage', crumb: 'conceptAnswerLineage' },
    { path: 'app/concepts/smart-matcher/page.tsx', term: 'Smart Matcher', crumb: 'conceptSmartMatcher' },
  ]
  for (const c of concepts) {
    const source = await read(c.path)
    assert.match(source, /import \{ BREADCRUMBS, definedTerm \} from '@\/lib\/jsonld'/, `${c.path} should import BREADCRUMBS + definedTerm`)
    assert.match(source, new RegExp(`BREADCRUMBS\\.${c.crumb}`), `${c.path} should use BREADCRUMBS.${c.crumb}`)
    assert.match(source, /definedTerm\(/, `${c.path} should call definedTerm()`)
    assert.match(source, /application\/ld\+json/, `${c.path} should render JSON-LD script tags`)
    assert.match(source, /alternates:\s*\{ canonical:/, `${c.path} should have canonical metadata`)
  }
})

test('3 guide pages exist with HowTo + BreadcrumbList JSON-LD', async () => {
  const guides = [
    { path: 'app/guides/how-to-reuse-application-answers/page.tsx', crumb: 'guideReuseAnswers' },
    { path: 'app/guides/how-to-compare-accelerator-fit/page.tsx', crumb: 'guideCompareFit' },
    { path: 'app/guides/how-to-build-an-answer-bank/page.tsx', crumb: 'guideBuildAnswerBank' },
  ]
  for (const g of guides) {
    const source = await read(g.path)
    assert.match(source, /import \{ BREADCRUMBS, howTo \} from '@\/lib\/jsonld'/, `${g.path} should import BREADCRUMBS + howTo`)
    assert.match(source, new RegExp(`BREADCRUMBS\\.${g.crumb}`), `${g.path} should use BREADCRUMBS.${g.crumb}`)
    assert.match(source, /howTo\(/, `${g.path} should call howTo()`)
    assert.match(source, /application\/ld\+json/, `${g.path} should render JSON-LD script tags`)
    assert.match(source, /alternates:\s*\{ canonical:/, `${g.path} should have canonical metadata`)
  }
})

test('3 comparison pages exist with Article + BreadcrumbList JSON-LD', async () => {
  const comparisons = [
    { path: 'app/vs/founderapp/page.tsx', crumb: 'vsFounderApp' },
    { path: 'app/vs/manual-application-tracking/page.tsx', crumb: 'vsManualTracking' },
    { path: 'app/vs/spreadsheets-for-applications/page.tsx', crumb: 'vsSpreadsheets' },
  ]
  for (const c of comparisons) {
    const source = await read(c.path)
    assert.match(source, /import \{ BREADCRUMBS, comparisonArticle \} from '@\/lib\/jsonld'/, `${c.path} should import BREADCRUMBS + comparisonArticle`)
    assert.match(source, new RegExp(`BREADCRUMBS\\.${c.crumb}`), `${c.path} should use BREADCRUMBS.${c.crumb}`)
    assert.match(source, /comparisonArticle\(/, `${c.path} should call comparisonArticle()`)
    assert.match(source, /application\/ld\+json/, `${c.path} should render JSON-LD script tags`)
    assert.match(source, /alternates:\s*\{ canonical:/, `${c.path} should have canonical metadata`)
  }
})

test('application-infrastructure topic hub exists with ItemList + BreadcrumbList', async () => {
  const source = await read('app/application-infrastructure/page.tsx')
  assert.match(source, /import \{ BREADCRUMBS, itemList \} from '@\/lib\/jsonld'/, 'hub should import BREADCRUMBS + itemList')
  assert.match(source, /BREADCRUMBS\.applicationInfrastructure/, 'hub should use BREADCRUMBS.applicationInfrastructure')
  assert.match(source, /itemList\(/, 'hub should call itemList()')
  assert.match(source, /application\/ld\+json/, 'hub should render JSON-LD script tags')
  assert.match(source, /alternates:\s*\{ canonical:/, 'hub should have canonical metadata')
})

test('sitemap includes all Phase 3 content pages', async () => {
  const sitemap = await read('app/sitemap.ts')
  const paths = [
    '/application-infrastructure',
    '/concepts/answer-reuse',
    '/concepts/fit-score',
    '/concepts/application-graph',
    '/concepts/answer-lineage',
    '/concepts/smart-matcher',
    '/guides/how-to-reuse-application-answers',
    '/guides/how-to-compare-accelerator-fit',
    '/guides/how-to-build-an-answer-bank',
    '/vs/founderapp',
    '/vs/manual-application-tracking',
    '/vs/spreadsheets-for-applications',
  ]
  for (const p of paths) {
    assert.match(sitemap, new RegExp(p.replace(/\//g, '\\/')), `sitemap should include ${p}`)
  }
})

test('llms.txt includes all Phase 3 content pages', async () => {
  const llms = await read('public/llms.txt')
  const paths = [
    '/application-infrastructure',
    '/concepts/answer-reuse',
    '/concepts/fit-score',
    '/concepts/application-graph',
    '/concepts/answer-lineage',
    '/concepts/smart-matcher',
    '/guides/how-to-reuse-application-answers',
    '/guides/how-to-compare-accelerator-fit',
    '/guides/how-to-build-an-answer-bank',
    '/vs/founderapp',
    '/vs/manual-application-tracking',
    '/vs/spreadsheets-for-applications',
  ]
  for (const p of paths) {
    assert.match(llms, new RegExp(p.replace(/\//g, '\\/')), `llms.txt should include ${p}`)
  }
})

test('Markdown content exists for all Phase 3 pages', () => {
  const paths = [
    '/application-infrastructure',
    '/concepts/answer-reuse',
    '/concepts/fit-score',
    '/concepts/application-graph',
    '/concepts/answer-lineage',
    '/concepts/smart-matcher',
    '/guides/how-to-reuse-application-answers',
    '/guides/how-to-compare-accelerator-fit',
    '/guides/how-to-build-an-answer-bank',
    '/vs/founderapp',
    '/vs/manual-application-tracking',
    '/vs/spreadsheets-for-applications',
  ]
  for (const p of paths) {
    const body = MARKDOWN_PAGES[p]
    assert.ok(body, `missing Markdown for ${p}`)
    assert.match(body, /^# /, `${p} Markdown should start with H1`)
    assert.ok(body.length > 200, `${p} Markdown is too thin (${body?.length ?? 0} chars)`)
  }
})

// ─── Phase 4c + 5b: IndexNow + Security headers ────────────────────────────

test('IndexNow API route exists with POST handler and domain validation', async () => {
  const source = await read('app/api/indexnow/route.ts')
  assert.match(source, /export async function POST/, 'indexnow route should export POST handler')
  assert.match(source, /export async function GET/, 'indexnow route should export GET handler for status')
  assert.match(source, /mos2es\.xyz/, 'indexnow route should validate mos2es.xyz URLs only')
  assert.match(source, /INDEXNOW_KEY/, 'indexnow route should reference the key')
  assert.match(source, /api\.indexnow\.org/, 'indexnow route should forward to IndexNow API')
  assert.match(source, /rejected/, 'indexnow route should track rejected URLs')
})

test('IndexNow key file exists in public directory', async () => {
  const fs = await import('node:fs/promises')
  const keyPath = new URL('../public/f1f880e1830342be8c1180ee9a7cfb41.txt', import.meta.url)
  const key = (await fs.readFile(keyPath, 'utf-8')).trim()
  assert.equal(key, 'f1f880e1830342be8c1180ee9a7cfb41', 'IndexNow key file should contain the key')
})

test('IndexNow push script exists', async () => {
  const fs = await import('node:fs/promises')
  const scriptPath = new URL('../../scripts/indexnow-push.mjs', import.meta.url)
  const source = await fs.readFile(scriptPath, 'utf-8')
  assert.match(source, /mos2es\.xyz/, 'push script should target mos2es.xyz')
  assert.match(source, /api\/indexnow/, 'push script should call the API route')
  assert.match(source, /sitemap\.xml/, 'push script should fetch sitemap URLs')
  assert.match(source, /dry-run/, 'push script should support --dry-run flag')
})

test('next.config.mjs includes security headers', async () => {
  const source = await read('next.config.mjs')
  assert.match(source, /X-Content-Type-Options/, 'should set X-Content-Type-Options: nosniff')
  assert.match(source, /X-Frame-Options/, 'should set X-Frame-Options: DENY')
  assert.match(source, /Referrer-Policy/, 'should set Referrer-Policy')
  assert.match(source, /Permissions-Policy/, 'should set Permissions-Policy')
  assert.match(source, /Strict-Transport-Security/, 'should set HSTS')
  assert.match(source, /Content-Security-Policy/, 'should set CSP')
  assert.match(source, /object-src 'none'/, 'CSP should block object-src')
  assert.match(source, /frame-src/, 'CSP should allow frame-src for Stripe')
})
