# SMTP Launch Handoff

Canonical setup guide: `docs/08_resend_smtp_setup.md`.

This handoff is the shorter launch checklist for the manual work that cannot be completed from the repo.

## Resend

1. Create or open the Resend account.
2. Add the sending domain.
3. Add DNS records exactly as Resend provides them.
4. Wait for domain verification.
5. Create an API key for SMTP.

## Supabase Auth

Open:

```text
Supabase Dashboard -> Authentication -> Emails -> SMTP Settings
```

Use:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Resend API key |
| Sender email | Owned domain sender, e.g. `hello@<domain>` |
| Sender name | `Application Hub` |

## Redirects

Confirm Supabase Auth redirect URLs:

- `http://localhost:3000/auth/callback`
- `https://<production-domain>/auth/callback`

## Smoke Test

1. Open the production login page.
2. Request a magic link for a real inbox.
3. Confirm the email arrives from the owned sender.
4. Click the link.
5. Confirm it lands on `/auth/callback`.
6. Confirm the session is established and the user reaches the app.
7. Repeat resend once to verify rate behavior.

## Ship Note

Supabase's default sender is acceptable for tiny internal testing. Custom SMTP should be done before public announcement or broader invite waves.
