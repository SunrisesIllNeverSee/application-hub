-- seed/programs/macarthur-100andchange.sql
-- MacArthur 100&Change — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'macarthur-100andchange',
  'MacArthur 100&Change',
  'MacArthur Foundation',
  'grant',
  'open',
  10000000000,
  10000000000,
  0.0,
  ARRAY['Global'],
  ARRAY['social-impact', 'systems-change', 'global-challenges'],
  'MacArthur 100&Change is a competition for a single $100 million grant to fund a bold solution to a critical problem of our time.',
  'https://www.macfound.org/programs/100change/',
  false,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Problem description
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the problem you are trying to solve. How many people are affected and how severely?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the problem you are trying to solve. How many people are affected and how severely?', 'problem', 750, 1, 0.95, false, ARRAY['MacArthur 100&Change'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MacArthur 100&Change') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the problem you are trying to solve. How many people are affected and how severely?', 750, true, 1, 'The Problem');

-- Q2: Proposed solution
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your proposed solution. How does it work and what evidence do you have that it will succeed?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your proposed solution. How does it work and what evidence do you have that it will succeed?', 'solution', 750, 1, 0.95, false, ARRAY['MacArthur 100&Change'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MacArthur 100&Change') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your proposed solution. How does it work and what evidence do you have that it will succeed?', 750, true, 2, 'The Solution');

-- Q3: Success vision
SELECT id INTO q_id FROM archived_questions WHERE text = 'What will success look like in five years? What specific, measurable change will have occurred?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What will success look like in five years? What specific, measurable change will have occurred?', 'vision', 500, 1, 0.92, false, ARRAY['MacArthur 100&Change'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MacArthur 100&Change') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What will success look like in five years? What specific, measurable change will have occurred?', 500, true, 3, 'Impact');

-- Q4: Unique positioning
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why is your organization uniquely positioned to solve this problem?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why is your organization uniquely positioned to solve this problem?', 'team', 500, 1, 0.93, false, ARRAY['MacArthur 100&Change'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MacArthur 100&Change') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why is your organization uniquely positioned to solve this problem?', 500, true, 4, 'Organization');

END $$;
