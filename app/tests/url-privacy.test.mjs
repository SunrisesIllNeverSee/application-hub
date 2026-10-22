// M09 hardening M5: ?url= deep links never reach analytics, Referer or the
// login `next` parameter. Run: node --test tests/url-privacy.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import {
  planUrlFragmentRedirect, stripUrlFromNext, readUrlFragment, analyticsSafeUrl, sanitizeAnalyticsProperties,
  EARLY_URL_STRIP_SCRIPT, GA4_QUERYLESS_ROUTE_RE, encodePendingUrl, decodePendingUrl, PENDING_URL_TTL_MS,
} from '../lib/url-privacy.ts'

const LINK = 'https://forms.example.org/apply?token=SECRET-123&draft=9'

test('middleware plan: ?url= moves into the fragment; /apply gains path=url; other params kept', () => {
  const p = planUrlFragmentRedirect(`?url=${encodeURIComponent(LINK)}&program=x`, { pathname: '/apply' })
  assert.equal(p.search, '?program=x&path=url')
  assert.equal(p.fragment, `url=${encodeURIComponent(LINK)}`)
  assert.equal(readUrlFragment(`#${p.fragment}`), LINK)
  assert.ok(!p.search.includes('SECRET'))
  assert.equal(planUrlFragmentRedirect('?program=x', { pathname: '/apply' }), null, 'no url → no redirect')
  assert.equal(planUrlFragmentRedirect('', { pathname: '/apply' }), null)
  const other = planUrlFragmentRedirect(`?url=${encodeURIComponent(LINK)}`, { pathname: '/review' })
  assert.equal(other.search, '')
})

test('middleware plan: url= nested in next= is stripped from next and carried in the fragment', () => {
  const next = `/apply?url=${encodeURIComponent(LINK)}&path=url`
  const p = planUrlFragmentRedirect(`?next=${encodeURIComponent(next)}`, { pathname: '/login' })
  assert.equal(new URLSearchParams(p.search).get('next'), '/apply?path=url')
  assert.equal(readUrlFragment(`#${p.fragment}`), LINK)
  assert.ok(!decodeURIComponent(p.search).includes('SECRET'))
})

test('login next never carries url=', () => {
  assert.equal(stripUrlFromNext(`/apply?url=${encodeURIComponent(LINK)}&path=url`), '/apply?path=url')
  assert.equal(stripUrlFromNext('/apply?url=x'), '/apply')
  assert.equal(stripUrlFromNext('/review/LA-1'), '/review/LA-1')
})

test('analytics URLs drop url/next params and #url= fragments; others untouched', () => {
  assert.equal(analyticsSafeUrl(`https://aquaidp.xyz/apply?url=${encodeURIComponent(LINK)}&path=url`), 'https://aquaidp.xyz/apply?path=url')
  assert.equal(analyticsSafeUrl(`https://aquaidp.xyz/apply?path=url#url=${encodeURIComponent(LINK)}`), 'https://aquaidp.xyz/apply?path=url')
  assert.equal(analyticsSafeUrl(`https://aquaidp.xyz/login?next=${encodeURIComponent('/apply?url=x')}`), 'https://aquaidp.xyz/login')
  assert.equal(analyticsSafeUrl('/apply?url=x&a=1'), '/apply?a=1')
  assert.equal(analyticsSafeUrl('https://aquaidp.xyz/programs?tab=open#section'), 'https://aquaidp.xyz/programs?tab=open#section')
  assert.equal(analyticsSafeUrl('not a url'), 'not a url')
  assert.equal(analyticsSafeUrl('$direct'), '$direct')
})

test('PostHog before_send sanitizer covers every URL-valued property incl. $set/$set_once', () => {
  const props = {
    $current_url: `https://aquaidp.xyz/apply?path=url#url=${encodeURIComponent(LINK)}`,
    $referrer: `https://aquaidp.xyz/login?next=${encodeURIComponent('/apply?url=x')}`,
    $initial_current_url: `https://aquaidp.xyz/apply?url=${encodeURIComponent(LINK)}`,
    $set_once: { $initial_current_url: `https://aquaidp.xyz/apply?url=${encodeURIComponent(LINK)}` },
    other: 'kept',
  }
  sanitizeAnalyticsProperties(props)
  assert.ok(!JSON.stringify(props).includes('SECRET'))
  assert.ok(!JSON.stringify(props).includes('forms.example.org'))
  assert.equal(props.other, 'kept')
  assert.equal(sanitizeAnalyticsProperties(null), null)
})

