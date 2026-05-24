# draft/ — My Output (Filled Answers)

One file per program, matching the filename used in `../questions/`.

```text
../questions/palantir-fellowship.md  →  ./palantir-fellowship.md
../questions/alliance-accelerator.md →  ./alliance-accelerator.md
```

Don't paste into this folder — it's destination only. I write here.

## Conventions I'll follow in each draft

- **One section per question.** Question text in bold, word limit in parens
  on the same line.
- **Draft answer below the question**, kept under the limit.
- **Source footnote** at the end of each answer naming what I drew from
  (a16z app / context.md file / live site / specific GitHub repo).
- **Open questions block** at the bottom for anything I couldn't resolve.
  Format defined in [../sources.md](../sources.md) — you answer in
  `../context/`, I re-draft.
- **`[ASSUMED]` tag** on any answer where I had to guess. Easy to grep
  before submission.

## Versioning

If a draft goes through multiple rounds, I keep history inside the file
(not as separate files) with `### v1`, `### v2 (2026-MM-DD)` headers. The
top of the file is always the latest. This keeps a single source of truth
per program without folder proliferation.

## After submission

Move the file out of `_drafting/` to one of:

- `applications/<program-slug>.md` (single-file form, matching existing
  conventions for the 3 captured applications)
- `applications/<program-slug>/` (folder form, if you want to keep the
  context + sources cache alongside the final answers)
