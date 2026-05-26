# 04-applications — Pipeline Structure

## Funnel stages

```
06-workshop/          ← workstation: active drafting
  <program>.md        ← form structure + notes
  draft/              ← rough draft answers (prefilled, iterating)

04-applications/      ← applying: bare form templates + submitted record
  <program>.md        ← bare form template (unfilled, reusable)
  submitted/          ← submitted: final record by entity + batch
    <program>-<batch>/
      draft.md        ← the rough draft that was used
      final.md        ← clean copy of what was actually submitted

07-answers/archive/   ← answer bank: paste-ready answers by program
```

## Status convention

| Stage | Location | Meaning |
|---|---|---|
| Drafting | `06-workshop/draft/` | Active, iterating |
| Applying | `04-applications/<program>.md` | Bare template ready |
| Submitted | `04-applications/submitted/<program>-<batch>/` | Filed, immutable record |

## Submitted applications

| Program | Batch | Date | Folder |
|---|---|---|---|
| Y Combinator | Summer 2026 | 2026-05-26 | `submitted/yc-summer-2026/` |
