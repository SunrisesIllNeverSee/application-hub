#!/usr/bin/env node
// scripts/indexnow-push.mjs — Push sitemap URLs to IndexNow via the AQUA API route.
//
// Usage:
//   node scripts/indexnow-push.mjs                    # push all sitemap URLs
//   node scripts/indexnow-push.mjs /faq /about        # push specific paths
//   node scripts/indexnow-push.mjs --dry-run          # print URLs without submitting
//
// Requires the deployed site to be live (calls https://mos2es.xyz/api/indexnow).

const HOST = 'mos2es.xyz'
const BASE = `https://${HOST}`
const API = `${BASE}/api/indexnow`
const SITEMAP = `${BASE}/sitemap.xml`

async function fetchSitemapUrls() {
  const res = await fetch(SITEMAP)
  if (!res.ok) {
    throw new Error(`Failed to fetch sitemap: ${res.status} ${res.statusText}`)
  }
  const xml = await res.text()
  const urls = []
  const locRe = /<loc>([^<]+)<\/loc>/g
  let m
  while ((m = locRe.exec(xml)) !== null) {
    urls.push(m[1].trim())
  }
  return urls
}

async function pushUrls(urls, dryRun = false) {
  if (dryRun) {
    console.log(`[dry-run] Would push ${urls.length} URL(s):`)
    for (const u of urls) console.log(`  ${u}`)
    return
  }

  // Batch in groups of 100 (IndexNow allows up to 10,000 but 100 is safer)
  const BATCH = 100
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH)
    console.log(`Pushing batch ${Math.floor(i / BATCH) + 1} (${batch.length} URLs)...`)

    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: batch }),
    })

    const body = await res.json().catch(() => ({}))

    if (res.ok) {
      console.log(`  ✓ Submitted ${body.count ?? batch.length} URL(s)`)
      if (body.rejected?.length) {
        console.log(`  ⚠ Rejected ${body.rejected.length}: ${body.rejected.slice(0, 5).join(', ')}...`)
      }
    } else {
      console.error(`  ✗ Failed: ${res.status} ${body.error ?? res.statusText}`)
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const paths = args.filter((a) => !a.startsWith('--'))

  let urls
  if (paths.length > 0) {
    urls = paths.map((p) => (p.startsWith('http') ? p : `${BASE}${p.startsWith('/') ? '' : '/'}${p}`))
  } else {
    console.log(`Fetching sitemap from ${SITEMAP}...`)
    urls = await fetchSitemapUrls()
  }

  console.log(`Total URLs: ${urls.length}`)
  await pushUrls(urls, dryRun)
  console.log('Done.')
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
