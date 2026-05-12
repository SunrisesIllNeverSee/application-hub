# Rewards System Design

_Last updated: 2026-05-11_
_Status: Mapped. Currency naming TBD (days vs credits). Build when confirmed._

---

## Open decisions before building UI

| Decision | Options | Notes |
|---|---|---|
| Currency name | **Days** (days of Pro access) · Credits · Points | "Days" is most tangible — earning 5 days means 5 extra days on your Pro clock |
| Redemption mechanic | Pro days · Question unlocks · Priority features | Need to pick one primary before UI makes sense |
| OG share image | Static (mos2es.xyz OG tags) · Dynamic card (user stats) | Dynamic is more shareable — "I've answered 25 questions" |
| Leaderboard | Yes (eventually) · No (privacy concern) · Opt-in | Deferred until enough users |

---

## Currency philosophy

The currency (days or credits) should feel earned, not gamified for its own sake.
Every earning action should map to something real:
- Social sharing → you brought someone in → you get value back
- Answering questions → you built the product → you get access
- Contributing programs → you grew the archive → you get question unlocks
- Contribution accepted → your work is live → bigger reward

**If using "Days":** 1 credit = 1 day of Pro access. A user who earns 30 days can redeem for a free month. Clean, directly valued, no abstraction layer.

**If keeping "Credits":** more flexible for future redemption options, but requires explanation. "What do credits do?" is a FAQ waiting to happen.

---

## Earning surface — full map

### Social (manual claim, honor system)
| Action | Amount | Dedup |
|---|---|---|
| Follow on X/Twitter | 50 cr / 50 days | Once per user |
| Follow on LinkedIn | 50 cr / 50 days | Once per user |
| Star on GitHub | 100 cr / 100 days | Once per user |
| Share pre-made post on X | 25 cr / 25 days | Weekly |
| Share pre-made post on LinkedIn | 25 cr / 25 days | Weekly |

### App actions (auto + manual)
| Action | Amount | Dedup |
|---|---|---|
| First answer written | 10 | Once |
| 25 answers | 50 | Once |
| 100 answers | 150 | Once |
| First AI draft used | 20 | Once |
| Profile completed | 25 | Once |
| Referred a user (future) | 100 | Per referral |

### Community contributions (auto via DB triggers)
| Action | Amount | Dedup |
|---|---|---|
| Submit a program | 25 | Per submission |
| Submission accepted | 50 | Per accepted submission |
| Submit an archived question | 15 | Per submission |
| Question accepted | 25 | Per accepted question |

---

## Share post with image — design

### Static OG image (already partially done)
mos2es.xyz has `metadataBase` set. Adding a proper `openGraph.images` entry to the root layout creates the card that appears when any URL is shared. This is the minimum — one branded card, always shows.

### Dynamic OG image (richer)
`/api/og?user=<id>` generates a personalized card:
```
┌─────────────────────────────────────────────┐
│  ⬡  Application Hub                         │
│                                              │
│  Building my answer bank.                   │
│  25 questions answered · 3 programs tracked  │
│                                              │
│  mos2es.xyz                                  │
└─────────────────────────────────────────────┘
```
Uses Vercel's `@vercel/og` — no image server needed, runs as an Edge Function.
The share URL becomes `https://mos2es.xyz?ref=<user_slug>` so referral attribution is baked in.

### Share flow with image
1. User opens CreditsPanel → Share section
2. Sees post preview with image thumbnail
3. Clicks "Share on X" → opens `twitter.com/intent/tweet?text=...&url=mos2es.xyz?ref=<slug>`
4. Twitter scrapes the URL → OG image appears in the tweet
5. User posts → returns to app → "Mark as shared" → claim reward

---

## UI surfaces — where rewards live

### 1. Profile → Credits tab (`/profile/credits`) ← already built
- Balance display
- Earning actions (social, app, community)
- Achievement grid
- Recent activity log

### 2. Sidebar balance badge (small)
A subtle "X days" or credit count next to the user avatar in the sidebar footer.
Updates in real-time. Clicking it navigates to `/profile/credits`.

