#!/usr/bin/env bash
# ============================================================
# M09 local catalog-promotion test runner (migration 058)
# ============================================================
# Mirrors supabase/tests/p0/run_local.sh and reuses its fixtures. Runs
# against a LOCAL THROWAWAY Postgres cluster only (initdb in $M09_PGROOT,
# non-default port, loopback TCP only). It never connects to Supabase.
#   M09_PGROOT=/some/scratch/dir ./supabase/tests/m09/run_local.sh
# M09_RESULTS_JSON=<file> also writes every expectation (id, descr, pass) as JSON.
# Load order = production order: live baseline (049-053 state) -> 054 ->
# 055 -> 039 program_cycles (absent from the p0 baseline fixture) -> 058
# twice (idempotency). Every existing p0 suite (10/20/... *_tests.sql) must
# still pass. Then the 002 unique index on program_questions is created
# (the p0 baseline does not carry it; production may) and 058 is re-applied
# so its active-only index swap is exercised before the 058 suite runs.
# Exit status is non-zero if any expectation fails.
#
# GRANTS_MODE (M09 W11, explicit Data API grants) switches to the FULL-CHAIN
# path in full_chain.sh: a fresh database built from every migration
# (001 -> 062; no live-baseline fixture), under either
#   GRANTS_MODE=default   the pre-2026-10-30 Supabase default privileges
#   GRANTS_MODE=revoked   the post-2026-10-30 default (Supabase's opt-in
#                         ALTER DEFAULT PRIVILEGES ... REVOKE statements run
#                         BEFORE migration 001)
# and then the p0 suites, the 058 suite, the 50 grants suite, the 60 RPC
# caller-binding suite (061; needs the full chain, so it runs in both
# GRANTS_MODE settings only) and the 058 and 061 rollbacks. Needs PostgreSQL 17 (production major) with pgvector; point
# M09_PGBIN at its bin directory if it is not first on PATH.
set -euo pipefail
if [ -n "${M09_PGBIN:-}" ]; then export PATH="$M09_PGBIN:$PATH"; fi
GRANTS_MODE="${GRANTS_MODE:-}"
case "$GRANTS_MODE" in ''|default|revoked) ;; *) echo "GRANTS_MODE must be default or revoked" >&2; exit 2;; esac

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
P0="$(cd "$HERE/../p0" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
MIG="$REPO/supabase/migrations"
M058="$(ls "$MIG"/*_058_catalog_provenance_promotion.sql)"
M063="$(ls "$MIG"/*_063_catalog_publish_cycle_only.sql)"
PGROOT="${M09_PGROOT:-$(mktemp -d)}"
PGDATA="$PGROOT/data"
PGPORT="${M09_PGPORT:-54331}"
DB=m09test
export PGHOST=127.0.0.1 PGPORT PGUSER=postgres PGDATABASE=$DB

psql_q() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }
notices() { sed -E 's/^psql:[^ ]*:[0-9]+: NOTICE:  //; s/ \| $//'; }
banner() { printf '\n==================== %s ====================\n' "$*"; }

cleanup() { pg_ctl -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true; echo "[runner] local cluster stopped"; }
trap cleanup EXIT

banner "cluster"
mkdir -p "$PGROOT"
if [ ! -d "$PGDATA" ]; then
  initdb -D "$PGDATA" -U postgres -A trust --no-locale -E UTF8 >/dev/null
fi
pg_ctl -D "$PGDATA" -o "-p $PGPORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" -l "$PGROOT/server.log" -w start >/dev/null
psql -X -q -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
psql -X -At -d postgres -c "select version()"

if [ -n "$GRANTS_MODE" ]; then
  # shellcheck source=full_chain.sh
  source "$HERE/full_chain.sh"
  exit 0
fi

banner "load: bootstrap, live baseline, 053, seed, harness, 054, 055, 039"
psql_q -f "$P0/00_bootstrap.sql"
psql_q -f "$P0/01_schema_live_baseline.sql"
psql_q -f "$MIG/053_canonical_promotion.sql"
psql_q -f "$P0/02_seed_synthetic.sql"
psql_q -f "$P0/03_harness.sql"
psql_q -f "$MIG/054_canonical_write_boundary.sql"
psql_q -f "$MIG/055_team_invite_acceptance.sql"
psql_q -f "$MIG/039_program_cycles.sql"

