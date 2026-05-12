# Grok Buildout Hit List
> Derived from codex/Grokraw.md — Grok's full strategic + technical session.
> Ordered by dependency chain, not arbitrary priority.
> Everything here is buildable. Nothing is wishful.

---

## Tier 1 — Ship These First (Foundation)

### 1.1 Chrome / Browser Extension V1
**What:** MV3 content script that detects supported portals, reads live DOM, semantic-matches questions to user's answer bank, pre-fills with real browser events (input + change + blur) that React/SPA forms respect.

**Why first:** Solves the JS-portal scraping wall entirely. Turns AcceleratorApp, CommonApp, Grants.gov, and every other React-rendered portal into a pre-fill target without any server-side scraping.

**Key technical details from Grok:**
- `MutationObserver` watching `document.body` for dynamic field rendering
- Label resolution: `field.labels[0]` → `label[for=id]` → `closest('label')` → `.label / .question-text` parent
- Real event dispatch: `field.focus()` → set value → `new Event('input', { bubbles: true })` → `change` → `blur`
- Background service worker handles MCP/API calls, `chrome.storage.local` for answer bank cache
- Never send raw answers to server unless user explicitly opts in for persona building
- Popup: "Connected • Pre-fill enabled" + manual trigger + fit score preview

**Portal whitelist V1:** AcceleratorApp (`*.acceleratorapp.co`), CommonApp (`*.commonapp.org`), Grants.gov (`*.grants.gov`)

**Capture mode (bonus):** "New question detected → screenshot + submit to Hub" → user earns daily unlocks. This is the living archive growth engine.

---

### 1.2 Persona Profile Tables
**What:** Three new Postgres tables that turn the answer bank into a compounding persona.

**SQL from Grok:**
```sql
-- Root persona record
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  commitment_hash TEXT NOT NULL,
  provenance_chain JSONB,
  personal_info JSONB,
  persona_embedding VECTOR(1536),
  modes_enabled TEXT[] DEFAULT ARRAY['founder'],
  is_verified BOOLEAN DEFAULT false
);

-- Scored, versioned, governed answers
CREATE TABLE profile_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  question_id TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  commitment_hash TEXT NOT NULL,
  lineage_hash TEXT NOT NULL,
  significance_score NUMERIC(4,2),
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  applicable_modes TEXT[] DEFAULT ARRAY['founder'],
  version INTEGER DEFAULT 1,
  superseded_by UUID REFERENCES profile_answers(id),
  UNIQUE(profile_id, question_id, version)
);

-- Derived signals — where the magic happens
CREATE TABLE profile_persona_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  enrichment_type TEXT NOT NULL,
  value JSONB,
  embedding VECTOR(1536),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  source_model TEXT,
  governance_envelope JSONB
);
```

**Data flow:** Raw answer → significance scored → nightly enrichment job generates `persona_embedding` + enrichments (e.g., "founder_archetype: deep-tech IP moat") → living modes re-enrich, jobs mode frozen.

**MCP query pattern:**
```json
{
  "query": "Tell us about your team",
  "mode": "founder",
  "profile_id": "uuid",
  "return": ["answer_text", "significance_score", "fit_score"]
}
```
Sub-200ms via pgvector.

---

### 1.3 "Port My Persona" Export Button
**What:** One-click export from the profile page in three formats. GDPR compliance + portability story + competitive differentiation in one feature.

**Three export formats:**

**A — GDPR JSON (ship first, easiest):**
```json
{
  "@context": "https://mos2es.xyz/ns/portability/v1",
  "exportedAt": "...",
  "commitmentHash": "sha256:...",
  "modes": ["founder", "grant", "university", "job"],
  "answers": [{ "questionId": "...", "answerText": "...", "significanceScore": 0.92, "commitmentHash": "...", "lineageHash": "..." }],
  "personaEnrichments": [{ "type": "founder_archetype", "value": "deep-tech IP moat", "confidence": 0.94 }]
}
```

