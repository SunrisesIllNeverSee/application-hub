-- seed/programs/gates-cambridge.sql
-- Gates Cambridge Scholarship — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'gates-cambridge',
  'Gates Cambridge Scholarship',
  'Gates Cambridge Trust',
  'fellowship',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['scholarship', 'cambridge', 'leadership', 'social impact', 'research'],
  'Gates Cambridge Scholarships are awarded to outstanding applicants from countries outside the UK to pursue postgraduate study at the University of Cambridge.',
  'https://www.gatescambridge.org/',
  false,
  'seeded',
  'fellowship'::opportunity_kind,
  'education'
);

-- Q1: Why Gates Cambridge and selection criteria
SELECT id INTO q_id FROM archived_questions WHERE text = 'Gates Cambridge Scholars are selected on the basis of intellectual ability, leadership potential, commitment to improving the lives of others, and fit with Cambridge. Please describe your reasons for applying and how they relate to these criteria.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Gates Cambridge Scholars are selected on the basis of intellectual ability, leadership potential, commitment to improving the lives of others, and fit with Cambridge. Please describe your reasons for applying and how they relate to these criteria.', 'fit', 600, 1, 0.96, false, ARRAY['Gates Cambridge Scholarship'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Gates Cambridge Scholarship') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Gates Cambridge Scholars are selected on the basis of intellectual ability, leadership potential, commitment to improving the lives of others, and fit with Cambridge. Please describe your reasons for applying and how they relate to these criteria.', 600, true, 1, 'Personal Statement');

END $$;
