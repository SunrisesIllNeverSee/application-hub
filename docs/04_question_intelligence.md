# Question Intelligence Layer
> What the questions reveal. How we score it all.

This is the most defensible part of the platform. Anyone can scrape a list of programs. No one else is decoding what those programs actually care about by analyzing their questions at scale.

---

## The Core Insight

A program's application questions are a direct signal of its investment thesis, its selection criteria, and what it values in a founder. A program that leads with "describe your traction" is different from one that leads with "why are you the right team for this?" A program that asks 3 questions about the market and 1 about the team is telling you exactly what it weights.

We're building the only system that reads those signals systematically across hundreds of programs.

---

## Two Levels of Scoring

### Level 1: Program DNA Score
*What does this program actually care about, based purely on its questions?*

Every program gets a DNA profile — a breakdown of question theme weights. We calculate this from:
- How many questions per theme
- Word limits per question (more words = more weight)
- Whether the question is required or optional
- Order (earlier questions often signal higher priority)

**Themes:**
| Theme | What it signals |
|---|---|
| `mission` | Why this exists, vision, long-term ambition |
| `problem` | Clarity on what's broken, evidence they understand the space |
| `solution` | The product, how it works, differentiation |
| `traction` | Revenue, users, growth, retention — proof it works |
| `team` | Who, why them, relevant experience, co-founder dynamics |
| `market` | TAM, SAM, SOM, competitive landscape |
| `financials` | Revenue model, unit economics, burn, runway |
| `ask` | What they want from the program, how they'll use it |
| `fit` | Why this program specifically, what they'll get from it |
| `impact` | Social/environmental outcomes (common in fellowships + gov grants) |
| `diversity` | Background, underrepresented founder questions |
| `stage` | Where they are, what's next |

**DNA score example:**

```
YC (inferred from questions):
  traction:  35%
  team:      25%
  product:   20%
  market:    10%
  ask:       10%

Echoing Green Fellowship (inferred):
  impact:    40%
  mission:   30%
  team:      20%
  financials: 10%
```

This is visible to users on each program page. Instantly tells them what they're walking into.

---

### Level 2: Question Significance Score
*How much does this individual question actually matter, across all programs that ask it?*

Every question in `archived_questions` gets a **significance score** computed from:

```
significance_score = (
  asked_by_count              -- how many programs ask it (raw reach)
  × avg_word_limit_weight     -- higher word limit = program invests more in this answer
  × theme_prestige_weight     -- traction > mission > impact (weighted by program type)
  × is_universal_bonus        -- 1.2x if asked by 80%+ of programs
)
```

This tells users: *"This question matters. If you get this answer right, it works across most of what you're applying to."*

Universal questions with high significance scores get surfaced first in onboarding. Build these answers well and you've covered 70% of your applications.

---

### Level 3: Applicant–Program Fit Score
*How well does this specific user match what this program is looking for?*

Computed per (user, program) pair. Factors:

**Answer coverage:**
- What % of required questions does the user have a profile answer for?
- What's the confidence level of those answers (draft / solid / locked)?

**Theme alignment:**
- Does the user's strongest profile answers match the program's highest-weighted themes?
- E.g. user has strong traction answers + program weights traction at 35% → high fit

**Explicit criteria match:**
- Program specifies: stage (pre-seed), sector (climate), geography (US) → match against user profile fields

