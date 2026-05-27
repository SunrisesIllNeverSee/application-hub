# 02-processing/ — Multi-Program Captures Being Triaged

**Step 2** of the pipeline. A capture that contains multiple programs
at once (e.g. a Safari tabs export with 14 URLs inside) lives here
until every program candidate inside is either:

- extracted into its own `../07-apply/<slug>.md`, or
- marked `skip` in a sibling `<capture>.todo.md` triage file.

Single-program captures don't pass through this folder — they go
`01-inbox/ → 07-apply/` directly.

Once every candidate in a multi-program capture is resolved, the
capture and its todo file move together to `../07-apply/_shared/raw/`
and an entry lands in `../audit-log.md`.
