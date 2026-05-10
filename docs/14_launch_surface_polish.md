# Launch Surface Polish

This note captures the UI/UX hardening that landed after the core MVP spine was already live.

## What changed

### 1. Honest heat/applicant fallbacks

Raw `0` values were making the Hub look broken even when the underlying program data was useful.

The app now:

- shows live heat scores when real `heat_score` data exists
- falls back to provisional labels like `High potential`, `Promising`, or `Early signal`
- shows applicant counts when known
- otherwise falls back to cohort-size context like `~200 seats`
- labels those fallbacks as provisional instead of pretending they are measured facts

This keeps the directory scannable without inventing precision we do not yet have.

### 2. Cohort context in founder workflow

Workspace and program detail views now surface:

- `cohort_name`
- `program_start_date`
- `cohort_size`

That matters because founders do not only care whether a program exists; they care which batch they are applying to, when it starts, and how selective the seat count feels.

### 3. Draft UX is BYOK-first and clearer

`/api/draft` was already BYOK-first, but the editor now makes the path more obvious:

- clearer provider-required messaging
- direct link to `/profile/integrations`
- clearer draft-limit messaging
- positive feedback when a draft used the founder's own Anthropic key

This keeps the product aligned with the intended operating model: user-paid AI, not silent platform spend.

### 4. Copy is now available where founders actually need it

Answer copy actions now exist both:

- on read-only answer display
- inside active editor controls

That matters because the real workflow often ends with pasting into external application portals.

## What this does not claim

- It does **not** mean heat/applicant modeling is complete.
- It does **not** replace a real synthetic compute job or richer downstream signal collection.
- It does **not** substitute for live BYOK end-to-end validation on production.

It simply makes the launch surface feel coherent and believable while the deeper signal layer catches up.
