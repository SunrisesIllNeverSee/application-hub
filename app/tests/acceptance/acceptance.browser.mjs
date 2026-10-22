// M09 W9 — browser acceptance checks that the existing walks do not cover:
//   AT15  another device makes no false sync claim (and nothing private is fetched or sent)
//   AT21  sign-out / account switch keeps private data isolated (real IndexedDB, two uids)
//   AT22  import / network / storage failures leave no partial state and send nothing private
//
// Runs against `next dev` on the journey harness (/dev/journey, 404 in
// production) with SYNTHETIC data. The dev server must be started with
//   NEXT_PUBLIC_AQUA_LOCAL_FIRST=1 NEXT_PUBLIC_SUPABASE_URL=https://acceptance0ref.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=<any dummy>
// (a placeholder project ref, so the session layer's cookie routing — which
// only reads `sb-<ref>-auth-token` for a *.supabase.co URL — is exercised),
// and its own outbound requests sent to tests/acceptance/deny-proxy.mjs.
// The browser aborts every request that leaves localhost and records it.
//
// Signed-in identity is a synthetic auth cookie (structurally what
// @supabase/ssr writes; it is only a vault-ROUTING hint in the client).
// Sign-out / sign-in in "another tab" is delivered the way supabase-js does
// it: a BroadcastChannel message on the auth storage key.
//
//   PLAYWRIGHT_MODULE=<dir of a playwright package> BASE_URL=http://localhost:3977 \
//     node tests/acceptance/acceptance.browser.mjs
// Writes <OUT>/browser-results.json and screenshots to <OUT>/screens/.

import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEV_PASTE_TEXT, DEV_URL } from '../../lib/journey/dev-fixture.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(here, '..', '..', '..')
const BASE = process.env.BASE_URL ?? 'http://localhost:3977'
const OUT = path.resolve(process.env.ACCEPTANCE_OUT ?? path.join(REPO, 'docs', 'evidence', 'm09-acceptance'))
const SHOTS = path.join(OUT, 'screens')
const REF = 'acceptance0ref'
const COOKIE = `sb-${REF}-auth-token`
fs.mkdirSync(SHOTS, { recursive: true })

function loadPlaywright() {
  const dir = process.env.PLAYWRIGHT_MODULE
  const req = createRequire(dir ? path.join(dir, 'package.json') : import.meta.url)
  return req(dir ?? 'playwright')
}
const { chromium } = loadPlaywright()

const UID_A = '0a0a0a0a-0000-4000-8000-00000000000a'
const UID_B = '0b0b0b0b-0000-4000-8000-00000000000b'
const UID_C = '0c0c0c0c-0000-4000-8000-00000000000c'
const SECRET_A = 'synthetic-secret-account-a-01'
const SECRET_B = 'synthetic-secret-account-b-02'
const SECRET_C = 'synthetic-secret-account-c-03'
const ZWSP_DRAFT = '​​​'
const PRIVATE = [
  ...DEV_PASTE_TEXT.split('\n').map((s) => s.trim()).filter((s) => s.length > 12),
  SECRET_A, SECRET_B, SECRET_C,
  'Synthetic AT22 draft that must never leave the device.',
]

