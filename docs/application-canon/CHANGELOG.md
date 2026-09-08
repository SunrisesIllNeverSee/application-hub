# Application Canon — Changelog

All changes to the application canon are logged here with date, what changed, and why.

## Format

```
## YYYY-MM-DD — [Summary]

### Added / Changed / Removed

- [What changed]

### Reason

- [Why it changed]

### Update targets

- [ ] Database sync
- [ ] Answer bank sync
- [ ] Browser extension sync
```

---

## 2026-09-06 — Initial application canon structure

### Added

- Created `docs/application-canon/` directory structure: companies/, applications/, questions/, answers/, templates/
- Created `README.md` with purpose, structure, entity relationships, canon rules, MCP integration, and workflow
- Created 4 templates: company-profile, application-profile, question-profile, answer-variant
- Created 3 company profiles: Y Combinator, Techstars, Ello Cello
- Created 1 application profile: YC W26
- Created 2 question profiles: one-liner (significance 0.96), tell-me-about-yourself (significance 0.98)
- Created 1 answer variant: one-liner for YC W26

### Reason

- AQUA's database has the schema and seed data but no human-readable, version-controlled, agent-editable canon layer
- The social profile canon pattern (source of truth → variants → snippets → changelog) needed to be applied to the application graph's three core entities: companies, applications, questions
- The filesystem MCP is the primary tool for creating and maintaining these profiles
- Other MCPs (pdf-mcp, markitdown, knowledge-graph, supabase, web-scrape) feed the workflow turns but need a structure to write into — this is that structure

### Update targets

- [ ] Sync company profiles to Supabase `programs` / `funders` tables
- [ ] Sync question profiles to Supabase `archived_questions` table
- [ ] Sync answer variants to Supabase answer bank
- [ ] Generate Espanso snippets from answer variants
- [ ] Wire knowledge-graph entities to mirror canon structure
