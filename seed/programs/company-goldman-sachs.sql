-- seed/programs/company-goldman-sachs.sql
-- Goldman Sachs Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-goldman-sachs',
  'Goldman Sachs Application',
  'Goldman Sachs',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['finance', 'investment banking', 'trading', 'asset management'],
  'Goldman Sachs application questions asked across their Workday application portal for analyst, associate, and specialist roles.',
  'https://www.goldmansachs.com/careers',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why Goldman Sachs?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Goldman Sachs?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Goldman Sachs?', 'fit', 400, 1, 0.92, false, ARRAY['Goldman Sachs Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Goldman Sachs Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Goldman Sachs?', 400, true, 1, 'Application Questions');

-- Q2: Tell me about a time you identified a risk that others overl
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you identified a risk that others overlooked. What did you do?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you identified a risk that others overlooked. What did you do?', 'personal', 400, 1, 0.91, false, ARRAY['Goldman Sachs Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Goldman Sachs Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you identified a risk that others overlooked. What did you do?', 400, true, 2, 'Application Questions');

-- Q3: Describe a situation where you had to work under significant
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a situation where you had to work under significant pressure. How did you manage it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a situation where you had to work under significant pressure. How did you manage it?', 'personal', 400, 1, 0.9, false, ARRAY['Goldman Sachs Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Goldman Sachs Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a situation where you had to work under significant pressure. How did you manage it?', 400, true, 3, 'Application Questions');

-- Q4: Tell me about a project where precision and accuracy were cr
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a project where precision and accuracy were critical.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a project where precision and accuracy were critical.', 'personal', 400, 1, 0.89, false, ARRAY['Goldman Sachs Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Goldman Sachs Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a project where precision and accuracy were critical.', 400, true, 4, 'Application Questions');

-- Q5: How do you stay current on financial markets and economic tr
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you stay current on financial markets and economic trends?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you stay current on financial markets and economic trends?', 'personal', 300, 1, 0.87, false, ARRAY['Goldman Sachs Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Goldman Sachs Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you stay current on financial markets and economic trends?', 300, true, 5, 'Application Questions');

END $$;