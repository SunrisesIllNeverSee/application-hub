# answers/ — Raw Answer Data Bank

Raw capture of every answer Deric has given across submitted applications,
**before any editorial reorganization**. Format per entry:

```markdown
### Answer

<answer text, verbatim>

— from: <application slug> · <YYYY-MM-DD> · Q: "<question text>"
```

The answer comes first because that's what you scan for when filling out a
new application. The identification footer is provenance — *where did this
answer come from, when, in response to what question.*

## File layout

One file per submitted application:

```text
answers/
├── README.md
├── a16z-speedrun.md
├── 3xcapital.md
├── cyberfund.md
└── unicorn-fund.md
```

Each file contains every Q→A entry from that program. Entries are in form
order (or conversation order for chat-based apps).

## What's here vs what's in `questions/`

| `questions/<slug>.md` | `answers/<slug>.md` |
| --- | --- |
| Question-first format, designed for the question-archive pipeline | Answer-first format, designed for filling out new applications |
| Includes all Qs (including unanswered / N/A / unselected) | Only entries where Deric gave an answer |
| Preserves form structure / sections | Flat list, scannable for retrieval |

Both files cover the same source application. They serve different
downstream consumers — `questions/` feeds the question archive,
`answers/` feeds the next application Deric fills out.

## Tweaking happens later

Per Deric's directive: **raw capture first, before tweaking.** Don't try
to canonicalize answers into a single "best answer per theme" yet. The
raw bank is the input to future indexing — keeping multiple answer
variants per question lets future-Deric pick the version that fits the
next application's tone.
