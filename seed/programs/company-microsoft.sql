-- seed/programs/company-microsoft.sql
-- Microsoft Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-microsoft',
  'Microsoft Application',
  'Microsoft',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['tech', 'cloud', 'enterprise software', 'ai', 'productivity'],
  'Microsoft application questions asked across Workday applications for engineering, product, sales, and operations roles.',
  'https://careers.microsoft.com',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why Microsoft?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Microsoft?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Microsoft?', 'fit', 300, 1, 0.92, false, ARRAY['Microsoft Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Microsoft Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Microsoft?', 300, true, 1, 'Application Questions');

-- Q2: Tell me about a time you had to learn a new technology or sk
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you had to learn a new technology or skill quickly.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you had to learn a new technology or skill quickly.', 'personal', 400, 1, 0.89, false, ARRAY['Microsoft Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Microsoft Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you had to learn a new technology or skill quickly.', 400, true, 2, 'Application Questions');

-- Q3: Describe a situation where you had to work across teams to d
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a situation where you had to work across teams to deliver a project.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a situation where you had to work across teams to deliver a project.', 'personal', 400, 1, 0.88, false, ARRAY['Microsoft Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Microsoft Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a situation where you had to work across teams to deliver a project.', 400, true, 3, 'Application Questions');

-- Q4: Tell me about a time you received difficult feedback. How di
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you received difficult feedback. How did you respond?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you received difficult feedback. How did you respond?', 'personal', 400, 1, 0.87, false, ARRAY['Microsoft Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Microsoft Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you received difficult feedback. How did you respond?', 400, true, 4, 'Application Questions');

-- Q5: How do you stay current with technology trends in your field
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you stay current with technology trends in your field?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you stay current with technology trends in your field?', 'personal', 300, 1, 0.85, false, ARRAY['Microsoft Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Microsoft Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you stay current with technology trends in your field?', 300, true, 5, 'Application Questions');

END $$;