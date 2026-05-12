-- seed/programs/harvard-mba.sql
-- Harvard Business School MBA — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'harvard-mba',
  'Harvard Business School MBA',
  'Harvard University',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['mba', 'graduate', 'business', 'leadership'],
  'Harvard Business School offers a two-year full-time MBA program focused on case method learning and developing leaders who make a difference in the world.',
  'https://www.hbs.edu/mba/admissions/application-process/Pages/default.aspx',
  false,
  'seeded',
  'school_professional'::opportunity_kind,
  'education'
);

-- Q1: Why MBA, Why HBS, Why now
SELECT id INTO q_id FROM archived_questions WHERE text = 'As we review your application, what more would you like us to know as we consider your candidacy for the Harvard Business School MBA program?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'As we review your application, what more would you like us to know as we consider your candidacy for the Harvard Business School MBA program?', 'fit', 900, 1, 0.95, false, ARRAY['Harvard Business School MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Harvard Business School MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'As we review your application, what more would you like us to know as we consider your candidacy for the Harvard Business School MBA program?', 900, true, 1, 'Essays');

END $$;
