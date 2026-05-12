-- seed/programs/company-johnson-and-johnson.sql
-- Johnson & Johnson Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-johnson-and-johnson',
  'Johnson & Johnson Application',
  'Johnson & Johnson',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['healthcare', 'pharma', 'medtech', 'consumer health'],
  'Johnson & Johnson application questions asked across their Workday application portal for commercial, R&D, operations, and technology roles.',
  'https://jobs.jnj.com',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why J&J?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why J&J?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why J&J?', 'fit', 400, 1, 0.92, false, ARRAY['Johnson & Johnson Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Johnson & Johnson Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why J&J?', 400, true, 1, 'Application Questions');

-- Q2: Tell me about a time you prioritized patient safety or stake
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you prioritized patient safety or stakeholder wellbeing over other considerations.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you prioritized patient safety or stakeholder wellbeing over other considerations.', 'personal', 500, 1, 0.93, false, ARRAY['Johnson & Johnson Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Johnson & Johnson Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you prioritized patient safety or stakeholder wellbeing over other considerations.', 500, true, 2, 'Application Questions');

-- Q3: Describe a project where you had to collaborate across disci
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a project where you had to collaborate across disciplines.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a project where you had to collaborate across disciplines.', 'personal', 400, 1, 0.89, false, ARRAY['Johnson & Johnson Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Johnson & Johnson Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a project where you had to collaborate across disciplines.', 400, true, 3, 'Application Questions');

-- Q4: Tell me about a time you led through uncertainty.
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you led through uncertainty.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you led through uncertainty.', 'personal', 400, 1, 0.88, false, ARRAY['Johnson & Johnson Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Johnson & Johnson Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you led through uncertainty.', 400, true, 4, 'Application Questions');

-- Q5: What does innovation mean to you in healthcare?
SELECT id INTO q_id FROM archived_questions WHERE text = 'What does innovation mean to you in healthcare?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What does innovation mean to you in healthcare?', 'vision', 400, 1, 0.88, false, ARRAY['Johnson & Johnson Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Johnson & Johnson Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What does innovation mean to you in healthcare?', 400, true, 5, 'Application Questions');

END $$;