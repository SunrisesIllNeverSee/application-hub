-- seed/programs/uchicago-harris-mpp.sql
-- University of Chicago Harris MPP — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'uchicago-harris-mpp',
  'University of Chicago Harris MPP',
  'University of Chicago',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['mpp', 'graduate', 'public policy', 'economics', 'analysis'],
  'Harris School of Public Policy MPP trains rigorous policy analysts and leaders to tackle complex public challenges using empirical methods and economic reasoning.',
  'https://harris.uchicago.edu/academics/programs-degrees/master-public-policy-mpp',
  false,
  'seeded',
  'school_grad'::opportunity_kind,
  'education'
);

-- Q1: Career goals and how Harris helps
SELECT id INTO q_id FROM archived_questions WHERE text = 'What are your career goals and how will the Harris MPP help you achieve them?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What are your career goals and how will the Harris MPP help you achieve them?', 'fit', 500, 1, 0.92, false, ARRAY['University of Chicago Harris MPP'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'University of Chicago Harris MPP') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What are your career goals and how will the Harris MPP help you achieve them?', 500, true, 1, 'Essays');

-- Q2: Policy challenge of interest
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a policy challenge you care deeply about. What is your proposed approach to addressing it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a policy challenge you care deeply about. What is your proposed approach to addressing it?', 'vision', 500, 1, 0.91, false, ARRAY['University of Chicago Harris MPP'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'University of Chicago Harris MPP') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a policy challenge you care deeply about. What is your proposed approach to addressing it?', 500, true, 2, 'Essays');

END $$;
