-- seed/programs/mozilla-builders.sql
-- Mozilla Builders — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'mozilla-builders',
  'Mozilla Builders',
  'Mozilla',
  'accel',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['open-source', 'ai', 'privacy', 'internet-health', 'decentralized', 'tech-for-good', 'b2c'],
  'Mozilla Builders is a program for founders and makers building products that create a healthier internet — grounded in privacy, openness, and human agency. The program provides equity-free funding, mentorship from Mozilla''s network, and a platform to reach Mozilla''s global community.',
  'https://builders.mozilla.community',
  false,
  'seeded'
);

-- Q1: What are you building
SELECT id INTO q_id FROM archived_questions WHERE text = 'What are you building and how does it contribute to a healthier internet?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What are you building and how does it contribute to a healthier internet?', 'solution', 250, 1, 0.93, false, ARRAY['Mozilla Builders'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Mozilla Builders') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What are you building and how does it contribute to a healthier internet?', 250, true, 1, 'Project');

-- Q2: Internet health problem
SELECT id INTO q_id FROM archived_questions WHERE text = 'What specific internet health problem does your project address? (Privacy, decentralization, openness, inclusion, security?)' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What specific internet health problem does your project address? (Privacy, decentralization, openness, inclusion, security?)', 'problem', 250, 1, 0.91, false, ARRAY['Mozilla Builders'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Mozilla Builders') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What specific internet health problem does your project address? (Privacy, decentralization, openness, inclusion, security?)', 250, true, 2, 'Problem');

-- Q3: Open source or open approach
SELECT id INTO q_id FROM archived_questions WHERE text = 'Is your project open source? How does openness factor into your approach?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Is your project open source? How does openness factor into your approach?', 'technical', 200, 1, 0.85, false, ARRAY['Mozilla Builders'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Mozilla Builders') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Is your project open source? How does openness factor into your approach?', 200, true, 3, 'Technical');

-- Q4: User traction
SELECT id INTO q_id FROM archived_questions WHERE text = 'Do you have users or early adopters? What feedback have you received so far?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Do you have users or early adopters? What feedback have you received so far?', 'traction', 200, 1, 0.88, true, ARRAY['Mozilla Builders'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Mozilla Builders') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Do you have users or early adopters? What feedback have you received so far?', 200, true, 4, 'Traction');

-- Q5: Mozilla community connection
SELECT id INTO q_id FROM archived_questions WHERE text = 'How does your project align with Mozilla''s mission and how could you benefit from Mozilla''s community and network?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How does your project align with Mozilla''s mission and how could you benefit from Mozilla''s community and network?', 'fit', 200, 1, 0.87, false, ARRAY['Mozilla Builders'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Mozilla Builders') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How does your project align with Mozilla''s mission and how could you benefit from Mozilla''s community and network?', 200, true, 5, 'Fit');

-- Q6: Technical architecture
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the technical architecture of your project. What technologies are you using?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the technical architecture of your project. What technologies are you using?', 'technical', 250, 1, 0.83, false, ARRAY['Mozilla Builders'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Mozilla Builders') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the technical architecture of your project. What technologies are you using?', 250, true, 6, 'Technical');

END $$;
