# questions/ — Target Program Question Sets

Drop one file per program you want to draft answers for. Naming convention:

```text
<program-slug>.md
```

Examples:

```text
palantir-fellowship.md
alliance-accelerator.md
xprize-gemini.md
```

## What to put in each file

Raw paste is fine — I'll structure it before drafting. Anything I can read works:

- Direct copy-paste from the program's apply form
- Bullet list typed from memory
- Screenshots OCR'd into text
- A URL + a note saying "scrape this for the questions" (I'll fetch)

If you know the program name and apply URL, drop them at the top of the
file. If not, no worries — I'll infer from the question content.

## Suggested per-file shape

```markdown
## Program

Name: <program name>
URL: <apply URL>
Deadline: <if known>

## Questions

1. <question text> (word limit if shown, required/optional if shown)
2. ...
```

## When this folder is populated

Drop me a note ("ready to draft `<slug>`") and I'll fetch the live sources
listed in [../sources.md](../sources.md), read any matching `../context/`
files, and write the draft into `../draft/<program-slug>.md`.
