# Integration Recommendations

Surfaced from the 2026-05-24 qaapplication restructure session.
Ranked by leverage (how much manual work each one removes).

---

## 1. Strip-on-drop automation — HIGHEST LEVERAGE

**What:** A small script (Python/Bash) that takes a file path in
`01-inbox/` and emits three outputs in one pass:

- `03-programs/<slug>.md` (entity record — metadata block)
- `05-questions/source/<slug>.md` (Q-only normalized list)
- `08-apply/<slug>.md` (Q + space-for-A workspace)

Plus moves the raw to `08-apply/_shared/raw/<slug>.<ext>` and
appends a line to `audit-log.md`.

**Why high-leverage:** this is the single most repeated manual pass
right now. Every dropped file requires reading the raw, identifying
the form host + canonical URL + question structure, then writing 3
output files by hand. Mechanically determined from the raw — should
be a script.

**Suggested location:** `bin/strip.py` at repo root, invoked as
`python3 bin/strip.py qaapplication/01-inbox/<file>`. Or expose as
a Claude Code command at `.claude/commands/strip.md`.

**Hard parts to design around:**

- Slug naming — needs to handle "anthonya_angel" → "anthonya-angel"
  normalization and avoid collisions with existing slugs.
- Q extraction — different form hosts (Tally, Airtable, Google
  Forms, custom React) need different extractors. Start with the
  Tally/Airtable cases (already covered by aria-label / placeholder
  patterns) and expand.
- Entity metadata — some fields (geo focus, stage, check size) can't
  be inferred from the form alone; leave as `[CONFIRM]` placeholders.

---

## 2. Appfeeder ↔ qaapplication integration

**What:** The parent repo's Appfeeder browser extension already
captures filled application forms (per the `STATUS.md` summary —
"Appfeeder capture loop — blur listener + `/api/answers/capture`").
Wire it to drop captures into `qaapplication/01-inbox/` directly so
the strip flow auto-triggers on every captured form.

**Why high-leverage:** closes the loop between "Deric fills out an
application in the browser" and "the answer enters the data bank
automatically." Currently captures land in the app's database but
don't feed back into this workspace's `09-submitted/archive/`.

**Hard parts:**

- The Appfeeder extension may not have write access to the local
  filesystem (browser sandbox). A bridge endpoint at
  `application-hub-mcp-server` could accept POSTs from the extension
  and write to `qaapplication/01-inbox/`.
- Conflict handling: what if a capture lands while Deric is
  mid-draft in apply? Last-write-wins is fine for raw; the
  apply file is editorial.

---

## 3. `.agents/check.py` extension — slug-lane parity

**What:** Add a check that for every slug in any of the canonical
lanes (`03-programs/`, `04-applications/`, `05-questions/source/`,
`09-submitted/archive/`), the same slug exists in the others. Flag
missing lanes as warnings.

**Why:** Right now the only enforcement is via Deric noticing
("hey, why isn't solo-fund in submitted?"). A check would catch this
mechanically. Same check could verify `08-apply/` entries have
matching `03-programs/` + `05-questions/source/` entries (since strip
should produce all three together).

**Where:** existing `.agents/check.py` already iterates over files
and produces warnings — just add another check function for
qaapplication-lane parity.

**Hard parts:** distinguishing "lane gap" from "intentionally
incomplete" (e.g. unicorn-fund's empty `09-submitted/archive/` because
the verbatim answers weren't preserved). Could solve with a
`[ACCEPTED-GAP]` marker in the file.

---

## 4. MCP server tool — `qa_application` workflow surface

**What:** Add tools to the parent's `application-hub-mcp-server` so
any Claude session (in any workspace) can interact with this
workspace through a typed API:

- `qa.drop(raw_content)` → drops to `01-inbox/`
- `qa.strip(slug)` → triggers the strip flow
- `qa.draft_answer(slug, question_id, answer_text)` → writes to
  apply
- `qa.submit(slug)` → moves to applications/, splits to questions/
  + answers/, appends audit-log line
- `qa.harvest(theme)` → builds `05-questions/index/` and
  `07-answers/index/` entries

**Why:** makes qaapplication addressable from outside its own VS Code
window. Codex working at the parent level can hand off drops to this
workspace via MCP instead of via filesystem drops.

**Hard parts:** designing the tool API for a workflow that's still
evolving. Don't lock in the schema too early. Maybe start with just
`qa.drop` and `qa.strip` as the v1.

---

## 5. Harvest-pass script — once N ≥ 8 submitted apps

**What:** Once enough programs are in `04-applications/` (rough
heuristic: 8+), a `bin/harvest.py` script that:

- Scans every `05-questions/source/*.md`
- Identifies recurring questions (Jaccard similarity on
  normalized question text)
- Groups variants into `05-questions/index/q-<theme>.md`
- Same for `09-submitted/archive/*.md` → `07-answers/index/*.md`

**Why:** the index/ lanes exist but are empty. Manual harvest is
tedious; mechanical clustering is mostly straightforward. Once
clustered, Deric can curate the buckets editorially.

**Hard parts:** theme labeling. Auto-clustering can produce
"questions about team" + "questions about co-founders" as
near-duplicates. A human editorial pass on the cluster labels is
worth the time.

---

## 6. Calendar / follow-up surfacing

**What:** Scan `04-applications/*.md` for follow-up dates (e.g.
NextUnicorn's 2026-06-02 meeting) and surface upcoming dates as a
simple `bin/upcoming.py` that emits a sorted list.

**Why:** the audit-log doesn't track forward-looking dates; the
application files do. Right now these get noticed by Deric
remembering, or by me re-reading the files. A 30-line script
removes that.

**Why this is low priority:** it's a small leverage win. Deric's
calendar app probably already handles this for any meeting he's
actually scheduled.

---

## Recommended sequence

If implementing one at a time:

1. **Strip-on-drop (#1)** — biggest leverage, can be done today, no
   external dependencies.
2. **`.agents/check.py` extension (#3)** — tiny code change, catches
   future drift mechanically. Pair with #1 so new drops are validated
   immediately.
3. **Appfeeder integration (#2)** — closes the capture loop. Coordinate
   with Codex (who's working on the Appfeeder side at the parent).
4. **MCP server tool (#4)** — once #1 + #2 are working in a script, the
   MCP wrap is straightforward.
5. **Harvest-pass (#5)** — defer until 8+ submitted apps make it
   worthwhile.
6. **Calendar surfacing (#6)** — defer indefinitely; low leverage.

## Things I deliberately did not recommend

- **Slug-rename automation.** The path-update sed dance is real but
  rare enough (handful of times per restructure) that automating it
  is busywork. The friction is a forcing function against thoughtless
  renames.
- **Auto-numbering of audit-log entries.** The audit-log is a
  human-readable ledger; numbering adds noise without value.
- **A web UI for browsing the workspace.** The folder structure IS
  the UI. Adding a web layer would tempt the kind of state-tracking
  the user explicitly pushed me off of.
- **Replacing markdown with structured data formats (JSON/YAML for
  every entry).** The current markdown-with-conventions strikes the
  right balance: human-editable, grep-able, doesn't require tooling
  to read. Saving structure for downstream (the Supabase rows) is
  the right place to add rigor.