**B — HR Open / LER-RS v2 (phase 2):**
Maps your scored answers into the standard Candidate/Person Profile schema. Instantly makes any persona export a valid LER-RS resume. Register for free HR Open account, download 4.5RC spec.

**C — W3C Verifiable Credential (phase 3):**
Wraps persona in a cryptographically verifiable VC. MO§ES™ `commitment_hash` + `lineage_hash` become natural VC proofs. Use `@digitalcredentials/vc` or `jsonld-signatures` (Node.js). BBS+ selective disclosure for sharing only specific answers with specific programs.

**Extension integration:** "Share consented signal with this program" → generates selective-disclosure VC → program can verify without seeing full profile.

---

## Tier 2 — Competitive Positioning Layer

### 2.1 AcceleratorApp Integration Angle
**What:** The browser extension + pre-fill story becomes a specific pitch: "the founder power-up for every program running on AcceleratorApp."

**Build:** Detect AcceleratorApp-powered portals by URL pattern (`*.acceleratorapp.co` + known subdomain list). Add AcceleratorApp-specific label selectors to the extension since their forms are React-based with consistent class names.

**Why this matters:** AcceleratorApp serves 500+ programs. Every one of those program's applicants is a potential user who needs exactly what this product does. Their applicant portal is the distribution channel.

**Pitch to programs:** "Your applicants look sharper when they use Application Hub. Better applications → better cohorts → less review time for you." Optional: surface anonymized persona fit scores to programs (with applicant consent).

---

### 2.2 Living Archive Growth Engine
**What:** The extension's capture mode + user submission pipeline combined with Playwright scraping for high-value portals.

**Hybrid architecture Grok recommended:**
- **User-facing:** Chrome extension capture mode (user sees question → one click → submits to Hub archive → earns daily unlocks). Zero scraping infrastructure needed for the core.
- **Backend curation:** Playwright + managed cloud browser (Browserless.io, ScrapingBee, Zyte) for weekly scheduled runs on high-value living-mode portals. Use `playwright-stealth` to avoid bot detection.
- **Jobs mode:** One-time historical scrape of Greenhouse/Lever/Ashby form snapshots. Static — never re-runs.

**Managed scraping APIs ranked for your use case:** Firecrawl → Scrapfly → Zyte → ScrapingBee. Give them a URL + "extract every form field and label" → clean structured output. Cheapest for scale once adding 50+ programs/month.

---

### 2.3 Jobs Mode — Static Historical Archive
**What:** Separate treatment for jobs vs. the three living modes (founder/grants/universities).

**Implementation:**
- `profile_answers` rows get `static = true` flag for job-mode answers
- Job-mode answers never re-enrich after initial import
- When user toggles "Job-seeker mode" → extension/MCP filters to static archive + job-specific significance scores
- Persona enrichments shared across modes (founder answers inform job applications — "leadership experience" carries over)
- Jobs mode never triggers living updates or nightly enrichment jobs

**Why static:** Avoids constant scraping churn with ATS platforms (Greenhouse, Lever, Ashby) that have strict ToS. Historic archive framed as research/reference = much safer legal posture.

---

## Tier 3 — The Hosting Source Vision

### 3.1 Applicant Persona → Program-Side API
**What:** Once the persona layer has critical mass, expose an opt-in consented API for programs to query anonymized fit signals from your repository.

**How it works:**
1. Applicant builds rich persona in Application Hub
2. When applying through any portal, full governed application can be optionally hosted/referenced in your repository
3. Programs get an opt-in "Application Hub Sourcing" button → browse/search high-fit anonymized personas → request warm intros or full applications
4. You earn usage fees, premium sourcing access, or revenue share

**This is not competing with AcceleratorApp.** They manage the review process. You supply the pre-filled, persona-scored, governed applications. Complementary — they're distribution.

---

### 3.2 W3C Verifiable Credentials — Full Implementation
**What:** Issue VCs directly from Application Hub as `did:web:mos2es.xyz`. Applicants hold credentials in digital wallets. Programs verify without seeing raw data.

