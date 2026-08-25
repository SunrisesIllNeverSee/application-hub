# AQUA Application Hub — SEO/GEO/AEO Phased Implementation Plan

> **Target site:** mos2es.xyz (Next.js 15, Vercel, `app/` root)
> **Repo:** `/Users/dericmchenry/Developer/built/application-hub`
> **Reference:** signalaf.com playbook (7 phases shipped, B- → A-)
> **Adapted from:** `docs/seo-aeo-geo-build-package/playbook/SEO_GEO_AEO_PLAYBOOK.md`
>
> This plan adapts the signalaf.com playbook for AQUA. The signalaf playbook
> was written for mos2es.com (static HTML, 11 pages) but AQUA is now a
> Next.js 15 app at mos2es.xyz with ~7 public pages, 40+ API routes, an MCP
> server, and an OpenAPI spec. The principles are the same; the implementation
> uses Next.js App Router conventions.

---

## Current state (audited 2026-08-25)

### Already done
- [x] Organization + WebSite + SoftwareApplication JSON-LD on homepage
- [x] `sameAs` includes npm package URL (brand discoverability)
- [x] `llms.txt` with when-to-use, MCP, CLI, REST API, developer portal sections
- [x] `robots.ts` allows all crawlers, references sitemap
- [x] Dynamic `sitemap.ts` (static routes + program pages from Supabase)
- [x] OpenAPI spec at `/openapi.json` (10 typed operations)
- [x] Developer portal at `/developers`
- [x] MCP manifest at `/.well-known/mcp`
- [x] MCP server published to npm (`application-hub-mcp-server@1.0.0`)
- [x] Markdown content negotiation (`Accept: text/markdown`)
- [x] `opengraph-image.tsx` (dynamic OG image via `next/og`)

### Gaps this plan closes

| # | Gap | Impact | Phase |
|---|-----|--------|-------|
| 1 | No BreadcrumbList on sub-pages | Medium (SEO + GEO) | 1 |
| 2 | No FAQPage schema anywhere | High (AI citation) | 1 |
| 3 | No DefinedTerm schema for AQUA concepts | High (AI citation) | 1 |
| 4 | No per-page OG images for key routes | Low (polish) | 1 |
| 5 | No AEO audit run for mos2es.xyz | Critical (baseline) | 2 |
| 6 | Opening paragraphs use proprietary vocabulary | High (AEO) | 2 |
| 7 | No content pages (vs/, guides, metrics, faq) | High (long-tail) | 3 |
| 8 | No GSC setup for mos2es.xyz | Critical (indexing) | 4 |
| 9 | No IndexNow integration | Medium (Bing speed) | 4 |
| 10 | No Screaming Frog baseline crawl | High (site health) | 5 |
| 11 | No weekly citation tracking process | Medium (ongoing) | 6 |
| 12 | GitHub topics not set on the repo | Quick win | 1 |

---

## Phase 1 — Structured Data + Quick Wins (code)

**Goal:** Add the JSON-LD types that AI engines extract from, plus GitHub/npm discoverability.

**Deliverables:**
1. `BreadcrumbList` on `/about`, `/about/scoring`, `/contact`, `/privacy`, `/developers`, `/agents`
2. `FAQPage` schema on a new `/faq` page (8-10 Q&A pairs about AQUA)
3. `DefinedTerm` schema on `/about/scoring` for each scoring concept (Significance, Fit, Composite, Heat, Program Value)
4. `ItemList` schema on `/hub` (list of programs)
5. Per-page OG images for `/about`, `/developers`, `/hub` (using `next/og`)
6. GitHub topics on `SunrisesIllNeverSee/application-hub` repo
7. `llms.txt` updated with `/faq` and any new pages
8. Sitemap updated with `/faq`
9. Tests for all new JSON-LD

