-- seed/programs/mit-sloan-mba.sql
-- MIT Sloan MBA — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'mit-sloan-mba',
  'MIT Sloan MBA',
  'Massachusetts Institute of Technology',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['mba', 'graduate', 'business', 'technology', 'innovation'],
  'MIT Sloan School of Management MBA program develops principled, innovative leaders who improve the world through rigorous analytical and hands-on learning.',
  'https://mitsloan.mit.edu/mba/admissions',
  false,
  'seeded',
  'school_professional'::opportunity_kind,
  'education'
);

-- Q1: Significant challenge or failure
SELECT id INTO q_id FROM archived_questions WHERE text = 'MIT Sloan seeks students whose personal characteristics demonstrate that they will make the most of the incredible opportunities at MIT, both academic and non-academic. Please share a significant challenge, failure, or setback you have faced. How did you manage it? What did you learn about yourself?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'MIT Sloan seeks students whose personal characteristics demonstrate that they will make the most of the incredible opportunities at MIT, both academic and non-academic. Please share a significant challenge, failure, or setback you have faced. How did you manage it? What did you learn about yourself?', 'personal', 250, 1, 0.93, false, ARRAY['MIT Sloan MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MIT Sloan MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'MIT Sloan seeks students whose personal characteristics demonstrate that they will make the most of the incredible opportunities at MIT, both academic and non-academic. Please share a significant challenge, failure, or setback you have faced. How did you manage it? What did you learn about yourself?', 250, true, 1, 'Essays');

-- Q2: Contribution to MIT Sloan mission
SELECT id INTO q_id FROM archived_questions WHERE text = 'The mission of MIT Sloan is to develop principled, innovative leaders who improve the world and to generate ideas that advance management practice. Discuss how you will contribute to this mission.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'The mission of MIT Sloan is to develop principled, innovative leaders who improve the world and to generate ideas that advance management practice. Discuss how you will contribute to this mission.', 'fit', 500, 1, 0.92, false, ARRAY['MIT Sloan MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MIT Sloan MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'The mission of MIT Sloan is to develop principled, innovative leaders who improve the world and to generate ideas that advance management practice. Discuss how you will contribute to this mission.', 500, true, 2, 'Essays');

END $$;
