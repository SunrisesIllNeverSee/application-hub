---
name: testing-application-hub
description: Test the Application Hub Next.js app end-to-end. Use when verifying UI changes, API endpoints, branding updates, or new page routes.
---

# Testing Application Hub

## Prerequisites

- The repo is cloned at the standard location
- Node.js and npm are available
- The `app/` directory contains the Next.js application

## Devin Secrets Needed

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (public, safe for client)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (public, safe for client)
- For authenticated testing: a test user email/password or magic link access

## Environment Setup

1. The Vercel preview deployment might be behind deployment protection (returns 401). If so, fall back to running the app locally.

2. To run the app locally without real Supabase credentials (sufficient for testing public pages like the homepage):
   ```bash
   cd app
   echo 'NEXT_PUBLIC_SUPABASE_URL=https://betcyfbzsgusaghriptz.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJplaceholder' > .env.local
   npm run dev
   ```
   The middleware will fail auth checks but public pages (homepage) will still render for unauthenticated visitors.

3. For full authenticated testing, you need real Supabase credentials in `.env.local`.

## What's Testable Without Auth

- **Homepage** (`/`): Public page, renders branding, hero section, archive preview, pricing, FAQ
- **Auth redirects**: Protected routes like `/smart-matcher`, `/dash`, `/applications` redirect to `/login`
- **API auth guards**: Protected API routes like `/api/export/persona` return 401 without session
- **Static file structure**: Chrome extension files in `webextension/chrome/application-hub/`
- **Migration SQL files**: Can verify structure, idempotency guards, RLS policies

## What Requires Auth

- **Smart Matcher page** (`/smart-matcher`): Requires authenticated session + persona data
- **Export API actual output**: Auth check runs before format validation
- **Dashboard, Applications, Questions, Answers pages**: All behind auth middleware
- **Any Supabase RPC calls**: Need valid JWT

## Testing Procedure

### 1. Start local dev server
```bash
cd app && npm run dev &
sleep 8
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
```

### 2. Verify public pages via curl
```bash
# Check homepage content
curl -sL http://localhost:3000/ | grep -o "expected text pattern"

# Check auth redirects
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/smart-matcher  # expect 307

# Check API auth guards
curl -s http://localhost:3000/api/export/persona?format=gdpr  # expect {"error":"Unauthorized"}
```

### 3. Visual verification via browser
Open `http://localhost:3000/` in the browser and take screenshots of key sections. Zoom into specific regions for detailed text verification.

### 4. File structure verification
```bash
# Chrome extension
find webextension/chrome/application-hub/ -type f | sort
cat webextension/chrome/application-hub/manifest.json | python3 -c "import json,sys; m=json.load(sys.stdin); print(m)"

# Migration files
grep -c "IF NOT EXISTS" migrations/042_*.sql
grep -c "ENABLE ROW LEVEL SECURITY" migrations/042_*.sql
```

## Known Issues / Workarounds

- The Vercel preview at `application-hub-git-*.vercel.app` might require Vercel team login. Use local dev server as fallback.
- The middleware crashes if `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are not set at all. Set them to any placeholder value to get past this.
- The Sidebar component does not include a link to `/smart-matcher` — navigate directly via URL.
- Production site is at `https://mos2es.xyz` — can be used for baseline comparison but may already have merged changes.

## Key Files

- `app/app/page.tsx` — Homepage (public)
- `app/app/(app)/smart-matcher/page.tsx` — Smart Matcher (auth required)
- `app/app/api/export/persona/route.ts` — Export API (auth required)
- `app/middleware.ts` — Auth middleware with protected route list
- `app/components/Sidebar.tsx` — Navigation sidebar (check for new page links)
- `webextension/chrome/application-hub/manifest.json` — Chrome extension manifest
- `migrations/` — SQL migration files
