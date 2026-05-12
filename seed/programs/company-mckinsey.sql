-- seed/programs/company-mckinsey.sql
-- McKinsey & Company Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-mckinsey',
  'McKinsey & Company Application',
  'McKinsey & Company',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['consulting', 'strategy', 'management consulting', 'business'],
  'McKinsey & Company application questions asked across their online application portal for analyst, associate, and specialist roles.',
  'https://www.mckinsey.com/careers',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why consulting? Why McKinsey?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why consulting? Why McKinsey?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why consulting? Why McKinsey?', 'fit', 500, 1, 0.93, false, ARRAY['McKinsey & Company Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'McKinsey & Company Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why consulting? Why McKinsey?', 500, true, 1, 'Application Questions');

-- Q2: Tell me about a time you solved a complex, ambiguous problem
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you solved a complex, ambiguous problem. How did you structure your thinking?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you solved a complex, ambiguous problem. How did you structure your thinking?', 'personal', 500, 1, 0.92, false, ARRAY['McKinsey & Company Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'McKinsey & Company Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you solved a complex, ambiguous problem. How did you structure your thinking?', 500, true, 2, 'Application Questions');

-- Q3: Describe your most significant leadership experience.
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your most significant leadership experience.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your most significant leadership experience.', 'personal', 500, 1, 0.91, false, ARRAY['McKinsey & Company Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'McKinsey & Company Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your most significant leadership experience.', 500, true, 3, 'Application Questions');

-- Q4: Tell me about a time you had to deliver a difficult recommen
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you had to deliver a difficult recommendation to a client or senior stakeholder.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you had to deliver a difficult recommendation to a client or senior stakeholder.', 'personal', 500, 1, 0.9, false, ARRAY['McKinsey & Company Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'McKinsey & Company Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you had to deliver a difficult recommendation to a client or senior stakeholder.', 500, true, 4, 'Application Questions');

-- Q5: Where do you see your career in 10 years?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Where do you see your career in 10 years?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Where do you see your career in 10 years?', 'personal', 400, 1, 0.87, false, ARRAY['McKinsey & Company Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'McKinsey & Company Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Where do you see your career in 10 years?', 400, true, 5, 'Application Questions');

END $$;