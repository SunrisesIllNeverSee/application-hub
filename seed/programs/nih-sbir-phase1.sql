-- seed/programs/nih-sbir-phase1.sql
-- NIH SBIR Phase I — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'nih-sbir-phase1',
  'NIH SBIR Phase I',
  'National Institutes of Health',
  'grant',
  'open',
  27500000,
  27500000,
  0.0,
  ARRAY['US'],
  ARRAY['biotech', 'health', 'medical-devices', 'life-sciences'],
  'NIH Small Business Innovation Research Phase I grants fund early-stage research and development of commercially promising health-related technologies.',
  'https://sbir.nih.gov/funding/funding-opportunities',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Specific aims
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the specific aims of the proposed research. What is the scientific question being addressed?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the specific aims of the proposed research. What is the scientific question being addressed?', 'problem', 350, 1, 0.95, false, ARRAY['NIH SBIR Phase I'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NIH SBIR Phase I') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the specific aims of the proposed research. What is the scientific question being addressed?', 350, true, 1, 'Specific Aims');

-- Q2: Significance
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the significance of the research. Why is it important?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the significance of the research. Why is it important?', 'impact', 750, 1, 0.93, false, ARRAY['NIH SBIR Phase I'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NIH SBIR Phase I') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the significance of the research. Why is it important?', 750, true, 2, 'Research Strategy');

-- Q3: Innovation
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the innovation? How does this work represent a novel approach?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the innovation? How does this work represent a novel approach?', 'solution', 750, 1, 0.93, false, ARRAY['NIH SBIR Phase I'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NIH SBIR Phase I') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the innovation? How does this work represent a novel approach?', 750, true, 3, 'Research Strategy');

-- Q4: Approach
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your approach. What are your milestones and how will you measure success?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your approach. What are your milestones and how will you measure success?', 'technical', 750, 1, 0.92, false, ARRAY['NIH SBIR Phase I'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NIH SBIR Phase I') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your approach. What are your milestones and how will you measure success?', 750, true, 4, 'Research Strategy');

-- Q5: Commercialization
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the potential for commercial success? Describe your go-to-market strategy.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the potential for commercial success? Describe your go-to-market strategy.', 'business_model', 500, 1, 0.90, false, ARRAY['NIH SBIR Phase I'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NIH SBIR Phase I') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the potential for commercial success? Describe your go-to-market strategy.', 500, true, 5, 'Commercialization Plan');

END $$;