const results = { generated_at: new Date().toISOString(), base: 'localhost (next dev, /dev/journey harness)', checks: [], requests: {} }
const allRequests = []
function check(at, name, pass, detail = undefined) {
  results.checks.push({ at, name, pass: Boolean(pass), ...(detail !== undefined ? { detail } : {}) })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${at} ${name}${detail !== undefined ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`)
}
const b64url = (s) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
function session(uid, tag) {
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600
  const jwt = `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify({ sub: uid, role: 'authenticated', aud: 'authenticated', exp }))}.synthetic-signature`
  return { access_token: jwt, token_type: 'bearer', expires_in: 7 * 24 * 3600, expires_at: exp, refresh_token: `synthetic-refresh-${tag}`, user: { id: uid, aud: 'authenticated', role: 'authenticated', email: `${tag}@example.test`, app_metadata: {}, user_metadata: {} } }
}
const cookieFor = (uid, tag) => ({ name: COOKIE, value: `base64-${b64url(JSON.stringify(session(uid, tag)))}`, domain: 'localhost', path: '/', sameSite: 'Lax' })

// Record IndexedDB opens/closes in the page (names only).
const IDB_PROBE = () => {
  window.__idb = { opened: [], closed: [] }
  const open = IDBFactory.prototype.open
  IDBFactory.prototype.open = function (name, v) {
    if (!window.__probing) window.__idb.opened.push(name)
    const req = open.call(this, name, v)
    req.addEventListener('success', () => {
      const db = req.result
      const close = db.close.bind(db)
      db.close = () => { if (!window.__probing) window.__idb.closed.push(db.name); return close() }
    })
    return req
  }
}

async function newDevice(browser, label, { uid, tag } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 })
  await ctx.addInitScript(IDB_PROBE)
  // everything that leaves localhost is aborted (and recorded)
  await ctx.route((url) => !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url.toString()), (route) => route.abort())
  if (uid) await ctx.addCookies([cookieFor(uid, tag)])
  ctx.on('request', (q) => {
    const u = q.url()
    if (/\/_next\/(static|webpack|image)|\/__nextjs|\.ico$|hot-update/.test(u)) return
    allRequests.push({ device: label, method: q.method(), url: u, body: q.postData() ?? null })
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log(`[${label}] pageerror`, e.message))
  return { ctx, page }
}

async function unlock(page, secret) {
  const pw = page.getByPlaceholder('Vault secret')
  await pw.first().waitFor({ timeout: 60_000 })
  const btn = page.getByRole('button', { name: /^(Create vault|Unlock vault)$/ })
  await btn.waitFor({ timeout: 30_000 })
  // the panel learns whether the vault is empty asynchronously: let it settle
  await page.waitForTimeout(800)
  const firstRun = (await page.getByPlaceholder('Confirm secret').count()) > 0
  await pw.first().fill(secret)
  if (firstRun) await page.getByPlaceholder('Confirm secret').fill(secret)
  await btn.click()
  await pw.first().waitFor({ state: 'detached', timeout: 30_000 })
  return firstRun
}

async function createPasteInstance(page, secret) {
  await page.goto(`${BASE}/dev/journey`)
  await page.getByTestId('path-paste').click()
  await page.getByRole('textbox', { name: 'Application text' }).fill(DEV_PASTE_TEXT)
  await page.getByRole('button', { name: 'Find the questions' }).click()
  await page.getByTestId('review-count').waitFor({ timeout: 30_000 })
  if (await page.getByPlaceholder('Vault secret').count()) await unlock(page, secret)
  await page.getByTestId('create-instance').click()
  await page.waitForURL(/\/dev\/journey\/LA-/, { timeout: 30_000 })
  return decodeURIComponent(page.url().split('/').pop())
}

// Raw IndexedDB facts, read in the page (store counts only, never contents).
async function idbFacts(page) {
  return page.evaluate(async () => {
    window.__probing = true
    const names = (await indexedDB.databases()).map((d) => d.name).filter((n) => n && n.startsWith('aqua-local')).sort()
    const counts = {}
    for (const name of names) {
      const db = await new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
      const c = {}
      for (const store of ['app_instances', 'answers', 'versions', 'approvals']) {
        if (!db.objectStoreNames.contains(store)) continue
        c[store] = await new Promise((res) => { const q = db.transaction(store).objectStore(store).count(); q.onsuccess = () => res(q.result) })
      }
      db.close()
      counts[name] = c
    }
    window.__probing = false
    return { names, counts, opened: [...window.__idb.opened], closed: [...window.__idb.closed] }
  })
}

async function broadcast(page, event, sess) {
  await page.evaluate(([key, ev, s]) => { const ch = new BroadcastChannel(key); ch.postMessage({ event: ev, session: s }); ch.close() }, [COOKIE, event, sess])
}
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true })
const SYNC_CLAIM = /\b(auto(matic(ally)?)?[ -]?sync(ed|s|ing)?|sync(ed|s|ing)? (across|to) (all |your |other )*devices|synced to (the )?cloud|available on all (of )?your devices|backed up automatically|cloud backup)\b/i

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })
let fatal = null
try {
  // ───────────────────────── AT21: sign-out isolation ─────────────────────────
  {
    const { ctx, page } = await newDevice(browser, 'at21-device', { uid: UID_A, tag: 'acct-a' })
    const instA = await createPasteInstance(page, SECRET_A)
    await page.goto(`${BASE}/dev/journey?path=mine`)
    await page.getByTestId('instance-link').first().waitFor({ timeout: 30_000 }).catch(async () => { await unlock(page, SECRET_A); await page.getByTestId('instance-link').first().waitFor({ timeout: 30_000 }) })
    const listA = await page.getByTestId('instance-link').count()
    const f1 = await idbFacts(page)
    check('AT21', 'account A writes only to its own IndexedDB database', f1.names.includes(`aqua-local-${UID_A}`) && f1.counts[`aqua-local-${UID_A}`].app_instances === 1, { names: f1.names.map((n) => n.replace(UID_A, '<uidA>')), listA })
    check('AT21', 'no shared/anonymous vault is created while signed in', !f1.names.includes('aqua-local'))
    await shot(page, 'at21-01-account-a-list')

    // sign-out in another tab: cookie removed + SIGNED_OUT broadcast (what supabase-js does)
    const closedBefore = f1.closed.filter((n) => n === `aqua-local-${UID_A}`).length
    await ctx.clearCookies()
    const other = await ctx.newPage()
    await other.goto(`${BASE}/dev/journey?path=mine`)
    await broadcast(other, 'SIGNED_OUT', null)
    await page.waitForFunction(([n, c]) => window.__idb.closed.filter((x) => x === n).length > c, [`aqua-local-${UID_A}`, closedBefore], { timeout: 15_000 }).catch(() => {})
    await page.waitForTimeout(500)
    const f2 = await page.evaluate(() => ({ closed: [...window.__idb.closed] }))
    const closedA = f2.closed.filter((n) => n === `aqua-local-${UID_A}`).length > closedBefore
    check('AT21', 'sign-out closes account A\'s IndexedDB connection', closedA)
    const unlockShown = await page.getByPlaceholder('Vault secret').count() > 0
    const listAfter = await page.getByTestId('instance-link').count()
    check('AT21', 'after sign-out the open tab drops the secret: list hidden, unlock required', listAfter === 0 && unlockShown, { listAfter, unlockShown })
    await shot(page, 'at21-02-after-sign-out')
    await other.close()

    // account B signs in on the same device
    await ctx.addCookies([cookieFor(UID_B, 'acct-b')])
    await broadcast(page, 'SIGNED_IN', session(UID_B, 'acct-b'))
    await page.goto(`${BASE}/dev/journey?path=mine`)
    const firstRunB = await unlock(page, SECRET_B)
    await page.getByText(/No private applications yet/).waitFor({ timeout: 30_000 })
    const listB = await page.getByTestId('instance-link').count()
    const f3 = await idbFacts(page)
    check('AT21', 'account B gets a first-run vault (A\'s secret and data are not inherited)', firstRunB === true)
    check('AT21', 'account B sees none of A\'s applications', listB === 0)
    check('AT21', 'A and B have different IndexedDB database names; A\'s data untouched, B\'s empty', f3.names.includes(`aqua-local-${UID_A}`) && f3.names.includes(`aqua-local-${UID_B}`) && f3.counts[`aqua-local-${UID_A}`].app_instances === 1 && f3.counts[`aqua-local-${UID_B}`].app_instances === 0,
      { names: f3.names.map((n) => n.replace(UID_A, '<uidA>').replace(UID_B, '<uidB>')), counts: Object.fromEntries(Object.entries(f3.counts).map(([k, v]) => [k.replace(UID_A, '<uidA>').replace(UID_B, '<uidB>'), v])) })
    check('AT21', 'after the switch the app never opened A\'s database again', f3.opened.filter((n) => n === `aqua-local-${UID_A}`).length === 0,
      { opened_by_b_page: f3.opened.map((n) => n.replace(UID_A, '<uidA>').replace(UID_B, '<uidB>')) })
    await shot(page, 'at21-03-account-b-empty')
    // B cannot open A's instance by URL
    await page.goto(`${BASE}/dev/journey/${encodeURIComponent(instA)}`)
    await page.waitForTimeout(1500)
    if (await page.getByPlaceholder('Vault secret').count()) await unlock(page, SECRET_B)
    await page.waitForTimeout(1500)
    const bodyText = await page.locator('body').innerText()
    check('AT21', 'B opening A\'s instance URL does not reveal it', !bodyText.includes('Northwind Civic Fellowship') && (await page.getByTestId('populate-row').count()) === 0)
    await shot(page, 'at21-04-b-opens-a-url')
    await ctx.close()
  }
  // ───────────────────────── AT21: account switch without sign-out ─────────────────────────
  {
    const { ctx, page } = await newDevice(browser, 'at21-switch', { uid: UID_A, tag: 'acct-a' })
    await page.goto(`${BASE}/dev/journey?path=mine`)
    await unlock(page, SECRET_A)
    await page.getByTestId('instance-link').first().waitFor({ timeout: 30_000 }).catch(() => {})
    const f0 = await page.evaluate(() => ({ closed: [...window.__idb.closed] }))
    await ctx.clearCookies()
    await ctx.addCookies([cookieFor(UID_B, 'acct-b')])
    await broadcast(page, 'SIGNED_IN', session(UID_B, 'acct-b')) // sent to this tab by "another tab"
    const other = await ctx.newPage()
    await other.goto(`${BASE}/dev/journey?path=mine`)
    await broadcast(other, 'SIGNED_IN', session(UID_B, 'acct-b'))
    await page.waitForTimeout(1500)
    const f1 = await page.evaluate(() => ({ closed: [...window.__idb.closed] }))
    check('AT21', 'switching A→B (SIGNED_IN as another account) closes A\'s connection', f1.closed.filter((n) => n === `aqua-local-${UID_A}`).length > f0.closed.filter((n) => n === `aqua-local-${UID_A}`).length)
    check('AT21', 'switching A→B locks the open tab (A\'s list no longer shown)', (await page.getByTestId('instance-link').count()) === 0)
    await other.close()
    await ctx.close()
  }

  // ───────────────────────── AT15: another device ─────────────────────────
  {
    const d1 = await newDevice(browser, 'at15-device-1', { uid: UID_C, tag: 'acct-c' })
    await createPasteInstance(d1.page, SECRET_C)
    const d1facts = await idbFacts(d1.page)
    const d2 = await newDevice(browser, 'at15-device-2', { uid: UID_C, tag: 'acct-c' })
    const reqStart = allRequests.length
    await d2.page.goto(`${BASE}/dev/journey?path=mine`)
    await d2.page.getByPlaceholder('Vault secret').first().waitFor({ timeout: 60_000 })
    await d2.page.waitForTimeout(800)
    const unlockText = await d2.page.locator('body').innerText()
    await shot(d2.page, 'at15-01-device-2-first-run')
    const firstRun = await unlock(d2.page, SECRET_C)
    await d2.page.getByText(/No private applications yet/).waitFor({ timeout: 30_000 })
    const listText = await d2.page.locator('body').innerText()
    await shot(d2.page, 'at15-02-device-2-empty-list')
    const d2facts = await idbFacts(d2.page)
    check('AT15', 'device 1 holds the application locally', d1facts.counts[`aqua-local-${UID_C}`]?.app_instances === 1)
    check('AT15', 'device 2 (same account) starts a first-run vault and lists nothing', firstRun && d2facts.counts[`aqua-local-${UID_C}`]?.app_instances === 0)
    const claims = [unlockText, listText].map((t) => t.match(SYNC_CLAIM)?.[0]).filter(Boolean)
    check('AT15', 'device 2 UI makes no automatic-sync claim', claims.length === 0, claims.length ? claims : 'no match for the sync-claim pattern')
    check('AT15', 'device 2 says the data is on this device', /on this device|leaves this device|never leaves/i.test(unlockText + listText))
    const d2req = allRequests.slice(reqStart).filter((q) => q.device === 'at15-device-2')
    const offsite = d2req.filter((q) => !q.url.startsWith(BASE))
    const apiCalls = d2req.filter((q) => q.url.startsWith(`${BASE}/api/`))
    // The only off-site attempt allowed is the root layout's pre-existing GA4 page-analytics script (GET, no body; aborted here).
    const unexpectedOffsite = offsite.filter((q) => !(q.method === 'GET' && !q.body && new URL(q.url).host === 'www.googletagmanager.com' && new URL(q.url).pathname === '/gtag/js'))
    check('AT15', 'device 2 makes no sync/API request; no off-site request except the GA4 script GET (no body, aborted)', apiCalls.length === 0 && unexpectedOffsite.length === 0, { api: apiCalls.map((q) => q.url.replace(BASE, '')), offsite: [...new Set(offsite.map((q) => `${q.method} ${new URL(q.url).host}${new URL(q.url).pathname}`))] })
    await d1.ctx.close()
    await d2.ctx.close()
  }

  // ───────────────────────── AT22: failures leave no partial state ─────────────────────────
  {
    const { ctx, page } = await newDevice(browser, 'at22-device', { uid: UID_A, tag: 'acct-a' })
    let mode = 'abort'
    const extractBodies = []
    await ctx.route('**/api/catalog/extract-url', async (route) => {
      extractBodies.push(route.request().postData())
      if (mode === 'abort') return route.abort('connectionreset')
      if (mode === '500') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"internal"}' })
      if (mode === '422') return route.fulfill({ status: 422, contentType: 'application/json', body: '{"error":"source_fetch_failed","code":"timeout"}' })
      if (mode === 'garbage') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"proposal": 42' })
      return route.abort()
    })
    await page.goto(`${BASE}/dev/journey?path=mine`)
    await unlock(page, SECRET_A)
    await page.getByTestId('instance-link').first().waitFor({ timeout: 30_000 }).catch(() => {})
    const before = await idbFacts(page)
    const dbA = `aqua-local-${UID_A}`
    for (const m of ['abort', '500', '422', 'garbage']) {
      mode = m
      await page.goto(`${BASE}/dev/journey?path=url`)
      await page.getByRole('textbox', { name: 'Application URL' }).waitFor({ timeout: 30_000 })
      await page.getByRole('textbox', { name: 'Application URL' }).fill(DEV_URL)
      await page.getByRole('button', { name: 'Import' }).click()
      await page.waitForTimeout(1500)
      const reviewShown = await page.getByTestId('review-count').count()
      const txt = await page.locator('body').innerText()
      check('AT22', `URL import failure (${m}) shows an error and no review/instance step`, reviewShown === 0 && /Nothing was created/.test(txt), txt.match(/[^\n.]{0,80}Nothing was created[^\n]{0,60}/)?.[0])
      if (m === 'abort') await shot(page, 'at22-01-url-import-network-failure')
    }
    const afterUrl = await idbFacts(page)
    check('AT22', 'failed URL imports wrote nothing to the vault', JSON.stringify(afterUrl.counts[dbA]) === JSON.stringify(before.counts[dbA]), { before: before.counts[dbA], after: afterUrl.counts[dbA] })
    check('AT22', 'extract-url request bodies were {url} only', extractBodies.length === 4 && extractBodies.every((b) => JSON.stringify(JSON.parse(b)) === JSON.stringify({ url: DEV_URL })))

    // storage failure while creating the instance: IndexedDB write refused once
    await page.goto(`${BASE}/dev/journey`)
    await page.getByTestId('path-paste').click()
    await page.getByRole('textbox', { name: 'Application text' }).fill(DEV_PASTE_TEXT)
    await page.getByRole('button', { name: 'Find the questions' }).click()
    await page.getByTestId('review-count').waitFor({ timeout: 30_000 })
    if (await page.getByPlaceholder('Vault secret').count()) await unlock(page, SECRET_A)
    await page.evaluate(() => {
      const add = IDBObjectStore.prototype.add; const put = IDBObjectStore.prototype.put
      let armed = true
      const fail = function (orig) { return function (...a) { if (armed && this.name === 'app_instances') { armed = false; throw new DOMException('synthetic quota failure', 'QuotaExceededError') } return orig.apply(this, a) } }
      IDBObjectStore.prototype.add = fail(add); IDBObjectStore.prototype.put = fail(put)
    })
    const n0 = (await idbFacts(page)).counts[dbA]
    await page.getByTestId('create-instance').click()
    await page.waitForTimeout(2000)
    const stayed = !/\/dev\/journey\/LA-/.test(page.url())
    const errTxt = (await page.locator('body').innerText()).match(/Could not create the application[^\n]*/)?.[0]
    const n1 = (await idbFacts(page)).counts[dbA]
    check('AT22', 'instance creation storage failure: error shown, nothing saved, no navigation', stayed && Boolean(errTxt) && n1.app_instances === n0.app_instances, { error: errTxt, before: n0, after: n1 })
    await shot(page, 'at22-02-instance-storage-failure')
    // retry succeeds (no stale half-state blocks it)
    await page.getByTestId('create-instance').click()
    await page.waitForURL(/\/dev\/journey\/LA-/, { timeout: 30_000 })
    const n2 = (await idbFacts(page)).counts[dbA]
    check('AT22', 'retry after the failure creates exactly one instance', n2.app_instances === n0.app_instances + 1)

    // a draft the vault refuses (invisible-only body) must not leave an empty answer shell
    await page.getByTestId('populate-row').first().waitFor({ timeout: 30_000 }).catch(async () => { await unlock(page, SECRET_A); await page.getByTestId('populate-row').first().waitFor({ timeout: 30_000 }) })
    const row = page.getByTestId('populate-row').first()
    const n3 = (await idbFacts(page)).counts[dbA]
    const write = row.getByTestId('write-draft')
    if (await write.count()) await write.click(); else await row.getByTestId('adapt').click()
    const ta = row.getByRole('textbox', { name: /Draft for question/ })
    await ta.waitFor()
    // (i) a real IndexedDB write failure in the middle of the first-draft transaction (provenance put)
    await page.evaluate(() => {
      const put = IDBObjectStore.prototype.put
      let armed = true
      IDBObjectStore.prototype.put = function (...a) { if (armed && this.name === 'provenance') { armed = false; throw new DOMException('synthetic write failure', 'UnknownError') } return put.apply(this, a) }
    })
    await ta.fill('Synthetic AT22 draft that must never leave the device.')
    await row.getByTestId('save-draft').click()
    await page.waitForTimeout(1500)
    const nFail = (await idbFacts(page)).counts[dbA]
    check('AT22', 'a write failure inside the first-draft transaction rolls back: no answer, no version', nFail.answers === n3.answers && nFail.versions === n3.versions, { before: n3, after: nFail })
    // (ii) a draft the vault refuses (invisible characters only)
    if (!(await ta.count())) { if (await write.count()) await write.click(); else await row.getByTestId('adapt').click(); await ta.waitFor() }
    const nBeforeZ = (await idbFacts(page)).counts[dbA]
    await ta.fill(ZWSP_DRAFT)
    await row.getByTestId('save-draft').click()
    await page.waitForTimeout(1500)
    const n4 = (await idbFacts(page)).counts[dbA]
    const draftErr = (await page.locator('body').innerText()).match(/(blank|empty|invisible)[^\n]{0,80}/i)?.[0]
    check('AT22', 'a refused draft (invisible characters only) writes no answer and no version', n4.answers === nBeforeZ.answers && n4.versions === nBeforeZ.versions, { before: nBeforeZ, after: n4, message: draftErr })
    await shot(page, 'at22-03-refused-draft')
    // then a real draft saves normally
    if (!(await ta.count())) { if (await write.count()) await write.click(); else await row.getByTestId('adapt').click(); await ta.waitFor() }
    await ta.fill('Synthetic AT22 draft that must never leave the device.')
    const nBeforeOk = (await idbFacts(page)).counts[dbA]
    await row.getByTestId('save-draft').click()
    await page.waitForFunction(() => !document.querySelector('[data-testid="save-draft"]'), null, { timeout: 20_000 }).catch(() => {})
    await page.waitForTimeout(800)
    const n5 = (await idbFacts(page)).counts[dbA]
    await shot(page, 'at22-04-valid-draft-saved')
    check('AT22', 'a valid draft afterwards creates exactly one answer + one version', n5.answers === nBeforeOk.answers + 1 && n5.versions === nBeforeOk.versions + 1, { before: nBeforeOk, after: n5 })
    await ctx.close()
  }
} catch (e) {
  fatal = e
  console.log('FATAL', e.stack ?? e.message)
} finally {
  await browser.close()
}

// ── privacy over every request any page made ──
const leaks = []
for (const q of allRequests) for (const s of PRIVATE) if (q.body?.includes(s) || q.url.includes(encodeURIComponent(s).slice(0, 40))) leaks.push({ device: q.device, url: q.url.replace(BASE, ''), s: s.slice(0, 24) })
const offsite = allRequests.filter((q) => !q.url.startsWith(BASE))
results.requests = {
  total_recorded: allRequests.length,
  api_calls: [...new Set(allRequests.filter((q) => q.url.startsWith(`${BASE}/api/`)).map((q) => `${q.method} ${q.url.replace(BASE, '').replace(/\?.*$/, '')}`))],
  offsite_hosts_attempted_and_aborted: [...new Set(offsite.map((q) => new URL(q.url).host))],
  bodies_or_urls_with_private_content: leaks.length,
}
check('AT22', 'no request (URL or body) carried pasted text, drafts or vault secrets', leaks.length === 0, leaks.slice(0, 5))
if (fatal) results.checks.push({ at: 'harness', name: 'browser run completed', pass: false, detail: String(fatal.message).slice(0, 300) })
results.pass = results.checks.every((c) => c.pass)
fs.writeFileSync(path.join(OUT, 'browser-results.json'), JSON.stringify(results, null, 2) + '\n')
console.log(results.pass ? 'ACCEPTANCE BROWSER: PASS' : 'ACCEPTANCE BROWSER: FAIL')
process.exitCode = results.pass ? 0 : 1