**Answer quality signal:**
- Word count vs limit ratio (using 60–90% of limit is signal of quality)
- Divergence score from profile answer (too divergent = they're writing from scratch = less ready)

```
fit_score = (
  (coverage_pct × 0.4)
  + (theme_alignment_score × 0.35)
  + (criteria_match × 0.15)
  + (answer_quality_signal × 0.10)
) × 100
```

Output: 0–100. Displayed as: "You're a 78% fit for this program."

---

## What This Unlocks

### For users
- "Which programs am I actually ready for right now?" → sort by fit_score
- "Which questions should I write first?" → highest significance_score questions covering the most programs
- "What does YC actually care about?" → DNA breakdown

### For the platform
- Opportunity Scout agent becomes genuinely intelligent — it's not just "you answered 3 of 5 questions," it's "your traction story is strong and YC weights traction at 35%, so you're a good fit even with gaps elsewhere"
- Answer Coach knows which answer matters most to this program → coaches toward the right emphasis

### For the MCP server
- `get_program_dna(program_id)` → theme weight breakdown
- `get_question_significance(question_id)` → significance score + which programs weight it highest
- `get_fit_score(user_token, program_id)` → full fit breakdown
- `find_best_programs_for_user(user_token)` → ranked by fit × program_value_score

---

## Schema Additions (Migration 008)

```sql
-- On archived_questions
ALTER TABLE archived_questions
  ADD COLUMN significance_score     NUMERIC(8,4) DEFAULT 0,
  ADD COLUMN avg_word_limit         INT,           -- avg word limit across programs that ask it
  ADD COLUMN theme_weight           NUMERIC(5,4);  -- how much this theme matters platform-wide

-- New table: program_dna
CREATE TABLE program_dna (
  program_id      UUID REFERENCES programs(id) ON DELETE CASCADE,
  theme           TEXT NOT NULL,
  question_count  INT NOT NULL DEFAULT 0,
  word_limit_sum  INT NOT NULL DEFAULT 0,
  weight_pct      NUMERIC(5,2),   -- % of total application weight for this theme
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (program_id, theme)
);

-- New table: user_program_fit
CREATE TABLE user_program_fit (
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id        UUID REFERENCES programs(id) ON DELETE CASCADE,
  fit_score         NUMERIC(5,2),
  coverage_pct      NUMERIC(5,2),
  theme_alignment   NUMERIC(5,2),
  criteria_match    NUMERIC(5,2),
  quality_signal    NUMERIC(5,2),
  computed_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, program_id)
);

-- Indexes
CREATE INDEX idx_program_dna_program ON program_dna (program_id);
CREATE INDEX idx_user_program_fit_user ON user_program_fit (user_id);
CREATE INDEX idx_user_program_fit_score ON user_program_fit (user_id, fit_score DESC);
CREATE INDEX idx_archived_questions_significance ON archived_questions (significance_score DESC);
```

---

## Cron Jobs (Daily)

```sql
-- Recompute program DNA from program_questions + word limits
SELECT cron.schedule('recompute-program-dna', '0 8 * * *',
  $$SELECT recompute_all_program_dna();$$
);

-- Recompute question significance scores
SELECT cron.schedule('recompute-question-significance', '0 8 * * *',
  $$SELECT recompute_question_significance();$$
);

-- Recompute fit scores for active users (users with activity in last 30 days)
SELECT cron.schedule('recompute-fit-scores', '0 9 * * *',
  $$SELECT recompute_active_user_fit_scores();$$
);
```

---

## How It Reads in the UI

**Program page — DNA bar:**
```
What YC cares about:
████████░░ Traction    35%
██████░░░░ Team        25%
████░░░░░░ Product     20%
██░░░░░░░░ Market      10%
██░░░░░░░░ Ask         10%
```

**Program card in hub:**
```
Y Combinator                                    [OPEN · 14 days left]
$500k · 7% equity · Batch S26
Fit: 82%  |  Value Score: 91  |  Heat: ████
[Start Application]
```

**Question in workspace:**
```
"What is your company's monthly revenue growth rate?"
Significance: ★★★★★  ·  Asked by 47 programs  ·  Theme: Traction
→ Your profile answer: [solid] [view]
```

**Top questions to write first (onboarding prompt):**
```
Answer these 5 questions and you'll be ready for 60% of open programs:
1. Describe your traction (significance: 94)
2. Why are you the right team? (significance: 88)
3. What problem are you solving? (significance: 85)
4. What's your revenue model? (significance: 79)
5. Why now? (significance: 74)
```

---

## MCP Tools for This Layer

```typescript
get_program_dna(program_id)
// Returns theme breakdown with weights

get_question_significance(question_id)
// Returns significance score, theme, programs that ask it

get_fit_score(user_token, program_id)
// Returns full fit breakdown: coverage, theme alignment, criteria match

find_best_programs_for_user(user_token, filters?)
// Returns programs ranked by (fit_score × program_value_score)
// The Opportunity Scout in tool form

get_universal_questions(limit?)
// Returns highest-significance universal questions — the ones to answer first

rank_my_answers(user_token)
// Returns user's profile answers ranked by how much they cover
// "Your traction answer covers 47 programs. Your team answer covers 39 programs."
```

---

## Why This Is the Moat

This scoring system requires:
1. A large enough question archive to compute meaningful weights (we build it by seeding)
2. Crowdsourced acceptance data to validate which question themes actually predict acceptance
3. User behavior data (which programs users save, start, submit) to calibrate heat + fit
4. Time — the system gets smarter with every program added and every user cycle

A competitor can't copy this on day one. The data compound is the moat.
