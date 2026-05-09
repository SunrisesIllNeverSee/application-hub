-- seed/programs/fast-forward.sql
-- Fast Forward — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'fast-forward',
  'Fast Forward Tech Nonprofit Accelerator',
  'Fast Forward',
  'accel',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['nonprofit', 'social-impact', 'education', 'health', 'workforce', 'climate', 'tech-for-good'],
  'Fast Forward accelerates tech nonprofits — organizations using technology to solve important social problems at scale. Fellows receive a $25k grant, 9 months of coaching, curriculum, a network of tech nonprofit peers, and connections to software engineering volunteers and major donors.',
  'https://www.ffwd.org',
  false,
  'seeded'
);

-- Q1: Organization mission
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your organization''s mission? What social problem are you trying to solve?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your organization''s mission? What social problem are you trying to solve?', 'problem', 200, 1, 0.93, false, ARRAY['Fast Forward'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Fast Forward') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your organization''s mission? What social problem are you trying to solve?', 200, true, 1, 'Organization');

-- Q2: Technology-driven solution
SELECT id INTO q_id FROM archived_questions WHERE text = 'How does technology power your solution? Why is a technology-driven approach the right one for this problem?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How does technology power your solution? Why is a technology-driven approach the right one for this problem?', 'technical', 250, 1, 0.91, false, ARRAY['Fast Forward'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Fast Forward') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How does technology power your solution? Why is a technology-driven approach the right one for this problem?', 250, true, 2, 'Technology');

-- Q3: Scale potential
SELECT id INTO q_id FROM archived_questions WHERE text = 'How can your technology solution scale to reach more people? What does scale look like for your organization?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How can your technology solution scale to reach more people? What does scale look like for your organization?', 'vision', 250, 1, 0.90, false, ARRAY['Fast Forward'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Fast Forward') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How can your technology solution scale to reach more people? What does scale look like for your organization?', 250, true, 3, 'Vision');

-- Q4: Program users and impact
SELECT id INTO q_id FROM archived_questions WHERE text = 'How many people does your program currently serve and what outcomes have you achieved?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How many people does your program currently serve and what outcomes have you achieved?', 'traction', 200, 1, 0.91, false, ARRAY['Fast Forward'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Fast Forward') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How many people does your program currently serve and what outcomes have you achieved?', 200, true, 4, 'Impact');

-- Q5: Funding model
SELECT id INTO q_id FROM archived_questions WHERE text = 'How does your nonprofit generate revenue or secure funding? What is your current annual budget?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How does your nonprofit generate revenue or secure funding? What is your current annual budget?', 'business_model', 200, 1, 0.87, false, ARRAY['Fast Forward'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Fast Forward') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How does your nonprofit generate revenue or secure funding? What is your current annual budget?', 200, true, 5, 'Financials');

-- Q6: Engineering capacity
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your current technology and engineering team? What is your tech stack?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your current technology and engineering team? What is your tech stack?', 'technical', 200, 1, 0.84, false, ARRAY['Fast Forward'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Fast Forward') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your current technology and engineering team? What is your tech stack?', 200, true, 6, 'Technology');

END $$;
