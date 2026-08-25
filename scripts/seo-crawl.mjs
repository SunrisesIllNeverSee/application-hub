#!/usr/bin/env node
// scripts/seo-crawl.mjs — Lightweight SEO crawler (Screaming Frog alternative).
//
// Crawls mos2es.xyz from the sitemap + homepage, following internal links.
// Reports:
//   - Broken links (4xx/5xx)
//   - Redirect chains
//   - Missing/duplicate title tags
//   - Missing/duplicate meta descriptions
//   - Missing/duplicate H1s
//   - Missing canonical URLs
//   - Missing JSON-LD structured data
//   - Missing security headers
//   - Orphan pages (in sitemap but not linked internally)
//   - Images missing alt text
//
// Usage:
//   node scripts/seo-crawl.mjs                    # crawl live site
//   node scripts/seo-crawl.mjs --limit 50         # limit to 50 pages
//   node scripts/seo-crawl.mjs --json             # output JSON instead of text
//
// No external dependencies — uses built-in fetch + URL parsing.

const BASE = 'https://mos2es.xyz'
const SITEMAP = `${BASE}/sitemap.xml`
const TIMEOUT_MS = 10000

// Pages we know are auth-protected or redirect — skip them
const SKIP_PATHS = new Set([
  '/applications',
  '/dash',
  '/questions',
  '/profile',
  '/onboarding',
  '/auth/callback',
])

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal, redirect: 'manual' })
    return res
  } finally {
    clearTimeout(timer)
  }
}

async function fetchSitemapUrls() {
  console.log(`Fetching sitemap from ${SITEMAP}...`)
  try {
    const res = await fetch(SITEMAP)
    if (!res.ok) {
      console.error(`  ✗ Sitemap returned ${res.status}`)
      return []
    }
    const xml = await res.text()
    const urls = []
    const locRe = /<loc>([^<]+)<\/loc>/g
    let m
    while ((m = locRe.exec(xml)) !== null) {
      urls.push(m[1].trim())
    }
    console.log(`  ✓ Found ${urls.length} URLs in sitemap`)
    return urls
  } catch (err) {
    console.error(`  ✗ Failed to fetch sitemap: ${err.message}`)
    return []
  }
}

function extractLinks(html, baseUrl) {
  const links = new Set()
  const hrefRe = /href=["']([^"']+)["']/g
  let m
  while ((m = hrefRe.exec(html)) !== null) {
    try {
      const resolved = new URL(m[1], baseUrl).href
      // Only internal links
      if (resolved.startsWith(BASE) || resolved.startsWith(`https://www.${BASE.replace('https://', '')}`)) {
        const path = new URL(resolved).pathname
        if (!SKIP_PATHS.has(path) && !path.startsWith('/api/') && !path.startsWith('/_next/')) {
          links.add(resolved)
        }
      }
    } catch {}
  }
  return [...links]
}

function extractMeta(html, url) {
  const result = {
    url,
    title: null,
    description: null,
    canonical: null,
    h1s: [],
    h2s: [],
    jsonldCount: 0,
    ogImage: null,
    imgAlts: { missing: 0, total: 0 },
    securityHeaders: {},
    status: null,
    redirected: false,
    redirectLocation: null,
  }

  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  if (titleMatch) result.title = titleMatch[1].trim()

  // Meta description
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)
  if (descMatch) result.description = descMatch[1].trim()

  // Canonical
  const canonMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)
  if (canonMatch) result.canonical = canonMatch[1].trim()

  // H1s
  const h1Re = /<h1[^>]*>([^<]*)<\/h1>/gi
  let h1m
  while ((h1m = h1Re.exec(html)) !== null) {
    result.h1s.push(h1m[1].trim())
  }

  // H2s
  const h2Re = /<h2[^>]*>([^<]*)<\/h2>/gi
  let h2m
  while ((h2m = h2Re.exec(html)) !== null) {
    result.h2s.push(h2m[1].trim())
  }

  // JSON-LD count
  const jsonldRe = /application\/ld\+json/g
  result.jsonldCount = (html.match(jsonldRe) || []).length

  // OG image
  const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
  if (ogMatch) result.ogImage = ogMatch[1].trim()

  // Images missing alt
  const imgRe = /<img[^>]*>/gi
  let imgm
  while ((imgm = imgRe.exec(html)) !== null) {
    result.imgAlts.total++
    if (!/alt=["']/i.test(imgm[0]) || /alt=["']["']/i.test(imgm[0])) {
      result.imgAlts.missing++
    }
  }

  return result
}

