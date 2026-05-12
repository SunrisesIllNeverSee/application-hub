-- seed/programs/company-salesforce.sql
-- Salesforce Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-salesforce',
  'Salesforce Application',
  'Salesforce',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['tech', 'crm', 'enterprise software', 'cloud', 'saas'],
  'Salesforce application questions asked across their Workday application portal for sales, engineering, product, and operations roles.',
  'https://salesforce.com/company/careers',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why Salesforce?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Salesforce?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Salesforce?', 'fit', 300, 1, 0.92, false, ARRAY['Salesforce Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Salesforce Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Salesforce?', 300, true, 1, 'Application Questions');

-- Q2: Tell me about a time you built trust with a customer or stak
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you built trust with a customer or stakeholder.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you built trust with a customer or stakeholder.', 'personal', 400, 1, 0.9, false, ARRAY['Salesforce Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Salesforce Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you built trust with a customer or stakeholder.', 400, true, 2, 'Application Questions');

-- Q3: Describe a project where you drove measurable business outco
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a project where you drove measurable business outcomes.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a project where you drove measurable business outcomes.', 'personal', 400, 1, 0.89, false, ARRAY['Salesforce Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Salesforce Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a project where you drove measurable business outcomes.', 400, true, 3, 'Application Questions');

-- Q4: Tell me about a time you had to advocate for a change in you
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you had to advocate for a change in your organization.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you had to advocate for a change in your organization.', 'personal', 400, 1, 0.88, false, ARRAY['Salesforce Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Salesforce Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you had to advocate for a change in your organization.', 400, true, 4, 'Application Questions');

-- Q5: What does 'customer success' mean to you?
SELECT id INTO q_id FROM archived_questions WHERE text = 'What does ''customer success'' mean to you?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What does ''customer success'' mean to you?', 'personal', 300, 1, 0.88, false, ARRAY['Salesforce Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Salesforce Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What does ''customer success'' mean to you?', 300, true, 5, 'Application Questions');

END $$;