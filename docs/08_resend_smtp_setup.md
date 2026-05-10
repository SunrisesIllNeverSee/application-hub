# Resend SMTP Setup for Supabase Auth

Application Hub uses Supabase Auth magic links. Supabase's built-in email sender is fine for early development, but it is rate-limited and not intended for real user testing or launch. Custom SMTP is required before inviting external users.

Recommended provider: **Resend**.

Primary references:

- Supabase custom SMTP docs: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase Resend partner page: https://supabase.com/partners/resend
- Resend + Supabase SMTP docs: https://resend.com/docs/send-with-supabase-smtp
- Resend Supabase getting-started guide: https://resend.com/docs/knowledge-base/getting-started-with-resend-and-supabase

---

## Goal

Route Supabase Auth emails through a sender controlled by Application Hub:

- Magic links
- Email confirmations
- Password reset emails
- Invites
- Future auth-related notifications

This removes the default Supabase sender bottleneck during smoke testing and gives the product a real sender identity.

---

## Project Values

Supabase project:

```text
Project ref: betcyfbzsgusaghriptz
Project URL: https://betcyfbzsgusaghriptz.supabase.co
```

Recommended sender:

```text
Sender email: no-reply@auth.applicationhub.co
Sender name: Application Hub
```

If `applicationhub.co` is not the final sending domain, use the real production domain. Prefer a dedicated auth subdomain such as `auth.example.com` instead of sending auth mail from the root domain or the same subdomain used for marketing.

---

## Required Secrets And Config Names

These values are dashboard secrets, not frontend environment variables.

| Name | Where it lives | Value |
|---|---|---|
| `RESEND_API_KEY` | Resend API Keys; also copied into Supabase SMTP password field | Resend API key beginning with `re_...` |
| `SMTP_HOST` | Supabase Auth SMTP settings | `smtp.resend.com` |
| `SMTP_PORT` | Supabase Auth SMTP settings | `465` |
| `SMTP_USER` | Supabase Auth SMTP settings | `resend` |
| `SMTP_PASS` | Supabase Auth SMTP settings | Same value as `RESEND_API_KEY` |
| `SMTP_ADMIN_EMAIL` / Sender email | Supabase Auth SMTP settings | Verified sender such as `no-reply@auth.applicationhub.co` |
| `SMTP_SENDER_NAME` / Sender name | Supabase Auth SMTP settings | `Application Hub` |

Do not add `RESEND_API_KEY`, SMTP password, or any service credential to `app/.env.local.example` with a public prefix. The Next.js app only needs the existing public Supabase URL and anon key for auth. Supabase Auth performs the email send server-side.

Future transactional email code can use a backend-only `RESEND_API_KEY`, but that is separate from Auth SMTP and should stay out of browser-visible config.

---

## DNS And Domain Setup

1. In Resend, open **Domains** and add the sender domain or subdomain.
2. Prefer a dedicated auth sending domain:
   - Good: `auth.applicationhub.co`
   - Also acceptable for early testing: `applicationhub.co`
   - Avoid mixing auth and marketing mail on one reputation surface.
3. Add the DNS records Resend generates at the DNS provider. Resend commonly requires SPF and DKIM records; use the exact host/name/value pairs shown in the Resend dashboard.
4. If Resend generates records for a subdomain, add them to that subdomain, not to the root by guesswork.
5. Wait for DNS propagation and click the Resend verify action. Resend says verification is often quick, but DNS can take longer depending on provider and TTL.
6. Keep DMARC in mind before real launch. A basic policy such as `p=none` is useful for monitoring; stricter policies can come after delivery is confirmed.

Do not proceed to broad tester invites until Resend shows the domain as verified.

---

## Resend Setup

1. Create or log into a Resend account.
2. Go to **Domains**.
3. Add a sending domain or subdomain.
4. Add the DNS records Resend provides at the domain registrar/DNS host.
5. Wait until Resend marks the domain as verified.
6. Create or copy a Resend API key.
7. Use these SMTP credentials:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: the Resend API key

Use a from address such as:

```text
Application Hub <no-reply@auth.applicationhub.co>
```

---

## Supabase Setup

In the Supabase dashboard for project `betcyfbzsgusaghriptz`:

