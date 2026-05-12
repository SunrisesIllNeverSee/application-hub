-- seed/programs/ross-mba.sql
-- Ross School of Business MBA — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'ross-mba',
  'Ross School of Business MBA',
  'University of Michigan',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['mba', 'graduate', 'business', 'leadership', 'action learning'],
  'Michigan Ross MBA program is known for its action-based learning approach, positive organizational scholarship, and developing leaders who make a positive difference in the world.',
  'https://michiganross.umich.edu/programs/mba/admissions',
  false,
  'seeded',
  'school_professional'::opportunity_kind,
  'education'
);

-- Q1: Professional challenge and lessons learned
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a situation in your professional experience where you faced a significant problem or challenge, what you did about it, and what you learned about yourself as a result of your actions.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a situation in your professional experience where you faced a significant problem or challenge, what you did about it, and what you learned about yourself as a result of your actions.', 'personal', 300, 1, 0.91, false, ARRAY['Ross School of Business MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Ross School of Business MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a situation in your professional experience where you faced a significant problem or challenge, what you did about it, and what you learned about yourself as a result of your actions.', 300, true, 1, 'Essays');

-- Q2: Diversity contribution
SELECT id INTO q_id FROM archived_questions WHERE text = 'At Ross, we value diversity and the expression of diverse perspectives. What experiences, beliefs, and/or perspectives do you bring that would contribute to diversity at Ross?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'At Ross, we value diversity and the expression of diverse perspectives. What experiences, beliefs, and/or perspectives do you bring that would contribute to diversity at Ross?', 'personal', 150, 1, 0.88, false, ARRAY['Ross School of Business MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Ross School of Business MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'At Ross, we value diversity and the expression of diverse perspectives. What experiences, beliefs, and/or perspectives do you bring that would contribute to diversity at Ross?', 150, true, 2, 'Essays');

END $$;
