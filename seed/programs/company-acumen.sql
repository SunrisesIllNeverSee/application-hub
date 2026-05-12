-- seed/programs/company-acumen.sql
-- Acumen Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-acumen',
  'Acumen Application',
  'Acumen',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['nonprofit', 'social impact', 'impact investing', 'global development'],
  'Acumen application questions asked in their online application for Fellows, staff, and leadership program roles.',
  'https://acumen.org/careers',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why Acumen?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Acumen?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Acumen?', 'fit', 500, 1, 0.92, false, ARRAY['Acumen Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Acumen Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Acumen?', 500, true, 1, 'Application Questions');

-- Q2: Tell me about a time you worked on a challenge at the inters
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you worked on a challenge at the intersection of business and social impact.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you worked on a challenge at the intersection of business and social impact.', 'personal', 500, 1, 0.91, false, ARRAY['Acumen Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Acumen Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you worked on a challenge at the intersection of business and social impact.', 500, true, 2, 'Application Questions');

-- Q3: Describe your theory of change for the issue you care most a
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your theory of change for the issue you care most about.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your theory of change for the issue you care most about.', 'vision', 500, 1, 0.93, false, ARRAY['Acumen Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Acumen Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your theory of change for the issue you care most about.', 500, true, 3, 'Application Questions');

-- Q4: Tell me about a time you had to make a values-based decision
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you had to make a values-based decision in your work.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you had to make a values-based decision in your work.', 'personal', 500, 1, 0.9, false, ARRAY['Acumen Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Acumen Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you had to make a values-based decision in your work.', 500, true, 4, 'Application Questions');

-- Q5: What does patient capital or long-termism mean to you?
SELECT id INTO q_id FROM archived_questions WHERE text = 'What does patient capital or long-termism mean to you?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What does patient capital or long-termism mean to you?', 'vision', 400, 1, 0.89, false, ARRAY['Acumen Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Acumen Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What does patient capital or long-termism mean to you?', 400, true, 5, 'Application Questions');

END $$;