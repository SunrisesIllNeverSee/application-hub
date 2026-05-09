-- seed/programs/doe-arpa-e.sql
-- DOE ARPA-E — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'doe-arpa-e',
  'DOE ARPA-E',
  'Department of Energy',
  'grant',
  'open',
  50000000,    -- $500k in cents
  1000000000,  -- $10M in cents
  0.0,
  ARRAY['US'],
  ARRAY['energy', 'climate', 'deeptech', 'advanced-manufacturing', 'grid', 'batteries', 'hydrogen'],
  'ARPA-E (Advanced Research Projects Agency-Energy) funds transformational energy technology projects that are too early for private investment but have the potential to radically change how the US generates, stores, and uses energy. Awards range from $500k to $10M for high-risk, high-reward energy R&D.',
  'https://arpa-e.energy.gov',
  false,
  'seeded'
);

-- Q1: Technology Description
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the proposed technology and how it works at a technical level.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the proposed technology and how it works at a technical level.', 'technical', 600, 1, 0.93, false, ARRAY['DOE ARPA-E'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'DOE ARPA-E') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the proposed technology and how it works at a technical level.', 600, true, 1, 'Technical');

-- Q2: Transformational Potential
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why is this technology potentially transformational for the US energy sector? What would change if it succeeds?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why is this technology potentially transformational for the US energy sector? What would change if it succeeds?', 'impact', 500, 1, 0.92, false, ARRAY['DOE ARPA-E'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'DOE ARPA-E') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why is this technology potentially transformational for the US energy sector? What would change if it succeeds?', 500, true, 2, 'Impact');

-- Q3: Why not funded privately
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why has private investment not funded this work? What technical or market barriers make this unsuitable for private investment today?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why has private investment not funded this work? What technical or market barriers make this unsuitable for private investment today?', 'fundraising', 400, 1, 0.88, false, ARRAY['DOE ARPA-E'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'DOE ARPA-E') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why has private investment not funded this work? What technical or market barriers make this unsuitable for private investment today?', 400, true, 3, 'Technical');

-- Q4: Technical Approach and Milestones
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the technical approach and what are the key milestones and go/no-go decision points?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the technical approach and what are the key milestones and go/no-go decision points?', 'technical', 600, 1, 0.91, false, ARRAY['DOE ARPA-E'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'DOE ARPA-E') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the technical approach and what are the key milestones and go/no-go decision points?', 600, true, 4, 'Technical');

-- Q5: Team expertise
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the team''s technical expertise and why they are qualified to execute this project.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the team''s technical expertise and why they are qualified to execute this project.', 'team', 400, 1, 0.88, false, ARRAY['DOE ARPA-E'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'DOE ARPA-E') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the team''s technical expertise and why they are qualified to execute this project.', 400, true, 5, 'Team');

-- Q6: Alignment with ARPA-E mission
SELECT id INTO q_id FROM archived_questions WHERE text = 'How does this project align with ARPA-E''s mission and the specific program topic area?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How does this project align with ARPA-E''s mission and the specific program topic area?', 'fit', 300, 1, 0.87, false, ARRAY['DOE ARPA-E'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'DOE ARPA-E') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How does this project align with ARPA-E''s mission and the specific program topic area?', 300, true, 6, 'Fit');

-- Q7: Path beyond ARPA-E
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the commercialization or technology transfer path after ARPA-E funding?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the commercialization or technology transfer path after ARPA-E funding?', 'vision', 300, 1, 0.86, false, ARRAY['DOE ARPA-E'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'DOE ARPA-E') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the commercialization or technology transfer path after ARPA-E funding?', 300, true, 7, 'Commercialization');

END $$;
