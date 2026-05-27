# Audit Log

Single ledger of every capture/draft/submission event in this workspace.
Replaces the old `01-inbox/done/` folder — once something leaves inbox, it
gets a line here, not a file there. This file is the proof of what was
received and where it was distributed.

## Format

`<YYYY-MM-DD> · <action> · <slug> · <destination or note>`

Most recent entries first. Append new entries at the top.

---

## 2026-05-26

- **2026-05-26** · **submitted** · `redbud` · Redbud VC Pitch Us form sent. Archived to `09-submitted/archive/redbud.md` and `09-submitted/archived_applications/redbud.md`.
- **2026-05-26** · **lane hardening** · — · active application workflow now encoded directly in the filesystem as `07-answers/` → `08-apply/` → `09-submitted/`. Moved the former `06-workshop/` lane to `08-apply/`, moved submitted materials out of `07-answers/` into `09-submitted/archive/` + `09-submitted/archived_applications/`, rewrote live docs/spec references, and extended `.agents/check.py` with qaapplication lane-parity enforcement so drift is flagged automatically.

## 2026-05-24

- **2026-05-24** · **doc-only / gap noted** · `fde-thread` · raw source `Devin_the_main_engine_is_signal_compression_en_2026-05-23_21_05_14.md` was not preserved locally — it was shared as an inline document attachment on 2026-05-23 and distilled directly into `08-apply/_shared/sources/fde-thread-notes.md` without first being saved to `08-apply/_shared/raw/`. Notes file flagged with a "raw not preserved" marker at the top. Going-forward rule documented: any inline document attachment goes to `01-inbox/` first before distillation work.
- **2026-05-24** · **stripped + indexed** · `anthonya-angel` · raw drop (Anthony Avedissian angel-investor startups page) extracted via the new strip flow: entity → `03-programs/anthonya-angel.md`, Q-only → `05-questions/source/anthonya-angel.md`, draft workspace → `08-apply/anthonya-angel.md`. Raw moved to `08-apply/_shared/raw/anthonya-angel.md`. Slug normalized from `anthonya_angel` to `anthonya-angel`. Not yet submitted.
- **2026-05-24** · **restructure** · — · added `03-programs/` (entity index for companies/programs themselves; mirrors parent's `programs` table). Renamed `05-drafting/ → 08-apply/`. Shifted numbering on downstream folders. Backfilled entity records for 5 submitted programs. Workshop programs (redbud, founding500, yc, cohort-5) still need entity backfill.
- **2026-05-24** · **doc-only** · — · pipeline order corrected in docs: workshop now comes before answers in the flow (workshop is where Q's get answered; answers is the harvested bank that crystallizes out of accumulated workshop work).
- **2026-05-24** · **restructure** · — · folders renamed for true sequential flow. `submitted/ → applications/`. `drafts/ → drafting/`. `01-inbox/processing/ → processing/` (promoted to top-level). `01-inbox/incoming/` flattened (raw drops land directly in `01-inbox/`).
- **2026-05-24** · **received + extracted + filed** · `3xcapital` · raw capture (Tally form) extracted to `04-applications/3xcapital.md`, normalized to `05-questions/source/3xcapital.md`, answers logged to `09-submitted/archive/3xcapital.md`. Raw moved to `08-apply/_shared/raw/3xcapital-raw.md`. **Submission was 2026-05-13; processed today.**
- **2026-05-24** · **routing fix** · `solo-fund` · was in `08-apply/`, but already submitted — moved to `04-applications/`, indexed to `05-questions/source/` and `09-submitted/archive/`.
- **2026-05-24** · **prior restructure** · — · earlier in the day: removed the old `04-applications/` folder + `01-inbox/done/` lane. Established `submitted/`, `drafts/`, `audit-log.md` at root. Those folders were renamed again later today for sequential clarity (see entry above).

## 2026-05-23

- **2026-05-23** · **received** · `founding500` · raw HTML dump (Hyperagent Founding 500 / Airtable form) in `01-inbox/incoming/founding500.html` → extracted to `08-apply/founding500.md` → raw moved to `08-apply/_shared/raw/founding500.html`.
- **2026-05-23** · **received** · `yc` · raw HTML dump (YC Summer 2026 application) in `01-inbox/incoming/yc.html` → extracted to `08-apply/yc.md` → raw moved to `08-apply/_shared/raw/yc.html`.
- **2026-05-23** · **submitted** · `cyberfund` · cyber.fund Monastery conversational agent. Assets uploaded: Conservation Law paper V.05 (PDF from Zenodo DOI 10.5281/zenodo.20029607), field-sheet markdown, KASSA voice-demo brief markdown. Canonical: `04-applications/cyberfund.md`. Status: submitted, awaiting response.
- **2026-05-23** · **received** · `redbud` · raw HTML dump (Redbud VC Pitch Us / Tally form) in `01-inbox/incoming/redbudraw.html` → extracted to `08-apply/redbud.md` → raw moved to `08-apply/_shared/raw/redbudraw.html`.

## 2026-05 (exact dates `[CONFIRM]`)

- **2026-05** · **submitted (×2)** · `a16z-speedrun` · a16z Speedrun apply form. Submission #1 pitch deck = `mos2es.com/benchmarks`. Result: rejected. Submission #2 pitch deck `[CONFIRM]`. Result: pending. Canonical: `04-applications/a16z-speedrun.md`.
- **2026-05** · **submitted** · `unicorn-fund` · NextUnicorn.Fund (multi-track Google Forms). Status: L1 → L2 → pitch event completed → **15-min follow-up scheduled 2026-06-02** (active warm lead). Canonical: `04-applications/unicorn-fund.md`. Submitted answers not preserved locally.
- **2026-05** · **submitted** · `solo-fund` · Solo Founders Program (SFP). Form deadline + kickoff: 2026-05-22. Canonical: `04-applications/solo-fund.md`. Submitted answers not preserved locally.

## Conventions

- **Append, don't edit.** Once an event is logged, it stays. Corrections go in as a new line referencing the original.
- **No status updates that change the original entry.** If a submission progresses (L1 → L2, rejected → reconsidered, etc.), add a new line. The original submission line stays as-is.
- **Slugs match folder names** — `<slug>` in this log corresponds to `04-applications/<slug>.md`, `08-apply/<slug>.md`, `05-questions/source/<slug>.md`, `09-submitted/archive/<slug>.md`.
- **No files in `01-inbox/done/`** — that folder is gone. This log is the proof of distribution.
