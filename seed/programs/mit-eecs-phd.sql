-- seed/programs/mit-eecs-phd.sql
-- MIT EECS PhD — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'mit-eecs-phd',
  'MIT EECS PhD',
  'Massachusetts Institute of Technology',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['phd', 'graduate', 'electrical engineering', 'computer science', 'research'],
  'MIT EECS PhD program is one of the world''s premier research programs in electrical engineering and computer science, fostering innovation across AI, systems, theory, and more.',
  'https://www.eecs.mit.edu/academics-admissions/graduate-program/admissions',
  false,
  'seeded',
  'school_grad'::opportunity_kind,
  'education'
);

-- Q1: Research experience and interests
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your research experience and interests. What do you hope to accomplish through your research?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your research experience and interests. What do you hope to accomplish through your research?', 'technical', 500, 1, 0.95, false, ARRAY['MIT EECS PhD'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MIT EECS PhD') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your research experience and interests. What do you hope to accomplish through your research?', 500, true, 1, 'Statement of Purpose');

-- Q2: Why MIT EECS specifically
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why are you applying to MIT EECS in particular? Are there specific research groups or faculty members whose work aligns with your interests?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why are you applying to MIT EECS in particular? Are there specific research groups or faculty members whose work aligns with your interests?', 'fit', 500, 1, 0.93, false, ARRAY['MIT EECS PhD'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MIT EECS PhD') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why are you applying to MIT EECS in particular? Are there specific research groups or faculty members whose work aligns with your interests?', 500, true, 2, 'Statement of Purpose');

END $$;