**Files to create/edit:**
- `app/faq/page.tsx` (new)
- `app/about/page.tsx` (add BreadcrumbList)
- `app/about/scoring/page.tsx` (add BreadcrumbList + DefinedTerm)
- `app/contact/page.tsx` (add BreadcrumbList)
- `app/privacy/page.tsx` (add BreadcrumbList)
- `app/developers/page.tsx` (add BreadcrumbList)
- `app/agents/page.tsx` (add BreadcrumbList)
- `app/hub/page.tsx` (add ItemList)
- `app/about/opengraph-image.tsx` (new)
- `app/developers/opengraph-image.tsx` (new)
- `app/sitemap.ts` (add /faq)
- `public/llms.txt` (add /faq)
- `lib/jsonld.ts` (new — shared JSON-LD builders)
- `tests/agent-readiness.test.mjs` (new assertions)

**Verification:**
- `npx tsc --noEmit` — 0 errors
- `npm run test:agent` — all pass
- validator.schema.org — 0 errors on each page type
- search.google.com/test/rich-results — FAQPage eligible
- Live: `curl -s https://mos2es.xyz/faq | grep FAQPage`

---

## Phase 2 — AEO Audit + Opening Paragraph Rewrites (code + content)

**Goal:** Run the 46-prompt test panel across 7 engines for mos2es.xyz, then fix the query association gap.

**Step 2a — Run the audit (manual, ~2 hours):**
1. Adapt the 46-prompt panel from `aeo-audit/PERPLEXITY_PROMPTS.md` for AQUA
2. Run across: ChatGPT Search, Perplexity, Claude, Google AI Overviews, Gemini, Grok, Copilot
3. Log results in `docs/seo-aeo-geo-build-package/aeo-audit/audit-results/`
4. Score: mentioned? cited? correct? hallucinated?
5. Identify failed broad prompts

**Step 2b — Rewrite opening paragraphs (code):**
For each page that fails broad prompt retrieval, rewrite the opening paragraph to:
- Answer the natural-language query first (before introducing AQUA branding)
- Include the query phrase in the first 100 words
- Use category language ("application answer reuse", "opportunity fit scoring") not just product language ("AQUA", "Smart Matcher")

**Key pages to audit and potentially rewrite:**
- `/` (homepage hero subtitle)
- `/about` (what is AQUA?)
- `/about/scoring` (what is fit score? what is significance?)
- `/developers` (what is the AQUA API?)
- `/agents` (what is the Contribution Exchange?)

**Deliverables:**
- `docs/seo-aeo-geo-build-package/aeo-audit/audit-results/AQUA_*.md` (7 engine logs)
- `docs/seo-aeo-geo-build-package/aeo-audit/reconciliation/AQUA_RECONCILIATION_SHEET.md`
- Rewritten opening paragraphs on failing pages
- `llms.txt` updated if any new category language is introduced

**Verification:**
- Re-run the 46-prompt panel after deployment
- Compare retrieval rates before vs after
- Log in `audit-results/` with new dated entries

---

## Phase 3 — Content Layer (code + content)

**Goal:** Build content pages that capture long-tail search intent for AQUA's category.

