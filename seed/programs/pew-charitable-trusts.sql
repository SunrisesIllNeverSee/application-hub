-- seed/programs/pew-charitable-trusts.sql
-- Pew Charitable Trusts Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'pew-charitable-trusts',
  'Pew Charitable Trusts Grant',
  'Pew Charitable Trusts',
  'grant',
  'open',
  10000000,
  500000000,
  0.0,
  ARRAY['US', 'Global'],
  ARRAY['environment', 'public-health', 'science', 'democracy', 'arts'],
  'Pew Charitable Trusts applies a rigorous, analytical approach to improve public policy, inform the public, and invigorate civic life.',
  'https://www.pewtrusts.org/en/projects/grants',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Problem and public importance
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the problem your project addresses and its importance to the public interest.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the problem your project addresses and its importance to the public interest.', 'problem', 600, 1, 0.92, false, ARRAY['Pew Charitable Trusts Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Pew Charitable Trusts Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the problem your project addresses and its importance to the public interest.', 600, true, 1, 'Problem');

-- Q2: Approach and evidence
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your approach and what evidence supports its effectiveness?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your approach and what evidence supports its effectiveness?', 'solution', 600, 1, 0.92, false, ARRAY['Pew Charitable Trusts Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Pew Charitable Trusts Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your approach and what evidence supports its effectiveness?', 600, true, 2, 'Approach');

END $$;
