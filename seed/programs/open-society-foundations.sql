-- seed/programs/open-society-foundations.sql
-- Open Society Foundations Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'open-society-foundations',
  'Open Society Foundations Grant',
  'Open Society Foundations',
  'grant',
  'open',
  5000000,
  500000000,
  0.0,
  ARRAY['Global'],
  ARRAY['democracy', 'human-rights', 'justice', 'civil-society'],
  'Open Society Foundations work to build vibrant and tolerant democracies whose governments are accountable to their citizens.',
  'https://www.opensocietyfoundations.org/grants',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Rights/justice issue
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the rights, justice, or governance issue you are addressing.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the rights, justice, or governance issue you are addressing.', 'problem', 500, 1, 0.92, false, ARRAY['Open Society Foundations Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Open Society Foundations Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the rights, justice, or governance issue you are addressing.', 500, true, 1, 'Issue');

-- Q2: Open society values
SELECT id INTO q_id FROM archived_questions WHERE text = 'How does your work advance open society values?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How does your work advance open society values?', 'fit', 400, 1, 0.90, false, ARRAY['Open Society Foundations Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Open Society Foundations Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How does your work advance open society values?', 400, true, 2, 'Values Alignment');

-- Q3: Theory of change and opposition
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your theory of change, and what opposition do you expect?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your theory of change, and what opposition do you expect?', 'vision', 400, 1, 0.91, false, ARRAY['Open Society Foundations Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Open Society Foundations Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your theory of change, and what opposition do you expect?', 400, true, 3, 'Theory of Change');

END $$;
