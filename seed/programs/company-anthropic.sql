-- seed/programs/company-anthropic.sql
-- Anthropic Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-anthropic',
  'Anthropic Application',
  'Anthropic',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['ai', 'research', 'safety', 'tech', 'machine learning'],
  'Anthropic application questions asked across Greenhouse applications for research, engineering, policy, and operations roles.',
  'https://www.anthropic.com/careers',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why Anthropic?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Anthropic?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Anthropic?', 'fit', 300, 1, 0.92, false, ARRAY['Anthropic Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Anthropic Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Anthropic?', 300, true, 1, 'Application Questions');

-- Q2: How do you think about safety and the risks of AI systems?
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you think about safety and the risks of AI systems?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you think about safety and the risks of AI systems?', 'vision', 500, 1, 0.95, false, ARRAY['Anthropic Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Anthropic Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you think about safety and the risks of AI systems?', 500, true, 2, 'Application Questions');

-- Q3: Describe a project where rigor and careful thinking led to a
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a project where rigor and careful thinking led to a better outcome.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a project where rigor and careful thinking led to a better outcome.', 'personal', 400, 1, 0.9, false, ARRAY['Anthropic Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Anthropic Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a project where rigor and careful thinking led to a better outcome.', 400, true, 3, 'Application Questions');

-- Q4: Tell me about a time you changed your mind based on new evid
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you changed your mind based on new evidence.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you changed your mind based on new evidence.', 'personal', 400, 1, 0.91, false, ARRAY['Anthropic Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Anthropic Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you changed your mind based on new evidence.', 400, true, 4, 'Application Questions');

-- Q5: What do you believe about the future of AI and its impact on
SELECT id INTO q_id FROM archived_questions WHERE text = 'What do you believe about the future of AI and its impact on society?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What do you believe about the future of AI and its impact on society?', 'vision', 500, 1, 0.93, false, ARRAY['Anthropic Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Anthropic Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What do you believe about the future of AI and its impact on society?', 500, true, 5, 'Application Questions');

END $$;