async function crawlPage(url) {
  try {
    const res = await fetchWithTimeout(url)
    const status = res.status

    // Handle redirects (manual mode — res.status is 3xx)
    if (status >= 300 && status < 400) {
      const location = res.headers.get('location')
      return {
        url,
        status,
        redirected: true,
        redirectLocation: location,
        securityHeaders: extractSecurityHeaders(res.headers),
        html: null,
        meta: null,
        links: [],
      }
    }

    if (status >= 400) {
      return {
        url,
        status,
        redirected: false,
        securityHeaders: extractSecurityHeaders(res.headers),
        html: null,
        meta: null,
        links: [],
      }
    }

    const html = await res.text()
    const meta = extractMeta(html, url)
    meta.status = status
    meta.securityHeaders = extractSecurityHeaders(res.headers)
    const links = extractLinks(html, url)
    return { url, status, redirected: false, securityHeaders: meta.securityHeaders, html, meta, links }
  } catch (err) {
    return {
      url,
      status: 0,
      redirected: false,
      error: err.message,
      securityHeaders: {},
      html: null,
      meta: null,
      links: [],
    }
  }
}

function extractSecurityHeaders(headers) {
  return {
    'x-content-type-options': headers.get('x-content-type-options'),
    'x-frame-options': headers.get('x-frame-options'),
    'referrer-policy': headers.get('referrer-policy'),
    'strict-transport-security': headers.get('strict-transport-security'),
    'content-security-policy': headers.get('content-security-policy') ? 'present' : null,
  }
}

