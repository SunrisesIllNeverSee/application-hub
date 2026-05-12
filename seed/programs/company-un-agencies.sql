-- seed/programs/company-un-agencies.sql
-- United Nations Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-un-agencies',
  'United Nations Application',
  'United Nations',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['international development', 'humanitarian', 'public sector', 'global policy', 'multilateral'],
  'United Nations application questions asked across UN Careers and agency portals for professional, associate, and Young Professionals Programme roles.',
  'https://careers.un.org',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why the UN and international public service?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why the UN and international public service?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why the UN and international public service?', 'fit', 500, 1, 0.92, false, ARRAY['United Nations Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'United Nations Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why the UN and international public service?', 500, true, 1, 'Application Questions');

-- Q2: Describe your experience working across cultural or national
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your experience working across cultural or national boundaries.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your experience working across cultural or national boundaries.', 'personal', 500, 1, 0.91, false, ARRAY['United Nations Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'United Nations Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your experience working across cultural or national boundaries.', 500, true, 2, 'Application Questions');

-- Q3: Tell me about a time you contributed to a complex multi-stak
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you contributed to a complex multi-stakeholder initiative.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you contributed to a complex multi-stakeholder initiative.', 'personal', 500, 1, 0.9, false, ARRAY['United Nations Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'United Nations Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you contributed to a complex multi-stakeholder initiative.', 500, true, 3, 'Application Questions');

-- Q4: How do you think about the relationship between humanitarian
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you think about the relationship between humanitarian action and sustainable development?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you think about the relationship between humanitarian action and sustainable development?', 'vision', 500, 1, 0.91, false, ARRAY['United Nations Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'United Nations Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you think about the relationship between humanitarian action and sustainable development?', 500, true, 4, 'Application Questions');

-- Q5: What do you believe is the most pressing global challenge, a
SELECT id INTO q_id FROM archived_questions WHERE text = 'What do you believe is the most pressing global challenge, and what role should the UN play?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What do you believe is the most pressing global challenge, and what role should the UN play?', 'vision', 500, 1, 0.92, false, ARRAY['United Nations Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'United Nations Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What do you believe is the most pressing global challenge, and what role should the UN play?', 500, true, 5, 'Application Questions');

END $$;