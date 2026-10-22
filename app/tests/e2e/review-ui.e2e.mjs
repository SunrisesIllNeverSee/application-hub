// M09 W5 — browser tests for the evidence-based review UI, driven against the
// DEV harness (/dev/review-harness: synthetic in-memory vault, no login).
//
//   1. start:  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy \
//              NEXT_PUBLIC_AQUA_LOCAL_FIRST=1 npx next dev -p 3457        (from app/)
//   2. run:    node tests/e2e/review-ui.e2e.mjs
//      env:    REVIEW_BASE_URL (default http://localhost:3457)
//              PLAYWRIGHT_MODULE (path to a playwright package dir, when
//              `playwright` is not resolvable from app/ — it is not an app
//              dependency; e.g. the npx cache dir of `npx playwright`)
//              SHOTS_DIR (default ../docs/evidence/m09-review-ui)
//
// Runs at 1440×900 and 390×844. Every request leaving localhost is aborted,
// so nothing (not even synthetic text) can reach a third party.

import { createRequire } from 'node:module'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import os from 'node:os'

const here = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.REVIEW_BASE_URL ?? 'http://localhost:3457'
const SHOTS = path.resolve(process.env.SHOTS_DIR ?? path.join(here, '../../../docs/evidence/m09-review-ui'))
// Exported HTML / decision files (synthetic) go to the OS temp dir, not docs/.
const TMP = path.join(os.tmpdir(), 'aqua-review-e2e')

async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    if (!process.env.PLAYWRIGHT_MODULE) throw new Error('playwright not found — set PLAYWRIGHT_MODULE to a playwright package dir')
    const req = createRequire(path.join(process.env.PLAYWRIGHT_MODULE, 'package.json'))
    return req(process.env.PLAYWRIGHT_MODULE)
  }
}

// "Ask agent to revise" runs the real consented BYOK path against an
// Ollama-shaped provider at the CSP-allowed local endpoint. Playwright
// intercepts and fulfills those requests IN THE BROWSER, so nothing reaches
// any daemon that may be listening on that port (or any network at all).
const MOCK_URL = 'http://127.0.0.1:11434'
const mockRequests = []
const REVISED = 'Our two founders spent six years running clinic software support and shipped two scheduling tools (synthetic revision).'
async function mockProvider(ctx) {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' }
  await ctx.route(`${MOCK_URL}/**`, (route) => {
    const r = route.request()
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    mockRequests.push(r.postData() ?? '')
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ model: 'mock-model', message: { content: REVISED } }) })
  })
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

// Screenshots: no mid-transition colors, no Next.js dev overlay, and the
// card scrolled to the region the step is about ('top' or a selector).
const SHOT_CSS = '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important} nextjs-portal{display:none!important}'
async function shot(page, name, opts = {}) {
  await page.addStyleTag({ content: SHOT_CSS }).catch(() => {})
  if (opts.at) {
    await page.evaluate((w) => {
      const panel = document.querySelector('[data-testid=card-panel]')
      if (w === 'top') {
        if (panel) panel.scrollTop = 0
        window.scrollTo(0, 0)
        return
      }
      document.querySelector(w)?.scrollIntoView({ block: 'center' })
    }, opts.at)
  }
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: opts.fullPage ?? false })
}

async function openRow(page, text) {
  await page.locator('[data-testid=board-row]', { hasText: text }).first().click()
  await page.locator('[data-testid=review-card]').waitFor()
  await page.locator('[data-testid=answer-body], [data-testid=section-answer]').first().waitFor()
}

async function cardText(page, testId) {
  return (await page.locator(`[data-testid=review-card] [data-testid=${testId}]`).first().innerText()).trim()
}

async function closeCard(page) {
  await page.locator('[data-testid=card-close]').click()
  await page.locator('[data-testid=review-card]').waitFor({ state: 'detached' })
}

