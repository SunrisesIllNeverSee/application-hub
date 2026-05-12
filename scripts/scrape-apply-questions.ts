/**
 * scrape-apply-questions.ts
 *
 * Headless browser (Playwright/Chromium) extraction of application questions
 * from accelerator, VC, and grant apply pages.
 *
 * PURPOSE: Build a frequency map of what questions programs actually ask.
 * Every extracted question is recorded — even if it already exists in the
 * archived_questions table. The frequency data (how many programs ask each
 * question) is what drives asked_by_count and program DNA weighting.
 *
 * INPUTS:
 *   --all        Read from seed/staging/fundingcake_apply_urls.csv
 *                (both high AND medium confidence — 292 programs total)
 *   --input f    Read from a specific JSON batch file
 *   --resume     Skip slugs already in the output file (safe to re-run)
 *   --no-screenshots  Skip saving screenshots (faster)
 *
 * OUTPUT (JSONL — one JSON object per line):
 *   {slug, program_name, type, apply_url, question_text, platform,
 *    scraped_at, screenshot_path, error}
 *
 *   Every program gets at least one line — even if no questions found
 *   (error field explains why). This is important: zero-question programs
 *   are data too (they confirm the URL is real but gated or empty).
 *
 * USAGE:
 *   # Install Playwright once:
 *   npm install --save-dev playwright
 *   npx playwright install chromium
 *
 *   # Run all 292 programs:
 *   npx tsx scripts/scrape-apply-questions.ts \
 *     --all --output seed/staging/extracted_questions.jsonl
 *
 *   # Resume if interrupted:
 *   npx tsx scripts/scrape-apply-questions.ts \
 *     --all --resume --output seed/staging/extracted_questions.jsonl
 *
 *   # After extraction, aggregate frequency:
 *   python3 scripts/aggregate-question-frequency.py
 *
 * PLATFORM DETECTION:
 *   Typeform, Airtable, AcceleratorApp, Google Forms, Microsoft Forms,
 *   Formstack, FormAssembly, Fillout, HubSpot, F6S, standard HTML forms.
 *   AcceleratorApp is the platform many accelerators use as their dedicated
 *   application management system (similar to an ATS) — it's fully
 *   React/JS-rendered, which is why curl/Firecrawl couldn't read it.
 */

import { chromium, Browser, Page } from 'playwright'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ─── Config ──────────────────────────────────────────────────────────────────

const SCREENSHOT_DIR = 'seed/staging/screenshots'
const PAGE_TIMEOUT   = 20_000
const FORM_TIMEOUT   = 8_000
const CONCURRENCY    = 3

// Labels that are logistics/contact, not substantive application questions
const SKIP_LABEL_EXACT = new Set([
  'name', 'first name', 'last name', 'full name', 'email', 'email address',
  'phone', 'phone number', 'mobile', 'company', 'company name', 'organization',
  'website', 'url', 'linkedin url', 'twitter', 'location', 'city', 'state',
  'country', 'postal code', 'zip', 'date', 'upload', 'attach', 'resume', 'cv',
  'how did you hear about us', 'referral source', 'promo code',
])

function isSubstantiveQuestion(text: string): boolean {
  const lower = text.toLowerCase().trim()
  if (lower.length < 10) return false
  if (SKIP_LABEL_EXACT.has(lower)) return false
  // Skip if it starts with a skip-label word (e.g. "Email address *")
  for (const skip of SKIP_LABEL_EXACT) {
    if (lower.startsWith(skip + ' ') || lower.startsWith(skip + '*')) return false
  }
  return true
}

// ─── Platform detection ───────────────────────────────────────────────────────

