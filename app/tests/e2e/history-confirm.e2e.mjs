// M09b — browser walk of the "Confirm submitted history" screen, driven
// against the DEV harness (/dev/history-harness: synthetic in-memory vault,
// no login).
//
//   1. start:  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy \
//              NEXT_PUBLIC_AQUA_LOCAL_FIRST=1 AQUA_LOCAL_FIRST=1 npx next dev -p 3458        (from app/)
//   2. run:    node tests/e2e/history-confirm.e2e.mjs
//      env:    HISTORY_BASE_URL (default http://localhost:3458)
//              PLAYWRIGHT_MODULE (path to a playwright package dir when
//              `playwright` is not resolvable from app/, e.g. the npx cache)
//              SHOTS_DIR (default ../docs/evidence/m09b)
//
// Runs at 1440×900 and 390×844. Every request leaving localhost is aborted.

import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const here = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.HISTORY_BASE_URL ?? 'http://localhost:3458'
const SHOTS = path.resolve(process.env.SHOTS_DIR ?? path.join(here, '../../../docs/evidence/m09b'))

async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    if (!process.env.PLAYWRIGHT_MODULE) throw new Error('playwright not found — set PLAYWRIGHT_MODULE to a playwright package dir')
    const req = createRequire(path.join(process.env.PLAYWRIGHT_MODULE, 'package.json'))
    return req(process.env.PLAYWRIGHT_MODULE)
  }
}

const results = []
async function step(name, fn) {
  const t = Date.now()
  try {
    await fn()
    results.push({ name, ok: true, ms: Date.now() - t })
    console.log(`PASS ${name}`)
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t, error: String(e?.message ?? e).split('\n')[0] })
    console.error(`FAIL ${name}: ${e?.stack ?? e}`)
    process.exitCode = 1
  }
}

const SHOT_CSS = '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important} nextjs-portal{display:none!important}'
async function shot(page, name, opts = {}) {
  await page.addStyleTag({ content: SHOT_CSS }).catch(() => {})
  if (opts.at) await page.locator(opts.at).first().scrollIntoViewIfNeeded().catch(() => {})
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: opts.fullPage ?? false })
}

const item = (page, question) => page.locator('[data-testid=history-item]', { hasText: question }).first()

async function runViewport(browser, label, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: label === 'mobile' ? 2 : 1 })
  await ctx.route('**/*', (route) => {
    const u = new URL(route.request().url())
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.protocol === 'blob:' || u.protocol === 'data:') return route.continue()
    return route.abort()
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${BASE}/dev/history-harness`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid=history-ready]').waitFor({ timeout: 90_000 })
  const P = (s) => `${label}-${s}`

  await step(`${label}: history is grouped by application and submission date with exact wording`, async () => {
    assert.equal(await page.locator('[data-testid=history-group]').count(), 3)
    const programs = await page.locator('[data-testid=history-group-program]').allInnerTexts()
    assert.deepEqual(programs, ['Synthetic Founders Fellowship', 'Example Climate Grant', 'Example Climate Grant'])
    const dates = await page.locator('[data-testid=history-group-date]').allInnerTexts()
    assert.match(dates[0], /Submitted .*2025/)
    assert.match(dates[2], /unknown/i)
    assert.equal(await page.locator('[data-testid=history-item]').count(), 6)
    await item(page, 'What are you building? (150 words)').waitFor()
    await shot(page, P('01-history-list'), { fullPage: true })
  })

  await step(`${label}: nothing is preselected and the confirm button is disabled`, async () => {
    const boxes = page.locator('[data-testid=history-select]')
    for (let i = 0; i < (await boxes.count()); i++) assert.equal(await boxes.nth(i).isChecked(), false)
    assert.equal(await page.locator('[data-testid=attest-check]').isChecked(), false)
    assert.equal(await page.locator('[data-testid=confirm-history]').isDisabled(), true)
  })

  await step(`${label}: placeholder and unknown-date items are disabled with the reason shown`, async () => {
    const ph = item(page, 'What traction do you have?')
    assert.equal(await ph.locator('[data-testid=history-select]').isDisabled(), true)
    assert.match(await ph.locator('[data-testid=history-reason]').innerText(), /placeholder/i)
    const unknown = item(page, 'What would you do with the funding?')
    assert.equal(await unknown.locator('[data-testid=history-select]').isDisabled(), true)
    assert.match(await unknown.locator('[data-testid=history-reason]').innerText(), /--date YYYY-MM-DD/)
    await shot(page, P('02-placeholder-disabled'), { at: '[data-testid=history-reason]' })
  })

  await step(`${label}: selecting is not enough — the attestation must be ticked`, async () => {
    await item(page, 'What are you building? (150 words)').locator('[data-testid=history-select]').check()
    await item(page, 'Describe the problem you are solving.').locator('[data-testid=history-select]').check()
    assert.equal(await page.locator('[data-testid=confirm-history]').isDisabled(), true)
    assert.match(await page.locator('[data-testid=confirm-hint]').innerText(), /attestation/i)
    await page.locator('[data-testid=attest-check]').check()
    assert.equal(await page.locator('[data-testid=confirm-history]').isEnabled(), true)
    assert.match(await page.locator('[data-testid=confirm-history]').innerText(), /\(2\)/)
    await shot(page, P('03-attest-ready'), { at: '[data-testid=attest-panel]' })
  })

  await step(`${label}: confirming 2 items marks them confirmed as of their submission date`, async () => {
    await page.locator('[data-testid=confirm-history]').click()
    await page.locator('[data-testid=history-result][data-ok=true]').nth(1).waitFor({ timeout: 30_000 })
    assert.equal(await page.locator('[data-testid=history-result][data-ok=false]').count(), 0)
    await page.locator('[data-testid=history-item][data-status=confirmed]').nth(1).waitFor({ timeout: 30_000 })
    assert.equal(await page.locator('[data-testid=history-item][data-status=confirmed]').count(), 2)
    const a = item(page, 'What are you building? (150 words)')
    assert.match(await a.locator('[data-testid=history-status]').innerText(), /Confirmed as submitted.*2025/)
    assert.equal(await a.locator('[data-testid=history-select]').isDisabled(), true)
    // selection and attestation reset after a confirmation
    assert.equal(await page.locator('[data-testid=attest-check]').isChecked(), false)
    assert.equal(await page.locator('[data-testid=confirm-history]').isDisabled(), true)
    await shot(page, P('04-confirmed'), { fullPage: true })
  })

  await step(`${label}: no page errors`, async () => {
    assert.deepEqual(errors, [])
  })
  await ctx.close()
}

await mkdir(SHOTS, { recursive: true })
const { chromium } = await loadPlaywright()
const browser = await chromium.launch()
try {
  await runViewport(browser, 'desktop', { width: 1440, height: 900 })
  await runViewport(browser, 'mobile', { width: 390, height: 844 })
} finally {
  await browser.close()
}
await writeFile(path.join(SHOTS, 'history-confirm-e2e.json'), `${JSON.stringify({ base: 'local next dev (dev harness, synthetic data)', results }, null, 2)}\n`)
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} steps passed`)
