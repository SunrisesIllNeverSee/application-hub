# Sources & Outreach Protocol

Standing instructions for any draft started in this workspace. I'll consult
these before generating answers, and I'll use the outreach protocol when I
need info I can't get from the web or your provided context.

## Live sources to fetch before drafting

When a `questions/<program>.md` file is populated and you've told me to
draft that program, I fetch these four in parallel and dump key signal
into `sources/` (created on demand). I prefer Firecrawl for HTML→markdown;
WebFetch as fallback.

| Source | URL | What I extract |
| --- | --- | --- |
| Personal GitHub profile | <https://github.com/SunrisesIllNeverSee> | Repo list, pinned repos, recent activity, README snippets from active projects |
| MO§ES™ — primary landing | <https://mos2es.com> | Current product description, pitch language, calls to action, latest claims |
| MO§ES™ — secondary | <https://mos2es.xyz> | Anything that differs from `.com` — separate product surface, demos, technical detail |
| Signomy | <https://signomy.xyz> | Product surface, stated capabilities ("270 API endpoints, Stripe Connect" per a16z app — verify still current), positioning |

I treat the live site as ground truth over the a16z application when they
diverge — the live site is "now," the a16z app is a May 2026 snapshot. Any
divergence gets flagged in the draft footnotes.

## Specific GitHub repos to pull on request

If a question demands code-level detail (e.g. "what's your tech stack" /
"show us your repo"), I'll fetch the relevant repo's README + top-level
structure via `gh repo view` or WebFetch. Tell me which repo, or I'll pick
the most thematically relevant based on the question.

## Outreach protocol — "ask the user / have the user ask someone else"

When I hit a question I can't answer from:

- `context/` files you provided
- `applications/a16z-speedrun.md`
- The live sources above
- Your GitHub repos

…I add an entry to the **"Open questions"** section at the bottom of the
relevant `draft/<program>.md` file instead of inventing an answer. Each
entry follows this shape:

```text
- [ ] [Q3] Question text I'm stuck on
  - why I'm asking: <what specifically I need>
  - who might know: <you / cofounder / advisor / customer / no one yet>
  - my best guess if forced: <fallback if you need a placeholder>
```

You can either:

1. **Answer directly** in a new `context/` file (or append to an existing
   one) and I'll fold it in. Inline answers in the open-questions list
   itself also work.
2. **Ask a third party** (cofounder, advisor, customer, mentor) and paste
   their reply back into `context/` under a `### From <name>` header.
   I'll attribute appropriately.
3. **Tell me to ship with my best guess** — I'll mark the answer with a
   visible `[ASSUMED]` tag so you can validate before submission.

I never invent facts (revenue numbers, headcounts, dates, claims about
people) without a source. If forced into a guess, it gets flagged.

## Cache layout (created on demand)

If I do fetch live content, it lands here for reference within this draft session:

```text
applications/_drafting/sources/
├── github-profile.md         ← snapshot of github.com/SunrisesIllNeverSee
├── mos2es-com.md             ← snapshot of mos2es.com
├── mos2es-xyz.md             ← snapshot of mos2es.xyz
├── signomy-xyz.md            ← snapshot of signomy.xyz
└── <repo-name>.md            ← any specific repo I fetch
```

These are scratch files for the active draft, not canonical. When this
draft folder is promoted/finalized, `sources/` is either deleted or moved
into the resulting `applications/<program>/sources/` if kept.