function detectPlatform(url: string): string {
  if (url.includes('typeform.com') || url.includes('tally.so')) return 'typeform'
  if (url.includes('airtable.com')) return 'airtable'
  if (url.includes('acceleratorapp.co')) return 'acceleratorapp'
  if (url.includes('forms.gle') || url.includes('docs.google.com/forms')) return 'google'
  if (url.includes('forms.microsoft.com') || url.includes('forms.office.com')) return 'microsoft'
  if (url.includes('formstack.com')) return 'formstack'
  if (url.includes('formassembly.com')) return 'formassembly'
  if (url.includes('fillout.com')) return 'fillout'
  if (url.includes('hubspot') || url.includes('hs-form')) return 'hubspot'
  if (url.includes('f6s.com')) return 'f6s'
  if (url.includes('gravityforms') || url.includes('gform')) return 'gravityforms'
  return 'standard'
}

// ─── Extractors (one per platform) ────────────────────────────────────────────

async function extractStandardForm(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const seen = new Set<string>()
    const results: string[] = []

    const add = (text: string | null | undefined) => {
      const t = text?.trim()
      if (t && t.length > 5 && !seen.has(t)) { seen.add(t); results.push(t) }
    }

    // Labels associated with textarea/text inputs
    document.querySelectorAll<HTMLLabelElement>('label').forEach(label => {
      add(label.textContent)
    })

    // aria-label on form controls
    document.querySelectorAll<HTMLElement>('textarea, input[type="text"]').forEach(el => {
      add(el.getAttribute('aria-label'))
      const ph = el.getAttribute('placeholder')
      if (ph && ph.length > 15) add(ph)
    })

    // Numbered prompts in paragraphs / list items
    document.querySelectorAll<HTMLElement>('li, p, h3, h4').forEach(el => {
      const text = el.textContent?.trim()
      if (text && /^\d+[.)]\s+\w/.test(text) && text.length > 20) {
        add(text.replace(/^\d+[.)]\s+/, ''))
      }
    })

    return results
  })
}

async function extractTypeform(page: Page): Promise<string[]> {
  // First try: read question text from visible DOM slides
  const fromDom = await page.evaluate(() => {
    const results: string[] = []
    document.querySelectorAll<HTMLElement>(
      '[data-qa="question-title"], [class*="question-title"], [class*="questionTitle"]'
    ).forEach(el => {
      const t = el.textContent?.trim()
      if (t) results.push(t)
    })
    return results
  })
  if (fromDom.length > 0) return fromDom

  // Fallback: click through slides up to 25 times
  const seen = new Set<string>()
  const questions: string[] = []
  for (let i = 0; i < 25; i++) {
    const q = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(
        '[data-qa="question-title"], [class*="question-title"], [class*="questionTitle"]'
      )
      return el?.textContent?.trim() ?? null
    })
    if (q && !seen.has(q)) { seen.add(q); questions.push(q) }
    const moved = await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>(
        '[data-qa="ok-button"], button[aria-label="OK"], [class*="next-btn"]'
      )
      if (btn) { btn.click(); return true }
      return false
    })
    if (!moved) break
    await page.waitForTimeout(600)
  }
  return questions
}

async function extractAirtable(page: Page): Promise<string[]> {
  await page.waitForSelector(
    '.cell-container, [data-fv-field], .fieldLabel, [class*="label"]',
    { timeout: FORM_TIMEOUT }
  ).catch(() => {})
  return page.evaluate(() => {
    const results: string[] = []
    document.querySelectorAll<HTMLElement>(
      '.fieldLabel, [data-fv-field] label, .cell-container .label, [class*="field-label"]'
    ).forEach(el => {
      const t = el.textContent?.trim()
      if (t) results.push(t)
    })
    return [...new Set(results)]
  })
}

async function extractAcceleratorApp(page: Page): Promise<string[]> {
  // AcceleratorApp: React SPA used by many accelerator programs as their
  // dedicated application management system. Fields render under .form-group.
  await page.waitForSelector(
    '.form-group label, .question-label, [class*="form-label"]',
    { timeout: FORM_TIMEOUT }
  ).catch(() => {})
  return page.evaluate(() => {
    const results: string[] = []
    document.querySelectorAll<HTMLElement>(
      '.form-group label, .question-label, [class*="form-label"]'
    ).forEach(el => {
      const t = el.textContent?.trim()
      if (t) results.push(t)
    })
    return [...new Set(results)]
  })
}

