-- ============================================================
-- 063 — catalog publish: cycle/deadline-only updates (GB4)
-- ============================================================
-- catalog_publish_candidate (058) required payload.questions to be
-- non-empty, so a curator could not publish a new cycle or deadline for an
-- existing program without re-submitting its whole question set; a partial
-- set would retire every question it left out. 063 replaces the function
-- with one change: a candidate with NO questions is a cycle-only update of
-- an existing canonical program (program_match_id, else an exact match on
-- payload.program.slug). Its current active questions are carried forward
-- as they are (0 created, 0 retired), the program keeps its curated name,
-- organization, urls, description and entity, and only status, is_rolling,
-- closes_at and the program_cycles row change. A new cycle for a closed
-- program is not marked active. Everything else is 058 unchanged.
-- No table or grant changes; CREATE OR REPLACE keeps the function's ACL.
--
-- ROLLBACK: re-run the catalog_publish_candidate definition from
-- supabase/migrations/20261022190000_058_catalog_provenance_promotion.sql
-- (section "catalog_publish_candidate").
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.catalog_publish_candidate(candidate_id uuid, curator_id uuid, note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
#variable_conflict use_column
DECLARE
  v_cid        uuid := catalog_publish_candidate.candidate_id;
  v_curator    uuid := catalog_publish_candidate.curator_id;
  v_note       text := btrim(catalog_publish_candidate.note);
  c            public.catalog_candidates%ROWTYPE;
  v_src        public.catalog_sources%ROWTYPE;
  v_ev         public.catalog_candidate_events%ROWTYPE;
  v_problems   text[];
  v_override   text;
  v_origin     text;
  v_payload    jsonb;
  v_prog       jsonb;
  v_ent        jsonb;
  v_cycle      jsonb;
  v_questions  jsonb;
  v_q          jsonb;
  v_idx        bigint;
  v_entity_id  uuid;
  v_program_id uuid;
  v_cycle_id   uuid;
  v_rev_id     uuid;
  v_prev_rev   uuid;
  v_rev        int;
  v_slug       text;
  v_base       text;
  v_n          int := 1;
  v_kind       text;
  v_type       text;
  v_domain     text;
  v_name       text;
  v_deadline   timestamptz;
  v_cq         uuid;
  v_occ        uuid;
  v_req        jsonb;
  v_tier       text;
  v_decision   text;
  v_carried    uuid[] := '{}';
  v_carried_ix bigint[] := '{}';
  v_match      uuid;
  v_new_entity boolean := false;
  v_new_prog   boolean := false;
  v_new_cq     int := 0;
  v_created    int := 0;
  v_retired    int := 0;
  v_cycle_only boolean := false;
BEGIN
  IF NOT public.is_canonical_writer() THEN
    RAISE EXCEPTION 'catalog_publish_candidate is service-side only' USING ERRCODE = '42501';
  END IF;
  IF v_curator IS NULL OR NOT EXISTS (SELECT 1 FROM public.catalog_curators k WHERE k.user_id = v_curator) THEN
    RAISE EXCEPTION 'catalog_publish_candidate: % is not a catalog curator', v_curator USING ERRCODE = '42501';
  END IF;

  SELECT * INTO c FROM public.catalog_candidates WHERE id = v_cid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog_publish_candidate: candidate % not found', v_cid USING ERRCODE = 'P0002';
  END IF;
  IF c.state <> 'approved' THEN
    RAISE EXCEPTION 'catalog_publish_candidate: candidate is %, must be approved', c.state USING ERRCODE = '55000';
  END IF;

  v_payload   := c.payload;
  v_prog      := v_payload->'program';
  v_questions := v_payload->'questions';
  -- 063: a candidate with no questions is a cycle/deadline-only update of an
  -- EXISTING canonical program (program_match_id, else an exact payload slug
  -- match). The program's current active questions are carried forward
  -- unchanged, so the new revision retires nothing and creates nothing.
  IF v_questions IS NULL OR (jsonb_typeof(v_questions) = 'array' AND jsonb_array_length(v_questions) = 0) THEN
    IF c.program_match_id IS NOT NULL THEN
      SELECT id INTO v_program_id FROM public.programs
       WHERE id = c.program_match_id AND source::text = 'canonical';
    ELSE
      SELECT id INTO v_program_id FROM public.programs
       WHERE slug = btrim(v_prog->>'slug') AND source::text = 'canonical';
    END IF;
    IF v_program_id IS NULL THEN
      RAISE EXCEPTION 'catalog_publish_candidate: a candidate without questions must update an existing canonical program (program_match_id or payload.program.slug)'
        USING ERRCODE = '22023';
    END IF;
    SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'asked_as', pq.asked_as, 'order_index', pq.order_index, 'section', pq.section,
             'required', pq.is_required, 'word_limit', pq.word_limit, 'char_limit', pq.char_limit,
             'response_type', pq.requirements->>'response_type',
             'time_context', pq.requirements->'time_context', 'qualifiers', pq.requirements->'qualifiers',
             'mapping', jsonb_build_object('canonical_question_id', pq.archived_question_id,
                                           'origin', 'curator', 'tier', 'curator')))
             ORDER BY pq.order_index, pq.created_at), '[]'::jsonb)
      INTO v_questions
      FROM public.program_questions pq
     WHERE pq.program_id = v_program_id AND pq.superseded_by_revision_id IS NULL;
    v_cycle_only := true;
  END IF;
  IF v_prog IS NULL OR jsonb_typeof(v_prog) <> 'object' OR coalesce(btrim(v_prog->>'name'), '') = ''
     OR coalesce(btrim(v_prog->>'organization'), '') = '' OR coalesce(v_prog->>'kind', '') = '' THEN
    RAISE EXCEPTION 'catalog_publish_candidate: payload.program needs name, organization, kind' USING ERRCODE = '22023';
  END IF;
  IF v_questions IS NULL OR jsonb_typeof(v_questions) <> 'array' OR jsonb_array_length(v_questions) = 0 THEN
    RAISE EXCEPTION 'catalog_publish_candidate: payload.questions must be a non-empty array' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_questions) q
              WHERE coalesce(btrim(q->>'asked_as'), '') = '' OR (q->>'order_index') IS NULL) THEN
    RAISE EXCEPTION 'catalog_publish_candidate: every question needs asked_as and order_index' USING ERRCODE = '22023';
  END IF;

  IF c.source_id IS NULL THEN
    RAISE EXCEPTION 'catalog_publish_candidate: candidate has no source evidence' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_src FROM public.catalog_sources WHERE id = c.source_id;
  -- M09 review M6: evidence must still be good. Stale/failed source, reuse
  -- disallowed or robots disallowing reuse refuses publish unless a curator
  -- override with a note (10+ characters) is on record: either this call's
  -- note, or the approval's recorded source_override, provided the source was
  -- not re-checked after that approval.
  v_problems := ARRAY(SELECT x FROM unnest(ARRAY[
      CASE WHEN v_src.verification_status = 'stale' THEN 'source changed since capture (stale)' END,
      CASE WHEN v_src.verification_status = 'failed' THEN 'source verification failed' END,
      CASE WHEN v_src.reuse = 'disallowed' THEN 'source reuse is disallowed' END,
      CASE WHEN v_src.robots_disallow IS TRUE THEN 'robots/terms disallow reuse' END]) x WHERE x IS NOT NULL);
  IF cardinality(v_problems) > 0 THEN
    IF length(coalesce(v_note, '')) >= 10 THEN
      v_override := 'publish_note';
    ELSE
      SELECT * INTO v_ev FROM public.catalog_candidate_events
       WHERE candidate_id = c.id AND to_state = 'approved' ORDER BY id DESC LIMIT 1;
      IF FOUND AND coalesce(v_ev.evidence->>'source_override', '') = 'true' AND length(btrim(coalesce(v_ev.note, ''))) >= 10 THEN
        IF v_src.last_checked_at IS NOT NULL AND v_src.last_checked_at > v_ev.at THEN
          RAISE EXCEPTION 'catalog_publish_candidate: the source was re-checked after the approval override (%); approve again or publish with a note', array_to_string(v_problems, '; ')
            USING ERRCODE = '23514';
        END IF;
        v_override := 'approval';
      END IF;
    END IF;
    IF v_override IS NULL THEN
      RAISE EXCEPTION 'catalog_publish_candidate: source is not fresh (%): a curator override with a note is required', array_to_string(v_problems, '; ')
        USING ERRCODE = '23514';
    END IF;
  END IF;
  -- M09 review M5: every canonical link needs a recorded origin. 'auto_match'
  -- (AQUA's exact/normalized matcher) or 'curator' (an override). A
  -- submitter's suggestion (suggested_mapping) is never read here.
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_questions) q
              WHERE q->'mapping'->>'canonical_question_id' IS NOT NULL
                AND coalesce(q->'mapping'->>'origin', '') NOT IN ('auto_match','curator')) THEN
    RAISE EXCEPTION 'catalog_publish_candidate: a canonical mapping needs a recorded origin (auto_match or curator)' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_questions) q
              WHERE q->'mapping'->>'origin' = 'auto_match' AND coalesce(q->'mapping'->>'tier', '') NOT IN ('exact','normalized')) THEN
    RAISE EXCEPTION 'catalog_publish_candidate: only exact/normalized matches can be auto-linked; a semantic match needs a curator confirmation' USING ERRCODE = '23514';
  END IF;

  v_name   := btrim(v_prog->>'name');
  v_kind   := v_prog->>'kind';
  v_type   := coalesce(v_prog->>'type', CASE
                WHEN v_kind = 'accelerator' THEN 'accel' WHEN v_kind = 'vc' THEN 'vc'
                WHEN v_kind = 'grant' THEN 'grant' WHEN v_kind = 'fellowship' THEN 'fellowship'
                WHEN v_kind LIKE 'job_%' THEN 'job' WHEN v_kind LIKE 'school_%' THEN 'uni' ELSE 'other' END);
  v_domain := coalesce(v_prog->>'domain', 'founder');
  v_cycle  := v_payload->'cycle';
  v_deadline := nullif(v_cycle->>'closes_at', '')::timestamptz;

  -- ---- entity (EN) --------------------------------------------------
  v_ent := coalesce(v_payload->'entity', jsonb_build_object('name', v_prog->>'organization'));
  IF v_cycle_only AND (SELECT entity_id FROM public.programs WHERE id = v_program_id) IS NOT NULL THEN
    -- 063: a cycle-only update keeps the program's entity
    SELECT entity_id INTO v_entity_id FROM public.programs WHERE id = v_program_id;
  ELSIF (v_ent->>'id') IS NOT NULL THEN
    SELECT id INTO v_entity_id FROM public.catalog_entities WHERE id = (v_ent->>'id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'catalog_publish_candidate: entity % not found', v_ent->>'id' USING ERRCODE = '23503';
    END IF;
  ELSE
    SELECT id INTO v_entity_id FROM public.catalog_entities
     WHERE lower(name) = lower(btrim(coalesce(v_ent->>'name', v_prog->>'organization')))
     ORDER BY created_at LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO public.catalog_entities (name, website, kind)
      VALUES (btrim(coalesce(v_ent->>'name', v_prog->>'organization')), v_ent->>'website', coalesce(v_ent->>'kind', 'other'))
      RETURNING id INTO v_entity_id;
      v_new_entity := true;
    END IF;
  END IF;

  -- ---- program (AP) -------------------------------------------------
  IF v_cycle_only THEN
    -- 063: identity fields (name, organization, urls, description) stay as
    -- curated; only cycle state changes
    PERFORM 1 FROM public.programs WHERE id = v_program_id FOR UPDATE;
    UPDATE public.programs SET
      entity_id  = coalesce(entity_id, v_entity_id),
      status     = coalesce((v_prog->>'status')::program_status, status),
      is_rolling = coalesce((v_cycle->>'is_rolling')::boolean, is_rolling),
      closes_at  = coalesce(v_deadline, closes_at)
    WHERE id = v_program_id;
  ELSIF c.program_match_id IS NOT NULL THEN
    SELECT id INTO v_program_id FROM public.programs
     WHERE id = c.program_match_id AND source::text = 'canonical' FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'catalog_publish_candidate: program_match_id must reference a canonical program' USING ERRCODE = '23514';
    END IF;
    UPDATE public.programs SET
      name         = v_name,
      organization = btrim(v_prog->>'organization'),
      url          = coalesce(v_prog->>'url', url),
      apply_url    = coalesce(v_prog->>'apply_url', apply_url),
      description  = coalesce(v_prog->>'description', description),
      entity_id    = coalesce(entity_id, v_entity_id),
      is_rolling   = coalesce((v_cycle->>'is_rolling')::boolean, is_rolling),
      -- programs.deadline_at is GENERATED ALWAYS AS (closes_at) (008); write closes_at.
      closes_at    = coalesce(v_deadline, closes_at)
    WHERE id = v_program_id;
  ELSE
    v_base := left(btrim(regexp_replace(lower(coalesce(v_prog->>'slug', v_name)), '[^a-z0-9]+', '-', 'g'), '-'), 80);
    IF v_base = '' THEN v_base := 'program'; END IF;
    v_slug := v_base;
    WHILE EXISTS (SELECT 1 FROM public.programs WHERE slug = v_slug) LOOP
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n;
    END LOOP;
    INSERT INTO public.programs (slug, name, organization, type, kind, status, url, apply_url, description,
                                 source, is_rolling, geo_focus, industry_tags, domain, entity_id, closes_at)
    VALUES (v_slug, v_name, btrim(v_prog->>'organization'), v_type::program_type, v_kind::opportunity_kind,
            coalesce(v_prog->>'status', 'open')::program_status, v_prog->>'url', v_prog->>'apply_url',
            v_prog->>'description', 'canonical', coalesce((v_cycle->>'is_rolling')::boolean, false),
            CASE WHEN jsonb_typeof(v_prog->'geo_focus') = 'array'
                 THEN ARRAY(SELECT jsonb_array_elements_text(v_prog->'geo_focus')) END,
            CASE WHEN jsonb_typeof(v_prog->'industry_tags') = 'array'
                 THEN ARRAY(SELECT jsonb_array_elements_text(v_prog->'industry_tags')) END,
            v_domain, v_entity_id, v_deadline)
    RETURNING id INTO v_program_id;
    v_new_prog := true;
  END IF;

  -- ---- cycle ---------------------------------------------------------
  IF v_cycle IS NOT NULL AND coalesce(btrim(v_cycle->>'name'), '') <> '' THEN
    SELECT id INTO v_cycle_id FROM public.program_cycles
     WHERE program_id = v_program_id AND cycle_name = btrim(v_cycle->>'name')
     ORDER BY created_at LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO public.program_cycles (program_id, cycle_name, opens_at, closes_at, apply_url, is_active)
      VALUES (v_program_id, btrim(v_cycle->>'name'), nullif(v_cycle->>'opens_at', '')::timestamptz, v_deadline,
              v_prog->>'apply_url',
              (v_deadline IS NULL OR v_deadline > now()) AND coalesce(v_prog->>'status', 'open') <> 'closed')
      RETURNING id INTO v_cycle_id;
    ELSE
      UPDATE public.program_cycles SET
        opens_at  = coalesce(nullif(v_cycle->>'opens_at', '')::timestamptz, opens_at),
        closes_at = coalesce(v_deadline, closes_at),
        apply_url = coalesce(v_prog->>'apply_url', apply_url),
        updated_at = now()
      WHERE id = v_cycle_id;
    END IF;
  END IF;

  -- ---- revision ------------------------------------------------------
  SELECT id, revision INTO v_prev_rev, v_rev FROM public.program_template_revisions
   WHERE program_id = v_program_id ORDER BY revision DESC LIMIT 1;
  v_rev := coalesce(v_rev, 0) + 1;
  INSERT INTO public.program_template_revisions
    (program_id, cycle_id, revision, question_set_sha256, question_count, source_id, candidate_id,
     published_by, supersedes_id, deadline_at, deadline_timezone, eligibility_text, requirements_text, sections, origin)
  VALUES (v_program_id, v_cycle_id, v_rev, public.catalog_question_set_sha256(v_questions),
          jsonb_array_length(v_questions), c.source_id, c.id, v_curator, v_prev_rev, v_deadline,
          v_cycle->>'timezone', v_payload->>'eligibility', v_payload->>'requirements',
          CASE WHEN jsonb_typeof(v_payload->'sections') = 'array' THEN v_payload->'sections' ELSE '[]'::jsonb END,
          'publish')
  RETURNING id INTO v_rev_id;

  -- ---- occurrences pass 1: carry forward identical active occurrences --
  FOR v_q, v_idx IN SELECT q, i FROM jsonb_array_elements(v_questions) WITH ORDINALITY AS t(q, i) LOOP
    v_req := jsonb_strip_nulls(jsonb_build_object(
      'required', coalesce((v_q->>'required')::boolean, true),
      'word_limit', (v_q->>'word_limit')::int, 'char_limit', (v_q->>'char_limit')::int,
      'response_type', v_q->>'response_type', 'time_context', v_q->'time_context',
      'qualifiers', v_q->'qualifiers'));
    SELECT pq.id INTO v_match FROM public.program_questions pq
     WHERE pq.program_id = v_program_id
       AND pq.superseded_by_revision_id IS NULL
       AND pq.asked_as = v_q->>'asked_as'
       AND pq.order_index = (v_q->>'order_index')::int
       AND pq.section IS NOT DISTINCT FROM (v_q->>'section')
       AND pq.is_required = coalesce((v_q->>'required')::boolean, true)
       AND pq.word_limit IS NOT DISTINCT FROM (v_q->>'word_limit')::int
       AND pq.char_limit IS NOT DISTINCT FROM (v_q->>'char_limit')::int
       AND (pq.requirements IS NULL OR pq.requirements = v_req)
       AND ((v_q->'mapping'->>'canonical_question_id') IS NULL
            OR pq.archived_question_id = (v_q->'mapping'->>'canonical_question_id')::uuid)
       AND NOT (pq.id = ANY (v_carried))
     ORDER BY pq.created_at LIMIT 1;
    IF FOUND THEN
      v_carried := v_carried || v_match;
      v_carried_ix := v_carried_ix || v_idx;
    END IF;
  END LOOP;

  -- retire every active occurrence this revision does not carry forward
  -- (wording untouched; answers linked to them keep their history)
  UPDATE public.program_questions SET superseded_by_revision_id = v_rev_id
   WHERE program_id = v_program_id AND superseded_by_revision_id IS NULL
     AND NOT (id = ANY (v_carried));
  GET DIAGNOSTICS v_retired = ROW_COUNT;

  -- ---- occurrences pass 2: new occurrences, canonical links, decisions --
  FOR v_q, v_idx IN SELECT q, i FROM jsonb_array_elements(v_questions) WITH ORDINALITY AS t(q, i) LOOP
    CONTINUE WHEN v_idx = ANY (v_carried_ix);
    v_req := jsonb_strip_nulls(jsonb_build_object(
      'required', coalesce((v_q->>'required')::boolean, true),
      'word_limit', (v_q->>'word_limit')::int, 'char_limit', (v_q->>'char_limit')::int,
      'response_type', v_q->>'response_type', 'time_context', v_q->'time_context',
      'qualifiers', v_q->'qualifiers'));

    IF (v_q->'mapping'->>'canonical_question_id') IS NOT NULL THEN
      SELECT id INTO v_cq FROM public.archived_questions
       WHERE id = (v_q->'mapping'->>'canonical_question_id')::uuid;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'catalog_publish_candidate: canonical question % not found',
          v_q->'mapping'->>'canonical_question_id' USING ERRCODE = '23503';
      END IF;
      v_origin := v_q->'mapping'->>'origin';
      v_tier := coalesce(v_q->'mapping'->>'tier', 'curator');
      IF v_tier = 'novel' THEN v_tier := 'curator'; END IF;
      -- auto_linked ONLY for AQUA's own match; a curator's choice is 'confirmed'
      v_decision := CASE WHEN v_origin = 'auto_match' THEN 'auto_linked' ELSE 'confirmed' END;
    ELSE
      INSERT INTO public.archived_questions (text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
      VALUES (coalesce(nullif(btrim(v_q->>'canonical_text'), ''), v_q->>'asked_as'),
              coalesce(nullif(v_q->>'theme', ''), 'general'),
              coalesce(v_q->>'response_type', 'text_long')::response_type,
              0, false, ARRAY[v_name], v_domain)
      RETURNING id INTO v_cq;
      v_tier := 'novel';
      v_decision := 'new_canonical';
      v_new_cq := v_new_cq + 1;
    END IF;

    IF EXISTS (SELECT 1 FROM public.program_questions pq
                WHERE pq.program_id = v_program_id AND pq.superseded_by_revision_id IS NULL
                  AND pq.archived_question_id = v_cq) THEN
      RAISE EXCEPTION 'catalog_publish_candidate: question % maps to a canonical question already used in this template (split it)', v_idx
        USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.program_questions
      (program_id, archived_question_id, asked_as, word_limit, char_limit, is_required, section, order_index,
       source_id, template_revision_id, requirements, normalized_text)
    VALUES (v_program_id, v_cq, v_q->>'asked_as', (v_q->>'word_limit')::int, (v_q->>'char_limit')::int,
            coalesce((v_q->>'required')::boolean, true), v_q->>'section', (v_q->>'order_index')::int,
            c.source_id, v_rev_id, v_req, public.catalog_norm(v_q->>'asked_as'))
    RETURNING id INTO v_occ;
    v_created := v_created + 1;

    INSERT INTO public.question_mapping_decisions
      (occurrence_id, canonical_question_id, tier, confidence, decision, decided_by, rationale, candidate_id)
    VALUES (v_occ, v_cq, v_tier,
            coalesce((v_q->'mapping'->>'confidence')::numeric, CASE WHEN v_tier IN ('exact','novel') THEN 1 ELSE NULL END),
            v_decision, v_curator, left(v_q->'mapping'->>'rationale', 2000), c.id);

    PERFORM public.catalog_assign_serial('AQ', v_occ);
    PERFORM public.catalog_assign_serial('QU', v_cq);
  END LOOP;

  -- carried occurrences keep (or get) their serials
  PERFORM public.catalog_assign_serial('AQ', x) FROM unnest(v_carried) x;
  PERFORM public.catalog_assign_serial('QU', pq.archived_question_id)
     FROM public.program_questions pq WHERE pq.id = ANY (v_carried);
  PERFORM public.catalog_assign_serial('EN', v_entity_id);
  PERFORM public.catalog_assign_serial('AP', v_program_id);

  UPDATE public.catalog_sources SET last_checked_at = coalesce(last_checked_at, now()) WHERE id = c.source_id;
  UPDATE public.catalog_candidates
     SET published_revision_id = v_rev_id, program_match_id = v_program_id
   WHERE id = c.id;

  INSERT INTO public.catalog_candidate_events (candidate_id, from_state, to_state, actor, actor_role, note, evidence)
  VALUES (c.id, 'approved', 'published', v_curator, 'curator', coalesce(v_note, 'published'),
          jsonb_build_object('program_id', v_program_id, 'revision_id', v_rev_id, 'revision', v_rev,
                             'occurrences_created', v_created, 'occurrences_carried', cardinality(v_carried),
                             'occurrences_retired', v_retired, 'canonical_created', v_new_cq)
          || CASE WHEN v_override IS NOT NULL
                  THEN jsonb_build_object('source_override', v_override, 'source_problems', to_jsonb(v_problems))
                  ELSE '{}'::jsonb END);

  RETURN jsonb_build_object(
    'candidate_id', c.id,
    'program_id', v_program_id,
    'program_slug', (SELECT slug FROM public.programs WHERE id = v_program_id),
    'program_serial', (SELECT serial FROM public.catalog_serials WHERE kind = 'AP' AND target_id = v_program_id),
    'entity_id', v_entity_id,
    'entity_serial', (SELECT serial FROM public.catalog_serials WHERE kind = 'EN' AND target_id = v_entity_id),
    'cycle_id', v_cycle_id,
    'revision_id', v_rev_id,
    'revision', v_rev,
    'new_program', v_new_prog,
    'new_entity', v_new_entity,
    'occurrences_created', v_created,
    'occurrences_carried', cardinality(v_carried),
    'occurrences_retired', v_retired,
    'canonical_created', v_new_cq);
END;
$fn$;

COMMIT;
