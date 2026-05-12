-- seed/programs/mit-media-lab.sql
-- MIT Media Lab — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'mit-media-lab',
  'MIT Media Lab',
  'Massachusetts Institute of Technology',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['ms', 'phd', 'graduate', 'design', 'technology', 'research', 'interdisciplinary'],
  'MIT Media Lab is a research lab and graduate program at the intersection of technology, media, design, and art, known for antidisciplinary research and speculative invention.',
  'https://www.media.mit.edu/graduate-program/',
  false,
  'seeded',
  'school_grad'::opportunity_kind,
  'education'
);

-- Q1: Research direction at Media Lab
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a research direction you''d like to pursue at the Media Lab. What unique perspective or approach would you bring?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a research direction you''d like to pursue at the Media Lab. What unique perspective or approach would you bring?', 'technical', 1000, 1, 0.94, false, ARRAY['MIT Media Lab'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MIT Media Lab') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a research direction you''d like to pursue at the Media Lab. What unique perspective or approach would you bring?', 1000, true, 1, 'Research Statement');

-- Q2: Career goals and Media Lab fit
SELECT id INTO q_id FROM archived_questions WHERE text = 'What are your career goals and how will the Media Lab help you achieve them?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What are your career goals and how will the Media Lab help you achieve them?', 'fit', 500, 1, 0.92, false, ARRAY['MIT Media Lab'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MIT Media Lab') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What are your career goals and how will the Media Lab help you achieve them?', 500, true, 2, 'Research Statement');

END $$;
