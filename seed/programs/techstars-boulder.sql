-- seed/programs/techstars-boulder.sql
-- Techstars Boulder — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'techstars-boulder',
  'Techstars Boulder',
  'Techstars',
  'accel',
  'open',
  12000000,   -- $120k in cents
  12000000,
  0.06,
  ARRAY['US', 'Global'],
  ARRAY['b2b', 'saas', 'enterprise', 'marketplace'],
  'Techstars Boulder is the flagship Techstars program, running since 2007. The program invests $120k (6% equity) in 10 companies per cohort. Companies receive three months of mentorship, access to the global Techstars network of 10,000+ mentors, and lifetime alumni benefits.',
  'https://www.techstars.com/accelerators/boulder',
  false,
  'seeded'
);

-- Q1: Elevator pitch
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about your company in one sentence.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about your company in one sentence.', 'solution', 25, 1, 0.95, true, ARRAY['Techstars Boulder'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Techstars Boulder') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about your company in one sentence.', 25, true, 1, 'Company');

-- Q2: Problem being solved
SELECT id INTO q_id FROM archived_questions WHERE text = 'What problem are you solving? Why is this problem worth solving?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What problem are you solving? Why is this problem worth solving?', 'problem', 200, 1, 0.96, true, ARRAY['Techstars Boulder'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Techstars Boulder') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What problem are you solving? Why is this problem worth solving?', 200, true, 2, 'Company');

-- Q3: Solution description
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your solution? How does it work?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your solution? How does it work?', 'solution', 200, 1, 0.95, true, ARRAY['Techstars Boulder'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Techstars Boulder') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your solution? How does it work?', 200, true, 3, 'Company');

-- Q4: Target customer
SELECT id INTO q_id FROM archived_questions WHERE text = 'Who is your target customer? How do you reach them?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Who is your target customer? How do you reach them?', 'market', 200, 1, 0.90, true, ARRAY['Techstars Boulder'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Techstars Boulder') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Who is your target customer? How do you reach them?', 200, true, 4, 'Market');

-- Q5: Market size
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the size of your target market? How did you estimate it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the size of your target market? How did you estimate it?', 'market', 200, 1, 0.88, true, ARRAY['Techstars Boulder'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Techstars Boulder') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the size of your target market? How did you estimate it?', 200, true, 5, 'Market');

-- Q6: Business model
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your business model? How do you generate or plan to generate revenue?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your business model? How do you generate or plan to generate revenue?', 'business_model', 200, 1, 0.93, true, ARRAY['Techstars Boulder'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Techstars Boulder') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your business model? How do you generate or plan to generate revenue?', 200, true, 6, 'Business Model');

-- Q7: Traction / milestones
SELECT id INTO q_id FROM archived_questions WHERE text = 'What traction do you have? Describe key milestones and metrics.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What traction do you have? Describe key milestones and metrics.', 'traction', 200, 1, 0.92, true, ARRAY['Techstars Boulder'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Techstars Boulder') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What traction do you have? Describe key milestones and metrics.', 200, true, 7, 'Traction');

-- Q8: Team
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about your team. What relevant experience does each founder bring?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about your team. What relevant experience does each founder bring?', 'team', 200, 1, 0.93, true, ARRAY['Techstars Boulder'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Techstars Boulder') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about your team. What relevant experience does each founder bring?', 200, true, 8, 'Team');

-- Q9: Unfair advantage
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your unfair advantage or competitive moat?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your unfair advantage or competitive moat?', 'vision', 200, 1, 0.88, true, ARRAY['Techstars Boulder'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Techstars Boulder') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your unfair advantage or competitive moat?', 200, true, 9, 'Company');

-- Q10: Why Techstars
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why do you want to join the Techstars program? What do you hope to get out of it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why do you want to join the Techstars program? What do you hope to get out of it?', 'fit', 200, 1, 0.85, false, ARRAY['Techstars Boulder'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Techstars Boulder') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why do you want to join the Techstars program? What do you hope to get out of it?', 200, true, 10, 'Fit');

-- Q11: Mentors wanted
SELECT id INTO q_id FROM archived_questions WHERE text = 'What specific expertise are you looking for in mentors?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What specific expertise are you looking for in mentors?', 'fit', 150, 1, 0.72, false, ARRAY['Techstars Boulder'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Techstars Boulder') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What specific expertise are you looking for in mentors?', 150, true, 11, 'Fit');

-- Q12: Fundraising plans
SELECT id INTO q_id FROM archived_questions WHERE text = 'How much are you looking to raise in your next round? When do you plan to raise it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How much are you looking to raise in your next round? When do you plan to raise it?', 'fundraising', 150, 1, 0.80, true, ARRAY['Techstars Boulder'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Techstars Boulder') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How much are you looking to raise in your next round? When do you plan to raise it?', 150, true, 12, 'Financing');

-- Q13: Biggest risk
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the biggest risk facing your company right now? How are you mitigating it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the biggest risk facing your company right now? How are you mitigating it?', 'vision', 200, 1, 0.83, true, ARRAY['Techstars Boulder'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Techstars Boulder') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the biggest risk facing your company right now? How are you mitigating it?', 200, true, 13, 'Company');

-- Q14: Founder commitment
SELECT id INTO q_id FROM archived_questions WHERE text = 'Are all founders working full-time on this company? If not, what would it take?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Are all founders working full-time on this company? If not, what would it take?', 'team', 100, 1, 0.82, true, ARRAY['Techstars Boulder'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Techstars Boulder') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Are all founders working full-time on this company? If not, what would it take?', 100, true, 14, 'Team');

-- Q15: Vision in 5-10 years
SELECT id INTO q_id FROM archived_questions WHERE text = 'What does success look like in 5–10 years? What is your long-term vision?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What does success look like in 5–10 years? What is your long-term vision?', 'vision', 200, 1, 0.87, true, ARRAY['Techstars Boulder'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Techstars Boulder') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What does success look like in 5–10 years? What is your long-term vision?', 200, true, 15, 'Vision');

END $$;
