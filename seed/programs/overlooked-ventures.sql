-- seed/programs/overlooked-ventures.sql
-- Overlooked Ventures — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'overlooked-ventures',
  'Overlooked Ventures',
  'Overlooked Ventures',
  'vc',
  'open',
  5000000,    -- $50k in cents
  25000000,   -- $250k in cents
  NULL,
  ARRAY['US'],
  ARRAY['b2b', 'saas', 'consumer', 'health', 'fintech', 'impact'],
  'Overlooked Ventures is a pre-seed fund that invests in founders who are overlooked by traditional venture capital — specifically founders who are Black, Latinx, Indigenous, women, LGBTQ+, or from non-coastal cities. The fund writes early checks and provides hands-on support.',
  'https://overlooked.vc',
  true,
  'seeded'
);

-- Q1: Company description
SELECT id INTO q_id FROM archived_questions WHERE text = 'What does your company do? Give us a clear, jargon-free description.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What does your company do? Give us a clear, jargon-free description.', 'solution', 100, 1, 0.95, true, ARRAY['Overlooked Ventures'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Overlooked Ventures') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What does your company do? Give us a clear, jargon-free description.', 100, true, 1, 'Company');

-- Q2: Founder identity
SELECT id INTO q_id FROM archived_questions WHERE text = 'Overlooked Ventures focuses on founders from underrepresented backgrounds. Please tell us about yourself and how you identify.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Overlooked Ventures focuses on founders from underrepresented backgrounds. Please tell us about yourself and how you identify.', 'personal', 200, 1, 0.93, false, ARRAY['Overlooked Ventures'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Overlooked Ventures') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Overlooked Ventures focuses on founders from underrepresented backgrounds. Please tell us about yourself and how you identify.', 200, true, 2, 'Founder');

-- Q3: Problem and customer
SELECT id INTO q_id FROM archived_questions WHERE text = 'Who is your customer and what specific pain point are you solving for them?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Who is your customer and what specific pain point are you solving for them?', 'problem', 200, 1, 0.93, true, ARRAY['Overlooked Ventures'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Overlooked Ventures') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Who is your customer and what specific pain point are you solving for them?', 200, true, 3, 'Problem');

-- Q4: Traction
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your most significant traction milestone to date?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your most significant traction milestone to date?', 'traction', 150, 1, 0.90, true, ARRAY['Overlooked Ventures'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Overlooked Ventures') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your most significant traction milestone to date?', 150, true, 4, 'Traction');

-- Q5: Fundraise details
SELECT id INTO q_id FROM archived_questions WHERE text = 'How much are you raising and at what terms? What existing commitments do you have?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How much are you raising and at what terms? What existing commitments do you have?', 'fundraising', 150, 1, 0.88, true, ARRAY['Overlooked Ventures'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Overlooked Ventures') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How much are you raising and at what terms? What existing commitments do you have?', 150, true, 5, 'Financing');

-- Q6: Location
SELECT id INTO q_id FROM archived_questions WHERE text = 'Where is your company based? Are you open to relocating?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Where is your company based? Are you open to relocating?', 'fit', 50, 1, 0.65, false, ARRAY['Overlooked Ventures'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Overlooked Ventures') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Where is your company based? Are you open to relocating?', 50, true, 6, 'Company');

END $$;