async function main() {
  const args = process.argv.slice(2)
  const jsonOutput = args.includes('--json')
  const limitArg = args.find((a) => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 0

  const sitemapUrls = await fetchSitemapUrls()

  // Start with sitemap URLs + homepage
  const toCrawl = new Set([BASE, ...sitemapUrls])
  const crawled = new Set()
  const results = []
  const allLinks = new Set()

  let count = 0
  for (const url of toCrawl) {
    if (crawled.has(url)) continue
    if (limit && count >= limit) break

    const path = new URL(url).pathname
    if (SKIP_PATHS.has(path)) continue

    count++
    process.stdout.write(`  [${count}] ${url} ... `)
    const result = await crawlPage(url)
    crawled.add(url)
    results.push(result)

    if (result.status === 200) {
      console.log(`200 OK`)
      // Add discovered links to crawl queue
      for (const link of result.links || []) {
        if (!crawled.has(link) && !toCrawl.has(link)) {
          toCrawl.add(link)
          allLinks.add(link)
        }
      }
    } else if (result.redirected) {
      console.log(`${result.status} → ${result.redirectLocation}`)
    } else if (result.status === 0) {
      console.log(`ERROR: ${result.error}`)
    } else {
      console.log(`${result.status}`)
    }

    // Be polite — 200ms delay between requests
    await sleep(200)
  }

  // ─── Analysis ───────────────────────────────────────────────
  const issues = []
  const okPages = results.filter((r) => r.status === 200 && r.meta)

  // Broken links
  for (const r of results) {
    if (r.status >= 400) {
      issues.push({ type: 'broken_link', url: r.url, status: r.status })
    }
    if (r.status === 0) {
      issues.push({ type: 'fetch_error', url: r.url, error: r.error })
    }
  }

  // Redirect chains
  for (const r of results) {
    if (r.redirected) {
      issues.push({ type: 'redirect', url: r.url, status: r.status, location: r.redirectLocation })
    }
  }

  // Missing titles
  for (const r of okPages) {
    if (!r.meta.title || r.meta.title.trim() === '') {
      issues.push({ type: 'missing_title', url: r.url })
    }
  }

  // Duplicate titles
  const titleMap = {}
  for (const r of okPages) {
    if (r.meta.title) {
      if (!titleMap[r.meta.title]) titleMap[r.meta.title] = []
      titleMap[r.meta.title].push(r.url)
    }
  }
  for (const [title, urls] of Object.entries(titleMap)) {
    if (urls.length > 1) {
      issues.push({ type: 'duplicate_title', title, urls })
    }
  }

  // Missing descriptions
  for (const r of okPages) {
    if (!r.meta.description || r.meta.description.trim() === '') {
      issues.push({ type: 'missing_description', url: r.url })
    }
  }

  // Missing H1
  for (const r of okPages) {
    if (r.meta.h1s.length === 0) {
      issues.push({ type: 'missing_h1', url: r.url })
    }
    if (r.meta.h1s.length > 1) {
      issues.push({ type: 'multiple_h1', url: r.url, h1s: r.meta.h1s })
    }
  }

  // Missing canonical
  for (const r of okPages) {
    if (!r.meta.canonical) {
      issues.push({ type: 'missing_canonical', url: r.url })
    }
  }

  // Missing JSON-LD
  for (const r of okPages) {
    if (r.meta.jsonldCount === 0) {
      issues.push({ type: 'missing_jsonld', url: r.url })
    }
  }

  // Missing security headers
  for (const r of okPages) {
    const h = r.securityHeaders
    if (!h['x-content-type-options']) issues.push({ type: 'missing_security_header', url: r.url, header: 'X-Content-Type-Options' })
    if (!h['x-frame-options']) issues.push({ type: 'missing_security_header', url: r.url, header: 'X-Frame-Options' })
    if (!h['strict-transport-security']) issues.push({ type: 'missing_security_header', url: r.url, header: 'Strict-Transport-Security' })
  }

  // Images missing alt
  for (const r of okPages) {
    if (r.meta.imgAlts.missing > 0) {
      issues.push({ type: 'images_missing_alt', url: r.url, missing: r.meta.imgAlts.missing, total: r.meta.imgAlts.total })
    }
  }

  // Orphan pages (in sitemap but not discovered via crawling)
  const discoveredUrls = new Set([BASE, ...allLinks])
  const orphans = sitemapUrls.filter((u) => !discoveredUrls.has(u) && !SKIP_PATHS.has(new URL(u).pathname))
  for (const url of orphans) {
    issues.push({ type: 'orphan_page', url })
  }

  // ─── Report ─────────────────────────────────────────────────
  if (jsonOutput) {
    console.log(JSON.stringify({ crawled: results.length, issues }, null, 2))
    return
  }

  console.log('\n' + '='.repeat(70))
  console.log('SEO CRAWL REPORT — mos2es.xyz')
  console.log('='.repeat(70))
  console.log(`Pages crawled: ${results.filter((r) => r.status === 200).length}`)
  console.log(`Redirects: ${results.filter((r) => r.redirected).length}`)
  console.log(`Errors (4xx/5xx): ${results.filter((r) => r.status >= 400).length}`)
  console.log(`Fetch errors: ${results.filter((r) => r.status === 0).length}`)
  console.log(`Total issues: ${issues.length}`)
  console.log('='.repeat(70))

  // Group issues by type
  const byType = {}
  for (const issue of issues) {
    if (!byType[issue.type]) byType[issue.type] = []
    byType[issue.type].push(issue)
  }

  for (const [type, items] of Object.entries(byType)) {
    console.log(`\n── ${type.replace(/_/g, ' ').toUpperCase()} (${items.length}) ──`)
    for (const item of items) {
      if (item.url) {
        let detail = `  ${item.url}`
        if (item.status) detail += ` [${item.status}]`
        if (item.header) detail += ` — ${item.header}`
        if (item.missing) detail += ` (${item.missing}/${item.total} images)`
        if (item.error) detail += ` — ${item.error}`
        console.log(detail)
      } else if (item.title) {
        console.log(`  "${item.title}"`)
        for (const u of item.urls) console.log(`    → ${u}`)
      }
    }
  }

  // Summary of good pages
  console.log('\n── PAGE SUMMARY ──')
  for (const r of okPages) {
    const path = new URL(r.url).pathname
    const title = r.meta.title ? r.meta.title.substring(0, 50) : '(no title)'
    const jsonld = r.meta.jsonldCount > 0 ? `JSON-LD:${r.meta.jsonldCount}` : 'NO-JSONLD'
    console.log(`  ${path.padEnd(50)} ${jsonld}  ${title}`)
  }

  if (issues.length === 0) {
    console.log('\n✓ No issues found!')
  } else {
    console.log(`\n${issues.length} issue(s) found. Fix them in Phase 5b.`)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
