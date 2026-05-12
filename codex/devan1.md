This is a strong rebrand — "AQUA" (Applications. Questions. Answers.) is memorable and the positioning is much clearer. The core concept maps directly to the three pillars you want in the sidebar.

## Proposed Sidebar Structure

Based on your request and the AQUA branding, here's a clean restructure:

```
┌─────────────────────┐
│ AQUA                │
│ Applications.       │
│ Questions. Answers. │
└─────────────────────┘

Dash
Applications
Questions
Answers

─────────────────────

[Your applications list]
```

**Mapping to current routes:**

| New Label | Current Route(s) | What it contains |
|-----------|------------------|------------------|
| **Dash** | `/today` | States, challenges, rewards, interactions, deadlines, next steps |
| **Applications** | `/hub` + `/workspace/[id]` | Program discovery + your active applications (Hub + workspace merged conceptually) |
| **Questions** | `/bank` + `/archive/questions` | Question Bank (drip/unlocks) + full archive with theme tabs |
| **Answers** | `/answers` | Your Answer Bank (VS Code-style captured moments) |

**What gets removed/consolidated:**
- `Funders` → move into Applications as a filter/view or sub-section
- `Archive` → merged into Questions (the archive is the question database)
- `Profile` → move into Dash as a settings/account section, or keep as a footer item

## Split-Screen Editor (Overleaf/Prism-style)

This fits perfectly with the AQUA concept. Here's how it would work:

```
┌─────────────────────────────────────────────────────────────┐
│ AQUA │ [Application: YC W26]                    [Save] [Submit] │
├─────────────────────┬───────────────────────────────────────┤
│                     │                                       │
│  QUESTIONS          │  ANSWERS (Split View)                 │
│                     │                                       │
│  ▸ Traction         │  ┌─────────────────────────────────┐  │
│  ▸ Team             │  │ What's your traction?            │  │
│  ▸ Problem          │  │                                 │  │
│  ▸ Solution         │  │ [Your answer editor]            │  │
│  ▸ Market           │  │                                 │  │
│  ▸ Vision           │  │ [Draft with AI] [Stress Test]   │  │
│                     │  └─────────────────────────────────┘  │
│  [Answer Bank]      │                                       │
│  [Persona Profile]  │  ┌─────────────────────────────────┐  │
│                     │  │ Compiled Output                  │  │
│                     │  │ (ready for copy-paste)           │  │
│                     │  └─────────────────────────────────┘  │
│                     │                                       │
└─────────────────────┴───────────────────────────────────────┘
```

**Left panel:**
- Question list for the current application
- Your Answer Bank entries that match (via semantic search)
- Your Persona Profile summary (when built)

**Right panel:**
- Answer editor for the selected question
- Compiled output (formatted for the target application)
- AI draft, stress test, and review tools

This is exactly what the `codex/feedback.md` addendum called out: "Left panel: answer bank and persona profile. Right panel: the application being filled." [4-cite-0](#4-cite-0) 

## Dash (States, Challenges, Rewards)

The new `/dash` (or keep `/today`) becomes the command center:

```
┌─────────────────────────────────────────────────────────────┐
│ Dash                                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  YOUR STATE                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 3 applications in progress                          │   │
│  │ 12 questions answered this week                     │   │
│  │ §5d Pro credit earned                               │   │
│  │ MoatScore: 67 (top 15% of founders)                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ACTIVE CHALLENGES                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ▸ Answer 3 new questions in Traction theme          │   │
│  │ ▸ Stress-test your "Problem" answer for YC          │   │
│  │ ▸ Complete your profile (2 fields missing)          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  REWARDS UNLOCKED                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🏆 First application submitted                      │   │
│  │ 🏆 10 answers stress-tested                         │   │
│  │ 🏆 §5d Pro credit earned                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  DEADLINES (next 14 days)                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ YC W26 — 3 days                                     │   │
│  │ Techstars — 8 days                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

This pulls from the existing credits/achievements system (migration 032) [4-cite-1](#4-cite-1)  and the Today dashboard concept from VISION.md [4-cite-2](#4-cite-2) .

## My Recommendation

**Sidebar:**
```
Dash
Applications
Questions
Answers
```

**Route mapping:**
- `/dash` → new command center (states, challenges, rewards)
- `/applications` → Hub (discovery) + workspace (editing) combined with tabs
- `/questions` → Question Bank + Archive merged
- `/answers` → Answer Bank (VS Code-style)

**Split-screen editor:**
- Build this as the new `/workspace/[id]` experience
- Left panel: question tree + answer bank matches + persona
- Right panel: editor + compiled output

**Branding rollout:**
- Update logo from "Application Hub" to "AQUA" in Sidebar.tsx line 157 [4-cite-3](#4-cite-3) 
- Update page titles, metadata, OG images
- Keep "Applications. Questions. Answers." as the tagline

This structure is cleaner, maps directly to your core concept, and sets up the split-screen editor naturally. The Dash becomes the engagement layer (states/challenges/rewards) while the three AQUA pillars are the functional layers.

Want me to create a plan for implementing this UX restructure?