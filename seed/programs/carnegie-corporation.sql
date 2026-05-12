-- seed/programs/carnegie-corporation.sql
-- Carnegie Corporation of New York Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'carnegie-corporation',
  'Carnegie Corporation of New York Grant',
  'Carnegie Corporation of New York',
  'grant',
  'open',
  5000000,
  300000000,
  0.0,
  ARRAY['US', 'Global'],
  ARRAY['education', 'democracy', 'international-peace', 'higher-education'],
  'Carnegie Corporation of New York promotes the advancement and diffusion of knowledge and understanding, strengthening democracy, international peace, and education.',
  'https://www.carnegie.org/grants/',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Mission alignment
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe how your project will strengthen democracy, advance international peace, or promote education.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe how your project will strengthen democracy, advance international peace, or promote education.', 'fit', 600, 1, 0.91, false, ARRAY['Carnegie Corporation of New York Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Carnegie Corporation of New York Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe how your project will strengthen democracy, advance international peace, or promote education.', 600, true, 1, 'Mission Alignment');

-- Q2: Evidence base
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the evidence base for your approach?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the evidence base for your approach?', 'solution', 500, 1, 0.90, false, ARRAY['Carnegie Corporation of New York Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Carnegie Corporation of New York Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the evidence base for your approach?', 500, true, 2, 'Evidence');

-- Q3: Systemic or enduring change
SELECT id INTO q_id FROM archived_questions WHERE text = 'How will your project create systemic or enduring change?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How will your project create systemic or enduring change?', 'vision', 400, 1, 0.91, false, ARRAY['Carnegie Corporation of New York Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Carnegie Corporation of New York Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How will your project create systemic or enduring change?', 400, true, 3, 'Systemic Change');

END $$;