banner "apply 058 (1st): $(basename "$M058")"
psql_q -f "$M058"
banner "idempotency: re-apply 058"
psql_q -f "$M058"
psql -X -At -c "select 'serials: '||string_agg(kind||'/'||origin||'='||n, ', ' order by kind, origin) from (select kind, origin, count(*) n from catalog_serials group by 1,2) s"
psql -X -At -c "select 'revisions='||(select count(*) from program_template_revisions)||' mapping_decisions='||(select count(*) from question_mapping_decisions)||' entities='||(select count(*) from catalog_entities)||' curators='||(select count(*) from catalog_curators)"
psql -X -At -c "select 'indexes: '||string_agg(indexname, ', ' order by indexname) from pg_indexes where tablename='program_questions'"
psql -X -At -c "select 'data untouched: canonical programs='||(select count(*) from programs where source='canonical')||' relationships='||(select count(*) from program_questions pq join programs p on p.id=pq.program_id where p.source='canonical')||' relinked='||(select count(*) from program_questions where template_revision_id is not null or superseded_by_revision_id is not null)"

banner "existing p0 suites, phase post, after 058"
EXISTING=()
for f in "$P0"/[0-9][0-9]_*_tests.sql; do EXISTING+=(-f "$f"); done
psql_q -t -A -o /dev/null -c "select set_config('p0.phase','post',false)" "${EXISTING[@]}" 2>&1 | notices

banner "002 unique index present (production shape per 002) -> re-apply 058 (index swap)"
psql_q -c "CREATE UNIQUE INDEX IF NOT EXISTS idx_program_questions_unique ON program_questions (program_id, archived_question_id)"
psql_q -f "$M058"
psql -X -At -c "select 'indexes: '||string_agg(indexname, ', ' order by indexname) from pg_indexes where tablename='program_questions'"
# 063 replaces catalog_publish_candidate (cycle-only publish); re-applying 058 above restored the 058 body
psql_q -f "$M063"

banner "058 catalog provenance + promotion suite"
psql_q -t -A -o /dev/null -c "select set_config('p0.phase','post',false)" -f "$HERE/40_catalog_promotion_tests.sql" 2>&1 | notices

banner "rollback: the migration's documented ROLLBACK block, then re-apply"
sed -n '/^-- ROLLBACK/,/^--   COMMIT;/p' "$M058" | sed -n '/^--   BEGIN;/,/^--   COMMIT;/p' \
  | sed -E 's/^--   //' | grep -v '^--' > "$PGROOT/rollback058.sql"
psql_q -c "DROP SCHEMA IF EXISTS p0m CASCADE"   # test helpers reference the 058 enum
psql_q -1 -f "$PGROOT/rollback058.sql" 2>&1 | grep -v '^$' || true
RB=$(psql -X -At -c "select (select count(*) from pg_class where relname like 'catalog\_%' or relname in ('program_template_revisions','question_mapping_decisions'))||'/'||(select count(*) from information_schema.columns where table_name in ('program_questions','programs') and column_name in ('source_id','template_revision_id','superseded_by_revision_id','requirements','normalized_text','entity_id'))||'/'||(select count(*) from program_questions pq join programs p on p.id=pq.program_id where p.slug in ('yc-summer-2026','founding-500','redbud-vc','cyberfund-monastery','3xcapital'))")
echo "after rollback: catalog_relations/new_columns/legacy_occurrences = $RB"
psql_q -f "$M058"
RA=$(psql -X -At -c "select count(*) from catalog_serials where origin <> 'assigned'")
echo "after re-apply: backfilled serials = $RA"
if [ "$RB" = "0/0/103" ] && [ "$RA" = "216" ]; then echo "ROLLBACK PASS"; else echo "ROLLBACK FAIL"; exit 1; fi

# Optional per-expectation export for the W9 acceptance runner (test id, description, pass).
if [ -n "${M09_RESULTS_JSON:-}" ]; then
  psql -X -At -c "select coalesce(json_agg(json_build_object('id',test_id,'descr',descr,'pass',pass) order by seq),'[]') from p0.results" > "$M09_RESULTS_JSON"
fi

banner "summary"
psql -X -c "select case when test_id like 'CP-%' then '058 suite' else 'existing p0 suites' end as suite, count(*) total, count(*) filter (where pass) passed, count(*) filter (where not pass) failed from p0.results group by 1 order by 1"
FAILED=$(psql -X -At -c "select count(*) from p0.results where not pass")
[ "$FAILED" = 0 ] || { echo "FAILURES: $FAILED"; exit 1; }
echo "ALL PASS"
