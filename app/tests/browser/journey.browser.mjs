// M09 W6 — browser walk of the unified application journey, Steps A→H,
// against the DEV HARNESS (/dev/journey, 404 in production) with SYNTHETIC
// data. Four paths (catalog, paste, file, URL) at 1440px and 390px.
//
//   - POST /api/catalog/extract-url is stubbed by network interception with
//     the fixture built by tests/fixtures/journey-fixtures.mjs (the same
//     pure pipeline the real route runs).
//   - POST /api/catalog/candidates is stubbed to 503
//     catalog_promotion_unavailable (W3 migration not applied).
//   - The .docx is generated in-test (stored ZIP); a fake .pdf checks the
//     unsupported-format message.
//   - Every request is recorded; the run fails if any request body carries
//     answer text, pasted text or file content (only the URL import body and
//     the user-confirmed candidate body may leave the page).
//   - The exported packet is verified with lib/aqua-local/verify-packet.mjs.
//
// Run (dev server on BASE_URL with NEXT_PUBLIC_AQUA_LOCAL_FIRST=1):
//   PW_CORE=/path/to/node_modules/playwright-core CHROMIUM=/path/to/chrome \
//   BASE_URL=http://localhost:3961 node tests/browser/journey.browser.mjs

import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { docxBytes, extractUrlResponse } from '../fixtures/journey-fixtures.mjs'
import { DEV_URL, DEV_PASTE_TEXT, DEV_DOCX_PARAGRAPHS } from '../../lib/journey/dev-fixture.ts'

const here = dirname(fileURLToPath(import.meta.url))
const APP = join(here, '..', '..')
const REPO = join(APP, '..')
const BASE = process.env.BASE_URL ?? 'http://localhost:3961'
const OUT = process.env.SHOT_DIR ?? join(REPO, 'docs', 'evidence', 'm09-journey')
const WORK = process.env.WORK_DIR ?? join(tmpdir(), 'aqua-journey-walk')
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW_CORE ?? 'playwright-core')

mkdirSync(OUT, { recursive: true })
rmSync(WORK, { recursive: true, force: true })
mkdirSync(WORK, { recursive: true })

const SECRET = 'synthetic-harness-secret-01'
const results = []
const log = (...a) => console.log(...a)

const ANSWERS = {
  catProblem: 'Community clinics lose hours each week to manual intake paperwork. Example Accelerator would help us scale our scheduling tool.',
  catTeam: 'Two synthetic founders: a nurse practitioner and a software engineer who have worked together for four years.',
  pasteProblem: 'Community clinics lose hours each week to manual intake paperwork. Our scheduling tool removes most of it.',
  pasteProject: 'I led a synthetic pilot with three clinics in 2026 that cut intake time in half.',
  fileProject: 'A synthetic mural project for the harbor district, painted with local students.',
  fileBenefit: 'Local students and harbor residents.',
}
const PRIVATE_STRINGS = [
  ...Object.values(ANSWERS),
  ...DEV_PASTE_TEXT.split('\n').map((s) => s.trim()).filter((s) => s.length > 12),
  ...DEV_DOCX_PARAGRAPHS.map((p) => p.text),
  SECRET,
  'We will cover timing in the interview.',
]

// per path: plan for each populate row in order — 'auto' (Direct → Adapt → Gap) with fallback text, or 'skip'
const PLANS = {
  catalog: { pick: 'example-accelerator', rows: [{ text: ANSWERS.catProblem }, { text: ANSWERS.catTeam }, { skip: 'We will cover timing in the interview.' }] },
  paste: { rows: [{ text: ANSWERS.pasteProblem, expect: 'adapt' }, { text: ANSWERS.pasteProject }, { skip: 'The stipend plan is still being drafted.' }] },
  file: { rows: [{ text: ANSWERS.fileProject }, { text: ANSWERS.fileBenefit }, { text: ANSWERS.pasteProblem, expect: 'direct' }] },
  url: { rows: [{ text: ANSWERS.pasteProblem }, { text: ANSWERS.catTeam }, { skip: 'Traction is covered in the deck.' }] },
}

async function shot(page, name, full = true) {
  const path = join(OUT, `${name}.jpg`)
  await page.screenshot({ path, fullPage: full, type: 'jpeg', quality: 70 })
  return path
}

async function unlockIfNeeded(page) {
  const pw = page.getByPlaceholder('Vault secret')
  if (await pw.count() === 0) return
  if (!(await pw.first().isVisible())) return
  await pw.first().fill(SECRET)
  const confirm = page.getByPlaceholder('Confirm secret')
  if (await confirm.count()) await confirm.fill(SECRET)
  await page.getByRole('button', { name: /Create vault|Unlock vault/ }).click()
  await page.getByPlaceholder('Vault secret').first().waitFor({ state: 'detached', timeout: 30_000 })
}