async function extractGoogleForm(page: Page): Promise<string[]> {
  await page.waitForSelector(
    '.freebirdFormviewerViewItemsItemItemTitle, [role="heading"]',
    { timeout: FORM_TIMEOUT }
  ).catch(() => {})
  return page.evaluate(() => {
    const results: string[] = []
    document.querySelectorAll<HTMLElement>(
      '.freebirdFormviewerViewItemsItemItemTitle, [data-params] [role="heading"]'
    ).forEach(el => {
      const t = el.textContent?.trim()
      if (t && t.length > 5) results.push(t)
    })
    return [...new Set(results)]
  })
}

async function extractMicrosoftForms(page: Page): Promise<string[]> {
  await page.waitForSelector(
    '.question-content, [data-automation-id="question-title"]',
    { timeout: FORM_TIMEOUT }
  ).catch(() => {})
  return page.evaluate(() => {
    const results: string[] = []
    document.querySelectorAll<HTMLElement>(
      '.question-content, [data-automation-id="question-title"]'
    ).forEach(el => {
      const t = el.textContent?.trim()
      if (t) results.push(t)
    })
    return [...new Set(results)]
  })
}

async function extractQuestionsFromPage(page: Page, url: string): Promise<string[]> {
  const platform = detectPlatform(url)
  let raw: string[] = []

  if (platform === 'typeform') raw = await extractTypeform(page)
  else if (platform === 'airtable') raw = await extractAirtable(page)
  else if (platform === 'acceleratorapp') raw = await extractAcceleratorApp(page)
  else if (platform === 'google') raw = await extractGoogleForm(page)
  else if (platform === 'microsoft') raw = await extractMicrosoftForms(page)
  else raw = await extractStandardForm(page)

  return raw.filter(isSubstantiveQuestion)
}

// ─── Program scraper ──────────────────────────────────────────────────────────

interface Program {
  slug: string
  name?: string
  program_name?: string
  type: string
  discovered_apply_url?: string
  apply_url?: string
  confidence?: string
}

interface ExtractedQuestion {
  slug: string
  program_name: string
  type: string
  apply_url: string
  question_text: string        // empty string if none found
  platform: string
  scraped_at: string
  screenshot_path: string | null
  error: string | null         // null if successful, reason string if not
}

async function scrapeProgram(
  browser: Browser,
  program: Program,
  outputStream: fs.WriteStream,
  takeScreenshots: boolean
): Promise<void> {
  const applyUrl = program.discovered_apply_url ?? program.apply_url ?? ''
  const slug = program.slug
  const name = program.name ?? program.program_name ?? slug
  const scraped_at = new Date().toISOString()
  const platform = detectPlatform(applyUrl)

  const page = await browser.newPage()
  let screenshotPath: string | null = null
  let error: string | null = null
  let questions: string[] = []

  try {
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    })

    await page.goto(applyUrl, { waitUntil: 'networkidle', timeout: PAGE_TIMEOUT })
    await page.waitForTimeout(2500) // extra settle time for SPAs and lazy-loading

    if (takeScreenshots) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
      const screenshotFile = path.join(SCREENSHOT_DIR, `${slug}.png`)
      await page.screenshot({ path: screenshotFile, fullPage: true })
      screenshotPath = screenshotFile
    }

    questions = await extractQuestionsFromPage(page, applyUrl)

    if (questions.length > 0) {
      console.log(`  ✓ ${slug}: ${questions.length} questions [${platform}]`)
    } else {
      console.log(`  — ${slug}: 0 questions [${platform}] (gated/empty)`)
      error = 'none_found'
    }

  } catch (err) {
    error = (err as Error).message.slice(0, 120)
    console.error(`  ✗ ${slug}: ${error}`)
  } finally {
    await page.close()
  }

  // Always write at least one row — zero-question programs are data too
  const rows: ExtractedQuestion[] = questions.length > 0
    ? questions.map(question_text => ({
        slug, program_name: name, type: program.type, apply_url: applyUrl,
        question_text, platform, scraped_at, screenshot_path: screenshotPath, error: null,
      }))
    : [{
        slug, program_name: name, type: program.type, apply_url: applyUrl,
        question_text: '', platform, scraped_at,
        screenshot_path: screenshotPath, error: error ?? 'none_found',
      }]

  for (const row of rows) {
    outputStream.write(JSON.stringify(row) + '\n')
  }
}