**Stack:**
- Issuer: `did:web:mos2es.xyz`
- Proof format: Data Integrity Proof with BBS+ (selective disclosure)
- Library: `@digitalcredentials/vc` or `jsonld-signatures`
- Let user's browser/extension sign on-device — keeps you out of the proof loop, maximizes sovereignty

**This turns MO§ES™ commitment hashes + lineage hashes into verifiable cryptographic proofs — not just internal governance metadata.**

---

### 3.3 Homepage Copy — "Persona + Auto-Vet" Future
**Grok's draft (use when persona layer ships):**

> **Hero:** Your answers. Your sovereign persona. Portable anywhere.
>
> **Sub:** Build once. Export as GDPR JSON, LER-RS, or W3C Verifiable Credential. Pre-fill any accelerator, grant, university, or job application — or hand your full governed profile directly to programs.
>
> **Body:** Application Hub doesn't just pre-fill forms. It creates a living, scored, MO§ES™-governed applicant persona that belongs to you. Export it in any standard format. Port it to AcceleratorApp portals, Common App, or your next role. Programs get verifiable signals without extra work. You stay in control.
>
> **Benefit block:**
> - One-click export in GDPR, HR Open LER-RS, or W3C VC format
> - Selective disclosure — share only what you want
> - Cryptographic proofs tied to your commitment hashes
> - Future-proof: programs will come to you for the strongest, verifiable applications
>
> **CTAs:** "Build & export your first persona (free)" + "Watch 45-second portability demo"

---

## Competitive Context (Keep Handy)

| Tier | Competitor | Their Lane | Your Edge |
|---|---|---|---|
| 1 | Grantable | AI grant writing + org answer bank | You have multi-mode, scoring, MCP depth |
| 1 | Instrumentl | Grant discovery + tracking + AI draft | You have reusable governed capital, not just discovery |
| 1 | ESAI.ai | College essays + internships + jobs | You have accelerator/grant archive + scoring depth |
| 2 | AutoFill Mate / Chrome extensions | AI resume auto-fill for jobs | No central scored archive or persona building |
| 2 | Norm AI | Answer bank for enterprise DDQ/RFP | B2B sales-focused, not founder/applicant |
| 2 | OpenVC / Signal (NFX) | Discovery + investor outreach | Complementary — they find programs, you fill them |
| Infra | AcceleratorApp | Backend ATS for 500+ programs | You serve their applicants — distribution channel |

> "No true Tier 1 category killer exists yet. Application Hub is pioneering the governed, multi-category answer capital layer. Your biggest competitors are still manual workflows (Notion + raw LLMs) rather than other products."

---

## ⚑ Implementation Flags (added 2026-05-12)

**1. `profiles` table name collision**
Migration 011 already ships `user_profiles` in the live schema. The `profiles` table in 1.2 will conflict or create dangerous ambiguity. Rename to `persona_profiles` or `applicant_personas` before running any migration derived from Grok's SQL.

**2. `profile_answers` already exists**
The answer bank is already `profile_answers` in the live schema. Grok's SQL would throw "relation already exists." What's actually needed is an `ALTER TABLE profile_answers ADD COLUMN` for `commitment_hash`, `lineage_hash`, `version`, `superseded_by` — plus a new `profile_persona_enrichments` table. Diff Grok's schema against the live schema and write proper ALTER + CREATE migrations before touching this.

**3. Export button (1.3) should ship before persona tables (1.2)**
The GDPR JSON export can be built from the *existing* `profile_answers` data today — no enrichment layer needed. Don't block it on persona enrichments being complete. Ship the export button first, layer in the richer persona fields as they arrive.

**4. AcceleratorApp needs dedicated portal testing before the pitch**
AcceleratorApp forms use iframe-heavy patterns and sometimes multi-step flows. The generic `MutationObserver` approach in 1.1 will need AcceleratorApp-specific label selectors and flow handling. Test on real AcceleratorApp portals before building the pitch around it.

**5. F6S missing from competitive table**
Grok flagged F6S as the biggest hybrid (discovery + management) and a closer competitor than Norm AI or AutoFill Mate. Belongs in Tier 1 of the competitive table alongside Grantable/Instrumentl/ESAI.
