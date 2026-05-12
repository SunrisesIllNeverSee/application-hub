-- seed/programs/kellogg-mba.sql
-- Kellogg MBA — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'kellogg-mba',
  'Kellogg MBA',
  'Northwestern University',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['mba', 'graduate', 'business', 'marketing', 'leadership'],
  'Kellogg School of Management MBA program is known for its collaborative culture, marketing strength, and emphasis on developing leaders who inspire growth in others.',
  'https://www.kellogg.northwestern.edu/programs/full-time-mba/admissions.aspx',
  false,
  'seeded',
  'school_professional'::opportunity_kind,
  'education'
);

-- Q1: Intended impact post-MBA
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your intended impact on business, your industry, or society during your post-MBA career?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your intended impact on business, your industry, or society during your post-MBA career?', 'vision', 450, 1, 0.92, false, ARRAY['Kellogg MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Kellogg MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your intended impact on business, your industry, or society during your post-MBA career?', 450, true, 1, 'Essays');

-- Q2: Leadership — inspiring others
SELECT id INTO q_id FROM archived_questions WHERE text = 'Kellogg leaders are defined by their ability to inspire growth in others and themselves. Tell us about a time you inspired others, and reflect on your leadership approach.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Kellogg leaders are defined by their ability to inspire growth in others and themselves. Tell us about a time you inspired others, and reflect on your leadership approach.', 'team', 450, 1, 0.91, false, ARRAY['Kellogg MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Kellogg MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Kellogg leaders are defined by their ability to inspire growth in others and themselves. Tell us about a time you inspired others, and reflect on your leadership approach.', 450, true, 2, 'Essays');

END $$;
