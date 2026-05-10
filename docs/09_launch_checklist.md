# Launch Checklist

This is the practical ship/no-ship checklist for a Milestone 3 push.

## Repo Verification

Run from repo root:

```bash
cd application-hub-mcp-server && npm run check
cd ../app && npm run type-check
cd ../app && npm run build
```

Expected:

- MCP TypeScript check passes.
- Next.js type-check passes.
- Next.js production build passes.
- Build output includes `/auth/callback`, `/hub`, `/hub/[slug]`, `/workspace/[program_id]`, `/profile`, and `/api/draft`.

## Auth

- Supabase Site URL points at the deployed app URL.
- Supabase redirect URLs include:
  - local: `http://localhost:3000/auth/callback`
  - production: `https://<production-domain>/auth/callback`
- Magic-link login opens `/auth/callback`, then lands in the app.
- Dev-only password sign-in is either disabled in production or intentionally feature-gated.
- Custom SMTP is configured before public launch, or the launch is explicitly capped to low-volume testing.

## Core Routes

Smoke these with a real authenticated user:

- `/hub`
  - Programs render from Supabase.
  - Filters do not crash.
  - Empty/zero heat does not look broken.
- `/hub/[slug]`
  - Program detail renders.
  - DNA/fit sections do not show impossible percentages.
  - External apply link is visible.
- `/workspace/[program_id]`
  - Questions render.
  - Answer editor saves.
  - Saved answer reloads after refresh.
- `/profile`
  - Answer bank renders.
  - Confidence enum remains `draft | solid | locked`.
- `/bank` once built
  - Unlocked questions render.
  - Locked previews render.
  - Upgrade/drip language is clear.

## AI Drafts

Current launch posture:

- Hosted drafts are disabled unless `PLATFORM_AI_DRAFTS_ENABLED=true`.
- Hosted drafts also require `ANTHROPIC_API_KEY`.
- Successful hosted drafts log to `ai_draft_runs`.
- `track_ai_usage_on_draft` updates `ai_usage`.

Smoke test when explicitly enabled:

- Set `PLATFORM_AI_DRAFTS_ENABLED=true`.
- Set `ANTHROPIC_API_KEY`.
- Click Draft with AI in workspace.
- Confirm text inserts into the editor.
- Confirm a row appears in `ai_draft_runs`.
- Confirm the current month row in `ai_usage` increments.
- Confirm over-limit users get HTTP `429`.

Ship/no-ship:

- If BYOK is not ready, hosted drafting should remain disabled or tightly limited.
- If hosted drafting is enabled, draft count must be visible in the UI before broad public launch.

## BYOK

Minimum before enabling user-paid AI:

- Migration `012_launch_hardening.sql` applied.
- `user_integrations` rows are metadata only; raw keys are stored in a server-side secret store.
- `/profile/integrations` can create/update provider metadata.
- A server route can store/verify a user key without exposing it client-side.
- `/api/draft` prefers user provider credentials before platform fallback.

## Program Data

- Deadline updates are source-verified before applying.
- Use `seed/01_deadline_updates_template.sql`.
- Do not invent deadlines.
- Keep unknown programs as rolling or unknown.
- Program detail pages have TL;DR/pros/cons/best-for copy before public announcement.

## Email

- Resend domain verified.
- Supabase Auth custom SMTP uses Resend settings.
- Magic link tested on the production domain.
- Sender address uses an owned domain, not a personal inbox.

## Public Launch Bar

Milestone 3 is ready when:

- Core routes pass.
- Auth email is reliable.
- BYOK/hosted draft policy is explicit.
- Program pages feel scannable.
- Deadlines are not all fake "Rolling."
- The product can be explained as: question archive + answer bank + program workspace + signal intelligence.