**Page types (modeled on signalaf.com's 34-page build):**

### 3a — FAQ page (highest ROI, do first)
- `/faq` — 15-20 Q&A pairs in natural language
- Each question as H2, one-sentence answer first, then elaborate
- `FAQPage` JSON-LD schema (Phase 1 adds the schema, Phase 3 fills content)
- Topics: What is AQUA? Is AQUA an admissions oracle? How does answer reuse work? What is Smart Matcher? What is fit score? Is AQUA free? How does the MCP server work? etc.

### 3b — Concept/definition pages (definitional, AI-citable)
- `/concepts/answer-reuse` — "What is answer reuse in applications?"
- `/concepts/fit-score` — "What is opportunity fit scoring?"
- `/concepts/application-graph` — "What is a portable application graph?"
- `/concepts/answer-lineage` — "What is answer lineage?"
- `/concepts/smart-matcher` — "What is Smart Matcher for applications?"
- Each gets `DefinedTerm` JSON-LD

### 3c — Guide pages (how-to intent)
- `/guides/how-to-reuse-application-answers`
- `/guides/how-to-compare-accelerator-fit`
- `/guides/how-to-stress-test-application-answers`
- `/guides/how-to-build-an-answer-bank`

### 3d — Comparison pages (vs intent)
- `/vs/switchboard` (or whatever competitors emerge)
- `/vs/manual-application-tracking`
- `/vs/spreadsheets-for-applications`

### 3e — Topic hub
- `/application-infrastructure` — hub page linking to all concept/guide pages

**Deliverables:**
- 15-20 new pages (start with FAQ + 5 concept pages + 3 guides)
- Each page: unique title, meta description ≤155 chars, one H1, unique H2s
- `BreadcrumbList` on every new page
- All new pages added to sitemap + llms.txt
- Internal links from homepage footer + about page

**Verification:**
- `npx tsc --noEmit` — 0 errors
- `npm run test:agent` — all pass
- Screaming Frog crawl (Phase 5) shows no new issues
- All new URLs return 200

---

## Phase 4 — Google Search Console + IndexNow (setup + code)

**Goal:** Get mos2es.xyz into Google Search Console and set up programmatic indexing.

**Step 4a — GSC setup (owner action, ~15 min):**
1. Go to https://search.google.com/search-console
2. Add property: `sc-domain:mos2es.xyz` (Domain property, requires DNS verification)
3. Verify via DNS TXT record (Vercel DNS or Porkbun)
4. Submit sitemap: `https://mos2es.xyz/sitemap.xml`

**Step 4b — GSC API toolkit (code):**
1. Copy `gsc-toolkit/gsc.mjs` to `scripts/gsc/gsc.mjs`
2. Update defaults: `GSC_SITE=sc-domain:mos2es.xyz`
3. Set up service account + key at `~/.config/aqua/gsc-sa.json`
4. Add `scripts/gsc/README.md` with AQUA-specific instructions
5. Add `AGENTS.md` section with GSC commands

**Step 4c — IndexNow (code):**
1. Generate IndexNow key: `openssl rand -hex 16`
2. Save as `public/<key>.txt`
3. Create `app/api/indexnow/route.ts` — accepts POST, forwards to IndexNow API
4. Add IndexNow push script: `scripts/indexnow-push.mjs`
5. Push all sitemap URLs after deployment

**Deliverables:**
- GSC property verified for mos2es.xyz
- `scripts/gsc/gsc.mjs` adapted for AQUA
- `app/api/indexnow/route.ts`
- `scripts/indexnow-push.mjs`
- `AGENTS.md` updated with GSC + IndexNow commands

**Verification:**
- `node scripts/gsc/gsc.mjs sitemaps:list` — shows submitted sitemap
- `node scripts/gsc/gsc.mjs check:index` — shows index status
- IndexNow push returns 200

---

## Phase 5 — Screaming Frog Crawl + Fix Campaign (manual + code)

**Goal:** Baseline site health, then fix all issues.

**Step 5a — Baseline crawl (manual, ~30 min):**
1. Download Screaming Frog SEO Spider (free, 500 URLs)
2. Crawl `https://mos2es.xyz`
3. Export: All Internal Links, All External Links, Orphan Pages, Redirects, Issues
4. Save exports to `docs/seo-aeo-geo-build-package/screaming-frog/`

**Step 5b — Fix campaign (code, ~2-4 hours):**
Prioritize:
1. Broken links (404s) — fix or remove
2. Redirect chains — flatten
3. Missing/duplicate title tags — fix
4. Missing/duplicate meta descriptions — fix
5. Missing H1 — add
6. Duplicate H2s — make unique
7. Security headers — add CSP, X-Frame-Options, etc. (in `vercel.json` or `next.config.mjs`)
8. Images missing width/height — add
9. Orphan pages — add internal links

**Step 5c — Re-crawl (manual, ~30 min):**
1. Re-run Screaming Frog
2. Compare issue count: before vs after
3. Save post-fix exports

**Deliverables:**
- `docs/seo-aeo-geo-build-package/screaming-frog/crawl-1-baseline/` (exports)
- `docs/seo-aeo-geo-build-package/screaming-frog/crawl-2-post-fix/` (exports)
- All fixes committed and deployed
- Issue count reduced by ≥50%

---

## Phase 6 — Ongoing Maintenance (process)

**Goal:** Establish the weekly/monthly/quarterly cadence.

**Weekly (15 min):**
- Run 10-15 AQUA target queries in incognito across ChatGPT, Perplexity, Claude, Google AI Overviews
- Record: mentioned? cited? which competitor cited instead?
- Log in `docs/seo-aeo-geo-build-package/aeo-audit/audit-results/`

**Weekly (5 min):**
- Check GSC for AI Overviews + query impressions
- `node scripts/gsc/gsc.mjs analytics 7`

**Bi-weekly (30 min):**
- Refresh core page content (homepage, about, faq, scoring)

**Monthly (30 min):**
- Full AEO citation audit (46-prompt panel across 7 engines)
- IndexNow push for any changed URLs
- AI crawler access check (`curl https://mos2es.xyz/robots.txt`)

**Quarterly (2 hours):**
- Screaming Frog crawl + compare
- Content decay review
- llms.txt + sitemap audit

**Deliverables:**
- `docs/seo-aeo-geo-build-package/maintenance/` directory
- `docs/seo-aeo-geo-build-package/maintenance/TRACKING_SHEET.md` (citation tracking)
- `docs/seo-aeo-geo-build-package/maintenance/CADENCE.md` (schedule)

---

## Execution order (recommended)

```
Phase 1 (structured data)     ← highest ROI, code-only
    ↓
Phase 4a (GSC setup)          ← owner action, unblocks indexing
    ↓
Phase 2 (AEO audit)           ← needs baseline before content
    ↓
Phase 3 (content layer)       ← guided by audit findings
    ↓
Phase 4b-c (GSC API + IndexNow) ← code, after GSC verified
    ↓
Phase 5 (Screaming Frog)      ← after all content shipped
    ↓
Phase 6 (maintenance)         ← ongoing
```

**Phases 1 and 4a can run in parallel.**
**Phase 2a (audit) can start while Phase 1 is being implemented.**

---

## What NOT to do

1. Don't block AI crawlers — being in the training corpus is the moat
2. Don't audit once and never re-run — citation share shifts weekly
3. Don't trust a single LLM snapshot — run queries 2-3 times
4. Don't create new content before refreshing existing — 70/30 rule
5. Don't push already-indexed URLs to GSC — wastes API quota
6. Don't change robots.txt without verifying AI bot access after
7. Don't forget llms.txt is manual — new pages need to be added by hand
8. Don't ignore Perplexity — it's the most citation-heavy engine
9. Don't skip the feedback loop — every finding needs an action item
10. Don't use SVG for OG images — most platforms don't render them

---

## Owner-only actions (Devin cannot do these)

| # | Action | When | Phase |
|---|--------|------|-------|
| 1 | Verify GSC domain property via DNS | Before Phase 4b | 4a |
| 2 | Set GitHub topics on the repo | Anytime | 1 |
| 3 | Run Screaming Frog (desktop app) | Phase 5 | 5 |
| 4 | Run AEO audit queries (manual, incognito) | Phase 2a | 2 |
| 5 | Set up GCP service account for GSC API | Phase 4b | 4b |

---

*Adapted from the signalaf.com SEO/GEO/AEO playbook (July-August 2026).
7 phases shipped on signalaf.com, 7-engine audit run, 5 reconciliation tiers
implemented, 24 content pages built, 2 Screaming Frog crawls (B- → A-).*