### 3. Toast on earn
When a DB trigger fires (e.g. user saves their 25th answer), a toast appears:
> "🏗️ 25 questions answered — you earned 50 days. +1 achievement unlocked."
Requires a polling mechanism or Supabase Realtime subscription.

### 4. RFC mode CTA (already built)
On Hub page, RFC mode badge → subtitle → "Submit a program, earn credits"
Links to `/hub/submit?kind=...`

### 5. Landing page social proof (future)
"Join 142 founders who've earned 3,200+ days" — aggregate stats, no individual names.

### 6. OG share card on `/profile/credits`
A "Share your progress" block at the top of the credits page:
> "You've answered 25 questions. Share this milestone."
Dynamic image card generated server-side, share button pre-fills the post.

---

## Achievement list — full

| ID | Label | Icon | Description | Trigger |
|---|---|---|---|---|
| `first_answer` | First Word | ✍️ | Wrote your first answer | Auto: 1st answer saved |
| `answer_25` | Building Arsenal | 🏗️ | 25 questions answered | Auto: 25th answer saved |
| `answer_100` | Arsenal Complete | ⚡ | 100 questions answered | Auto: 100th answer saved |
| `first_draft` | AI Powered | 🤖 | Used AI to draft an answer | Manual claim |
| `first_submission` | Contributor | 📋 | Submitted a program | Auto: import_queue INSERT |
| `accepted` | Verified Contributor | ✅ | Had a submission accepted | Auto: award trigger |
| `social_connected` | Connected | 🔗 | Followed on social | Manual claim |
| `profile_complete` | Full Profile | 👤 | Completed your profile | Manual claim |
| `question_submitter` | Question Spotter | 🔍 | Submitted a new archived question | Future |
| `streak_7` | Week Streak | 🔥 | 7 consecutive days active | Future |
| `streak_30` | Monthly Habit | 📅 | 30 consecutive days active | Future |
| `referral_first` | Connector | 🤝 | Referred your first user | Future (needs referral system) |

---

## Redemption mechanics

### Option A — Days of Pro access (recommended if "days" naming adopted)
100 days earned = 100 days of Pro. Displayed as "Free Pro until [date]" in billing.
Stripe handles this via `trial_end` on the subscription or a separate free period.

### Option B — Question unlock boosts
1 credit = 1 bonus question unlocked immediately (on top of daily drip).
Stackable. Never expires.

### Option C — Hybrid
First redemption tier: question unlocks (immediate, small).
Second tier: Pro days (larger, delayed).

### Recommended: Option B first, Option A when Stripe integration is confirmed
Question unlocks are already the infrastructure (drip system, user_question_unlocks).
Adding a "redeem credits for bonus unlocks" button is a small API call.
Pro days requires Stripe subscription manipulation.

---

## Build sequence

1. **OG image** — `/api/og` static card + update root layout `openGraph.images` — ~1 hour
2. **Dynamic OG** — personalized share card with user stats — ~2 hours
3. **Sidebar balance badge** — credit/day count in Sidebar footer — ~30 min
4. **Earn toast** — Supabase Realtime subscription on credit_events — ~1 hour
5. **Redemption button** — "Spend X credits → unlock Y questions" — ~1 hour
6. **Question submission** — new archived question pipeline + trigger — ~3 hours
7. **Streak tracking** — migration + daily cron check — ~2 hours
8. **Referral system** — ref param in share URL + credit on signup — ~3 hours

---

## What's already built (don't rebuild)

- `credit_events` table + triggers (answers, submissions) — migration 032
- `user_achievements` table — migration 032
- `user_credit_balance` view — migration 032
- `award_contribution_credits()` trigger (accepted programs) — migration 031
- `/api/credits/claim` — POST (manual claims) + GET (balance + achievements)
- `CreditsPanel` component — balance, sharing, achievements, actions
- `/profile/credits` page
- Pre-made share posts — `SHARE_CONTENT` in `lib/credits.ts`
- `getShareUrl()` helper for Twitter + LinkedIn intent URLs
