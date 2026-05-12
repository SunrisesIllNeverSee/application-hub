#!/usr/bin/env python3
"""
scrape_apply_questions.py

Headless browser extraction of application questions from accelerator,
VC, and grant apply pages. Uses Playwright/Chromium.

Goal: capture raw question text from every apply page. Every question
from every program — including ones already in the archive — because
frequency (how many programs ask it) is the data.

USAGE:
    # All 292 high + medium confidence programs from Phase A:
    python3 scripts/scrape_apply_questions.py --all

    # Resume if interrupted:
    python3 scripts/scrape_apply_questions.py --all --resume

    # Single batch file:
    python3 scripts/scrape_apply_questions.py \
        --input seed/staging/phase_b_batches/batch_01.json

    # Specific URLs for quick test:
    python3 scripts/scrape_apply_questions.py \
        --url https://www.bethnalgreenventures.com/apply --slug bgv-test

OUTPUT (JSONL — seed/staging/extracted_questions.jsonl):
    One JSON line per question found. Zero-question pages also logged.
    {slug, program_name, type, apply_url, question_text,
     platform, scraped_at, error}

THEN:
    python3 scripts/aggregate-question-frequency.py \
        --input seed/staging/extracted_questions.jsonl
"""

import asyncio
import csv
import json
import re
import sys
import time
from pathlib import Path
from datetime import datetime
from typing import Optional

# ── Config ────────────────────────────────────────────────────────────────────

OUTPUT_FILE   = "seed/staging/extracted_questions.jsonl"
SCREENSHOT_DIR = "seed/staging/screenshots"
CONCURRENCY   = 3
PAGE_TIMEOUT  = 20_000   # ms
SETTLE_WAIT   = 2.5      # seconds after load before extracting

# Labels that are logistics, not substantive questions
SKIP_EXACT = {
    "name", "first name", "last name", "full name", "email", "email address",
    "phone", "phone number", "mobile", "company", "company name",
    "organization", "website", "url", "linkedin", "linkedin url", "twitter",
    "location", "city", "state", "country", "postal code", "zip", "date",
    "upload", "attach", "resume", "cv", "how did you hear about us",
    "referral", "promo code", "coupon",
}

def is_substantive(text: str) -> bool:
    t = text.lower().strip()
    if len(t) < 10:
        return False
    if t in SKIP_EXACT:
        return False
    for skip in SKIP_EXACT:
        if t.startswith(skip + " ") or t.startswith(skip + "*") or t.startswith(skip + ":"):
            return False
    return True

# ── Platform detection ────────────────────────────────────────────────────────

def detect_platform(url: str) -> str:
    u = url.lower()
    if "typeform.com" in u or "tally.so" in u:  return "typeform"
    if "airtable.com" in u:                       return "airtable"
    if "acceleratorapp.co" in u:                  return "acceleratorapp"
    if "forms.gle" in u or "docs.google.com/forms" in u: return "google"
    if "forms.microsoft.com" in u or "forms.office.com" in u: return "microsoft"
    if "formstack.com" in u:                      return "formstack"
    if "formassembly.com" in u:                   return "formassembly"
    if "fillout.com" in u:                        return "fillout"
    if "hubspot" in u or "hs-form" in u:          return "hubspot"
    if "f6s.com" in u:                            return "f6s"
    if "gravityforms" in u:                       return "gravityforms"
    return "standard"

# ── Browser extractors ────────────────────────────────────────────────────────

async def extract_standard(page) -> list[str]:
    return await page.evaluate("""() => {
        const results = [];
        const seen = new Set();
        function add(t) {
            const s = (t || '').trim();
            if (s.length > 5 && !seen.has(s)) { seen.add(s); results.push(s); }
        }
        document.querySelectorAll('label').forEach(el => add(el.textContent));
        document.querySelectorAll('textarea, input[type="text"]').forEach(el => {
            add(el.getAttribute('aria-label'));
            const p = el.getAttribute('placeholder');
            if (p && p.length > 15) add(p);
        });
        document.querySelectorAll('li, p, h3, h4').forEach(el => {
            const t = (el.textContent || '').trim();
            if (/^\\d+[.)]\s+\\w/.test(t) && t.length > 20) {
                add(t.replace(/^\\d+[.)]\\s+/, ''));
            }
        });
        return results;
    }""")

