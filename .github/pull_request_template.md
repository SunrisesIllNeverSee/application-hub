## What this changes

<!-- One sentence. -->

## Type of change

- [ ] Seed data (new program or questions added to archive)
- [ ] MCP server — new tool / resource / prompt
- [ ] MCP server — bug fix
- [ ] Database migration
- [ ] Next.js UI
- [ ] Infrastructure / config

## Checklist

**For MCP server changes:**
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] Tool/resource/prompt registered in `src/index.ts`
- [ ] Input schema uses `.strict()`
- [ ] Returns both `content[text]` and `structuredContent`
- [ ] Supabase join access uses `Array.isArray` guard pattern

**For migrations:**
- [ ] New migration file named `00N_description.sql` (next in sequence)
- [ ] Idempotent where possible (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- [ ] RLS policies included for any new tables
- [ ] Tested on a fresh Supabase branch before merging to main

**For seed data:**
- [ ] Real questions verified from actual application (not guessed)
- [ ] Exact phrasing, not paraphrased
- [ ] Theme classification matches valid themes (see CONTRIBUTING.md)
- [ ] `compute_significance_scores()` runs clean after insert

## Notes for reviewer

<!-- Anything that needs context or a second look. -->
