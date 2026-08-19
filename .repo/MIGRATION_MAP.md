# Migration Map — application-hub

**Installed:** 2026-08-19
**Mode:** migrate
**Profile:** platform

## Existing structure preserved

All existing root directories declared in `allowed_root_dirs_extra`:
- `app/` — Next.js application (nested package.json)
- `appfeeder/` — browser extension feeder
- `application-hub-mcp-server/` — MCP server
- `qaapplication/` — QA pipeline
- `seed/` — seed data (added to artifact_roots)
- `supabase/` — Supabase backend config
- `webextension/` — browser extension
- `.firecrawl/`, `.vercel/` — tool caches (gitignored)

All existing root files declared in `allowed_root_files_extra`:
- `.claudeignore`, `.mcp.json`, `REPO_INDEX.md`

## Canon context

- Authority role: `implementation`
- Canon contexts: `moses`
- Authority owner: `search_authority`

## Migration steps (before enforce)

1. [ ] Run `repo_check.py --ci` until clean (currently clean)
2. [ ] Verify GitHub ruleset application (solo-fast)
3. [ ] Switch REPO.yaml mode from `migrate` → `enforce`

## Enforce readiness

Ready after ruleset verification — no structural defects.