1. Open **Authentication**.
2. Open **Email** under the notifications/email settings area.
3. Open **SMTP Settings** or **Set up custom SMTP**.
4. Set sender fields:
   - Sender email: `no-reply@auth.applicationhub.co` or the verified sender
   - Sender name: `Application Hub`
5. Paste the Resend SMTP values:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: the Resend API key
6. Save.
7. Go to **Authentication -> Rate Limits** and review email limits. Supabase may keep a conservative initial custom-SMTP limit; raise only after deliverability is stable.
8. Send a test magic link from the Application Hub login page.

If the dashboard field labels differ, match by meaning: host, port, username, password, sender email, and sender name.

Application Hub's callback URL is:

```text
/auth/callback
```

For local testing this is typically:

```text
http://localhost:3000/auth/callback
```

For production, add the deployed app URL to Supabase Auth URL settings and redirect allowlist before testing public users.

---

## Resend Integration Option

If available, Resend's Supabase integration can configure these settings automatically:

1. Open Resend.
2. Go to **Integrations**.
3. Choose **Supabase**.
4. Connect the Supabase account.
5. Select project `betcyfbzsgusaghriptz`.
6. Select the verified sending domain.
7. Let Resend create the API key and configure the Supabase SMTP integration.
8. Open the Supabase dashboard afterward and confirm the Auth email settings.

Manual SMTP is still a good fallback if the integration is unavailable.

---

## Magic-Link Auth Impact

No app code should need to change for the existing magic-link login flow.

What changes:

- Supabase Auth sends login/signup/recovery emails through Resend instead of Supabase's default sender.
- Magic-link emails can go to real tester addresses, not only Supabase organization members.
- The link still resolves through Supabase Auth and redirects back to Application Hub's configured callback URL.
- The sender reputation and DNS authentication now belong to the Application Hub domain.

What must stay correct:

- Supabase Auth **Site URL** should point to the deployed app URL when production testing begins.
- Supabase Auth **Redirect URLs** must include the app callback URL, including local development if testers use local builds.
- The current app expects the callback route at `/auth/callback`.

Keep magic-link templates focused and low-friction. Avoid marketing copy in auth emails because it can hurt deliverability.

---

## Secrets And Environment

For Supabase Auth SMTP, the SMTP credentials live in the Supabase project settings, not in the Next.js app.

Do not put SMTP passwords in:

- `app/.env.local`
- `NEXT_PUBLIC_*` variables
- frontend code
- committed docs

If future Edge Functions send product emails directly through Resend, use a server-side secret named:

```text
RESEND_API_KEY
```

That is separate from Supabase Auth SMTP.

---

## Test Checklist

Use at least two real inboxes.

- Confirm sender email uses the verified Resend domain.
- Confirm sender name is `Application Hub`.
- Confirm SMTP host is `smtp.resend.com`.
- Confirm SMTP port is `465`.
- Confirm SMTP username is `resend`.
- Confirm SMTP password is the Resend API key.
- Confirm Site URL points to the intended app environment.
- Confirm Redirect URLs include the intended callback URL.
- Confirm Resend domain is verified and SPF/DKIM records are passing.
- Send magic link from `/login`.
- Confirm email arrives from the Application Hub sender.
- Click the link and confirm it lands on `/auth/callback`.
- Confirm `/auth/callback` redirects into `/hub`.
- Repeat once from a second browser profile or private window.
- Repeat with a non-team test address.
- Confirm no `Database error saving new user` appears in Supabase auth logs.
- Confirm rate limits no longer block a normal smoke-test loop.
- Check Resend activity logs for accepted, bounced, or rejected messages.

---

## Launch Notes

Custom SMTP does not replace the need for:

- A working `/auth/callback` route.
- Correct Supabase redirect allowlist entries.
- Migration `009_fix_auth_trigger_search_path.sql`.
- A policy decision on whether the dev-only password sign-in remains before launch.

Once custom SMTP is working, the dev-only password escape hatch can be removed or gated behind a development-only flag.

Keep auth emails separate from marketing emails. Consider a custom Supabase Auth/API domain later so links do not expose the shared Supabase project domain in auth emails.
