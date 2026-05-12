-- seed/programs/berkeley-meng.sql
-- Berkeley MEng — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'berkeley-meng',
  'Berkeley MEng',
  'University of California, Berkeley',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['meng', 'graduate', 'engineering', 'technology', 'leadership'],
  'Berkeley Master of Engineering is a one-year professional degree combining advanced technical coursework with management and leadership training for engineers.',
  'https://engineering.berkeley.edu/programs/degrees/meng',
  false,
  'seeded',
  'school_grad'::opportunity_kind,
  'education'
);

-- Q1: Technical project description
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a technical project or problem you solved. What was the challenge, your approach, and the outcome?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a technical project or problem you solved. What was the challenge, your approach, and the outcome?', 'technical', 500, 1, 0.91, false, ARRAY['Berkeley MEng'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Berkeley MEng') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a technical project or problem you solved. What was the challenge, your approach, and the outcome?', 500, true, 1, 'Essays');

-- Q2: Professional goals and MEng fit
SELECT id INTO q_id FROM archived_questions WHERE text = 'What are your professional goals and how will the MEng program help you achieve them?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What are your professional goals and how will the MEng program help you achieve them?', 'fit', 400, 1, 0.90, false, ARRAY['Berkeley MEng'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Berkeley MEng') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What are your professional goals and how will the MEng program help you achieve them?', 400, true, 2, 'Essays');

END $$;
