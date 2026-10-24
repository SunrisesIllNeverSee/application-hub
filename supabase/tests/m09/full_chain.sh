# shellcheck shell=bash
# ============================================================
# M09 W11 full-chain runner (sourced by run_local.sh when GRANTS_MODE is set)
# ============================================================
# LOCAL THROWAWAY POSTGRES ONLY (the cluster run_local.sh started). Never
# connects to Supabase. Expects from run_local.sh: HERE P0 MIG M058 PGROOT
# DB, psql_q, notices, banner, a running cluster and PG* env.
#
#   1. Build $DB from every migration (001 -> 062) in ledger order on a
#      fresh database, with the default privileges of GRANTS_MODE set
#      BEFORE 001. 058, 059, 061 and 062 are re-applied (idempotency:
#      grants must not change). The grants right after 061 are kept as
#      the 'at061' snapshot (= production before 062).
#   2. Build two reference databases with the other default-privilege
#      settings (default / revoked / strict = every table+sequence default
#      revoked) and require identical effective grants on every relation:
#      a fresh rebuild must not depend on default privileges.
#   3. Require the at061 snapshot to equal the production grants snapshot
#      (fixtures/production_grants_2026-10-22.psv) for every relation that
#      existed in production at capture time. 062 is the change on top.
#   4. Seed (p0 02/03), then the p0 suites, the 058 suite, the 50 grants
#      suite, the 60 RPC caller-binding suite (061), and the 058, 061 and
#      062 documented rollbacks + re-apply.
# ============================================================

M059="$(ls "$MIG"/*_059_explicit_data_api_grants.sql)"
M061="$(ls "$MIG"/*_061_bind_user_rpcs_to_caller.sql)"
M062="$(ls "$MIG"/*_062_tighten_data_api_grants.sql)"
# pg_proc.prosrc md5 of the functions whose body 061 replaces, in production
# before 061 (read-only, 2026-10-22); the 061 rollback must restore exactly these.
PROD_RPC_MD5='claim_starter_package=772df476cc9acf14618b2d63ed0449ca compute_user_fit_scores=58bcf20519bb27382d351066878e7502 get_top_programs_by_value=8b7b993a0e677549ea6c9f9c0d9f7f79 increment_draft_count=69add660f93dafed6f2433b7a2c728e8 run_daily_drip=452fd804de44497b53c8d53ae15c9d26 seed_signup_questions=310e240efb217c29fd96bd29b01fa666'
# The functions 061 touches: every SECURITY DEFINER function in public
# except accept_team_invite (055), plus the two 061 turns into INVOKER.
RPC_SET="pronamespace='public'::regnamespace and (prosecdef or proname in ('run_daily_drip','get_top_programs_by_value')) and proname <> 'accept_team_invite'"
# name:secdef:search_path:EXECUTE grantees (sorted)
rpc_state() { psql -X -At -c "select string_agg(proname||':'||prosecdef||':'||coalesce(array_to_string(proconfig,';'),'-')||':'||(select string_agg(case a.grantee when 0 then 'PUBLIC' else a.grantee::regrole::text end, ',' order by case a.grantee when 0 then 'PUBLIC' else a.grantee::regrole::text end collate \"C\") from aclexplode(proacl) a where a.privilege_type = 'EXECUTE'), '|' order by proname) from pg_proc where $RPC_SET"; }
# production (read-only, 2026-10-22) for the same set, before 061
PROD_RPC_STATE="$(printf '%s|' \
  'auto_seed_questions_on_signup:true:search_path=public, extensions:P' 'award_answer_credits:true:search_path=public, extensions:P' \
  'award_contribution_credits:true:search_path=public, extensions:P' 'award_submission_credits:true:search_path=public, extensions:P' \
  'claim_starter_package:true:search_path=public, extensions:P' 'compute_heat_scores:true:search_path=public, extensions:P' \
  'compute_program_dna:true:-:P' 'compute_significance_scores:true:-:P' 'compute_user_fit_scores:true:-:P' \
  'create_free_subscription_on_signup:true:search_path=public, extensions:P' 'create_user_profile_on_signup:true:search_path=public, extensions:P' \
  'decrement_asked_by_count:true:search_path=public, pg_temp:P' 'get_top_programs_by_value:true:search_path=public:P' \
  'increment_asked_by_count:true:search_path=public, pg_temp:P' 'increment_draft_count:true:-:P' \
  'is_canonical_program:true:search_path=public, pg_temp:P' 'local_first_active:true:search_path=public:P' \
  'process_reward:true:search_path=public, extensions:P' 'refresh_canonical_aggregate:true:search_path=public, extensions:P' \
  'run_daily_drip:true:search_path=public, extensions:P' 'seed_signup_questions:true:search_path=public, extensions:P' \
  | sed -e 's/:P|/:PUBLIC,anon,authenticated,postgres,service_role|/g' -e 's/|$//')"