async function rowCount(page) {
  return page.getByTestId('populate-row').count()
}

async function populate(page, plan) {
  const n = await rowCount(page)
  if (n !== plan.rows.length) throw new Error(`expected ${plan.rows.length} rows, got ${n}`)
  const seen = []
  for (let i = 0; i < n; i++) {
    const spec = plan.rows[i]
    if (spec.skip) { seen.push('skip'); continue }
    const row = page.getByTestId('populate-row').nth(i)
    const direct = row.getByTestId('use-direct')
    const adapt = row.getByTestId('adapt')
    let kind
    if (await direct.count()) {
      kind = 'direct'
      await direct.click()
    } else if (await adapt.count()) {
      kind = 'adapt'
      await adapt.click()
      const ta = row.getByRole('textbox', { name: /Draft for question/ })
      await ta.waitFor()
      await ta.fill(spec.text)
      await row.getByTestId('save-draft').click()
    } else {
      kind = 'gap'
      await row.getByTestId('write-draft').click()
      const ta = row.getByRole('textbox', { name: /Draft for question/ })
      await ta.waitFor()
      await ta.fill(spec.text)
      await row.getByTestId('save-draft').click()
    }
    if (spec.expect && spec.expect !== kind) throw new Error(`row ${i + 1}: expected ${spec.expect}, got ${kind}`)
    await page.getByTestId('populate-row').nth(i).getByTestId('draft-created').waitFor({ timeout: 20_000 })
    seen.push(kind)
  }
  return seen
}

async function approveAll(page) {
  for (let guard = 0; guard < 10; guard++) {
    const btn = page.getByTestId('harness-approve')
    if (await btn.count() === 0) return
    const before = await btn.count()
    await btn.first().click()
    await page.waitForFunction((b) => document.querySelectorAll('[data-testid="harness-approve"]').length < b, before, { timeout: 20_000 })
  }
}

async function skipReasons(page, plan) {
  for (let i = 0; i < plan.rows.length; i++) {
    if (!plan.rows[i].skip) continue
    await page.getByRole('textbox', { name: `Skip reason for question ${i + 1}` }).fill(plan.rows[i].skip)
  }
  await page.getByText('ready to freeze').waitFor({ timeout: 20_000 })
}

async function freezeExportSubmit(page, label, vp) {
  await page.getByRole('button', { name: 'Freeze packet' }).click()
  await page.getByText(/Packet PK-[0-9a-f]+ — PREPARED/i).waitFor({ timeout: 20_000 })
  await page.getByText('I have reviewed the selected versions').click()
  await page.getByRole('button', { name: 'Sign packet' }).click()
  await page.getByText(/SIGNED/).first().waitFor({ timeout: 20_000 })
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export packet/ }).click()])
  const file = join(WORK, `${vp}-${label}-packet.json`)
  await dl.saveAs(file)
  let verify
  try {
    verify = { code: 0, out: execFileSync('node', [join(APP, 'lib', 'aqua-local', 'verify-packet.mjs'), file], { encoding: 'utf8' }) }
  } catch (e) {
    verify = { code: e.status ?? 1, out: String(e.stdout ?? '') + String(e.stderr ?? '') }
  }
  await page.getByText('Record external submission').waitFor()
  if (vp === 'w1440') await shot(page, `${vp}-${label}-G-export`)
  await page.getByPlaceholder('Submission portal URL').fill('https://portal.example.org/submit')
  await page.getByPlaceholder('Confirmation / reference no. (optional)').fill(`SYN-${label.toUpperCase()}-001`)
  await page.getByRole('button', { name: 'Record submission' }).click()
  await page.getByTestId('historical-view').waitFor({ timeout: 30_000 })
  return verify
}

