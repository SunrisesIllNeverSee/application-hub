# AQUA SEO/AEO/GEO Maintenance Process

> Phase 6 — ongoing maintenance cadence after Phases 1-5 are complete.

## Weekly

1. **Run the SEO crawler**
   ```bash
   node scripts/seo-crawl.mjs
   ```
   Check for new broken links, missing canonicals, or missing JSON-LD on any
   new pages. Fix issues immediately.

2. **Push sitemap to IndexNow**
   ```bash
   node scripts/indexnow-push.mjs
   ```
   Notifies Bing/Yandex of any sitemap changes from the past week.

3. **Check GSC (owner action)**
   - Log into Google Search Console
   - Check Coverage report for new errors
   - Check Performance report for impression/click trends
   - Submit any new URLs via the URL Inspection tool

## Monthly

1. **Re-run the SEO crawler** with full output and compare to previous month.
   Look for:
   - New orphan pages (pages in sitemap but not internally linked)
   - Title/description drift on existing pages
   - New redirect chains

2. **Review llms.txt** — ensure all public pages are listed. Add any new
   content pages, API routes, or developer resources.

3. **Review sitemap** — ensure all public pages are included. Remove any
   pages that have been deleted or redirected.

4. **Check competitor landscape** — scan for new competitors or positioning
   changes. Update comparison pages if needed.

5. **Review JSON-LD** — run the crawler and verify every content page has
   appropriate structured data (BreadcrumbList + page-type schema).

## Quarterly

1. **Full AEO audit (owner action)** — run the 46-prompt, 7-engine AEO audit
   in incognito mode across ChatGPT, Perplexity, Claude, Gemini, Copilot,
   Google AI Overviews, and Bing Copilot. Document which prompts cite AQUA
   and which don't. Update content to address gaps.

2. **Content gap analysis** — review search console queries, competitor
   content, and AI engine citations. Identify new content opportunities
   (concepts, guides, comparisons) and build them following the Phase 3
   pattern.

3. **Security header audit** — run the crawler and verify all security
   headers are present on all routes. Update CSP if new third-party
   services are added.

4. **IndexNow key rotation** — consider rotating the IndexNow key annually
   for security. Update the key file, API route, and push script.

## On-demand (after any content change)

1. **Push changed URLs to IndexNow**
   ```bash
   node scripts/indexnow-push.mjs /faq /about
   ```

2. **Submit to GSC** (owner action) — use the URL Inspection tool to request
   indexing for any significantly changed pages.

3. **Run tests**
   ```bash
   cd app && npx tsc --noEmit && npm run test:agent
   ```

## Files to maintain

| File | Purpose | Update when |
|------|---------|-------------|
| `app/app/sitemap.ts` | Sitemap generation | New pages added/removed |
| `app/public/llms.txt` | Agent discovery | New pages, API routes, or resources |
| `app/lib/jsonld.ts` | JSON-LD builders + BREADCRUMBS | New breadcrumb trails or schema types |
| `app/lib/agent-content.mjs` | Markdown content negotiation | New content pages |
| `app/next.config.mjs` | Security headers + redirects | New routes or third-party services |
| `scripts/seo-crawl.mjs` | SEO crawler | Run weekly |
| `scripts/indexnow-push.mjs` | IndexNow submission | Run after content changes |
| `scripts/indexnow-ping.sh` | Direct IndexNow ping (bash) | Alternative to push script |

## Phase completion status

| Phase | Status | Notes |
|-------|--------|-------|
| 1 — Structured data | ✅ Complete | Commit 58eafd6 + 2daa9e1 |
| 2b — Category language rewrites | ✅ Complete | Commit 20fda3f |
| 3 — Content layer (12 pages) | ✅ Complete | Commit 254c86d |
| 4c — IndexNow API route | ✅ Complete | Commit 0165422 |
| 5a — SEO crawler | ✅ Complete | Commit 2706955 |
| 5b — Crawl fixes | ✅ Complete | Commit 2706955 |
| 5b — Security headers | ✅ Complete | Commit 0165422 |
| 6 — Maintenance process | ✅ This document | Ongoing |