async def extract_typeform(page) -> list[str]:
    # Try visible question title first
    results = await page.evaluate("""() => {
        const selectors = [
            '[data-qa="question-title"]',
            '[class*="question-title"]',
            '[class*="questionTitle"]',
            '.sc-fXgAZx',
        ];
        const seen = new Set();
        const out = [];
        for (const sel of selectors) {
            document.querySelectorAll(sel).forEach(el => {
                const t = (el.textContent || '').trim();
                if (t && !seen.has(t)) { seen.add(t); out.push(t); }
            });
        }
        return out;
    }""")
    if results:
        return results
    # Click through slides
    seen = set()
    questions = []
    for _ in range(25):
        q = await page.evaluate("""() => {
            const el = document.querySelector(
                '[data-qa="question-title"], [class*="question-title"]'
            );
            return el ? el.textContent.trim() : null;
        }""")
        if q and q not in seen:
            seen.add(q)
            questions.append(q)
        moved = await page.evaluate("""() => {
            const btn = document.querySelector(
                '[data-qa="ok-button"], [class*="next-btn"], button[aria-label="OK"]'
            );
            if (btn) { btn.click(); return true; }
            return false;
        }""")
        if not moved:
            break
        await asyncio.sleep(0.7)
    return questions

async def extract_airtable(page) -> list[str]:
    try:
        await page.wait_for_selector(
            ".cell-container, .fieldLabel, [data-fv-field]",
            timeout=8000
        )
    except Exception:
        pass
    return await page.evaluate("""() => {
        const seen = new Set();
        const out = [];
        document.querySelectorAll(
            '.fieldLabel, [data-fv-field] label, .cell-container .label'
        ).forEach(el => {
            const t = (el.textContent || '').trim();
            if (t && !seen.has(t)) { seen.add(t); out.push(t); }
        });
        return out;
    }""")

async def extract_acceleratorapp(page) -> list[str]:
    # AcceleratorApp: React SPA used by many accelerators as their dedicated
    # application management system. Labels render under .form-group.
    try:
        await page.wait_for_selector(
            ".form-group label, .question-label",
            timeout=8000
        )
    except Exception:
        pass
    return await page.evaluate("""() => {
        const seen = new Set();
        const out = [];
        document.querySelectorAll(
            '.form-group label, .question-label, [class*="form-label"]'
        ).forEach(el => {
            const t = (el.textContent || '').trim();
            if (t && !seen.has(t)) { seen.add(t); out.push(t); }
        });
        return out;
    }""")

async def extract_google(page) -> list[str]:
    try:
        await page.wait_for_selector(
            ".freebirdFormviewerViewItemsItemItemTitle",
            timeout=8000
        )
    except Exception:
        pass
    return await page.evaluate("""() => {
        const seen = new Set();
        const out = [];
        document.querySelectorAll(
            '.freebirdFormviewerViewItemsItemItemTitle, [role="heading"]'
        ).forEach(el => {
            const t = (el.textContent || '').trim();
            if (t && t.length > 5 && !seen.has(t)) { seen.add(t); out.push(t); }
        });
        return out;
    }""")

async def extract_microsoft(page) -> list[str]:
    try:
        await page.wait_for_selector(".question-content", timeout=8000)
    except Exception:
        pass
    return await page.evaluate("""() => {
        const seen = new Set();
        const out = [];
        document.querySelectorAll(
            '.question-content, [data-automation-id="question-title"]'
        ).forEach(el => {
            const t = (el.textContent || '').trim();
            if (t && !seen.has(t)) { seen.add(t); out.push(t); }
        });
        return out;
    }""")

async def get_questions(page, url: str) -> list[str]:
    platform = detect_platform(url)
    if platform == "typeform":        raw = await extract_typeform(page)
    elif platform == "airtable":      raw = await extract_airtable(page)
    elif platform == "acceleratorapp": raw = await extract_acceleratorapp(page)
    elif platform == "google":        raw = await extract_google(page)
    elif platform == "microsoft":     raw = await extract_microsoft(page)
    else:                             raw = await extract_standard(page)
    return [q for q in raw if is_substantive(q)]

# ── Scrape one program ────────────────────────────────────────────────────────

