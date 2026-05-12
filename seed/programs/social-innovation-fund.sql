-- seed/programs/social-innovation-fund.sql
-- Social Innovation Fund — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'social-innovation-fund',
  'Social Innovation Fund',
  'Corporation for National and Community Service',
  'grant',
  'open',
  100000000,
  1000000000,
  0.0,
  ARRAY['US'],
  ARRAY['social-impact', 'evidence-based', 'scaling', 'community'],
  'The Social Innovation Fund combines public and private resources to grow the impact of innovative, community-based solutions that have compelling evidence of improving the lives of people in need.',
  'https://www.nationalservice.gov/programs/social-innovation-fund',
  false,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Evidence base for intervention
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the evidence base for your intervention. What rigorous research supports your approach?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the evidence base for your intervention. What rigorous research supports your approach?', 'traction', 600, 1, 0.93, false, ARRAY['Social Innovation Fund'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Social Innovation Fund') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the evidence base for your intervention. What rigorous research supports your approach?', 600, true, 1, 'Evidence');

-- Q2: Strengthening evidence base
SELECT id INTO q_id FROM archived_questions WHERE text = 'How will you strengthen the evidence base through this grant?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How will you strengthen the evidence base through this grant?', 'solution', 500, 1, 0.91, false, ARRAY['Social Innovation Fund'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Social Innovation Fund') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How will you strengthen the evidence base through this grant?', 500, true, 2, 'Research Plan');

-- Q3: Scaling effective interventions
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your plan to scale effective interventions.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your plan to scale effective interventions.', 'vision', 400, 1, 0.91, false, ARRAY['Social Innovation Fund'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Social Innovation Fund') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your plan to scale effective interventions.', 400, true, 3, 'Scale');

END $$;
