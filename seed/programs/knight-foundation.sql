-- seed/programs/knight-foundation.sql
-- Knight Foundation Arts & Tech Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'knight-foundation',
  'Knight Foundation Arts & Tech Grant',
  'Knight Foundation',
  'grant',
  'open',
  5000000,
  50000000,
  0.0,
  ARRAY['US'],
  ARRAY['arts', 'technology', 'media', 'journalism', 'community'],
  'Knight Foundation supports journalism, arts, and informed and engaged communities.',
  'https://knightfoundation.org/grants/',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Project description
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your project. What will you create, and how does it serve the public interest?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your project. What will you create, and how does it serve the public interest?', 'solution', 500, 1, 0.92, false, ARRAY['Knight Foundation Arts & Tech Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Knight Foundation Arts & Tech Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your project. What will you create, and how does it serve the public interest?', 500, true, 1, 'Project');

-- Q2: Communities served
SELECT id INTO q_id FROM archived_questions WHERE text = 'Who are the communities you serve, and how will this project benefit them?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Who are the communities you serve, and how will this project benefit them?', 'impact', 400, 1, 0.91, false, ARRAY['Knight Foundation Arts & Tech Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Knight Foundation Arts & Tech Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Who are the communities you serve, and how will this project benefit them?', 400, true, 2, 'Community Impact');

-- Q3: Timeline and success
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your timeline and how will you measure success?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your timeline and how will you measure success?', 'vision', 300, 1, 0.88, false, ARRAY['Knight Foundation Arts & Tech Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Knight Foundation Arts & Tech Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your timeline and how will you measure success?', 300, true, 3, 'Evaluation');

END $$;
