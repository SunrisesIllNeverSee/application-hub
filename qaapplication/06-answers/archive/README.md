# 06-answers/archive/ — Paired Q+A Archive per Program

The **archive layer** for the answer pipeline. One file per submitted
program (`<slug>.md`), containing Q+A pairs from that program, in the
order they were asked.

Format per entry (answer-first):

```markdown
### Answer

<answer text, verbatim>

— from: <slug> · <YYYY-MM-DD> · Q: "<question text>"
```

## Naming

`<slug>.md` — same slug as `../../03-applications/<slug>.md`,
`../../04-questions/source/<slug>.md`, and `../../05-drafting/<slug>.md`.

## archive/ vs index/

| `archive/<slug>.md` | `index/` |
| --- | --- |
| One file per program | One file per theme (cross-program) |
| Q+A pairs in form order | Answers only, flat list per theme |
| Audit + provenance | Retrieval + reuse |

Both layers are populated from the same submissions. The archive holds
the original context; the index strips context for fast retrieval during
drafting.

## What's not preserved here

If the verbatim answer text wasn't preserved locally (e.g. unicorn-fund,
solo-fund — submitted directly into Google Forms with no local record),
the file is a placeholder. Backfill if the answers are recovered.