test('GA4 queryless routes: /apply and /review only', () => {
  for (const p of ['/apply', '/apply/', '/review', '/review/LA-1']) assert.ok(GA4_QUERYLESS_ROUTE_RE.test(p), p)
  for (const p of ['/applications', '/reviewers', '/']) assert.ok(!GA4_QUERYLESS_ROUTE_RE.test(p), p)
})

test('early inline script mirrors the middleware plan (runs before analytics)', () => {
  const run = (href) => {
    const u = new URL(href)
    let replaced = null
    const ctx = {
      URLSearchParams, encodeURIComponent,
      window: {
        location: { pathname: u.pathname, search: u.search, hash: u.hash },
        history: { state: null, replaceState: (_s, _t, url) => { replaced = url } },
      },
    }
    vm.runInNewContext(EARLY_URL_STRIP_SCRIPT, ctx)
    return replaced
  }
  const out = run(`https://aquaidp.xyz/apply?url=${encodeURIComponent(LINK)}&program=x`)
  const plan = planUrlFragmentRedirect(`?url=${encodeURIComponent(LINK)}&program=x`, { pathname: '/apply' })
  assert.equal(out, `/apply${plan.search}#${plan.fragment}`)
  const nested = run(`https://aquaidp.xyz/login?next=${encodeURIComponent(`/apply?url=${encodeURIComponent(LINK)}`)}`)
  assert.ok(!nested.split('#')[0].includes('forms.example.org'))
  assert.equal(readUrlFragment(`#${nested.split('#')[1]}`), LINK)
  assert.equal(run('https://aquaidp.xyz/programs?tab=x'), null, 'no-op without url=')
})

test('pending url across login expires', () => {
  const now = 1_000_000
  assert.equal(decodePendingUrl(encodePendingUrl(LINK, now), now + 1000), LINK)
  assert.equal(decodePendingUrl(encodePendingUrl(LINK, now), now + PENDING_URL_TTL_MS + 1), null)
  assert.equal(decodePendingUrl('garbage', now), null)
  assert.equal(decodePendingUrl(null, now), null)
})

test('wiring: middleware redirects before auth, strips url from next; PostHog + GA4 + layout + ApplyStart wired', () => {
  const mw = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8')
  const planAt = mw.indexOf('planUrlFragmentRedirect(request.nextUrl.search')
  assert.ok(planAt > 0 && planAt < mw.indexOf('supabase.auth.getUser()'), 'fragment redirect runs before any auth / rendering')
  assert.match(mw, /stripUrlFromNext\(pathname \+ request\.nextUrl\.search\)/)
  assert.doesNotMatch(mw, /searchParams\.set\('next', pathname \+ request\.nextUrl\.search\)/)
  const ph = readFileSync(new URL('../lib/posthog/client.ts', import.meta.url), 'utf8')
  assert.match(ph, /before_send:/)
  assert.match(ph, /sanitizeAnalyticsProperties/)
  const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8')
  assert.match(layout, /EARLY_URL_STRIP_SCRIPT/)
  assert.ok(layout.indexOf('EARLY_URL_STRIP_SCRIPT }}') < layout.indexOf('googletagmanager'), 'strip script precedes GA4')
  assert.match(layout, /page_location=location\.origin\+location\.pathname/)
  const apply = readFileSync(new URL('../components/journey/ApplyStart.tsx', import.meta.url), 'utf8')
  assert.match(apply, /readUrlFragment\(window\.location\.hash\)/)
  const login = readFileSync(new URL('../app/(auth)/login/LoginClient.tsx', import.meta.url), 'utf8') // client half of /login (page.tsx is the SSR noscript wrapper)
  assert.match(login, /PENDING_URL_FRAGMENT_KEY/)
})
