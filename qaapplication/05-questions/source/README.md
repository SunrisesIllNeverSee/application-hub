# 05-questions/source/ — Normalized Q-Only Index per Program

The **source layer** for the question pipeline. One file per submitted
program (`<slug>.md`), in uniform Q-only shape regardless of how the
original submission was captured (form, chat, agent, wizard).

This is the serialized `AQ` lane.
See `../../src/archive-serialization-spec.md`.

## Naming

`<slug>.md` — same slug as `../../04-applications/<slug>.md`,
`../../06-workshop/<slug>.md`, and `../../07-answers/archive/<slug>.md`.

## Why this folder exists

| Source format | Normalized to |
| --- | --- |
| Form-based (a16z Speedrun) — labels + inline answers in messy line order | Clean Q-only entries in form order |
| Conversational (cyber.fund) — Agent/User chat transcript | Q-only entries in conversation order |
| Q-only captures (NextUnicorn) — form structure without answers | Q-only entries with `[not preserved locally]` notes |

## File shape

```markdown
# <Program Name> — Q-Only Index

- canonical: ../../04-applications/<slug>.md
- form host: <host>
- submission date: <date>
- status: <pending | escalated | rejected | accepted>

### Q: <question text>

### Q: <next question text>
```

Verbatim questions. No editorial commentary.

## Downstream

The cross-program index in `../index/` is built by harvesting across
every file here. The answer-side companion at `../../07-answers/archive/`
holds the same questions paired with their answers.
