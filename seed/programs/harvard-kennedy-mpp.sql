-- seed/programs/harvard-kennedy-mpp.sql
-- Harvard Kennedy School MPP — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'harvard-kennedy-mpp',
  'Harvard Kennedy School MPP',
  'Harvard University',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US', 'Global'],
  ARRAY['mpp', 'graduate', 'public policy', 'government', 'social impact'],
  'Harvard Kennedy School MPP program prepares students for careers in public service and policy, developing leaders who use rigorous analysis to solve complex public problems.',
  'https://www.hks.harvard.edu/educational-programs/masters-programs/master-public-policy',
  false,
  'seeded',
  'school_grad'::opportunity_kind,
  'education'
);

-- Q1: Career and policy goals
SELECT id INTO q_id FROM archived_questions WHERE text = 'Please describe your career and policy goals. What do you hope to accomplish, and how do you plan to achieve your goals?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Please describe your career and policy goals. What do you hope to accomplish, and how do you plan to achieve your goals?', 'vision', 600, 1, 0.94, false, ARRAY['Harvard Kennedy School MPP'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Harvard Kennedy School MPP') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Please describe your career and policy goals. What do you hope to accomplish, and how do you plan to achieve your goals?', 600, true, 1, 'Essays');

-- Q2: Why HKS
SELECT id INTO q_id FROM archived_questions WHERE text = 'Please tell us about yourself — your background, interests, values, and aspirations — and why you believe Harvard Kennedy School is the right place to pursue your education.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Please tell us about yourself — your background, interests, values, and aspirations — and why you believe Harvard Kennedy School is the right place to pursue your education.', 'fit', 600, 1, 0.92, false, ARRAY['Harvard Kennedy School MPP'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Harvard Kennedy School MPP') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Please tell us about yourself — your background, interests, values, and aspirations — and why you believe Harvard Kennedy School is the right place to pursue your education.', 600, true, 2, 'Essays');

END $$;
