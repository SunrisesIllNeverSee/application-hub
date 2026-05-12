-- seed/programs/haas-mba.sql
-- Haas School of Business MBA — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'haas-mba',
  'Haas School of Business MBA',
  'University of California, Berkeley',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['mba', 'graduate', 'business', 'entrepreneurship', 'innovation'],
  'Berkeley Haas MBA program develops leaders who challenge the status quo and question the conventional through four defining principles: confidence without attitude, students always, beyond yourself, and question the status quo.',
  'https://mba.haas.berkeley.edu/admissions',
  false,
  'seeded',
  'school_professional'::opportunity_kind,
  'education'
);

-- Q1: What makes you feel alive
SELECT id INTO q_id FROM archived_questions WHERE text = 'What makes you feel alive when you do it, and how has it shaped you as a person and future leader?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What makes you feel alive when you do it, and how has it shaped you as a person and future leader?', 'personal', 250, 1, 0.91, false, ARRAY['Haas School of Business MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Haas School of Business MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What makes you feel alive when you do it, and how has it shaped you as a person and future leader?', 250, true, 1, 'Essays');

-- Q2: Advocacy
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time when you had the ability to advocate for an idea, a project, or people, and what was the result?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time when you had the ability to advocate for an idea, a project, or people, and what was the result?', 'team', 250, 1, 0.89, false, ARRAY['Haas School of Business MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Haas School of Business MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time when you had the ability to advocate for an idea, a project, or people, and what was the result?', 250, true, 2, 'Essays');

-- Q3: Contrarian belief
SELECT id INTO q_id FROM archived_questions WHERE text = 'What''s a belief or opinion you hold that many would disagree with? Why do you hold this view?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What''s a belief or opinion you hold that many would disagree with? Why do you hold this view?', 'personal', 250, 1, 0.88, false, ARRAY['Haas School of Business MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Haas School of Business MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What''s a belief or opinion you hold that many would disagree with? Why do you hold this view?', 250, true, 3, 'Essays');

-- Q4: What would you like more time to explore
SELECT id INTO q_id FROM archived_questions WHERE text = 'What do you wish you had more time to explore?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What do you wish you had more time to explore?', 'personal', 250, 1, 0.87, false, ARRAY['Haas School of Business MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Haas School of Business MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What do you wish you had more time to explore?', 250, true, 4, 'Essays');

END $$;
