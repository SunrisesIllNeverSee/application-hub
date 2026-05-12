-- seed/programs/capitalimpact-partners.sql
-- Capital Impact Partners Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'capitalimpact-partners',
  'Capital Impact Partners Grant',
  'Capital Impact Partners',
  'grant',
  'open',
  25000000,
  500000000,
  0.0,
  ARRAY['US'],
  ARRAY['community-development', 'economic-opportunity', 'underserved-communities'],
  'Capital Impact Partners works to make capital and opportunity accessible to underserved people and communities through mission-driven financing and programs.',
  'https://capitalimpact.org/grants/',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Underserved community and opportunity
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the underserved community you are serving and the opportunity you are addressing.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the underserved community you are serving and the opportunity you are addressing.', 'problem', 500, 1, 0.91, false, ARRAY['Capital Impact Partners Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Capital Impact Partners Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the underserved community you are serving and the opportunity you are addressing.', 500, true, 1, 'Community');

-- Q2: Economic opportunity / quality of life
SELECT id INTO q_id FROM archived_questions WHERE text = 'How will your project create economic opportunity or improve quality of life?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How will your project create economic opportunity or improve quality of life?', 'impact', 500, 1, 0.92, false, ARRAY['Capital Impact Partners Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Capital Impact Partners Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How will your project create economic opportunity or improve quality of life?', 500, true, 2, 'Impact');

END $$;
