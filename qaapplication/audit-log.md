# Audit Log

Single ledger of every capture/draft/submission event in this workspace.
Replaces the old `inbox/done/` folder — once something leaves inbox, it
gets a line here, not a file there. This file is the proof of what was
received and where it was distributed.

## Format

`<YYYY-MM-DD> · <action> · <slug> · <destination or note>`

Most recent entries first. Append new entries at the top.

---

## 2026-05-24

- **2026-05-24** · **restructure** · — · folders renamed for true sequential flow. `submitted/ → applications/`. `drafts/ → drafting/`. `inbox/processing/ → processing/` (promoted to top-level). `inbox/incoming/` flattened (raw drops land directly in `inbox/`). Pipeline now reads top-to-bottom: `inbox → processing → applications → questions → answers → drafting`.
- **2026-05-24** · **received + extracted + filed** · `3xcapital` · raw capture (Tally form) extracted to `applications/3xcapital.md`, normalized to `questions/3xcapital.md`, answers logged to `answers/3xcapital.md`. Raw moved to `drafting/_shared/raw/3xcapital-raw.md`. **Submission was 2026-05-13; processed today.**
- **2026-05-24** · **routing fix** · `solo-fund` · was in `drafting/`, but already submitted — moved to `applications/`, indexed to `questions/` and `answers/`.
- **2026-05-24** · **prior restructure** · — · earlier in the day: removed the old `applications/` folder + `inbox/done/` lane. Established `submitted/`, `drafts/`, `audit-log.md` at root. Those folders were renamed again later today for sequential clarity (see entry above).

## 2026-05-23

- **2026-05-23** · **received** · `founding500` · raw HTML dump (Hyperagent Founding 500 / Airtable form) in `inbox/incoming/founding500.html` → extracted to `drafting/founding500.md` → raw moved to `drafting/_shared/raw/founding500.html`.
- **2026-05-23** · **received** · `yc` · raw HTML dump (YC Summer 2026 application) in `inbox/incoming/yc.html` → extracted to `drafting/yc.md` → raw moved to `drafting/_shared/raw/yc.html`.
- **2026-05-23** · **submitted** · `cyberfund` · cyber.fund Monastery conversational agent. Assets uploaded: Conservation Law paper V.05 (PDF from Zenodo DOI 10.5281/zenodo.20029607), field-sheet markdown, KASSA voice-demo brief markdown. Canonical: `applications/cyberfund.md`. Status: submitted, awaiting response.
- **2026-05-23** · **received** · `redbud` · raw HTML dump (Redbud VC Pitch Us / Tally form) in `inbox/incoming/redbudraw.html` → extracted to `drafting/redbud.md` → raw moved to `drafting/_shared/raw/redbudraw.html`.

## 2026-05 (exact dates `[CONFIRM]`)

- **2026-05** · **submitted (×2)** · `a16z-speedrun` · a16z Speedrun apply form. Submission #1 pitch deck = `mos2es.com/benchmarks`. Result: rejected. Submission #2 pitch deck `[CONFIRM]`. Result: pending. Canonical: `applications/a16z-speedrun.md`.
- **2026-05** · **submitted** · `unicorn-fund` · NextUnicorn.Fund (multi-track Google Forms). Status: L1 → L2 → pitch event completed → **15-min follow-up scheduled 2026-06-02** (active warm lead). Canonical: `applications/unicorn-fund.md`. Submitted answers not preserved locally.
- **2026-05** · **submitted** · `solo-fund` · Solo Founders Program (SFP). Form deadline + kickoff: 2026-05-22. Canonical: `applications/solo-fund.md`. Submitted answers not preserved locally.

## Conventions

- **Append, don't edit.** Once an event is logged, it stays. Corrections go in as a new line referencing the original.
- **No status updates that change the original entry.** If a submission progresses (L1 → L2, rejected → reconsidered, etc.), add a new line. The original submission line stays as-is.
- **Slugs match folder names** — `<slug>` in this log corresponds to `applications/<slug>.md`, `drafting/<slug>.md`, `questions/<slug>.md`, `answers/<slug>.md`.
- **No files in `inbox/done/`** — that folder is gone. This log is the proof of distribution.
