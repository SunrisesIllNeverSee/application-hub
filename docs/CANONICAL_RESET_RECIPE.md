# Canonical Rebuild Data Reset Recipe

This is the reset lane from `ARCHIVE_NOTES.md`, rewritten as an explicit operator checklist. Do not run it casually. Back up Supabase first and confirm the real-data import path is ready.

## Purpose

The canonical hub must be built from real captured applications, not synthesized question/program mappings. The existing intelligence engine can stay, but synthetic data should be removed or marked unverified before canonical scoring is trusted.

## Manual SQL

```sql
begin;

delete from user_program_fit;
delete from program_dna;
delete from program_questions;

delete from archived_questions aq
where not exists (
  select 1
  from profile_answers pa
  where pa.archived_question_id = aq.id
);

alter table programs
  add column if not exists questions_status text not null default 'unverified';

update programs
set questions_status = 'unverified',
    updated_at = now();

commit;
```

## Required Follow-Up

1. Import 10 or more real applications through the workstation or canonical ingestion API.
2. Review staged questions before promotion.
3. Map each real question to canonicals via the Canonical Hub.
4. Re-run intelligence only on validated source data.
5. Recompute aggregate stats and smart matcher recommendations.

## Safety Notes

- Do not delete `profile_answers`, BYOK integrations, user applications, subscriptions, or user-generated content.
- Do not auto-promote Firecrawl output.
- Keep every reset run tied to a lineage event or operator note.
