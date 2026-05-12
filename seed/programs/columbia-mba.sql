-- seed/programs/columbia-mba.sql
-- Columbia Business School MBA — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'columbia-mba',
  'Columbia Business School MBA',
  'Columbia University',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['mba', 'graduate', 'business', 'finance', 'new york'],
  'Columbia Business School MBA leverages its New York City location to connect students with the global epicenter of business, finance, and entrepreneurship.',
  'https://www8.gsb.columbia.edu/mba/admissions',
  false,
  'seeded',
  'school_professional'::opportunity_kind,
  'education'
);

-- Q1: Career goals and how CBS helps
SELECT id INTO q_id FROM archived_questions WHERE text = 'Through your resume and recommendations, we have a clear picture of your professional path to date. What are your short-term and long-term post-MBA goals, and how will Columbia Business School help you achieve them?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Through your resume and recommendations, we have a clear picture of your professional path to date. What are your short-term and long-term post-MBA goals, and how will Columbia Business School help you achieve them?', 'fit', 500, 1, 0.93, false, ARRAY['Columbia Business School MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Columbia Business School MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Through your resume and recommendations, we have a clear picture of your professional path to date. What are your short-term and long-term post-MBA goals, and how will Columbia Business School help you achieve them?', 500, true, 1, 'Essays');

-- Q2: Community contribution
SELECT id INTO q_id FROM archived_questions WHERE text = 'Columbia Business School''s location in New York City is an integral part of our program and deeply affects our culture. Tell us about a time you''ve been part of a community (neighborhood, city, school, sports team, etc.) that was central to your identity. How did you engage with and contribute to that community?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Columbia Business School''s location in New York City is an integral part of our program and deeply affects our culture. Tell us about a time you''ve been part of a community (neighborhood, city, school, sports team, etc.) that was central to your identity. How did you engage with and contribute to that community?', 'personal', 250, 1, 0.89, false, ARRAY['Columbia Business School MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Columbia Business School MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Columbia Business School''s location in New York City is an integral part of our program and deeply affects our culture. Tell us about a time you''ve been part of a community (neighborhood, city, school, sports team, etc.) that was central to your identity. How did you engage with and contribute to that community?', 250, true, 2, 'Essays');

END $$;
