-- seed/programs/company-openai.sql
-- OpenAI Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-openai',
  'OpenAI Application',
  'OpenAI',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['ai', 'research', 'tech', 'safety', 'machine learning'],
  'OpenAI application questions asked across Greenhouse applications for research, engineering, policy, and operations roles.',
  'https://openai.com/careers',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why OpenAI?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why OpenAI?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why OpenAI?', 'fit', 300, 1, 0.92, false, ARRAY['OpenAI Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'OpenAI Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why OpenAI?', 300, true, 1, 'Application Questions');

-- Q2: What is your view on the responsible development of AI?
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your view on the responsible development of AI?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your view on the responsible development of AI?', 'vision', 500, 1, 0.93, false, ARRAY['OpenAI Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'OpenAI Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your view on the responsible development of AI?', 500, true, 2, 'Application Questions');

-- Q3: Describe a project that stretched your capabilities signific
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a project that stretched your capabilities significantly.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a project that stretched your capabilities significantly.', 'personal', 400, 1, 0.9, false, ARRAY['OpenAI Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'OpenAI Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a project that stretched your capabilities significantly.', 400, true, 3, 'Application Questions');

-- Q4: How do you think about the long-term implications of your wo
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you think about the long-term implications of your work?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you think about the long-term implications of your work?', 'vision', 400, 1, 0.91, false, ARRAY['OpenAI Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'OpenAI Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you think about the long-term implications of your work?', 400, true, 4, 'Application Questions');

-- Q5: Tell me about a time you had to navigate ambiguity in your w
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you had to navigate ambiguity in your work.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you had to navigate ambiguity in your work.', 'personal', 400, 1, 0.88, false, ARRAY['OpenAI Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'OpenAI Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you had to navigate ambiguity in your work.', 400, true, 5, 'Application Questions');

END $$;