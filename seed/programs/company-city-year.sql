-- seed/programs/company-city-year.sql
-- City Year Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-city-year',
  'City Year Application',
  'City Year',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['nonprofit', 'education', 'americorps', 'social impact', 'community'],
  'City Year application questions asked in their online application for AmeriCorps member and staff roles.',
  'https://www.cityyear.org/join-city-year',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why City Year?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why City Year?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why City Year?', 'fit', 500, 1, 0.92, false, ARRAY['City Year Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'City Year Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why City Year?', 500, true, 1, 'Application Questions');

-- Q2: Describe your vision for a just and equitable society. What 
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your vision for a just and equitable society. What role do you want to play?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your vision for a just and equitable society. What role do you want to play?', 'vision', 500, 1, 0.93, false, ARRAY['City Year Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'City Year Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your vision for a just and equitable society. What role do you want to play?', 500, true, 2, 'Application Questions');

-- Q3: Tell me about a time you built a meaningful relationship acr
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you built a meaningful relationship across difference.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you built a meaningful relationship across difference.', 'personal', 500, 1, 0.91, false, ARRAY['City Year Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'City Year Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you built a meaningful relationship across difference.', 500, true, 3, 'Application Questions');

-- Q4: Tell me about a time you had to navigate failure. What did y
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you had to navigate failure. What did you learn?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you had to navigate failure. What did you learn?', 'personal', 400, 1, 0.89, false, ARRAY['City Year Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'City Year Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you had to navigate failure. What did you learn?', 400, true, 4, 'Application Questions');

-- Q5: How have you contributed to your community outside of your p
SELECT id INTO q_id FROM archived_questions WHERE text = 'How have you contributed to your community outside of your professional role?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How have you contributed to your community outside of your professional role?', 'personal', 400, 1, 0.88, false, ARRAY['City Year Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'City Year Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How have you contributed to your community outside of your professional role?', 400, true, 5, 'Application Questions');

END $$;