async def scrape_one(browser, program: dict, out_file, sem: asyncio.Semaphore):
    slug     = program.get("slug", "")
    name     = program.get("name") or program.get("program_name") or slug
    typ      = program.get("type", "")
    url      = program.get("discovered_apply_url") or program.get("apply_url") or ""
    platform = detect_platform(url)
    scraped  = datetime.utcnow().isoformat() + "Z"

    async with sem:
        page = await browser.new_page()
        questions = []
        error = None
        try:
            await page.set_extra_http_headers({
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                              "AppleWebKit/537.36 (KHTML, like Gecko) "
                              "Chrome/122.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
            })
            await page.goto(url, wait_until="networkidle", timeout=PAGE_TIMEOUT)
            await asyncio.sleep(SETTLE_WAIT)
            questions = await get_questions(page, url)
            status = f"✓ {len(questions)} questions [{platform}]"
        except Exception as e:
            error = str(e)[:100]
            status = f"✗ {error}"
        finally:
            await page.close()

        print(f"  {slug}: {status}")

        rows = questions if questions else [""]
        for q in rows:
            record = {
                "slug": slug, "program_name": name, "type": typ,
                "apply_url": url, "question_text": q,
                "platform": platform, "scraped_at": scraped,
                "error": error if not q else None,
            }
            out_file.write(json.dumps(record) + "\n")
        out_file.flush()

# ── Load programs ─────────────────────────────────────────────────────────────

def load_programs(mode: str, input_file: Optional[str]) -> list[dict]:
    if mode == "all":
        programs = []
        csv_path = "seed/staging/fundingcake_apply_urls.csv"
        with open(csv_path, newline="") as f:
            for row in csv.DictReader(f):
                conf = row.get("confidence", "")
                url  = row.get("discovered_apply_url", "")
                if conf in ("high", "medium") and url:
                    programs.append(row)
        print(f"Loaded {len(programs)} programs (high + medium) from Phase A")
        return programs
    elif input_file:
        programs = json.loads(Path(input_file).read_text())
        print(f"Loaded {len(programs)} programs from {input_file}")
        return programs
    return []

# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--all", action="store_true")
    p.add_argument("--input", default=None)
    p.add_argument("--output", default=OUTPUT_FILE)
    p.add_argument("--resume", action="store_true")
    p.add_argument("--url", default=None, help="Test a single URL")
    p.add_argument("--slug", default="test")
    args = p.parse_args()

    from playwright.async_api import async_playwright

    # Single URL test mode
    if args.url:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            page    = await browser.new_page()
            await page.goto(args.url, wait_until="networkidle", timeout=PAGE_TIMEOUT)
            await asyncio.sleep(SETTLE_WAIT)
            questions = await get_questions(page, args.url)
            print(f"\n{len(questions)} questions found:")
            for q in questions:
                print(f"  - {q}")
            await browser.close()
        return

    mode = "all" if args.all else ("file" if args.input else None)
    if not mode:
        p.print_help()
        sys.exit(1)

    programs = load_programs(mode, args.input)

    # Resume: skip already-done slugs
    if args.resume and Path(args.output).exists():
        done = set()
        with open(args.output) as f:
            for line in f:
                try:
                    done.add(json.loads(line)["slug"])
                except Exception:
                    pass
        before = len(programs)
        programs = [p for p in programs if p.get("slug") not in done]
        print(f"Resume: skipping {before - len(programs)}, {len(programs)} remaining")

    print(f"\nScraping {len(programs)} programs (concurrency: {CONCURRENCY})\n")

    flag = "a" if args.resume else "w"
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        sem     = asyncio.Semaphore(CONCURRENCY)
        with open(args.output, flag) as out_file:
            tasks = [scrape_one(browser, prog, out_file, sem) for prog in programs]
            await asyncio.gather(*tasks)
        await browser.close()

    # Quick summary
    total, with_q, unique_q = 0, 0, set()
    with open(args.output) as f:
        for line in f:
            try:
                obj = json.loads(line)
                if obj.get("question_text"):
                    total += 1
                    with_q += 1
                    unique_q.add(obj["question_text"].lower().strip())
            except Exception:
                pass
    print(f"\nDone → {args.output}")
    print(f"  {total} question rows | {len(unique_q)} unique questions")
    print(f"  Run: python3 scripts/aggregate-question-frequency.py --input {args.output}")

if __name__ == "__main__":
    asyncio.run(main())