// ─── CSV parser (no external dependency) ──────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const allMode    = args.includes('--all')
  const resume     = args.includes('--resume')
  const noScreens  = args.includes('--no-screenshots')
  const inputIdx   = args.indexOf('--input')
  const outputIdx  = args.indexOf('--output')
  const inputFile  = inputIdx >= 0 ? args[inputIdx + 1] : null
  const outputFile = outputIdx >= 0 ? args[outputIdx + 1] : 'seed/staging/extracted_questions.jsonl'

  let programs: Program[] = []

  if (allMode) {
    const csvContent = fs.readFileSync('seed/staging/fundingcake_apply_urls.csv', 'utf8')
    const lines = csvContent.split('\n').filter(Boolean)
    const header = parseCSVLine(lines[0])
    const slugIdx   = header.indexOf('slug')
    const nameIdx   = header.indexOf('name')
    const typeIdx   = header.indexOf('type')
    const urlIdx    = header.indexOf('discovered_apply_url')
    const confIdx   = header.indexOf('confidence')

    programs = lines.slice(1)
      .map(line => {
        const cols = parseCSVLine(line)
        return {
          slug: cols[slugIdx],
          name: cols[nameIdx],
          type: cols[typeIdx],
          discovered_apply_url: cols[urlIdx],
          confidence: cols[confIdx],
        }
      })
      .filter(p => (p.confidence === 'high' || p.confidence === 'medium') && p.discovered_apply_url)

    console.log(`Loaded ${programs.length} programs (high + medium confidence) from Phase A`)
  } else if (inputFile) {
    programs = JSON.parse(fs.readFileSync(inputFile, 'utf8'))
    console.log(`Loaded ${programs.length} programs from ${inputFile}`)
  } else {
    console.error('Usage: --all [--resume] [--no-screenshots] [--output file.jsonl]')
    console.error('       --input batch.json [--output file.jsonl]')
    process.exit(1)
  }

  // Resume: skip already-processed slugs
  if (resume && fs.existsSync(outputFile)) {
    const done = new Set<string>()
    fs.readFileSync(outputFile, 'utf8').split('\n').filter(Boolean).forEach(line => {
      try { done.add(JSON.parse(line).slug) } catch {}
    })
    const before = programs.length
    programs = programs.filter(p => !done.has(p.slug))
    console.log(`Resume: skipping ${before - programs.length} done, ${programs.length} remaining`)
  }

  const outputStream = fs.createWriteStream(outputFile, { flags: resume ? 'a' : 'w' })
  const browser = await chromium.launch({ headless: true })

  console.log(`\nScraping ${programs.length} programs (concurrency: ${CONCURRENCY})\n`)
  let done = 0

  for (let i = 0; i < programs.length; i += CONCURRENCY) {
    const batch = programs.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(p => scrapeProgram(browser, p, outputStream, !noScreens)))
    done += batch.length
    if (done % 30 === 0) console.log(`\n--- Progress: ${done}/${programs.length} ---\n`)
  }

  await browser.close()
  outputStream.end()

  console.log(`\nComplete. Output: ${outputFile}`)
  console.log('Next: python3 scripts/aggregate-question-frequency.py')
}

main().catch(err => { console.error(err); process.exit(1) })