FIXTURE="$HERE/fixtures/production_grants_2026-10-22.psv"
OUT="$PGROOT/grants"
mkdir -p "$OUT"
# Objects 058 adds (absent from the 2026-10-22 production snapshot).
NEW_058='^(COL\|)?(catalog_|program_template_revisions|question_mapping_decisions)'
# Migrations that do not apply verbatim (050 restates their intended end
# state; documented there). Applied without ON_ERROR_STOP, errors listed.
KNOWN_VERBATIM_FAILURES='^(008_intelligence_layer_v2|019_fundingcake_seed|028_solofounders_seed)\.sql$'
# p0 tests that encode the live-baseline FIXTURE schema, which differs from
# the full chain in ways unrelated to grants (they fail identically under
# GRANTS_MODE=default). test_id:stmt_outcome
#   P-3e  002 unique index (program_id, archived_question_id) -> 23505
#   P-4e  011/0xx sync trigger copies answer_content into content on INSERT
# and the legacy-mode answer writes 062 section B refuses by grant on
# purpose (local-first custody backstop; the p0 fixture models legacy mode):
#   P-4d  authenticated INSERT into application_answers -> 42501
#   P-4e  authenticated upsert into profile_answers -> 42501
#   P-4f  the second profile_answers upsert -> 42501 (before 062 this was
#         RLS on profile_answer_history; now the grant refuses first)
# and one 062 section E refusal:
#   SIG-1 anon UPDATE programs -> 42501 instead of an RLS-filtered 0 rows.
#         The only way anon reached that UPDATE was the program_signals
#         insert trigger (004); C/D revoke client access to program_signals
#         (no code path uses it), so the trigger now fires for service_role
#         only and anon needs no UPDATE on programs.
KNOWN_FULL_CHAIN='P-3e:error:23505 P-4d:error:42501 P-4e:error:42501 P-4f:error:42501 SIG-1:error:42501'

fail() { echo "FULL-CHAIN FAIL: $*"; exit 1; }

PGNUM=$(psql -X -At -d postgres -c "show server_version_num")
[ "$PGNUM" -ge 170000 ] || fail "PostgreSQL 17+ required (production is 17; MAINTAIN privilege). Set M09_PGBIN."
[ "$(psql -X -At -d postgres -c "select count(*) from pg_available_extensions where name='vector'")" = 1 ] \
  || fail "pgvector is not installed for this PostgreSQL (migration 001 creates extension vector)"

set_default_privs() { # $1 db, $2 mode — run after bootstrap, BEFORE migration 001
  case "$2" in
    default) ;;  # p0/00_bootstrap.sql already set the pre-change Supabase defaults (ALL)
    revoked)     # Supabase's published opt-in statements (changelog, 2026-10-30 change)
      psql_q -d "$1" \
        -c "alter default privileges for role postgres in schema public revoke select, insert, update, delete on tables from anon, authenticated, service_role" \
        -c "alter default privileges for role postgres in schema public revoke usage, select on sequences from anon, authenticated, service_role" ;;
    strict)      # nothing at all by default (stronger than the platform change)
      psql_q -d "$1" \
        -c "alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role" \
        -c "alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role" ;;
  esac
}

apply_migration() { # $1 db, $2 file
  local b; b=$(basename "$2")
  if [[ "$b" =~ $KNOWN_VERBATIM_FAILURES ]]; then
    local errs
    errs=$(sed -E 's/^CREATE EXTENSION IF NOT EXISTS pg_cron;/-- harness: pg_cron stubbed/' "$2" \
      | psql -X -q -d "$1" 2>&1 >/dev/null | grep -c 'ERROR' || true)
    echo "  $b: known verbatim failure ($errs statement error(s); restated by 050)"
  else
    local log
    if ! log=$(sed -E 's/^CREATE EXTENSION IF NOT EXISTS pg_cron;/-- harness: pg_cron stubbed/' "$2" \
               | psql_q -d "$1" 2>&1); then
      echo "$log" | grep -v NOTICE; fail "migration $b failed on $1"
    fi
    grep -E 'WARNING' <<< "$log" || true
  fi
}

