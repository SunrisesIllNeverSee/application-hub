# Inbox — Front Door for Raw Captures

Drop new raw captures (HTML dumps, markdown exports, screenshots) into
`incoming/`. When a capture's questions are extracted into `drafts/<slug>.md`,
the raw file moves to `drafts/_shared/raw/<slug>.html` and an entry is
appended to the root `audit-log.md`.

## Lanes

```text
inbox/
├── incoming/    ← raw captures, untriaged
└── processing/  ← multi-program captures being triaged (e.g. Safari tabs file)
```

There is intentionally no `done/` folder. Once a capture is extracted or
discarded, it leaves this folder entirely. The proof of distribution
lives in `../audit-log.md` at the workspace root.

## Lane semantics

| Lane | Contains | Lifetime |
| --- | --- | --- |
| `incoming/` | Raw HTML / markdown captures that haven't been touched yet. New drops land here. | Until extracted (usually same session) |
| `processing/` | Multi-program captures still being triaged (one file → many candidate programs). Single-program raw HTML doesn't need this lane — it goes incoming → extract → `drafts/_shared/raw/`. | Until every candidate inside is resolved |

## Workflow

```text
inbox/incoming/<raw>.html
   ↓ extract questions
drafts/<slug>.md                          ← question structure + space for answers
drafts/_shared/raw/<slug>.html            ← raw moves here for audit
   ↓ draft answers
drafts/<slug>.md (with answers filled)
   ↓ submit
submitted/<slug>.md                       ← canonical filled record
questions/<slug>.md                       ← normalized Q→A index
answers/<slug>.md                         ← raw answer entries
   ↓ append a line to audit-log.md
```

## What does NOT belong in inbox/

- Working drafts → `drafts/<slug>.md`
- Submitted applications → `submitted/<slug>.md`
- Reference material → `drafts/_shared/sources/` or `drafts/_shared/context/`
- Anything not actively being captured-and-routed