async function walk(page, vp, label) {
  const plan = PLANS[label]
  const r = { viewport: vp, path: label, steps: [] }
  const reqBefore = requests.length
  await page.goto(label === 'url' ? `${BASE}/dev/journey?url=${encodeURIComponent(DEV_URL)}` : `${BASE}/dev/journey`)
  await page.getByTestId('path-catalog').waitFor()
  if (vp === 'w1440' && label === 'catalog') await shot(page, `${vp}-${label}-A-choose`)

  if (label === 'catalog') {
    await page.getByTestId(`pick-${plan.pick}`).click()
  } else if (label === 'paste') {
    await page.getByTestId('path-paste').click()
    await page.getByRole('textbox', { name: 'Application text' }).fill(DEV_PASTE_TEXT)
    if (vp === 'w1440') await shot(page, `${vp}-${label}-A-paste`)
    await page.getByRole('button', { name: 'Find the questions' }).click()
  } else if (label === 'file') {
    await page.getByTestId('path-file').click()
    await page.getByLabel('Application file').setInputFiles({ name: 'form.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 synthetic') })
    await page.getByText(/PDF import is not supported yet/).waitFor()
    r.steps.push('pdf-unsupported-message')
    if (vp === 'w1440') await shot(page, `${vp}-${label}-A-pdf-unsupported`)
    await page.getByLabel('Application file').setInputFiles({ name: 'harbor-arts-grant.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(docxBytes()) })
  } else if (label === 'url') {
    // ?url= deep link: prefilled, NOT fetched, and dropped from the address bar
    await page.getByTestId('url-prefilled').waitFor()
    if ((await page.getByRole('textbox', { name: 'Application URL' }).inputValue()) !== DEV_URL) throw new Error('url not prefilled')
    await page.waitForTimeout(500)
    if (requests.slice(reqBefore).some((q) => q.url.includes('/api/catalog/extract-url'))) throw new Error('deep link auto-fetched')
    if (page.url().includes('url=') || !page.url().includes('path=url')) throw new Error(`deep link kept in address bar: ${page.url()}`)
    r.steps.push('A: ?url= deep link prefilled, not fetched, stripped from the address bar')
    if (vp === 'w1440') await shot(page, `${vp}-${label}-A-url-deeplink`)
    const before = requests.length
    await page.getByRole('textbox', { name: 'Application URL' }).fill('https://docs.google.com/document/d/synthetic123/edit')
    await page.getByRole('button', { name: 'Import' }).click()
    await page.getByText(/looks private/).waitFor()
    if (requests.slice(before).some((q) => q.url.includes('/api/'))) throw new Error('private link was sent')
    r.steps.push('private-link-refused-locally')
    await page.getByRole('textbox', { name: 'Application URL' }).fill(DEV_URL)
    await page.getByRole('button', { name: 'Import' }).click()
  }

  // ── Step B ──
  await page.getByTestId('review-count').waitFor({ timeout: 20_000 })
  r.steps.push(`B: ${await page.getByTestId('review-count').innerText()}`)
  if (label === 'paste') {
    const q = page.getByTestId('review-q-q1')
    await q.getByRole('button', { name: 'Correct wording' }).click()
    await q.getByRole('textbox').fill('Describe a project you led in the last two years.')
    await q.getByRole('button', { name: 'Save correction' }).click()
    await q.getByText(/Original \(kept\)/).waitFor()
    r.steps.push('B: wording corrected, original kept')
  }
  if (label === 'url') {
    await page.getByTestId('review-q-q2').getByRole('button', { name: /Merge into 2/ }).click()
    await page.getByTestId('review-q-q4').getByRole('button', { name: 'Remove' }).click()
    r.steps.push('B: duplicate merged, contact field removed')
    await page.getByRole('button', { name: 'Show exactly what would be sent' }).click()
    const payload = await page.getByTestId('candidate-payload').innerText()
    if (payload.includes('founder@example.com')) throw new Error('private filled value in candidate payload')
    await page.getByText('I confirm this page is public').click()
    await page.getByRole('button', { name: 'Send suggestion' }).click()
    await page.getByText(/Catalog submissions open soon/).waitFor()
    r.steps.push('B: candidate shown → confirmed → 503 handled ("open soon")')
  }
  await shot(page, `${vp}-${label}-B-review`)

  // ── Step C ──
  await unlockIfNeeded(page)
  await page.getByTestId('create-instance').click()
  await page.waitForURL(/\/dev\/journey\/(AI|LA)-/, { timeout: 30_000 })
  const instanceId = decodeURIComponent(page.url().split('/').pop())
  r.instance_id_prefix = instanceId.slice(0, 3)
  await unlockIfNeeded(page)
  await page.getByTestId('populate-row').first().waitFor({ timeout: 30_000 })
  r.steps.push(`C: created ${r.instance_id_prefix}…`)

  // ── Step D ──
  await page.getByTestId('record-matches').click()
  await page.getByText(/answer-bank suggestion/).first().waitFor({ timeout: 20_000 })
  r.classifications = await populate(page, plan)
  r.steps.push(`D: ${r.classifications.join(', ')}`)
  if (vp === 'w1440' || label === 'paste') await shot(page, `${vp}-${label}-D-populate`)

  // ── Step E ──
  const reviewHref = await page.getByTestId('review-cta').getAttribute('href')
  if (!reviewHref.startsWith(`/review/${encodeURIComponent(instanceId)}`)) throw new Error(`review CTA → ${reviewHref}`)
  if (instanceId.startsWith('AI-') !== reviewHref.includes('?program=')) throw new Error(`catalog-backed review link must carry ?program= (${reviewHref})`)
  await approveAll(page)
  r.steps.push(`E: review CTA → ${reviewHref.replace(encodeURIComponent(instanceId), '<id>')}; approved via harness stand-in`)
  if (vp === 'w1440') await shot(page, `${vp}-${label}-E-review`)

  // ── Step F ──
  await skipReasons(page, plan)
  r.steps.push('F: ready to freeze')
  await shot(page, `${vp}-${label}-F-prepare`)

  // ── Steps G + H ──
  const verify = await freezeExportSubmit(page, label, vp)
  r.verify_exit = verify.code
  r.verify_summary = verify.out.trim().split('\n').slice(-1)[0]
  r.steps.push(`G: frozen, signed, exported; verify-packet exit ${verify.code}`)
  r.steps.push('H: submission recorded → read-only historical view')
  await shot(page, `${vp}-${label}-H-historical`)
  results.push(r)
  log(JSON.stringify(r))
  return instanceId
}

const requests = []
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM })
let failed = false
try {
  for (const [vp, viewport] of [['w1440', { width: 1440, height: 900 }], ['w390', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, acceptDownloads: true, deviceScaleFactor: 1 })
    await context.route('**/api/catalog/extract-url', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(extractUrlResponse()) })
    })
    await context.route('**/api/catalog/candidates', async (route) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'catalog_promotion_unavailable' }) })
    })
    await context.route('http://127.0.0.1:54399/**', (route) => route.abort())
    const page = await context.newPage()
    page.on('request', (q) => {
      const u = q.url()
      if (u.startsWith(`${BASE}/_next/`) || u.endsWith('.ico')) return
      requests.push({ vp, method: q.method(), url: u, body: q.postData() ?? null })
    })
    page.on('pageerror', (e) => log('pageerror', e.message))
    for (const label of ['catalog', 'paste', 'file', 'url']) {
      try { await walk(page, vp, label) } catch (e) {
        await page.screenshot({ path: join(WORK, `${vp}-${label}-FAIL.png`), fullPage: true }).catch(() => {})
        throw e
      }
    }
    await page.goto(`${BASE}/dev/journey?path=mine`)
    await unlockIfNeeded(page)
    await page.getByTestId('instance-link').first().waitFor({ timeout: 20_000 })
    const listText = await page.getByTestId('instance-link').allInnerTexts()
    results.push({ viewport: vp, path: 'mine', instances: listText.length, all_submitted: listText.every((t) => /submitted/.test(t)) })
    await shot(page, `${vp}-mine-reopen-list`)
    await page.getByTestId('instance-link').last().click()
    await page.getByTestId('historical-view').waitFor({ timeout: 20_000 })
    await page.getByTestId('submission-record').first().waitFor()
    results.push({ viewport: vp, path: 'reopen', historical_readonly: (await page.getByTestId('populate-row').count()) === 0 })
    await context.close()
  }

  // ── privacy: no private content in any request body ──
  const api = requests.filter((q) => q.url.includes('/api/') || !q.url.startsWith(BASE))
  const leaks = []
  for (const q of requests) {
    if (!q.body) continue
    for (const s of PRIVATE_STRINGS) if (q.body.includes(s)) leaks.push({ url: q.url, s: s.slice(0, 40) })
  }
  const extract = api.filter((q) => q.url.endsWith('/api/catalog/extract-url'))
  const cand = api.filter((q) => q.url.endsWith('/api/catalog/candidates'))
  const other = api.filter((q) => !extract.includes(q) && !cand.includes(q))
  results.push({
    privacy: {
      request_bodies_with_private_content: leaks.length,
      extract_url_requests: extract.length,
      extract_url_bodies_url_only: extract.every((q) => JSON.stringify(JSON.parse(q.body)) === JSON.stringify({ url: DEV_URL })),
      candidate_requests: cand.length,
      other_api_or_offsite_requests: [...new Set(other.map((q) => `${q.method} ${q.url.replace(/\?.*$/, '')}`))],
    },
  })
  if (leaks.length) { failed = true; log('LEAKS', JSON.stringify(leaks)) }
} catch (e) {
  failed = true
  log('FAIL', e.stack ?? e.message)
} finally {
  await browser.close()
}

writeFileSync(join(WORK, 'results.json'), JSON.stringify(results, null, 2))
log('RESULTS', JSON.stringify(results, null, 2))
const bad = results.filter((r) => r.verify_exit !== undefined && r.verify_exit !== 0)
if (bad.length) failed = true
process.exitCode = failed ? 1 : 0
log(failed ? 'BROWSER WALK: FAIL' : 'BROWSER WALK: PASS')
