-- seed/programs/stanford-cs-ms.sql
-- Stanford MS Computer Science — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'stanford-cs-ms',
  'Stanford MS Computer Science',
  'Stanford University',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['ms', 'graduate', 'computer science', 'technology', 'research'],
  'Stanford MS in Computer Science offers rigorous technical training and research opportunities in areas including AI, systems, theory, and human-computer interaction.',
  'https://cs.stanford.edu/academics/masters',
  false,
  'seeded',
  'school_grad'::opportunity_kind,
  'education'
);

-- Q1: Purpose and research interests
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your purpose in pursuing a graduate degree? Please describe your scholarly and research interests, any relevant experience, and your intended area of study.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your purpose in pursuing a graduate degree? Please describe your scholarly and research interests, any relevant experience, and your intended area of study.', 'fit', 1000, 1, 0.94, false, ARRAY['Stanford MS Computer Science'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Stanford MS Computer Science') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your purpose in pursuing a graduate degree? Please describe your scholarly and research interests, any relevant experience, and your intended area of study.', 1000, true, 1, 'Statement of Purpose');

-- Q2: Background and motivation for graduate study
SELECT id INTO q_id FROM archived_questions WHERE text = 'How have your background and life experiences, including cultural, geographical, financial, educational, or other opportunities or challenges, motivated your decision to pursue a graduate degree at Stanford?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How have your background and life experiences, including cultural, geographical, financial, educational, or other opportunities or challenges, motivated your decision to pursue a graduate degree at Stanford?', 'personal', 250, 1, 0.88, false, ARRAY['Stanford MS Computer Science'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Stanford MS Computer Science') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How have your background and life experiences, including cultural, geographical, financial, educational, or other opportunities or challenges, motivated your decision to pursue a graduate degree at Stanford?', 250, true, 2, 'Diversity Statement');

END $$;
