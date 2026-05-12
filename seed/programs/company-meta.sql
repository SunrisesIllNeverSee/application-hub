-- seed/programs/company-meta.sql
-- Meta Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-meta',
  'Meta Application',
  'Meta',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['tech', 'engineering', 'product', 'social media'],
  'Meta application questions asked across Greenhouse applications for engineering, product, design, and operations roles.',
  'https://www.metacareers.com',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Tell me about yourself.
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about yourself.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about yourself.', 'personal', 300, 1, 0.95, true, ARRAY['Meta Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Meta Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about yourself.', 300, true, 1, 'Application Questions');

-- Q2: Why Meta?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Meta?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Meta?', 'fit', 300, 1, 0.92, false, ARRAY['Meta Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Meta Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Meta?', 300, true, 2, 'Application Questions');

-- Q3: Tell me about a time you had to make a decision with incompl
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you had to make a decision with incomplete information.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you had to make a decision with incomplete information.', 'personal', 400, 1, 0.89, false, ARRAY['Meta Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Meta Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you had to make a decision with incomplete information.', 400, true, 3, 'Application Questions');

-- Q4: Describe a project you're proud of and walk me through your 
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a project you''re proud of and walk me through your decision-making.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a project you''re proud of and walk me through your decision-making.', 'personal', 400, 1, 0.88, false, ARRAY['Meta Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Meta Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a project you''re proud of and walk me through your decision-making.', 400, true, 4, 'Application Questions');

-- Q5: How have you contributed to a diverse and inclusive environm
SELECT id INTO q_id FROM archived_questions WHERE text = 'How have you contributed to a diverse and inclusive environment?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How have you contributed to a diverse and inclusive environment?', 'personal', 400, 1, 0.85, false, ARRAY['Meta Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Meta Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How have you contributed to a diverse and inclusive environment?', 400, true, 5, 'Application Questions');

END $$;