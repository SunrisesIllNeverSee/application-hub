-- seed/programs/darden-mba.sql
-- UVA Darden MBA — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'darden-mba',
  'UVA Darden MBA',
  'University of Virginia',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['mba', 'graduate', 'business', 'case method', 'leadership'],
  'UVA Darden MBA uses a case method learning approach and residential community to develop confident, creative leaders who are ready to make a difference from day one.',
  'https://www.darden.virginia.edu/mba/full-time/application-process',
  false,
  'seeded',
  'school_professional'::opportunity_kind,
  'education'
);

-- Q1: Who are you beyond professional experience
SELECT id INTO q_id FROM archived_questions WHERE text = 'What makes you who you are? We know that you are more than your professional experiences; Darden has always been a place that values the whole person. Share something about yourself that is not captured elsewhere in your application.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What makes you who you are? We know that you are more than your professional experiences; Darden has always been a place that values the whole person. Share something about yourself that is not captured elsewhere in your application.', 'personal', 250, 1, 0.92, false, ARRAY['UVA Darden MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'UVA Darden MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What makes you who you are? We know that you are more than your professional experiences; Darden has always been a place that values the whole person. Share something about yourself that is not captured elsewhere in your application.', 250, true, 1, 'Essays');

END $$;