async function runViewport(browser, label, viewport) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true, deviceScaleFactor: label === 'mobile' ? 2 : 1 })
  await ctx.route('**/*', (route) => {
    const u = new URL(route.request().url())
    if (u.protocol === 'file:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.protocol === 'blob:' || u.protocol === 'data:') return route.continue()
    return route.abort()
  })
  await mockProvider(ctx) // registered last → matched first
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${BASE}/dev/review-harness?mockProvider=${encodeURIComponent(MOCK_URL)}`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid=harness-ready]').waitFor({ timeout: 60_000 })
  await page.locator('[data-testid=board-row]').first().waitFor()
  const P = (s) => `${label}-${s}`

  await step(`${label}: board lists every question with status, filters and progress`, async () => {
    assert.equal(await page.locator('[data-testid=board-row]').count(), 6)
    await page.getByText('Checking your answer bank').waitFor({ state: 'detached', timeout: 30_000 }).catch(() => {})
    await page.locator('[data-testid=board-row]', { hasText: 'Agent: Adapt' }).first().waitFor({ timeout: 30_000 })
    const progress = await page.locator('[data-testid=progress]').innerText()
    assert.match(progress, /0 of 6 approved/)
    await page.locator('[data-testid=filter-gaps]').click()
    assert.equal(await page.locator('[data-testid=board-row]').count(), 1)
    await page.locator('[data-testid=filter-all]').click()
    await shot(page, P('01-board'), { fullPage: label === 'desktop' })
  })

  let approvedSha = ''
  await step(`${label}: APPROVE requires confirm and binds the displayed version hash`, async () => {
    await openRow(page, 'Describe your company')
    const sha = await cardText(page, 'answer-sha')
    assert.match(sha, /^[0-9a-f]{64}$/)
    assert.match(await cardText(page, 'signal-approval'), /Not approved/)
    await page.locator('[data-testid=control-approve]').click()
    const bound = (await page.locator('[data-testid=approve-bound-sha]').innerText()).replace(/\s+/g, '')
    assert.equal(bound, sha, 'confirm step shows the exact displayed hash')
    await shot(page, P('02-approve-confirm'), { at: '[data-testid=approve-confirm]' })
    await page.locator('[data-testid=confirm-approve]').click()
    await page.locator('[data-testid=card-notice]', { hasText: 'Approved v1' }).waitFor()
    assert.match(await cardText(page, 'card-notice'), new RegExp(sha.slice(0, 12)))
    await page.locator('[data-testid=signal-approval]', { hasText: `sha256 ${sha.slice(0, 12)}` }).waitFor()
    approvedSha = sha
    await shot(page, P('03-approved'), { at: 'top' })
  })

  await step(`${label}: EDIT creates a new child version and the approval does not transfer`, async () => {
    await page.locator('[data-testid=control-edit]').click()
    await page.locator('[data-testid=edit-body]').fill('Example Labs builds a scheduling assistant for small veterinary clinics with one to five vets. (synthetic edit)')
    await page.locator('[data-testid=save-edit]').click()
    await page.locator('[data-testid=card-notice]', { hasText: 'Saved v2' }).waitFor()
    assert.match(await cardText(page, 'card-notice'), /NOT approved/)
    await page.locator('[data-testid=version-number]', { hasText: 'v2 of 2' }).waitFor()
    const newSha = await cardText(page, 'answer-sha')
    assert.notEqual(newSha, approvedSha)
    assert.match(await cardText(page, 'signal-approval'), /v1 was approved, v2 is not/)
    assert.doesNotMatch(await cardText(page, 'signal-status'), /Approved/)
    const lineage = await page.locator('[data-testid=lineage]').innerText()
    assert.match(lineage, /v2[\s\S]*child of v1/)
    assert.match(lineage, /Approved by human/)
    await shot(page, P('04-edited-not-approved'), { at: 'top' })
    await shot(page, P('04b-lineage'), { at: '[data-testid=lineage]' })
    if (label === 'mobile') await closeCard(page)
  })

  await step(`${label}: EVIDENCE / HELP request is recorded and is not an approval`, async () => {
    await openRow(page, 'Why is your team')
    assert.match(await cardText(page, 'signal-status'), /Suggested/)
    await page.locator('[data-testid=control-evidence]').click()
    await page.locator('[data-testid=evidence-tab-more]').click()
    await page.locator('[data-testid=request-text]').fill('Source for six years of clinic software support (synthetic)')
    await page.locator('[data-testid=submit-request]').click()
    await page.locator('[data-testid=card-notice]', { hasText: 'NOT an approval' }).waitFor()
    await page.locator('[data-testid=signal-status]', { hasText: 'Needs evidence' }).waitFor()
    assert.match(await cardText(page, 'signal-approval'), /^Not approved/)
    assert.match(await cardText(page, 'signal-review'), /Evidence requested/)
    // Attaching evidence is also not an approval.
    await page.locator('[data-testid=control-evidence]').click()
    await page.locator('[data-testid=evidence-title]').fill('Founder bio note (synthetic)')
    await page.locator('[data-testid=evidence-excerpt]').fill('Six years on a clinic-software support team (synthetic).')
    await page.locator('[data-testid=attach-evidence]').click()
    await page.locator('[data-testid=evidence-list]', { hasText: 'Founder bio note' }).waitFor()
    assert.match(await cardText(page, 'signal-approval'), /^Not approved/)
    await shot(page, P('05-evidence-request'), { at: 'top' })
    await shot(page, P('05b-evidence-linked'), { at: '[data-testid=evidence-list]' })
  })

  await step(`${label}: DISCUSS comment is bound to the displayed version, history labelled across versions`, async () => {
    await page.locator('[data-testid=control-discuss]').click()
    await page.locator('[data-testid=comment-body]').fill('Mention the two shipped scheduling tools by type (synthetic).')
    await page.locator('[data-testid=add-comment]').click()
    await page.locator('[data-testid=card-notice]', { hasText: 'Comment added on v1' }).waitFor()
    await page.locator('[data-testid=control-discuss]').click()
    await page.locator('[data-testid=comment]', { hasText: 'two shipped scheduling tools' }).locator('text=on v1').waitFor()
    if (label === 'mobile') await closeCard(page)
    await openRow(page, 'main competitors')
    await page.locator('[data-testid=control-discuss]').click()
    await page.locator('[data-testid=comment]', { hasText: 'competitor category' }).locator('text=on v1 (earlier version)').waitFor()
    await page.locator('[data-testid=comment-body]').fill('v2 reads better (synthetic).')
    await page.locator('[data-testid=add-comment]').click()
    await page.locator('[data-testid=card-notice]', { hasText: 'Comment added on v2' }).waitFor()
    await page.locator('[data-testid=control-discuss]').click()
    await page.locator('[data-testid=comment]', { hasText: 'v2 reads better' }).locator('text=on v2').waitFor()
    await shot(page, P('06-discuss-history'), { at: '[data-testid=comment-threads]' })
    if (label === 'mobile') await closeCard(page)
  })

  await step(`${label}: EDIT → "Ask agent to revise" (consented, local mock) creates a SUGGESTED child, never approved`, async () => {
    if (await page.locator('[data-testid=review-card]').count() && label === 'mobile') await closeCard(page)
    await openRow(page, 'Why is your team')
    await page.locator('[data-testid=control-edit]').click()
    await page.locator('[data-testid=tab-revise]').click()
    const instruction = 'Name the two scheduling tools by type (synthetic instruction).'
    await page.locator('[data-testid=revise-instruction]').fill(instruction)
    await page.getByRole('button', { name: 'Continue to consent' }).click()
    await page.getByText('Your revision instruction').waitFor()
    const before = mockRequests.length
    await page.getByRole('button', { name: /Authorize & revise via/ }).click()
    await page.locator('[data-testid=card-notice]', { hasText: 'Agent revision saved as v2' }).waitFor()
    assert.equal(mockRequests.length, before + 1, 'exactly one consented provider call')
    assert.ok(mockRequests.at(-1).includes(instruction), 'instruction sent to the provider')
    await page.locator('[data-testid=version-number]', { hasText: 'v2 of 2' }).waitFor()
    assert.match(await cardText(page, 'answer-body'), /synthetic revision/)
    assert.match(await cardText(page, 'signal-status'), /Suggested/)
    assert.match(await cardText(page, 'signal-approval'), /^Not approved/)
    await page.locator('[data-testid=evidence-list]', { hasText: 'Founder bio note' }).waitFor() // cited evidence carried to v2
    await shot(page, P('06b-agent-revision'), { at: 'top' })
    if (label === 'mobile') await closeCard(page)
  })

  await step(`${label}: one-at-a-time mode with next / previous`, async () => {
    if (await page.locator('[data-testid=review-card]').count()) await closeCard(page)
    await page.locator('[data-testid=toggle-one]').click()
    await page.locator('[data-testid=review-card]').waitFor()
    const first = await page.locator('[data-testid=review-card]').getAttribute('data-occ')
    await page.locator('[data-testid=card-next]').click()
    await page.waitForFunction((f) => document.querySelector('[data-testid=review-card]')?.getAttribute('data-occ') !== f, first)
    await page.locator('[data-testid=card-prev]').click()
    await page.waitForFunction((f) => document.querySelector('[data-testid=review-card]')?.getAttribute('data-occ') === f, first)
    await shot(page, P('07-one-at-a-time'), { at: 'top' })
    await page.locator('[data-testid=card-close]').click()
  })

  await step(`${label}: export HTML → decide offline → decision file → import → confirm`, async () => {
    await mkdir(TMP, { recursive: true })
    await page.locator('[data-testid=open-export]').click()
    await shot(page, P('08-export-notice'))
    assert.equal(await page.locator('[data-testid=export-confirm]').isDisabled(), true, 'export requires the exposure acknowledgement')
    await page.locator('[data-testid=export-ack]').check()
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-testid=export-confirm]').click()])
    const htmlPath = path.join(TMP, `${label}-review.html`)
    await dl.saveAs(htmlPath)
    await page.locator('[data-testid=export-done]').waitFor()
    await page.keyboard.press('Escape')
    const html = await readFile(htmlPath, 'utf8')
    assert.match(html, /clicking here does NOT update AQUA/)

    // Offline file: approve traction + funding, comment on team.
    const off = await ctx.newPage()
    await off.goto(pathToFileURL(htmlPath).href)
    const card = (q) => off.locator('article.card', { has: off.locator('h2', { hasText: q }) })
    await card('What traction').locator('input[value=approve]').check()
    await card('What will you do with the funding').locator('input[value=approve]').check()
    await card('Why is your team').locator('textarea').fill('Offline note: fine after evidence (synthetic).')
    await off.locator('#count', { hasText: '3 decisions' }).waitFor()
    await shot(off, P('09-offline-html'), { at: 'article.card' })
    await off.emulateMedia({ colorScheme: 'dark' })
    await shot(off, P('10-offline-html-dark'), { at: 'article.card:nth-of-type(2) .rec' })
    const [jd] = await Promise.all([off.waitForEvent('download'), off.locator('#download').click()])
    const jsonPath = path.join(TMP, `${label}-decisions.json`)
    await jd.saveAs(jsonPath)
    const decision = JSON.parse(await readFile(jsonPath, 'utf8'))
    assert.equal(decision.format, 'aqua-review-decisions')
    assert.equal(decision.decisions.length, 3)
    for (const d of decision.decisions) assert.match(d.version_sha256, /^[0-9a-f]{64}$/)
    assert.match(decision.export_nonce, /^[0-9a-f]{64}$/, 'M2: the export nonce travels in the decision file')
    await off.close()

    // Opening/clicking the file changed nothing in AQUA.
    assert.match(await page.locator('[data-testid=progress]').innerText(), /1 of 6 approved|0 of 6 approved/)
    const before = await page.locator('[data-testid=progress]').innerText()

    // Make the funding decision stale: edit that answer in-app first.
    await openRow(page, 'What will you do with the funding')
    await page.locator('[data-testid=control-edit]').click()
    await page.locator('[data-testid=edit-body]').fill('Hire two engineers and one clinic success lead; run a two-state sales pilot. (synthetic)')
    await page.locator('[data-testid=save-edit]').click()
    await page.locator('[data-testid=card-notice]', { hasText: 'Saved v2' }).waitFor()
    await closeCard(page)

    await page.locator('[data-testid=open-import]').click()
    await page.locator('[data-testid=import-file]').setInputFiles(jsonPath)
    await page.locator('[data-testid=import-plan]').waitFor()
    const summary = await page.locator('[data-testid=import-summary]').innerText()
    assert.match(summary, /3 decisions in file · 2 can be applied · 1 stale/)
    assert.equal(await page.locator('[data-testid=import-plan] li[data-status=stale_superseded]').count(), 1)
    assert.equal(await page.locator('[data-testid=progress]').innerText(), before, 'nothing applied before confirm')
    // M2: file from this vault's export → not foreign; approve rows start unticked
    // and show the exact answer excerpt + full hash; the comment row is preselected.
    assert.equal(await page.locator('[data-testid=import-foreign]').count(), 0, 'own export is not a foreign file')
    const readyApprove = page.locator('[data-testid=import-plan] li[data-status=ready]', { has: page.locator('[data-testid=import-approve-detail]') })
    assert.equal(await readyApprove.count(), 1)
    assert.equal(await readyApprove.locator('input[type=checkbox]').isChecked(), false, 'approvals are never preselected')
    assert.match(await readyApprove.locator('[data-testid=import-full-hash]').innerText(), /sha256 [0-9a-f]{64}/)
    const excerpt = await readyApprove.locator('[data-testid=import-excerpt]').innerText()
    assert.ok(excerpt.length > 10 && !/unlock the vault|could not be decrypted/.test(excerpt), `answer excerpt decrypted locally (got: ${excerpt.slice(0, 60)})`)
    await shot(page, P('11-import-plan'))
    await readyApprove.locator('input[type=checkbox]').check()
    await page.locator('[data-testid=import-confirm]').click()
    await page.locator('[data-testid=import-results]').waitFor()
    assert.match(await page.locator('[data-testid=import-results]').innerText(), /Applied 2 of 2/)
    await shot(page, P('12-import-applied'))
    await page.keyboard.press('Escape')
    await openRow(page, 'What traction')
    await page.locator('[data-testid=signal-approval]', { hasText: 'Approved' }).waitFor()
    const lineage = await page.locator('[data-testid=lineage]').innerText()
    assert.match(lineage, /via decision file/)
    if (label === 'mobile') await closeCard(page)
    await openRow(page, 'What will you do with the funding')
    assert.match(await cardText(page, 'signal-approval'), /^Not approved/, 'stale decision was not applied')
    await shot(page, P('13-after-import-card'), { at: 'top' })
    await closeCard(page)
    await page.locator('[data-testid=filter-approved]').click()
    assert.equal(await page.locator('[data-testid=board-row]').count(), 1, 'only traction is approved (company was edited after approval)')
    await page.locator('[data-testid=filter-all]').click()
  })

  if (label === 'desktop') {
    await step('desktop: dark theme renders the card', async () => {
      await page.locator('[data-testid=harness-theme]').click()
      await openRow(page, 'What traction')
      await shot(page, 'desktop-14-dark-card', { at: 'top' })
      await shot(page, 'desktop-14b-dark-recommendation', { at: '[data-testid=section-recommendation]' })
      await page.locator('[data-testid=harness-theme]').click()
    })
  }

  await step(`${label}: no page errors`, async () => {
    assert.deepEqual(errors, [])
  })
  await ctx.close()
}

const { chromium } = await loadPlaywright()
await mkdir(SHOTS, { recursive: true })
const browser = await chromium.launch()
try {
  await runViewport(browser, 'desktop', { width: 1440, height: 900 })
  await runViewport(browser, 'mobile', { width: 390, height: 844 })
} finally {
  await browser.close()
}
await writeFile(path.join(SHOTS, 'e2e-results.json'), JSON.stringify(results, null, 2) + '\n')
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`)
