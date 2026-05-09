-- seed/programs/sbir-phase-1.sql
-- SBIR Phase I — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'sbir-phase-1',
  'SBIR Phase I',
  'Small Business Administration',
  'grant',
  'open',
  15000000,   -- $150k in cents (typical Phase I)
  27500000,   -- $275k in cents
  0.0,
  ARRAY['US'],
  ARRAY['deeptech', 'defense', 'health', 'energy', 'climate', 'biotech', 'ai'],
  'The Small Business Innovation Research (SBIR) program is a competitive federal grant program that encourages US small businesses to engage in R&D with the potential for commercialization. Phase I awards are $150k–$275k for 6 months to establish technical merit and feasibility of proposed R&D.',
  'https://www.sbir.gov',
  true,
  'seeded'
);

-- Q1: Project Title
SELECT id INTO q_id FROM archived_questions WHERE text = 'Provide a concise and descriptive project title.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Provide a concise and descriptive project title.', 'solution', 15, 1, 0.70, false, ARRAY['SBIR Phase I'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'SBIR Phase I') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Provide a concise and descriptive project title.', 15, true, 1, 'Cover');

-- Q2: Project Summary / Abstract
SELECT id INTO q_id FROM archived_questions WHERE text = 'Provide a project summary that describes the problem, proposed solution, and anticipated outcomes. (Project Abstract)' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Provide a project summary that describes the problem, proposed solution, and anticipated outcomes. (Project Abstract)', 'solution', 200, 1, 0.90, false, ARRAY['SBIR Phase I'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'SBIR Phase I') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Provide a project summary that describes the problem, proposed solution, and anticipated outcomes. (Project Abstract)', 200, true, 2, 'Cover');

-- Q3: Identification and Significance of the Problem
SELECT id INTO q_id FROM archived_questions WHERE text = 'Identify and describe the technical problem or opportunity being addressed. Why is it significant?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Identify and describe the technical problem or opportunity being addressed. Why is it significant?', 'problem', 500, 1, 0.92, false, ARRAY['SBIR Phase I'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'SBIR Phase I') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Identify and describe the technical problem or opportunity being addressed. Why is it significant?', 500, true, 3, 'Technical');

-- Q4: Technical Objectives
SELECT id INTO q_id FROM archived_questions WHERE text = 'State the specific technical objectives and questions to be answered in Phase I.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'State the specific technical objectives and questions to be answered in Phase I.', 'technical', 400, 1, 0.90, false, ARRAY['SBIR Phase I'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'SBIR Phase I') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'State the specific technical objectives and questions to be answered in Phase I.', 400, true, 4, 'Technical');

-- Q5: Work Plan
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the R&D work plan, including tasks, milestones, and timeline.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the R&D work plan, including tasks, milestones, and timeline.', 'technical', 700, 1, 0.88, false, ARRAY['SBIR Phase I'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'SBIR Phase I') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the R&D work plan, including tasks, milestones, and timeline.', 700, true, 5, 'Technical');

-- Q6: Innovation and Technical Merit
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the innovation and why your technical approach is novel compared to existing solutions.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the innovation and why your technical approach is novel compared to existing solutions.', 'technical', 500, 1, 0.92, false, ARRAY['SBIR Phase I'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'SBIR Phase I') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the innovation and why your technical approach is novel compared to existing solutions.', 500, true, 6, 'Technical');

-- Q7: Commercialization Potential
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the commercial potential of the proposed R&D, including target markets and customers.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the commercial potential of the proposed R&D, including target markets and customers.', 'market', 500, 1, 0.90, false, ARRAY['SBIR Phase I'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'SBIR Phase I') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the commercial potential of the proposed R&D, including target markets and customers.', 500, true, 7, 'Commercialization');

-- Q8: Qualifications of the Research Team
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the qualifications of the key personnel and their relevant research experience.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the qualifications of the key personnel and their relevant research experience.', 'team', 400, 1, 0.88, false, ARRAY['SBIR Phase I'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'SBIR Phase I') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the qualifications of the key personnel and their relevant research experience.', 400, true, 8, 'Team');

-- Q9: Facilities and Resources
SELECT id INTO q_id FROM archived_questions WHERE text = 'What facilities, equipment, and resources are available to conduct the proposed research?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What facilities, equipment, and resources are available to conduct the proposed research?', 'technical', 300, 1, 0.75, false, ARRAY['SBIR Phase I'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'SBIR Phase I') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What facilities, equipment, and resources are available to conduct the proposed research?', 300, true, 9, 'Technical');

-- Q10: Intellectual Property
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe any existing intellectual property, patents, or proprietary technology related to this project.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe any existing intellectual property, patents, or proprietary technology related to this project.', 'technical', 300, 1, 0.80, false, ARRAY['SBIR Phase I'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'SBIR Phase I') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe any existing intellectual property, patents, or proprietary technology related to this project.', 300, true, 10, 'Commercialization');

-- Q11: Budget Justification
SELECT id INTO q_id FROM archived_questions WHERE text = 'Provide a detailed budget justification for all requested costs.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Provide a detailed budget justification for all requested costs.', 'fundraising', 400, 1, 0.78, false, ARRAY['SBIR Phase I'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'SBIR Phase I') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Provide a detailed budget justification for all requested costs.', 400, true, 11, 'Budget');

-- Q12: Phase II Potential
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the anticipated scope and budget of Phase II, and what milestones would trigger a Phase II application?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the anticipated scope and budget of Phase II, and what milestones would trigger a Phase II application?', 'vision', 300, 1, 0.82, false, ARRAY['SBIR Phase I'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'SBIR Phase I') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the anticipated scope and budget of Phase II, and what milestones would trigger a Phase II application?', 300, true, 12, 'Commercialization');

END $$;
