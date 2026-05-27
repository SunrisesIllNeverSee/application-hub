# 04-questions/index/ — Master Index of Every Question Asked

Cross-program index, built by harvesting across every file in
`../source/`. Each entry = one unique question, with references to which
programs asked it (and what variants of phrasing they used).

## What goes here

For now, this folder is **scaffolded but empty**. The harvest pass that
populates it runs once enough programs are in `../source/` for
cross-program patterns to matter (typically 5+ submitted apps — which is
where we are right now).

## Expected structure (when populated)

Option being considered:

```text
04-questions/index/
├── README.md
├── q-founder-bio.md           ← every variant of "tell us about yourself"
├── q-what-do-you-do.md        ← every variant of "describe your product"
├── q-moat.md                  ← every variant of "what's your moat"
├── q-traction.md
├── q-why-this-program.md
└── ...
```

Each `q-<theme>.md` file:

```markdown
## Question theme: <theme name>

### Variants seen

- "What have you built or achieved in the past that you're most proud of?" — asked by: cyberfund (2026-05-23)
- "Founder experience" (100-word limit) — asked by: a16z-speedrun (2026-05)
- "Why you're the right person to build this" — asked by: hyperagent-founding500 (drafting)
- ...
```

## Why this layer exists

Two reasons:

1. **Reuse during drafting.** When Deric opens a new draft and sees
   "Why this team?", he can grep the index folder for "why-this-team"
   variants to see how he's answered similar questions before.
2. **Feed the parent's question archive.** This index is the direct
   input to `application-hub/seed/staging/archived_questions` rows.
   Each entry maps to one `archived_questions` row with its
   significance score calculated from the cross-program frequency
   captured here.
