-- seed/programs/y-combinator.sql
-- Y Combinator — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'y-combinator',
  'Y Combinator',
  'Y Combinator',
  'accel',
  'open',
  50000000,   -- $500k in cents
  50000000,
  0.07,
  ARRAY['Global'],
  ARRAY['b2b', 'b2c', 'deeptech', 'fintech', 'health', 'ai'],
  'Y Combinator is the world''s most prestigious startup accelerator. Since 2005, YC has funded over 4,000 startups including Airbnb, Dropbox, Stripe, and Reddit. The program provides $500k in funding for 7% equity, three months of intensive support, and lifelong access to the YC alumni network.',
  'https://www.ycombinator.com/apply',
  false,
  'seeded'
);

-- Q1: Company description (50 chars)
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe what your company does in 50 characters or less.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe what your company does in 50 characters or less.', 'solution', 10, 1, 0.95, true, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, char_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe what your company does in 50 characters or less.', 50, true, 1, 'Company');

-- Q2: What is your company going to make?
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your company going to make? Please describe your product and what it does or will do.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your company going to make? Please describe your product and what it does or will do.', 'solution', 150, 1, 0.98, true, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your company going to make? Please describe your product and what it does or will do.', 150, true, 2, 'Company');

-- Q3: Why did you pick this idea?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why did you pick this idea to work on? Do you have domain expertise in this area? How do you know people need what you''re making?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why did you pick this idea to work on? Do you have domain expertise in this area? How do you know people need what you''re making?', 'problem', 150, 1, 0.92, true, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why did you pick this idea to work on? Do you have domain expertise in this area? How do you know people need what you''re making?', 150, true, 3, 'Company');

-- Q4: Revenue and users
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your monthly revenue? How many active users do you have?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your monthly revenue? How many active users do you have?', 'traction', 100, 1, 0.90, true, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your monthly revenue? How many active users do you have?', 100, true, 4, 'Traction');

-- Q5: Traction narrative
SELECT id INTO q_id FROM archived_questions WHERE text = 'If you have already started working on it, how long have you been working and how much progress have you made?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'If you have already started working on it, how long have you been working and how much progress have you made?', 'traction', 150, 1, 0.88, true, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'If you have already started working on it, how long have you been working and how much progress have you made?', 150, true, 5, 'Traction');

-- Q6: How long have founders known each other?
SELECT id INTO q_id FROM archived_questions WHERE text = 'How long have the founders known one another and how did you meet? Have any of the founders not met in person?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How long have the founders known one another and how did you meet? Have any of the founders not met in person?', 'team', 150, 1, 0.85, false, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How long have the founders known one another and how did you meet? Have any of the founders not met in person?', 150, true, 6, 'Founders');

-- Q7: Technical co-founder
SELECT id INTO q_id FROM archived_questions WHERE text = 'Who writes code, or does other technical work? Have any of the founders had experience at a high-growth startup before?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Who writes code, or does other technical work? Have any of the founders had experience at a high-growth startup before?', 'team', 150, 1, 0.82, false, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Who writes code, or does other technical work? Have any of the founders had experience at a high-growth startup before?', 150, true, 7, 'Founders');

-- Q8: Impressive thing accomplished
SELECT id INTO q_id FROM archived_questions WHERE text = 'Please tell us about the time you most successfully hacked some (non-computer) system to your advantage.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Please tell us about the time you most successfully hacked some (non-computer) system to your advantage.', 'personal', 150, 1, 0.78, false, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Please tell us about the time you most successfully hacked some (non-computer) system to your advantage.', 150, true, 8, 'Founders');

-- Q9: Competitors
SELECT id INTO q_id FROM archived_questions WHERE text = 'Who are your competitors, and who might become competitors? Who do you fear most?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Who are your competitors, and who might become competitors? Who do you fear most?', 'market', 150, 1, 0.87, true, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Who are your competitors, and who might become competitors? Who do you fear most?', 150, true, 9, 'Company');

-- Q10: What do you understand about your business that others don't?
SELECT id INTO q_id FROM archived_questions WHERE text = 'What do you understand about your business that other companies in it just don''t get?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What do you understand about your business that other companies in it just don''t get?', 'vision', 150, 1, 0.90, true, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What do you understand about your business that other companies in it just don''t get?', 150, true, 10, 'Company');

-- Q11: How will you make money?
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you make money? How much could you make?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you make money? How much could you make?', 'business_model', 150, 1, 0.93, true, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you make money? How much could you make?', 150, true, 11, 'Company');

-- Q12: Previous fundraising
SELECT id INTO q_id FROM archived_questions WHERE text = 'How much money have you raised? From whom? On what terms?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How much money have you raised? From whom? On what terms?', 'fundraising', 150, 1, 0.85, true, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How much money have you raised? From whom? On what terms?', 150, true, 12, 'Financing');

-- Q13: Other accelerators
SELECT id INTO q_id FROM archived_questions WHERE text = 'Are you applying to other accelerators or programs at this time? If so, which ones?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Are you applying to other accelerators or programs at this time? If so, which ones?', 'fit', 100, 1, 0.70, false, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Are you applying to other accelerators or programs at this time? If so, which ones?', 100, true, 13, 'Financing');

-- Q14: Incorporated?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Is your company incorporated? If so, in what state and when?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Is your company incorporated? If so, in what state and when?', 'fit', 50, 1, 0.65, false, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Is your company incorporated? If so, in what state and when?', 50, true, 14, 'Legal');

-- Q15: Why YC?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why do you want to participate in Y Combinator?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why do you want to participate in Y Combinator?', 'fit', 150, 1, 0.88, false, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why do you want to participate in Y Combinator?', 150, true, 15, 'Company');

-- Q16: How did you hear about YC?
SELECT id INTO q_id FROM archived_questions WHERE text = 'How did you hear about Y Combinator?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How did you hear about Y Combinator?', 'fit', 50, 1, 0.40, false, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How did you hear about Y Combinator?', 50, false, 16, 'Company');

-- Q17: Demo video
SELECT id INTO q_id FROM archived_questions WHERE text = 'Please provide a link to a demo or prototype of your product, or a video walkthrough.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Please provide a link to a demo or prototype of your product, or a video walkthrough.', 'solution', NULL, 1, 0.75, true, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Please provide a link to a demo or prototype of your product, or a video walkthrough.', NULL, false, 17, 'Company');

-- Q18: If you had to choose one founder
SELECT id INTO q_id FROM archived_questions WHERE text = 'If you had to choose one founder on your team to build this company alone, which one would it be? Why?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'If you had to choose one founder on your team to build this company alone, which one would it be? Why?', 'team', 150, 1, 0.80, false, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'If you had to choose one founder on your team to build this company alone, which one would it be? Why?', 150, true, 18, 'Founders');

-- Q19: Equity split
SELECT id INTO q_id FROM archived_questions WHERE text = 'Have you established a clear and equitable equity split among the founders? If so, what is it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Have you established a clear and equitable equity split among the founders? If so, what is it?', 'team', 100, 1, 0.75, false, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Have you established a clear and equitable equity split among the founders? If so, what is it?', 100, true, 19, 'Founders');

-- Q20: Something surprising about users
SELECT id INTO q_id FROM archived_questions WHERE text = 'What surprised you most about talking to users about your product?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What surprised you most about talking to users about your product?', 'traction', 150, 1, 0.82, false, ARRAY['Y Combinator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Y Combinator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What surprised you most about talking to users about your product?', 150, true, 20, 'Traction');

END $$;
