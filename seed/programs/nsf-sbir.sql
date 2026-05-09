-- seed/programs/nsf-sbir.sql
-- NSF SBIR — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'nsf-sbir',
  'NSF SBIR/STTR',
  'National Science Foundation',
  'grant',
  'open',
  27500000,   -- $275k in cents (Phase I)
  200000000,  -- $2M in cents (Phase II)
  0.0,
  ARRAY['US'],
  ARRAY['deeptech', 'biotech', 'ai', 'climate', 'energy', 'health', 'advanced-manufacturing'],
  'The NSF SBIR/STTR program funds transformative science and engineering research with commercial potential. NSF focuses on high-risk, high-reward fundamental innovation. Phase I awards up to $275k to establish feasibility; Phase II awards up to $2M for full R&D.',
  'https://seedfund.nsf.gov',
  true,
  'seeded'
);

-- Q1: Technical Innovation
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the core technical innovation? What makes it novel compared to the state of the art?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the core technical innovation? What makes it novel compared to the state of the art?', 'technical', 500, 1, 0.93, false, ARRAY['NSF SBIR'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NSF SBIR') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the core technical innovation? What makes it novel compared to the state of the art?', 500, true, 1, 'Technical');

-- Q2: Scientific Merit
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the scientific merit of the proposed research. What fundamental scientific questions does this work address?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the scientific merit of the proposed research. What fundamental scientific questions does this work address?', 'technical', 500, 1, 0.90, false, ARRAY['NSF SBIR'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NSF SBIR') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the scientific merit of the proposed research. What fundamental scientific questions does this work address?', 500, true, 2, 'Technical');

-- Q3: Broader Impact
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the broader societal impact of this research? Who benefits and how?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the broader societal impact of this research? Who benefits and how?', 'impact', 400, 1, 0.88, false, ARRAY['NSF SBIR'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NSF SBIR') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the broader societal impact of this research? Who benefits and how?', 400, true, 3, 'Impact');

-- Q4: Commercialization Plan
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your commercialization plan, including target market, customers, and path to market.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your commercialization plan, including target market, customers, and path to market.', 'market', 500, 1, 0.91, false, ARRAY['NSF SBIR'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NSF SBIR') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your commercialization plan, including target market, customers, and path to market.', 500, true, 4, 'Commercialization');

-- Q5: PI Qualifications
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the Principal Investigator''s qualifications and relevant research background.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the Principal Investigator''s qualifications and relevant research background.', 'team', 300, 1, 0.85, false, ARRAY['NSF SBIR'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NSF SBIR') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the Principal Investigator''s qualifications and relevant research background.', 300, true, 5, 'Team');

-- Q6: Specific Aims
SELECT id INTO q_id FROM archived_questions WHERE text = 'List the specific aims or research objectives for the Phase I period.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'List the specific aims or research objectives for the Phase I period.', 'technical', 400, 1, 0.90, false, ARRAY['NSF SBIR'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NSF SBIR') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'List the specific aims or research objectives for the Phase I period.', 400, true, 6, 'Technical');

-- Q7: Literature Review
SELECT id INTO q_id FROM archived_questions WHERE text = 'Summarize the relevant prior art or literature and how your approach differs.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Summarize the relevant prior art or literature and how your approach differs.', 'technical', 400, 1, 0.82, false, ARRAY['NSF SBIR'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NSF SBIR') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Summarize the relevant prior art or literature and how your approach differs.', 400, true, 7, 'Technical');

-- Q8: Risk and Mitigation
SELECT id INTO q_id FROM archived_questions WHERE text = 'What are the primary technical risks and how will you mitigate or address them?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What are the primary technical risks and how will you mitigate or address them?', 'technical', 300, 1, 0.85, false, ARRAY['NSF SBIR'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NSF SBIR') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What are the primary technical risks and how will you mitigate or address them?', 300, true, 8, 'Technical');

END $$;
