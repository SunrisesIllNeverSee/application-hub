-- seed/programs/marshall-scholarship.sql
-- Marshall Scholarship — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'marshall-scholarship',
  'Marshall Scholarship',
  'Marshall Aid Commemoration Commission',
  'fellowship',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['scholarship', 'uk', 'leadership', 'academic excellence', 'service'],
  'Marshall Scholarships are awarded to outstanding young Americans to pursue postgraduate study in the United Kingdom, honoring the contribution of the Marshall Plan.',
  'https://www.marshallscholarship.org/',
  false,
  'seeded',
  'fellowship'::opportunity_kind,
  'education'
);

-- Q1: Why study in UK
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why do you wish to study in the United Kingdom? Please describe your proposed programme of study and explain why it is the right programme for your academic and personal development.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why do you wish to study in the United Kingdom? Please describe your proposed programme of study and explain why it is the right programme for your academic and personal development.', 'fit', 500, 1, 0.95, false, ARRAY['Marshall Scholarship'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Marshall Scholarship') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why do you wish to study in the United Kingdom? Please describe your proposed programme of study and explain why it is the right programme for your academic and personal development.', 500, true, 1, 'Essays');

-- Q2: Leadership roles and impact
SELECT id INTO q_id FROM archived_questions WHERE text = 'Outline the nature and scope of leadership roles you have held and the impact you have made through these roles.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Outline the nature and scope of leadership roles you have held and the impact you have made through these roles.', 'team', 500, 1, 0.93, false, ARRAY['Marshall Scholarship'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Marshall Scholarship') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Outline the nature and scope of leadership roles you have held and the impact you have made through these roles.', 500, true, 2, 'Essays');

END $$;
