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

- **2026-05-24** · **received + extracted + filed** · `3xcapital` · raw capture (Tally form) found in `inbox/incoming/startup-submission-form-2026-05-13-dup.md` — extracted to `submitted/3xcapital.md`, normalized to `questions/3xcapital.md`, answers logged to `answers/3xcapital.md`. Raw moved to `drafts/_shared/raw/3xcapital-raw.md`. **Submission was 2026-05-13; processed today.**
- **2026-05-24** · **restructure** · — · removed `applications/` and `inbox/done/` lanes. Established `drafts/`, `submitted/`, `audit-log.md` at root. See commit history for full diff.

## 2026-05-23

- **2026-05-23** · **received** · `founding500` · raw HTML dump (Hyperagent Founding 500 / Airtable form) in `inbox/incoming/founding500.html` → extracted to `drafts/founding500.md` → raw moved to `drafts/_shared/raw/founding500.html`.
- **2026-05-23** · **received** · `yc` · raw HTML dump (YC Summer 2026 application) in `inbox/incoming/yc.html` → extracted to `drafts/yc.md` → raw moved to `drafts/_shared/raw/yc.html`.
- **2026-05-23** · **submitted** · `cyberfund` · cyber.fund Monastery conversational agent. Assets uploaded: Conservation Law paper V.05 (PDF from Zenodo DOI 10.5281/zenodo.20029607), field-sheet markdown, KASSA voice-demo brief markdown. Canonical: `submitted/cyberfund.md`. Status: submitted, awaiting response.
- **2026-05-23** · **received** · `redbud` · raw HTML dump (Redbud VC Pitch Us / Tally form) in `inbox/incoming/redbudraw.html` → extracted to `drafts/redbud.md` → raw moved to `drafts/_shared/raw/redbudraw.html`.

## 2026-05 (exact dates `[CONFIRM]`)

- **2026-05** · **submitted (×2)** · `a16z-speedrun` · a16z Speedrun apply form. Submission #1 pitch deck = `mos2es.com/benchmarks`. Result: rejected. Submission #2 pitch deck `[CONFIRM]`. Result: pending. Canonical: `submitted/a16z-speedrun.md`.
- **2026-05** · **submitted** · `unicorn-fund` · NextUnicorn.Fund (multi-track Google Forms). Status: L1 → L2 → pitch event completed → **15-min follow-up scheduled 2026-06-02** (active warm lead). Canonical: `submitted/unicorn-fund.md`. Submitted answers not preserved locally.
- **2026-05** · **submitted** · `solo-fund` · Solo Founders Program (SFP). Form deadline + kickoff: 2026-05-22. Canonical: `submitted/solo-fund.md`. Submitted answers not preserved locally.

## Conventions

- **Append, don't edit.** Once an event is logged, it stays. Corrections go in as a new line referencing the original.
- **No status updates that change the original entry.** If a submission progresses (L1 → L2, rejected → reconsidered, etc.), add a new line. The original submission line stays as-is.
- **Slugs match folder names** — `<slug>` in this log corresponds to `submitted/<slug>.md`, `drafts/<slug>.md`, `questions/<slug>.md`, `answers/<slug>.md`.
- **No files in `inbox/done/`** — that folder is gone. This log is the proof of distribution.
