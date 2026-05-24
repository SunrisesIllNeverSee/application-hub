# 06-answers/index/ — Flat Answer Bank

All answers, indexed for retrieval. The answer side of the question/answer
data bank — built by harvesting `../archive/` files and re-organizing so
finding "the best phrasing of <X>" is fast.

## What goes here

For now, this folder is **scaffolded but empty**. Populated once enough
answers accumulate in `../archive/` to make cross-program retrieval
useful.

## Expected structure (when populated)

```text
06-answers/index/
├── README.md
├── founder-bio.md              ← every founder-bio answer variant
├── what-do-you-do.md
├── moat.md
├── traction.md
├── why-this-program.md
└── ...
```

Each theme file is a flat list of answer-text variants:

```markdown
### Answer (full)

<full answer text>

— used in: <slug> · <date> · response: <pending / rejected / escalated>

---

### Answer (one-paragraph variant)

<shorter version>

— used in: <slug> · <date>
```

Each variant tagged with provenance (where used) and outcome signal
(was the application that used it rejected / escalated / accepted /
still pending).

## Why this is separate from `archive/`

- **`archive/`** preserves the Q+A pair in form context — useful for
  audit and for understanding "what was the question that generated
  this answer."
- **`index/`** strips the context and gives a flat answer bank — useful
  for retrieval ("show me my best moat answers across all programs").

Same content, two access patterns. The archive is paired with the
question; the index is paired with the theme.
