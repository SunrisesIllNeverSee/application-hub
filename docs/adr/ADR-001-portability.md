# ADR-001 — Cross-Theme Portability

**Status:** Accepted  
**Date:** 2026-05-12  
**Owner:** Deric McHenry / Ello Cello LLC

## Decision

The question archive, answer bank, fit/review engine, and all MCP tools are built as domain-agnostic infrastructure. No founder-only hardcoding in reusable layers.

## What this means in code

- `archived_questions.domain` — CHECK constraint: `('founder','jobs','education','grants','general')`
- `programs.domain` — same constraint, defaults `'founder'`
- `app_import_sessions.domain` — same
- `import_queue.domain` — same
- Hub page: `.eq('domain', activeDomain)` — defaults `'founder'`, accepts `?domain=` param
- `hub_get_universal_questions`: `domain` param, default `'founder'`
- `hub_find_similar_questions`: `domain` param, default `'founder'`
- `get_top_programs_by_value()`: `p_domain` param, default `'founder'`

All implemented in migrations 034 + 038 and wired in the app/MCP layer.

## What is deferred

Seeding non-founder verticals (jobs, school applications, grants). Do not expand until the founder wedge validates — defined as **100+ active founders with measurable Answer Bank reuse rates**.

## Rule

When building new features: ask "does this work for a job applicant too?" If yes, build it portable. If the answer is "we'd need to refactor," make the layer generic first, then build the feature.
