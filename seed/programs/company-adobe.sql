-- seed/programs/company-adobe.sql
-- Adobe Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-adobe',
  'Adobe Application',
  'Adobe',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['tech', 'creative software', 'design', 'media', 'saas'],
  'Adobe application questions asked across their Workday application portal for engineering, product, design, and marketing roles.',
  'https://careers.adobe.com',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why Adobe?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Adobe?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Adobe?', 'fit', 300, 1, 0.92, false, ARRAY['Adobe Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Adobe Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Adobe?', 300, true, 1, 'Application Questions');

-- Q2: Describe a project where creativity and technical skill inte
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a project where creativity and technical skill intersected.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a project where creativity and technical skill intersected.', 'personal', 400, 1, 0.9, false, ARRAY['Adobe Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Adobe Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a project where creativity and technical skill intersected.', 400, true, 2, 'Application Questions');

-- Q3: Tell me about a time you had to champion a creative vision t
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you had to champion a creative vision to stakeholders.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you had to champion a creative vision to stakeholders.', 'personal', 400, 1, 0.89, false, ARRAY['Adobe Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Adobe Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you had to champion a creative vision to stakeholders.', 400, true, 3, 'Application Questions');

-- Q4: How do you think about the democratization of creativity?
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you think about the democratization of creativity?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you think about the democratization of creativity?', 'vision', 400, 1, 0.88, false, ARRAY['Adobe Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Adobe Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you think about the democratization of creativity?', 400, true, 4, 'Application Questions');

-- Q5: Tell me about a time you had to iterate quickly based on fee
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you had to iterate quickly based on feedback.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you had to iterate quickly based on feedback.', 'personal', 400, 1, 0.87, false, ARRAY['Adobe Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Adobe Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you had to iterate quickly based on feedback.', 400, true, 5, 'Application Questions');

END $$;