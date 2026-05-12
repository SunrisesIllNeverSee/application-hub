-- seed/programs/lumina-foundation.sql
-- Lumina Foundation Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'lumina-foundation',
  'Lumina Foundation Grant',
  'Lumina Foundation',
  'grant',
  'open',
  5000000,
  200000000,
  0.0,
  ARRAY['US'],
  ARRAY['higher-education', 'workforce', 'equity', 'credentialing'],
  'Lumina Foundation works to increase the proportion of Americans with high-quality degrees, certificates, and other credentials to 60% by 2025.',
  'https://www.luminafoundation.org/grants/',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Postsecondary attainment
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe how your project will increase equitable postsecondary attainment.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe how your project will increase equitable postsecondary attainment.', 'solution', 600, 1, 0.91, false, ARRAY['Lumina Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Lumina Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe how your project will increase equitable postsecondary attainment.', 600, true, 1, 'Project');

-- Q2: Evidence for underrepresented students
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your evidence that this approach will work for underrepresented students?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your evidence that this approach will work for underrepresented students?', 'traction', 500, 1, 0.92, false, ARRAY['Lumina Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Lumina Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your evidence that this approach will work for underrepresented students?', 500, true, 2, 'Evidence');

-- Q3: Measuring success
SELECT id INTO q_id FROM archived_questions WHERE text = 'How will you measure success?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How will you measure success?', 'impact', 300, 1, 0.89, true, ARRAY['Lumina Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Lumina Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How will you measure success?', 300, true, 3, 'Evaluation');

END $$;
