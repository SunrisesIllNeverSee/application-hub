# context/ — Source Material for Drafting

Drop one file per distinct piece of context. The folder accumulates over
time as you add info or get answers back from third parties. I read every
file here when I draft.

## Suggested naming

Numbered prefix keeps things ordered; topic-or-source suffix tells you what
it is at a glance:

```text
001-bio-update.md
002-recent-shipments.md
003-cofounder-input.md
004-mentor-reply-on-fundraising.md
005-palantir-research.md       (program-specific context)
```

Files with a `<program-slug>-` prefix are read primarily when drafting that
program. Files without a prefix apply to every draft.

## What to put in each file

Anything that shapes the answer. Examples:

- New bio details since your a16z application (the May 2026 snapshot)
- Project milestones, recent shipments, demo links, traction numbers
- Voice / tone preferences ("write like X", "avoid Y")
- Specific stories or proof points you want pulled in
- **Counter-context**: things in `03-applications/a16z-speedrun.md` that are
  now OUT OF DATE and should not be reused as-is
- Third-party answers (cofounder, advisor, customer, mentor) — paste their
  reply under a `### From <name>` header so I can attribute properly

## Per-file shape (loose, not enforced)

```markdown
---
applies_to: all | <program-slug>
source: self | cofounder-X | advisor-Y | customer-Z
captured: 2026-05-23
---

## <topic>

<content>
```

Frontmatter is optional. If you skip it, I'll infer.

## Iteration loop

When I draft, I'll add an **Open questions** block at the bottom of the
draft file listing anything I couldn't resolve. You answer here (in a new
file, or appended to an existing one), and I re-draft.
