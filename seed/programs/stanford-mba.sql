-- seed/programs/stanford-mba.sql
-- Stanford GSB MBA — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'stanford-mba',
  'Stanford GSB MBA',
  'Stanford University',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['mba', 'graduate', 'business', 'entrepreneurship'],
  'Stanford Graduate School of Business MBA program emphasizes personal transformation and developing innovative leaders with a global perspective.',
  'https://www.gsb.stanford.edu/programs/mba/admission',
  false,
  'seeded',
  'school_professional'::opportunity_kind,
  'education'
);

-- Q1: What matters most to you, and why
SELECT id INTO q_id FROM archived_questions WHERE text = 'What matters most to you, and why?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What matters most to you, and why?', 'personal', 650, 1, 0.97, false, ARRAY['Stanford GSB MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Stanford GSB MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What matters most to you, and why?', 650, true, 1, 'Essays');

-- Q2: Why Stanford
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Stanford?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Stanford?', 'fit', 400, 1, 0.93, false, ARRAY['Stanford GSB MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Stanford GSB MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Stanford?', 400, true, 2, 'Essays');

END $$;
