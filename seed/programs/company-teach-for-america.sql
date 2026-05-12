-- seed/programs/company-teach-for-america.sql
-- Teach For America Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-teach-for-america',
  'Teach For America Application',
  'Teach For America',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['nonprofit', 'education', 'equity', 'social impact', 'teaching'],
  'Teach For America application questions asked in their online application for corps member and staff roles.',
  'https://www.teachforamerica.org/join-tfa',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why TFA? Why teaching?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why TFA? Why teaching?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why TFA? Why teaching?', 'fit', 500, 1, 0.93, false, ARRAY['Teach For America Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Teach For America Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why TFA? Why teaching?', 500, true, 1, 'Application Questions');

-- Q2: Describe a time you drove significant change in your communi
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time you drove significant change in your community or organization.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time you drove significant change in your community or organization.', 'personal', 500, 1, 0.91, false, ARRAY['Teach For America Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Teach For America Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time you drove significant change in your community or organization.', 500, true, 2, 'Application Questions');

-- Q3: Tell me about a time you had to adapt your approach to reach
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you had to adapt your approach to reach a challenging goal.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you had to adapt your approach to reach a challenging goal.', 'personal', 500, 1, 0.9, false, ARRAY['Teach For America Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Teach For America Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you had to adapt your approach to reach a challenging goal.', 500, true, 3, 'Application Questions');

-- Q4: What do you believe about educational equity, and how has th
SELECT id INTO q_id FROM archived_questions WHERE text = 'What do you believe about educational equity, and how has that shaped your path?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What do you believe about educational equity, and how has that shaped your path?', 'vision', 500, 1, 0.92, false, ARRAY['Teach For America Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Teach For America Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What do you believe about educational equity, and how has that shaped your path?', 500, true, 4, 'Application Questions');

-- Q5: Describe your experience working with diverse communities.
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your experience working with diverse communities.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your experience working with diverse communities.', 'personal', 400, 1, 0.89, false, ARRAY['Teach For America Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Teach For America Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your experience working with diverse communities.', 400, true, 5, 'Application Questions');

END $$;