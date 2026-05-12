-- seed/programs/company-spotify.sql
-- Spotify Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-spotify',
  'Spotify Application',
  'Spotify',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['tech', 'streaming', 'music', 'audio', 'media'],
  'Spotify application questions asked across their Greenhouse application portal for engineering, product, design, and data roles.',
  'https://www.lifeatspotify.com',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why Spotify?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Spotify?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Spotify?', 'fit', 300, 1, 0.92, false, ARRAY['Spotify Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Spotify Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Spotify?', 300, true, 1, 'Application Questions');

-- Q2: Tell me about a project where user experience was central to
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a project where user experience was central to your work.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a project where user experience was central to your work.', 'personal', 400, 1, 0.9, false, ARRAY['Spotify Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Spotify Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a project where user experience was central to your work.', 400, true, 2, 'Application Questions');

-- Q3: Describe a time you used data and intuition together to make
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time you used data and intuition together to make a decision.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time you used data and intuition together to make a decision.', 'personal', 400, 1, 0.89, false, ARRAY['Spotify Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Spotify Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time you used data and intuition together to make a decision.', 400, true, 3, 'Application Questions');

-- Q4: Tell me about a creative problem you solved.
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a creative problem you solved.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a creative problem you solved.', 'personal', 400, 1, 0.88, false, ARRAY['Spotify Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Spotify Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a creative problem you solved.', 400, true, 4, 'Application Questions');

-- Q5: What does music or audio mean to culture, in your view?
SELECT id INTO q_id FROM archived_questions WHERE text = 'What does music or audio mean to culture, in your view?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What does music or audio mean to culture, in your view?', 'vision', 400, 1, 0.87, false, ARRAY['Spotify Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Spotify Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What does music or audio mean to culture, in your view?', 400, true, 5, 'Application Questions');

END $$;