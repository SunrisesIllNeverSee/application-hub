-- seed/programs/cmu-scs-ms.sql
-- Carnegie Mellon MS Computer Science — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'cmu-scs-ms',
  'Carnegie Mellon MS Computer Science',
  'Carnegie Mellon University',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['ms', 'graduate', 'computer science', 'technology', 'research'],
  'Carnegie Mellon School of Computer Science MS program is a world leader in computer science research and education, known for AI, robotics, security, and software engineering.',
  'https://www.scs.cmu.edu/academics/masters',
  false,
  'seeded',
  'school_grad'::opportunity_kind,
  'education'
);

-- Q1: Research and professional experience
SELECT id INTO q_id FROM archived_questions WHERE text = 'Please describe your research and/or professional experience in computer science. How has this prepared you for graduate study?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Please describe your research and/or professional experience in computer science. How has this prepared you for graduate study?', 'technical', 500, 1, 0.93, false, ARRAY['Carnegie Mellon MS Computer Science'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Carnegie Mellon MS Computer Science') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Please describe your research and/or professional experience in computer science. How has this prepared you for graduate study?', 500, true, 1, 'Statement of Purpose');

-- Q2: Career goals and how CMU helps
SELECT id INTO q_id FROM archived_questions WHERE text = 'What are your career goals and how will graduate study at CMU help you achieve them?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What are your career goals and how will graduate study at CMU help you achieve them?', 'fit', 500, 1, 0.91, false, ARRAY['Carnegie Mellon MS Computer Science'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Carnegie Mellon MS Computer Science') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What are your career goals and how will graduate study at CMU help you achieve them?', 500, true, 2, 'Statement of Purpose');

END $$;
