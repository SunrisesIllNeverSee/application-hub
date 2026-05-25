# Multi-Claude Coordination Substrate — Build-Out Folder

This folder collects everything needed to develop, demo, and pitch the
multi-AI coordination substrate currently running inside this repo.
The pattern: parallel AI sessions (Claude / Codex / Cowork / Devin)
coordinate via three text files and an append-only thread, with `git`
as the durable audit log. No message bus, no broker, no designed
protocol — just **lane discipline**.

## Folder map

```text
multi-claude-substrate/
├── README.md             ← you are here
├── 01-premise.md         ← the core thesis (one-page)
├── 02-architecture.md    ← full doc with all four mermaid diagrams
├── 03-case-studies.md    ← real parallel-session runs (the receipts)
├── 04-roadmap.md         ← Phase A (live) → B (enforcement) → C (cross-repo)
├── pitch/
│   ├── one-liner.md      ← one sentence
│   ├── 30-second.md      ← elevator
│   ├── 2-minute.md       ← full pitch script
│   ├── talking-points.md ← Q&A prep
│   └── slide-outline.md  ← deck structure if it ever becomes one
└── diagrams/
    ├── 01-architecture.mmd
    ├── 02-lane-lifecycle.mmd
    ├── 03-parallel-sessions.mmd
    └── 04-session-start.mmd
```

## Why a folder, not a single doc

The single-file version answered "what is this?" The folder version
answers "how do we explain it / demo it / pitch it / extend it?"
Different audiences need different surfaces:

- **Engineer / future session** reads `02-architecture.md` cold.
- **VC / partner** sees `pitch/2-minute.md` + a diagram.
- **Operator (you)** uses `pitch/talking-points.md` live in
  conversations.
- **Tool builders** want raw mermaid in `diagrams/*.mmd` to embed
  elsewhere.

## How to actually see the diagrams

Mermaid is text-as-diagram. Each `.mmd` file is the raw source; each
`.md` file embeds the same blocks inside ` ```mermaid ` fences. To
render them:

| Surface | Method |
| --- | --- |
| **GitHub web** | Auto-renders mermaid inside `.md` files. Just push and view in the browser. **Best for pitch decks / sharing.** |
| **VS Code** | Install the *Markdown Preview Mermaid Support* extension, then open any `.md` in preview mode (`⌘K V`). |
| **Cursor** | Same as VS Code — the extension works. |
| **mermaid.live** | Paste a `.mmd` file contents in. Lets you export SVG/PNG/PDF. **Best for ad-hoc image exports.** |
| **mermaid CLI** | `npm i -g @mermaid-js/mermaid-cli` then `mmdc -i diagrams/01-architecture.mmd -o build/01.svg`. Scriptable. |
| **Obsidian / Logseq / Notion** | All support mermaid in markdown natively. |

If you want raster exports for a pitch deck, the cleanest path is
mermaid.live → SVG → drop into Canva / Keynote / Figma.

## Reading order

If you're new to the pattern, read in this order:

1. `01-premise.md` — the one-page thesis
2. `02-architecture.md` — the comprehensive doc with diagrams
3. `03-case-studies.md` — proof it actually works
4. `pitch/2-minute.md` — how to talk about it
5. `04-roadmap.md` — where it goes next

If you're walking into a pitch cold, start at `pitch/talking-points.md`.

## Status

| Layer | Status |
| --- | --- |
| Phase A (lane discipline + ledgers + scratch + git audit) | ✅ Live, load-tested by ≥2 parallel session pairs |
| Phase B (automated lane-collision enforcement, stale-claim reaping) | ⬜ Designed, not built |
| Phase C (cross-repo claim visibility) | ⬜ Future |
| Pitch material | 🟡 Drafts in `pitch/` — needs operator pass for voice |
| Diagram exports for deck | ⬜ Pending — see "How to actually see the diagrams" above |
