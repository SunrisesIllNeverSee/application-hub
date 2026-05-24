# questions/ — Normalized Q→A Index per Program

This folder is the **formatted layer** between raw application records and
the cross-program answer data bank. One file per submitted program, in a
uniform Q→A shape, regardless of what shape the original submission was in
(form, chat, agent, multi-step wizard).

## Why this folder exists

| Source format | Normalized to |
| --- | --- |
| Form-based application (a16z Speedrun) — labels + inline answers in messy line order | Clean Q→A pairs in form order |
| Conversational agent (cyber.fund Monastery) — `Agent>` / `>` chat transcript | Clean Q→A pairs in conversation order |
| Mostly-blank capture with confirmation page (NextUnicorn.Fund) — Google Forms questions only locally | Q-only entries with `[not preserved locally]` markers on the answer slot |

This normalization is what makes downstream indexing possible. Without
it, you can't extract "every program that asks 'why this team'" or "every
program that asks about traction" because the questions are buried in
different shapes per file.

## Naming convention

`<slug>.md` — same slug as `applications/<slug>.md` and as the
`inbox/done/<slug>-submitted-*.md` marker. One Q→A file per submitted
program.

## File structure inside each `<slug>.md`

```markdown
# <Program Name> — Q→A Index

- canonical: applications/<slug>.md
- submission marker: inbox/done/<slug>-submitted-YYYY-MM[-DD].md
- form host: <form host>
- submission date: <date or rough>
- status: <pending | escalated | rejected | accepted>

## <Section name (if the form had sections)>

### Q: <question text>
<answer text, verbatim from the canonical record, or `[not preserved locally]`>

### Q: <next question text>
<answer text>
```

Questions stay verbatim. Answers stay verbatim. The file is a clean
record, not editorial.

## Downstream: answers/

The next layer is `answers/` — where questions get re-indexed across
programs by theme/recurrence so the answer bank can be queried when
filling out new applications. See `answers/README.md`.