build_chain() { # $1 db, $2 mode
  psql -X -q -d postgres -c "DROP DATABASE IF EXISTS $1" -c "CREATE DATABASE $1"
  psql_q -d "$1" -f "$P0/00_bootstrap.sql" -f "$HERE/full_apply_platform_shim.sql" 2>&1 | grep -v NOTICE || true
  set_default_privs "$1" "$2"
  psql_q -d "$1" -f "$HERE/grants_lib.sql" 2>&1 | grep -v NOTICE || true
  local f n=0
  for f in $(ls "$MIG"/*.sql | LC_ALL=C sort); do
    apply_migration "$1" "$f"; n=$((n+1))
    [ "$f" = "$M061" ] && snapshot "$1" "$1_at061"
  done
  echo "  $1 ($2 defaults): $n migrations applied"
}

snapshot() { psql -X -At -d "$1" -c "select line from p0g.snapshot()" > "$OUT/$2.txt"; }

banner "full chain 001 -> 062, GRANTS_MODE=$GRANTS_MODE: $DB"
psql -X -At -d postgres -c "select 'default privileges set before 001: $GRANTS_MODE'"
build_chain "$DB" "$GRANTS_MODE"
snapshot "$DB" main
banner "idempotency: re-apply 058, 059, 061 and 062"
RPC_FIRST=$(rpc_state)
psql_q -d "$DB" -f "$M058" -f "$M059" -f "$M061" -f "$M062" 2>&1 | grep -v NOTICE || true
snapshot "$DB" main_reapplied
diff "$OUT/main.txt" "$OUT/main_reapplied.txt" || fail "re-applying 058/059/061/062 changed grants"
[ "$(rpc_state)" = "$RPC_FIRST" ] || fail "re-applying 061 changed the RPC definitions or EXECUTE grants"
echo "re-apply 061: RPC security/search_path/EXECUTE unchanged"
echo "re-apply: grants unchanged ($(wc -l < "$OUT/main.txt" | tr -d ' ') relation/column ACL lines)"

banner "fresh rebuild is independent of default privileges"
for m in default revoked strict; do
  [ "$m" = "$GRANTS_MODE" ] && continue
  build_chain "m09ref_$m" "$m"
  snapshot "m09ref_$m" "ref_$m"
  if diff "$OUT/main.txt" "$OUT/ref_$m.txt" > "$OUT/diff_$m.txt"; then
    echo "EQUAL: $GRANTS_MODE rebuild == $m rebuild ($(wc -l < "$OUT/ref_$m.txt" | tr -d ' ') lines)"
  else
    cat "$OUT/diff_$m.txt"; fail "grants differ between $GRANTS_MODE and $m default privileges"
  fi
  psql -X -q -d postgres -c "DROP DATABASE m09ref_$m"
done

banner "rebuild through 061 equals production (snapshot 2026-10-22)"
grep -v '^#' "$FIXTURE" | grep -v '|OUT_OF_REPO$' | LC_ALL=C sort > "$OUT/prod.txt"
grep -v -E "$NEW_058" "$OUT/${DB}_at061.txt" | LC_ALL=C sort > "$OUT/main_prod_scope.txt"
if diff "$OUT/prod.txt" "$OUT/main_prod_scope.txt"; then
  echo "EQUAL: rebuild through 061 == production for $(wc -l < "$OUT/prod.txt" | tr -d ' ') in-repo relations; out-of-repo (not rebuilt): $(grep -c '|OUT_OF_REPO$' "$FIXTURE")"
else
  fail "rebuild through 061 differs from the production grants snapshot"
fi
echo "062 changes on top of production: $(diff "$OUT/${DB}_at061.txt" "$OUT/main.txt" | grep -c '^>') relation/column ACL lines"
grep -v -E "$NEW_058" "$OUT/main.txt" | grep -v '^COL|' | grep -E '[| ](anon|authenticated)=[^ ]*[Dxtm]' \
  && fail "062: a client role still holds TRUNCATE/REFERENCES/TRIGGER/MAINTAIN" || echo "062 A: no client non-CRUD privileges"
echo "objects added by 058 (not in production yet): $(grep -E "$NEW_058" "$OUT/main.txt" | grep -vc '^COL|') relations, $(grep -E "$NEW_058" "$OUT/main.txt" | grep -c '^COL|') column ACLs"

banner "seed + harness (p0 02/03)"
psql_q -d "$DB" -f "$P0/02_seed_synthetic.sql" -f "$P0/03_harness.sql" 2>&1 | grep -v NOTICE || true
psql -X -At -c "select 'canonical programs='||(select count(*) from programs where source='canonical')||' relationships='||(select count(*) from program_questions pq join programs p on p.id=pq.program_id where p.source='canonical')||' serials='||(select count(*) from catalog_serials)"

banner "existing p0 suites, phase post, full chain"
for f in "$P0"/[0-9][0-9]_*_tests.sql; do
  psql -X -q -v ON_ERROR_STOP=1 -t -A -o /dev/null -c "select set_config('p0.phase','post',false)" -f "$f" 2>&1 \
    | notices > "$OUT/$(basename "$f").log" || true
  grep -q '^phase=post total=' "$OUT/$(basename "$f").log" || { cat "$OUT/$(basename "$f").log"; fail "$(basename "$f") did not complete"; }
  grep -E '^(PASS|FAIL) ' "$OUT/$(basename "$f").log" | grep -c '^PASS' | sed "s/^/  $(basename "$f"): PASS lines /"
done
P0_UNEXPECTED=$(psql -X -At -c "select string_agg(test_id||'('||stmt_outcome||')', ' ' order by seq) from p0.results r
  where not pass and test_id not like 'CP-%' and test_id not like 'GR-%'
    and (test_id||':'||stmt_outcome) <> all (string_to_array('$KNOWN_FULL_CHAIN', ' '))")
P0_KNOWN=$(psql -X -At -c "select count(*) from p0.results where not pass
    and (test_id||':'||stmt_outcome) = any (string_to_array('$KNOWN_FULL_CHAIN', ' '))")
[ -z "$P0_UNEXPECTED" ] || { grep '^FAIL' "$OUT"/*_tests.sql.log; fail "unexpected p0 failures: $P0_UNEXPECTED"; }
[ "$P0_KNOWN" = "$(wc -w <<< "$KNOWN_FULL_CHAIN" | tr -d ' ')" ] || fail "known full-chain divergences changed (got $P0_KNOWN)"
echo "p0: all pass except $P0_KNOWN known full-chain (fixture-schema) divergences: $KNOWN_FULL_CHAIN"
# p0.report() in the next suites fails on ANY failing 'post' row; the known
# divergences are accounted for above, so file the p0 rows under their own phase.
psql_q -c "update p0.results set phase = 'post-full-chain' where phase = 'post'" \
       -c "update p0.cursor set last_seq = (select coalesce(max(seq), 0) from p0.results)"

banner "058 catalog provenance + promotion suite"
psql_q -t -A -o /dev/null -c "select set_config('p0.phase','post',false)" -f "$HERE/40_catalog_promotion_tests.sql" 2>&1 | notices | grep -E '^(FAIL|phase=)'

banner "50 grants suite (role probes vs class expectations)"
psql_q -t -A -o /dev/null -c "select set_config('p0.phase','post',false)" -f "$HERE/50_grants_tests.sql" 2>&1 | notices \
  | grep -E '^(FAIL|phase=|KNOWN-|MISSING|grants:)'

banner "60 RPC caller-binding suite (061)"
psql_q -t -A -o /dev/null -c "select set_config('p0.phase','post',false)" -f "$HERE/60_rpc_caller_binding_tests.sql" 2>&1 | notices \
  | grep -E '^(FAIL|phase=)'

banner "rollback: the 058 documented ROLLBACK block, then re-apply"
sed -n '/^-- ROLLBACK/,/^--   COMMIT;/p' "$M058" | sed -n '/^--   BEGIN;/,/^--   COMMIT;/p' \
  | sed -E 's/^--   //' | grep -v '^--' > "$PGROOT/rollback058.sql"
psql_q -c "DROP SCHEMA IF EXISTS p0m CASCADE"
psql_q -1 -f "$PGROOT/rollback058.sql" 2>&1 | grep -v '^$' || true
RB=$(psql -X -At -c "select (select count(*) from pg_class where relname like 'catalog\_%' or relname in ('program_template_revisions','question_mapping_decisions'))||'/'||(select count(*) from information_schema.columns where table_name in ('program_questions','programs') and column_name in ('source_id','template_revision_id','superseded_by_revision_id','requirements','normalized_text','entity_id'))||'/'||(select count(*) from program_questions pq join programs p on p.id=pq.program_id where p.slug in ('yc-summer-2026','founding-500','redbud-vc','cyberfund-monastery','3xcapital'))")
echo "after rollback: catalog_relations/new_columns/legacy_occurrences = $RB"
psql_q -f "$M058" 2>&1 | grep -v NOTICE || true
RA=$(psql -X -At -c "select count(*) from catalog_serials where origin <> 'assigned'")
echo "after re-apply: backfilled serials = $RA"
snapshot "$DB" main_after_rollback
diff <(grep -E "$NEW_058" "$OUT/main.txt") <(grep -E "$NEW_058" "$OUT/main_after_rollback.txt") \
  || fail "058 grants after rollback + re-apply differ from the first apply"
if [ "$RB" = "0/0/103" ] && [ "$RA" = "216" ]; then echo "ROLLBACK PASS (058 grants identical after re-apply)"; else fail "ROLLBACK"; fi

banner "rollback: the 061 documented ROLLBACK block, then re-apply"
sed -n '/^-- ROLLBACK/,/^--   COMMIT;/p' "$M061" | sed -n '/^--   BEGIN;/,/^--   COMMIT;/p' \
  | sed -E 's/^--(   )?//' > "$PGROOT/rollback061.sql"
psql_q -1 -f "$PGROOT/rollback061.sql" 2>&1 | grep -v -E '^$|WARNING:  there is (no|already a) transaction' || true
RB61_MD5=$(psql -X -At -c "select string_agg(proname||'='||md5(prosrc), ' ' order by proname) from pg_proc where pronamespace='public'::regnamespace and proname in ('claim_starter_package','run_daily_drip','compute_user_fit_scores','increment_draft_count','seed_signup_questions','get_top_programs_by_value')")
RB61_STATE=$(rpc_state)
echo "after 061 rollback: bodies $RB61_MD5"
[ "$RB61_MD5" = "$PROD_RPC_MD5" ] || fail "061 rollback bodies differ from production"
if [ "$RB61_STATE" = "$PROD_RPC_STATE" ]; then
  echo "after 061 rollback: security/search_path/EXECUTE == production for $(tr '|' '\n' <<< "$RB61_STATE" | wc -l | tr -d ' ') functions"
else
  diff <(tr '|' '\n' <<< "$PROD_RPC_STATE") <(tr '|' '\n' <<< "$RB61_STATE"); fail "061 rollback security/search_path/grants differ from production"
fi
psql_q -f "$M061" 2>&1 | grep -v NOTICE || true
[ "$(rpc_state)" = "$RPC_FIRST" ] || fail "061 re-apply after rollback differs from the first apply"
echo "ROLLBACK PASS (061: replaced bodies md5 == production, security/search_path/EXECUTE == production; re-apply identical to first apply)"

banner "rollback: the 062 documented ROLLBACK block + 059, then re-apply"
sed -n '/^-- ROLLBACK/,/^--   COMMIT;/p' "$M062" | sed -n '/^--   BEGIN;/,/^--   COMMIT;/p' \
  | sed -E 's/^--   //' > "$PGROOT/rollback062.sql"
psql_q -f "$PGROOT/rollback062.sql" -f "$M059" 2>&1 | grep -v -E '^$|NOTICE|WARNING:  there is (no|already a) transaction' || true
snapshot "$DB" after_rollback062
diff "$OUT/${DB}_at061.txt" "$OUT/after_rollback062.txt" || fail "062 rollback does not restore the 061 grants"
[ "$(psql -X -At -c "select count(*) from pg_policies where tablename='community_messages' and policyname='cm_sender_delete'")" = 0 ] \
  || fail "062 rollback left cm_sender_delete"
psql_q -f "$M062" 2>&1 | grep -v NOTICE || true
snapshot "$DB" after_reapply062
diff "$OUT/main.txt" "$OUT/after_reapply062.txt" || fail "062 re-apply after rollback differs from the first apply"
[ "$(psql -X -At -c "select count(*) from pg_policies where tablename='community_messages' and policyname='cm_sender_delete'")" = 1 ] \
  || fail "062 re-apply did not create cm_sender_delete"
echo "ROLLBACK PASS (062: rollback + 059 == 061 grants, policy removed; re-apply identical to first apply)"

banner "summary (GRANTS_MODE=$GRANTS_MODE)"
psql -X -c "select case when test_id like 'CP-%' then '058 suite' when test_id like 'GR-%' then '50 grants suite' when test_id like 'RB-%' then '60 rpc binding suite' else 'p0 suites' end as suite,
  count(*) total, count(*) filter (where pass) passed,
  count(*) filter (where not pass and (test_id||':'||stmt_outcome) = any (string_to_array('$KNOWN_FULL_CHAIN', ' '))) known_full_chain,
  count(*) filter (where not pass and (test_id||':'||stmt_outcome) <> all (string_to_array('$KNOWN_FULL_CHAIN', ' '))) failed
  from p0.results group by 1 order by 1"
psql -X -c "select finding, count(*) from p0g.findings group by 1 order by 1"
FAILED=$(psql -X -At -c "select count(*) from p0.results where not pass and (test_id||':'||stmt_outcome) <> all (string_to_array('$KNOWN_FULL_CHAIN', ' '))")
[ "$FAILED" = 0 ] || fail "$FAILED failing expectation(s)"
echo "ALL PASS (GRANTS_MODE=$GRANTS_MODE)"
