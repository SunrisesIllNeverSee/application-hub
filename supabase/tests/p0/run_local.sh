#!/usr/bin/env bash
# ============================================================
# P0 local role-boundary test runner (migrations 054 / 055)
# ============================================================
# Runs against a LOCAL THROWAWAY Postgres cluster only (initdb in
# $P0_PGROOT, non-default port, loopback TCP only). It never connects to
# Supabase. Usage:
#   P0_PGROOT=/some/scratch/dir ./supabase/tests/p0/run_local.sh
# Exit status is non-zero if any expectation fails.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
MIG="$REPO/supabase/migrations"
PGROOT="${P0_PGROOT:-$(mktemp -d)}"
PGDATA="$PGROOT/data"
PGPORT="${P0_PGPORT:-54329}"
DB=p0test
export PGHOST=127.0.0.1 PGPORT PGUSER=postgres PGDATABASE=$DB

psql_q() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }
run_tests() { # $1 = phase; NOTICE lines carry the PASS/FAIL report
  psql_q -t -A -o /dev/null -c "select set_config('p0.phase','$1',false)" \
    -f "$HERE/10_canonical_boundary_tests.sql" -f "$HERE/20_team_invite_tests.sql" 2>&1 \
    | sed -E 's/^psql:[^ ]*:[0-9]+: NOTICE:  //; s/ \| $//'
}
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

banner "load: bootstrap, live-baseline schema, REAL migration 053, synthetic seed, harness"
psql_q -f "$HERE/00_bootstrap.sql"
psql_q -f "$HERE/01_schema_live_baseline.sql"
psql_q -f "$MIG/053_canonical_promotion.sql"
psql_q -f "$HERE/02_seed_synthetic.sql"
psql_q -f "$HERE/03_harness.sql"
psql -X -At -c "select 'canonical programs='||(select count(*) from programs where source='canonical')||' canonical relationships='||(select count(*) from program_questions pq join programs p on p.id=pq.program_id where p.source='canonical')||' archived_questions='||(select count(*) from archived_questions)"
psql -X -At -c "select 'policies: '||string_agg(tablename||'.'||policyname, ', ' order by tablename, policyname) from pg_policies where tablename in ('programs','archived_questions','program_questions')"

banner "PHASE pre (live baseline, before 054/055): gaps must reproduce"
run_tests pre

banner "apply 054 (1st)"
psql_q -f "$MIG/054_canonical_write_boundary.sql"
banner "apply 055 (1st)"
psql_q -f "$MIG/055_team_invite_acceptance.sql"
banner "idempotency: re-apply 054 and 055"
psql_q -f "$MIG/054_canonical_write_boundary.sql"
psql_q -f "$MIG/055_team_invite_acceptance.sql"
psql -X -At -c "select 'policies: '||string_agg(tablename||'.'||policyname, ', ' order by tablename, policyname) from pg_policies where tablename in ('programs','archived_questions','program_questions')"
psql -X -At -c "select 'guard triggers: '||string_agg(tgname, ', ' order by tgname) from pg_trigger where tgname like '%canonical_guard' or tgname like '%service_only_guard'"
psql -X -At -c "select 'data untouched: canonical programs='||(select count(*) from programs where source='canonical')||' relationships='||(select count(*) from program_questions pq join programs p on p.id=pq.program_id where p.source='canonical')"

banner "PHASE post (after 054/055): gaps closed, legitimate flows intact"
run_tests post

banner "concurrency: two sessions race to accept the same token (single use)"
race() { # $1 = label, $2 = pre-sleep seconds, $3 = hold seconds
  psql -X -At -v ON_ERROR_STOP=1 <<SQL > "$PGROOT/race_$1.out" 2>&1 &
select pg_sleep($2);
begin;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated","email":"stranger@example.test"}',true);
set local role authenticated;
select '$1: ' || public.accept_team_invite('tok-race')::text;
select pg_sleep($3);
commit;
SQL
}
race A 0 2
race B 0.7 0
wait
cat "$PGROOT/race_A.out" "$PGROOT/race_B.out" | grep -E "^[AB]: "
psql -X -At -c "select 'membership rows for a4 on team: '||count(*) from team_members where user_id='00000000-0000-0000-0000-0000000000a4'"
A_OK=$(grep -c '"status": "joined"' "$PGROOT/race_A.out" || true)
B_OK=$(grep -c '"error": "invalid_or_used"' "$PGROOT/race_B.out" || true)
CNT=$(psql -X -At -c "select count(*) from team_members where user_id='00000000-0000-0000-0000-0000000000a4'")
if [ "$A_OK" = 1 ] && [ "$B_OK" = 1 ] && [ "$CNT" = 1 ]; then echo "RACE PASS"; else echo "RACE FAIL"; exit 1; fi

banner "summary (all phases)"
psql -X -c "select phase, count(*) total, count(*) filter (where pass) passed, count(*) filter (where not pass) failed from p0.results group by phase order by phase desc"
