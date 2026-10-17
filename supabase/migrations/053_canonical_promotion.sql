-- ============================================================
-- 053 — Canonical catalog promotion (M08)
-- ============================================================
-- STATUS: PREPARED — DO NOT APPLY without separate owner
-- prod-exec-auth. Requires 052 applied first ('canonical' enum).
--
-- Owner-approved records only (decisions m08:c1–c5, 2026-10-15):
--   * yc-summer-2026 — Y Combinator — Summer 2026
--   * founding-500 — The Founding 500
--   * redbud-vc — Redbud VC — Pitch Us
--   * cyberfund-monastery — cyber.fund — The Monastery
--   * 3xcapital — 3xCapital — Startup Submission
--
-- Verbatim questions transcribed from qaapplication/ evidence
-- (generator: qaapplication/src/gen-canonical-053.mjs).
-- NO answers are promoted — answers stay in private custody.
-- NO FundingCake, NO synthetic seed content, NO inherited
-- scores/stats: asked_by_count reflects real records only,
-- significance/score columns are left at neutral defaults.
-- Idempotent: ON CONFLICT on slugs/text makes reruns safe.
-- ============================================================

BEGIN;

-- 1. Programs (canonical)
INSERT INTO programs (slug, name, organization, type, status, round, url, description, source, is_rolling, geo_focus, industry_tags, domain)
VALUES ('yc-summer-2026', 'Y Combinator — Summer 2026', 'Y Combinator', 'accel', 'closed', NULL, 'https://www.ycombinator.com/', 'Y Combinator Summer 2026 batch application (custom apply portal). Canonical record derived from the submitted application evidence in qaapplication/ (raw form DOM + portal export).', 'canonical', false, '{"Global"}', '{"startups","pre-seed"}', 'founder')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO programs (slug, name, organization, type, status, round, url, description, source, is_rolling, geo_focus, industry_tags, domain)
VALUES ('founding-500', 'The Founding 500', 'Hyperagent', 'accel', 'open', NULL, 'https://hyperagent.com/', 'Hyperagent-operated cohort program for agent-first founders (Airtable form). Canonical record derived from raw form DOM + submitted answers in qaapplication/.', 'canonical', true, '{"US","Global"}', '{"agents","pre-seed","cohort"}', 'founder')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO programs (slug, name, organization, type, status, round, url, description, source, is_rolling, geo_focus, industry_tags, domain)
VALUES ('redbud-vc', 'Redbud VC — Pitch Us', 'Redbud VC', 'vc', 'open', NULL, 'https://redbud.vc', 'Redbud VC "Pitch Us" intake (Tally). Canonical record derived from raw Tally DOM + submitted answers in qaapplication/. Q27–Q30 are asset/attribution fields.', 'canonical', true, '{"US"}', '{"pre-seed","seed","middle-america"}', 'founder')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO programs (slug, name, organization, type, status, round, url, description, source, is_rolling, geo_focus, industry_tags, domain)
VALUES ('cyberfund-monastery', 'cyber.fund — The Monastery', 'cyber.fund', 'fellowship', 'open', NULL, 'https://cyber.fund/content/monastery', 'cyber.fund Monastery residency for AI-native founders ($2M uncapped SAFE, 12 weeks hybrid). Conversational application via proprietary agent; canonical record derived from the verbatim interaction transcript.', 'canonical', true, '{"Global"}', '{"ai-native","fellowship","residency"}', 'founder')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO programs (slug, name, organization, type, status, round, url, description, source, is_rolling, geo_focus, industry_tags, domain)
VALUES ('3xcapital', '3xCapital — Startup Submission', '3xCapital', 'vc', 'open', NULL, 'https://3xcapital.fund', '3xCapital startup submission (Tally). Canonical record derived from raw Tally page capture + submitted answers. Note: the sector select (DeFi/Infrastructure/Web2-to-Web3/Metaverse/GameFi/L1/L2/NFT/Other) was deliberately left unselected at submission — Web3-default taxonomy.', 'canonical', true, '{"Global"}', '{"pre-seed","seed"}', 'founder')
ON CONFLICT (slug) DO NOTHING;

-- 2. Canonical questions (real verbatim only; deduped across programs)
-- 000
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('1b57fa6f-183c-4017-89f3-0d2008e22234', 'Company / project name', 'applicant', 'text_short', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 001
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('763d2c9d-a6be-458b-8198-810142d2b523', 'What batch do you want to apply for?', 'attribution', 'multiple_choice', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 002
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('a84d822c-bb6a-45d1-8ca4-99c90d9e7e21', 'Are you looking for a cofounder?', 'team', 'yes_no', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 003
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('24d73c63-42a0-4e22-8a2b-34f46418f4e1', 'Cofounder info', 'team', 'text_long', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 004
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('b6944fcb-64b9-49ee-82fd-22f3dcbe3f9a', 'Other co-founders / team', 'team', 'text_long', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 005
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('f8ef8b5b-e684-4af7-8b79-392b908d6ef4', 'Who writes code, or does other technical work on your product? Was any of it done by a non-founder? Please explain.', 'team', 'text_long', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 006
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('1e99e45d-f978-4e8c-8236-556aed8ecf81', 'Describe what your company does in 50 characters or less.', 'idea', 'text_short', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 007
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('b86280f0-4312-43a5-8e7b-00a8311e1929', 'What is your company going to make? Please describe your product and what it does or will do.', 'idea', 'text_long', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 008
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('2f0aceb5-42e2-4fb7-8c44-7b1ea82f7e6d', 'What tech stack are you using, or planning to use, to build this product? Include AI models and AI coding tools you use.', 'product', 'text_long', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 009
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('abf29a15-8efb-4978-824d-0fb65b2e549a', 'Please provide a link to the product, if any.', 'product', 'url', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 010
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('49530f45-67e3-4606-81da-ed6cf715d82d', 'If login credentials are required for the link above, enter them here.', 'product', 'text_short', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 011
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('39beafbd-3f0a-469e-83c3-16818cbcb0ee', 'Why did you pick this idea to work on? Do you have domain expertise in this area? How do you know people need what you''re making?', 'idea', 'text_long', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 012
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('44d5a468-8054-498c-8b48-053ffbc07314', 'If you are applying with the same idea as a previous batch, did anything change? If you applied with a different idea, why did you pivot and what did you learn from the last idea?', 'idea', 'text_long', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 013
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('3b0e7908-6763-4cd7-832e-1ff5513f193a', 'How far along are you?', 'traction', 'text_long', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 014
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('f44202a5-ddef-4bd0-8fbc-a22bb513bff6', 'How long have each of you been working on this? How much of that has been full-time? Please explain.', 'traction', 'text_long', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 015
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('d106c16d-8437-4cbc-8f14-f41b12db0333', 'Have you formed ANY legal entity yet?', 'company', 'yes_no', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 016
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('61cff54d-d743-4ea5-8483-dd1799a011a6', 'Are people using your product?', 'product', 'yes_no', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 017
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('22f85078-bb56-4ad3-8992-99375fc98f63', 'Do you have revenue?', 'traction', 'yes_no', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 018
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('f5035b17-0660-476b-8cc6-aa69ef7dcdd4', 'Worked together before?', 'team', 'yes_no', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 019
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('54448f3f-9311-43d3-8bf8-14afd49b7d16', 'How do or will you make money? How much could you make?', 'market', 'text_long', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 020
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('b934ff7e-9acd-4953-8318-710f40b51ecd', 'Have you taken any investment yet?', 'funding', 'yes_no', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 021
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('4ce888fa-6b40-46a6-881f-2d151f6d7ed8', 'Are you currently fundraising?', 'funding', 'yes_no', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 022
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('ba89e487-70a4-4562-8bd7-94295cdcdc9e', 'Other ideas considered?', 'idea', 'text_long', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 023
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('6c6a0a32-bfaf-4a1f-8577-7c0cc8120fd0', 'Who are your competitors? What do you understand about your business that they don''t?', 'competition', 'text_long', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 024
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('4f962704-cf37-4b1c-80bc-98571c50b78b', 'Where do you live now, and where would the company be based after YC?', 'applicant', 'text_short', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 025
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('8c3f4424-0c78-4504-88cf-30bcdbbfeafe', 'Explain your decision regarding location.', 'company', 'text_long', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 026
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('c9904461-6572-4747-8aad-d192e504c709', 'How did you hear about Y Combinator?', 'attribution', 'text_long', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 027
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('4033c895-7174-4f6e-8531-50eafcb11793', 'What convinced you to apply to Y Combinator? Did someone encourage you to apply? Have you been to any YC events?', 'attribution', 'text_long', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 028
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('67b485ef-0a96-4991-8a09-50e4e7d113e8', 'Please record a one minute video introducing the founder(s).', 'materials', 'file_upload', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 029
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('242a08be-67e8-4c13-8959-858bdf5f0521', 'If you have a demo, attach it below.', 'product', 'file_upload', 1, FALSE, '{"Y Combinator — Summer 2026"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 030
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('541f67b4-f064-41fd-82d0-91a196d6c5a3', 'Full name', 'applicant', 'text_short', 1, FALSE, '{"The Founding 500"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 031
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('5bfa0607-fe5c-45f4-86cf-9ab74c116872', 'Your title', 'applicant', 'text_short', 1, FALSE, '{"The Founding 500"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 032
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('aa83e7f2-71a4-45b4-80e8-fe34a256127a', 'LinkedIn URL', 'applicant', 'url', 1, FALSE, '{"The Founding 500"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 033
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('ef28c634-b561-403c-8f38-ba122835d36a', 'Company or project name', 'applicant', 'text_short', 1, FALSE, '{"The Founding 500"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 034
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('9622c035-b928-4c6f-8728-2f948c0fc820', 'Company website', 'general', 'url', 1, FALSE, '{"The Founding 500"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 035
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('8047978d-bb55-4669-8d06-e2e562f4b2da', 'Team size', 'team', 'number', 1, FALSE, '{"The Founding 500"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 036
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('a5f322e5-956d-467e-825d-0f3dd8eef61f', 'Company stage', 'product', 'multiple_choice', 1, FALSE, '{"The Founding 500"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 037
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('16806e16-dfac-470e-8bbb-524d200f0626', 'Which best describes you?', 'general', 'multiple_choice', 1, FALSE, '{"The Founding 500"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 038
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('03c25092-c57b-4895-8690-ecd95e2842e8', 'What does agent-first look like for your business in 12 months?', 'motivation', 'text_long', 1, FALSE, '{"The Founding 500"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 039
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('c06e295d-0dc6-4ca1-8db9-b56876f72182', 'What have you built with agents in the last 6 months?', 'founder_story', 'text_long', 1, FALSE, '{"The Founding 500"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 040
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('60b5fb9c-15a1-44ab-8eff-ea5658cbfa38', 'Walk us through what you''re showing', 'general', 'file_upload', 1, FALSE, '{"The Founding 500"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 041
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('c7dbe31a-d3a1-413a-8bf6-b595ff4fd153', 'Why you''re the right person to build this', 'founder_story', 'text_long', 1, FALSE, '{"The Founding 500"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 042
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('6587d327-e795-4927-8df3-88be9a4be8a9', 'First Name', 'applicant', 'text_short', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 043
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('9fff9a6e-37b7-49e2-8ddf-58281877b81e', 'Last Name', 'applicant', 'text_short', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 044
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('4edbedec-afa5-4548-839b-2a0f5ba20b92', 'Email', 'applicant', 'text_short', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 045
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('07ab0a2e-aa20-4a1c-89de-ba017b5afac8', 'Your LinkedIn', 'applicant', 'url', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 046
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('b2d5e7ea-b6bd-49fd-8ab6-eb26b3ef4281', 'Where is home base? (State)', 'applicant', 'text_short', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 047
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('4e132c87-680a-4b38-88da-82a5ce87fa12', 'Company Name', 'applicant', 'text_short', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 048
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('ee617104-6065-470f-893b-d9d150469ada', 'Website', 'general', 'url', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 049
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('8411c768-2d0d-4434-85f2-181267491846', 'Industry', 'company', 'text_short', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 050
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('26bd1db3-3b3b-4682-8e4d-9862d4cd78f6', '# of Founders', 'general', 'number', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 051
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('9f2dd601-8080-4bf6-867c-7533dd5dcfef', 'Number of companies founded prior', 'general', 'number', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 052
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('0f6df99d-06cb-423b-8e9c-099245e3c441', 'Someone technical on the team?', 'team', 'yes_no', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 053
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('9d8509db-0c38-41a1-803f-a8836f4d8c05', 'Co-founder profile links', 'team', 'url', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 054
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('1c0e94cb-81bd-4ab9-80c1-6da77ef8b7b1', 'How long have you known your co-founders, and how did you meet?', 'team', 'text_long', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 055
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('70176f9e-e843-41fb-8ed6-d16c4ae3cf36', 'Idea/company elevator pitch (1-2 sentences)', 'idea', 'text_short', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 056
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('b2748373-8544-46b9-8d5c-f088304e8aca', 'Product phase', 'product', 'multiple_choice', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 057
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('e34035ff-838f-4654-897b-3d87fc7ad740', 'How long have you been tinkering with/working on your idea?', 'idea', 'text_short', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 058
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('d8c0afbd-5761-48d9-82ee-660fd38eab70', 'Why you/your team?', 'team', 'text_long', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 059
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('5f9031a0-5ee4-41fb-88d9-0fed397a78e8', 'Traction', 'traction', 'text_long', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 060
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('aa3220d9-497a-4233-8841-69bd87ca46cc', 'Ideal customer profile / what you''ve learned from talking to them', 'idea', 'text_long', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 061
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('ce74e64c-c2a8-4692-8cb6-f96839707d7f', 'Who are your main competitors, and what do you know they don''t?', 'competition', 'text_long', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 062
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('246b28c2-699c-4c98-8a44-127b1ea0f653', 'Revenue opportunity and how does the opportunity expand with your vision?', 'traction', 'text_long', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 063
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('9c759da7-b3db-4bad-815a-f2f5ebd9d14c', 'Have you raised capital for your current company?', 'funding', 'yes_no', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 064
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('a62881d6-78d3-4e77-845a-a7525135d406', 'Have you raised venture capital before?', 'funding', 'yes_no', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 065
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('6adef7b6-824a-455d-8d5b-336c6d77ec86', 'How much capital have you raised, and any significant investors?', 'funding', 'text_long', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 066
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('6a5eb749-a348-457e-8ec8-735a05724717', 'Deck or One Pager (file upload)', 'materials', 'file_upload', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 067
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('53694c4f-0bef-4eec-83f0-93f1d6284087', 'Deck link', 'materials', 'url', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 068
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('358e0952-3632-46e4-8d4e-88d02859833e', 'How did you find us?', 'attribution', 'text_short', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 069
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('28d7178c-3fca-463a-8dcc-64d0b1356403', 'Who referred you?', 'attribution', 'text_short', 1, FALSE, '{"Redbud VC — Pitch Us"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 070
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('7c873a14-5cd9-4910-80f3-b1f268f9596e', 'What is your name? If you have co-founders, please include their names too.', 'applicant', 'text_short', 1, FALSE, '{"cyber.fund — The Monastery"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 071
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('b37273e8-dcfd-4d8f-8b98-13b6af8b15ac', 'What''s your email address?', 'applicant', 'text_short', 1, FALSE, '{"cyber.fund — The Monastery"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 072
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('42ff88bd-be24-4685-8d18-5bde38aca6f0', 'What''s your LinkedIn profile URL?', 'applicant', 'url', 1, FALSE, '{"cyber.fund — The Monastery"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 073
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('9f5e268a-fcbb-4fb9-83c3-f52d188d8846', 'What''s your X (Twitter) handle?', 'applicant', 'text_short', 1, FALSE, '{"cyber.fund — The Monastery"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 074
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('0417fa59-5c29-4e7e-8207-8a58b3344b3a', 'Do you have a GitHub profile? If so, what''s the URL?', 'applicant', 'url', 1, FALSE, '{"cyber.fund — The Monastery"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 075
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('a032070d-bdbf-4458-80bf-37192e3a04ac', 'It looks like you''re flying solo — but if you do have co-founders, how long have you known them and why did you decide to work together? If you''re solo, just let me know and we''ll move on.', 'team', 'text_long', 1, FALSE, '{"cyber.fund — The Monastery"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 076
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('b5169c2a-47fb-4ff0-8e10-a1fc5c5ad052', 'What have you built or achieved in the past that you''re most proud of?', 'founder_story', 'text_long', 1, FALSE, '{"cyber.fund — The Monastery"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 077
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('73e1b83e-e4ac-438d-8b8d-f22e91e7111e', 'What''s your project''s name?', 'applicant', 'text_short', 1, FALSE, '{"cyber.fund — The Monastery"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 078
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('838aefff-6a28-4bef-81d9-e76bbece8d45', 'What problem are you solving?', 'motivation', 'text_long', 1, FALSE, '{"cyber.fund — The Monastery"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 079
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('e93b2c2e-a02d-4ee9-8a6e-0af215469726', 'Why are you solving that problem?', 'motivation', 'text_long', 1, FALSE, '{"cyber.fund — The Monastery"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 080
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('bae5c5ab-a651-42b3-8290-113f4882b988', 'Can you say more about the necessity part — what made this feel urgent or unavoidable for you specifically?', 'motivation', 'text_long', 1, FALSE, '{"cyber.fund — The Monastery"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 081
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('ed35da7a-255e-4edd-8897-2b7899eaab22', 'Why is your project better than competitors and what''s your moat?', 'competition', 'text_long', 1, FALSE, '{"cyber.fund — The Monastery"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 082
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('7d660d43-c40d-421e-8bb5-7e506246232e', 'What''s your current traction — waitlist signups, MRR, users, anything like that?', 'traction', 'text_long', 1, FALSE, '{"cyber.fund — The Monastery"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 083
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('6a0f3cc9-c01b-4921-826d-04f85ed90e4a', 'Upload deck (.md or .pdf, max 50 MB each, up to 3 files)', 'materials', 'file_upload', 1, FALSE, '{"cyber.fund — The Monastery"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 084
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('d10a2eb4-72be-4ed3-8620-41956e85405e', 'What is your name?', 'applicant', 'text_short', 1, FALSE, '{"3xCapital — Startup Submission"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 085
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('06df477d-5d67-4fb0-8948-39c141485e8a', 'What is your email?', 'applicant', 'text_short', 1, FALSE, '{"3xCapital — Startup Submission"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 086
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('763fddf9-7e09-487e-8440-470215763566', 'What is your X / Twitter URL?', 'applicant', 'url', 1, FALSE, '{"3xCapital — Startup Submission"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 087
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('1f98f8be-0c54-4d49-8028-1916ef89e418', 'What is your LinkedIn URL?', 'applicant', 'url', 1, FALSE, '{"3xCapital — Startup Submission"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 088
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('20ba64e9-7df0-4d1c-8d2b-4912ecfc208a', 'What is your relationship to the startup?', 'motivation', 'multiple_choice', 1, FALSE, '{"3xCapital — Startup Submission"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 089
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('70a19a68-aacf-4c1d-8197-fd7b8da0e751', 'What is the startup name?', 'applicant', 'text_short', 1, FALSE, '{"3xCapital — Startup Submission"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 090
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('2c65179a-8e40-4460-8dd6-b257662c60f0', 'One-line description of the startup', 'idea', 'text_short', 1, FALSE, '{"3xCapital — Startup Submission"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 091
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('978a1b0c-3c49-4bfb-882f-2df701a6f503', 'Websites', 'company', 'url', 1, FALSE, '{"3xCapital — Startup Submission"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 092
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('06359df7-7f58-48b3-8b7d-7b2a8b8a03ae', 'Architecture link', 'company', 'url', 1, FALSE, '{"3xCapital — Startup Submission"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 093
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('90955cc8-7cd3-4b8b-801b-7a678bc2da51', 'Legal entity', 'company', 'text_short', 1, FALSE, '{"3xCapital — Startup Submission"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 094
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('12bd2f20-3e76-4ad5-8c7b-6d076a69ff9f', 'What sector does the startup belong to? (options: DeFi / Infrastructure / Web2-to-Web3 / Metaverse / GameFi / L1 / L2 / NFT / Other)', 'company', 'multiple_choice', 1, FALSE, '{"3xCapital — Startup Submission"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 095
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('ae1d1f9e-badb-4443-8090-2ba0723404a9', 'What is the stage of the product?', 'product', 'multiple_choice', 1, FALSE, '{"3xCapital — Startup Submission"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 096
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('5e49c7ac-0355-43b5-8c7f-6c364760bebe', 'How does the startup raise?', 'funding', 'multiple_choice', 1, FALSE, '{"3xCapital — Startup Submission"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 097
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('c23e3bef-f6e7-4ad8-8240-f6d482b180d1', 'What round?', 'funding', 'multiple_choice', 1, FALSE, '{"3xCapital — Startup Submission"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 098
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('0e24f3c6-9786-42c1-8a79-63fb596a6a98', 'What is the round / valuation type?', 'funding', 'multiple_choice', 1, FALSE, '{"3xCapital — Startup Submission"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 099
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('b59b66f6-a54f-4c99-8347-62314fcbc37c', 'What is the range?', 'general', 'text_short', 1, FALSE, '{"3xCapital — Startup Submission"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 100
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('2783d627-8c42-4239-8aec-60b7bc9446fc', 'What is the valuation for equity/token, and how did you develop it?', 'funding', 'text_long', 1, FALSE, '{"3xCapital — Startup Submission"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 101
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('d6d5ea8d-72fb-4b3f-88c3-492ef39d850b', 'What are the terms?', 'funding', 'text_long', 1, FALSE, '{"3xCapital — Startup Submission"}', 'founder')
ON CONFLICT (id) DO NOTHING;
-- 102
INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)
VALUES ('ad53773e-c6e2-41c6-87a4-8e0507a2a7ec', 'Any other comments?', 'general', 'text_long', 1, FALSE, '{"3xCapital — Startup Submission"}', 'founder')
ON CONFLICT (id) DO NOTHING;

-- 3. Program questions (verbatim asked_as per program)
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '1b57fa6f-183c-4017-89f3-0d2008e22234', 'Company / project name', true, 'Founder & company basics', 1 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Company / project name'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '763d2c9d-a6be-458b-8198-810142d2b523', 'What batch do you want to apply for?', true, 'Founder & company basics', 2 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What batch do you want to apply for?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'a84d822c-bb6a-45d1-8ca4-99c90d9e7e21', 'Are you looking for a cofounder?', true, 'Founder & company basics', 3 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Are you looking for a cofounder?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '24d73c63-42a0-4e22-8a2b-34f46418f4e1', 'Cofounder info', false, 'Founder & company basics', 4 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Cofounder info'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'b6944fcb-64b9-49ee-82fd-22f3dcbe3f9a', 'Other co-founders / team', false, 'Founder & company basics', 5 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Other co-founders / team'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'f8ef8b5b-e684-4af7-8b79-392b908d6ef4', 'Who writes code, or does other technical work on your product? Was any of it done by a non-founder? Please explain.', true, 'Founder & company basics', 6 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Who writes code, or does other technical work on your product? Was any of it done by a non-founder? Please explain.'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '1e99e45d-f978-4e8c-8236-556aed8ecf81', 'Describe what your company does in 50 characters or less.', true, 'Product', 7 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Describe what your company does in 50 characters or less.'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'b86280f0-4312-43a5-8e7b-00a8311e1929', 'What is your company going to make? Please describe your product and what it does or will do.', true, 'Product', 8 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What is your company going to make? Please describe your product and what it does or will do.'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '2f0aceb5-42e2-4fb7-8c44-7b1ea82f7e6d', 'What tech stack are you using, or planning to use, to build this product? Include AI models and AI coding tools you use.', true, 'Product', 9 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What tech stack are you using, or planning to use, to build this product? Include AI models and AI coding tools you use.'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'abf29a15-8efb-4978-824d-0fb65b2e549a', 'Please provide a link to the product, if any.', false, 'Product', 10 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Please provide a link to the product, if any.'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '49530f45-67e3-4606-81da-ed6cf715d82d', 'If login credentials are required for the link above, enter them here.', false, 'Product', 11 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'If login credentials are required for the link above, enter them here.'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '39beafbd-3f0a-469e-83c3-16818cbcb0ee', 'Why did you pick this idea to work on? Do you have domain expertise in this area? How do you know people need what you''re making?', true, 'Idea', 12 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Why did you pick this idea to work on? Do you have domain expertise in this area? How do you know people need what you''re making?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '44d5a468-8054-498c-8b48-053ffbc07314', 'If you are applying with the same idea as a previous batch, did anything change? If you applied with a different idea, why did you pivot and what did you learn from the last idea?', false, 'Idea', 13 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'If you are applying with the same idea as a previous batch, did anything change? If you applied with a different idea, why did you pivot and what did you learn from the last idea?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '3b0e7908-6763-4cd7-832e-1ff5513f193a', 'How far along are you?', true, 'Progress', 14 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'How far along are you?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'f44202a5-ddef-4bd0-8fbc-a22bb513bff6', 'How long have each of you been working on this? How much of that has been full-time? Please explain.', true, 'Progress', 15 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'How long have each of you been working on this? How much of that has been full-time? Please explain.'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'd106c16d-8437-4cbc-8f14-f41b12db0333', 'Have you formed ANY legal entity yet?', true, 'Progress', 16 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Have you formed ANY legal entity yet?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '61cff54d-d743-4ea5-8483-dd1799a011a6', 'Are people using your product?', true, 'Progress', 17 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Are people using your product?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '22f85078-bb56-4ad3-8992-99375fc98f63', 'Do you have revenue?', true, 'Progress', 18 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Do you have revenue?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'f5035b17-0660-476b-8cc6-aa69ef7dcdd4', 'Worked together before?', true, 'Progress', 19 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Worked together before?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '54448f3f-9311-43d3-8bf8-14afd49b7d16', 'How do or will you make money? How much could you make?', true, 'Money', 20 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'How do or will you make money? How much could you make?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'b934ff7e-9acd-4953-8318-710f40b51ecd', 'Have you taken any investment yet?', true, 'Money', 21 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Have you taken any investment yet?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '4ce888fa-6b40-46a6-881f-2d151f6d7ed8', 'Are you currently fundraising?', true, 'Money', 22 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Are you currently fundraising?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'ba89e487-70a4-4562-8bd7-94295cdcdc9e', 'Other ideas considered?', false, 'Idea', 23 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Other ideas considered?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '6c6a0a32-bfaf-4a1f-8577-7c0cc8120fd0', 'Who are your competitors? What do you understand about your business that they don''t?', true, 'Competition', 24 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Who are your competitors? What do you understand about your business that they don''t?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '4f962704-cf37-4b1c-80bc-98571c50b78b', 'Where do you live now, and where would the company be based after YC?', true, 'Location', 25 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Where do you live now, and where would the company be based after YC?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '8c3f4424-0c78-4504-88cf-30bcdbbfeafe', 'Explain your decision regarding location.', true, 'Location', 26 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Explain your decision regarding location.'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'c9904461-6572-4747-8aad-d192e504c709', 'How did you hear about Y Combinator?', true, 'YC fit', 27 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'How did you hear about Y Combinator?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '4033c895-7174-4f6e-8531-50eafcb11793', 'What convinced you to apply to Y Combinator? Did someone encourage you to apply? Have you been to any YC events?', true, 'YC fit', 28 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What convinced you to apply to Y Combinator? Did someone encourage you to apply? Have you been to any YC events?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '67b485ef-0a96-4991-8a09-50e4e7d113e8', 'Please record a one minute video introducing the founder(s).', true, 'Video & demo', 29 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Please record a one minute video introducing the founder(s).'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '242a08be-67e8-4c13-8959-858bdf5f0521', 'If you have a demo, attach it below.', false, 'Video & demo', 30 FROM programs p
WHERE p.slug = 'yc-summer-2026' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'If you have a demo, attach it below.'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '541f67b4-f064-41fd-82d0-91a196d6c5a3', 'Full name', true, 'Applicant', 1 FROM programs p
WHERE p.slug = 'founding-500' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Full name'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '5bfa0607-fe5c-45f4-86cf-9ab74c116872', 'Your title', true, 'Applicant', 2 FROM programs p
WHERE p.slug = 'founding-500' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Your title'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'aa83e7f2-71a4-45b4-80e8-fe34a256127a', 'LinkedIn URL', true, 'Applicant', 3 FROM programs p
WHERE p.slug = 'founding-500' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'LinkedIn URL'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'ef28c634-b561-403c-8f38-ba122835d36a', 'Company or project name', true, 'Company', 4 FROM programs p
WHERE p.slug = 'founding-500' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Company or project name'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '9622c035-b928-4c6f-8728-2f948c0fc820', 'Company website', true, 'Company', 5 FROM programs p
WHERE p.slug = 'founding-500' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Company website'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '8047978d-bb55-4669-8d06-e2e562f4b2da', 'Team size', true, 'Company', 6 FROM programs p
WHERE p.slug = 'founding-500' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Team size'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'a5f322e5-956d-467e-825d-0f3dd8eef61f', 'Company stage', true, 'Company', 7 FROM programs p
WHERE p.slug = 'founding-500' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Company stage'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '16806e16-dfac-470e-8bbb-524d200f0626', 'Which best describes you?', true, 'Company', 8 FROM programs p
WHERE p.slug = 'founding-500' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Which best describes you?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '03c25092-c57b-4895-8690-ecd95e2842e8', 'What does agent-first look like for your business in 12 months?', true, 'Vision', 9 FROM programs p
WHERE p.slug = 'founding-500' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What does agent-first look like for your business in 12 months?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'c06e295d-0dc6-4ca1-8db9-b56876f72182', 'What have you built with agents in the last 6 months?', true, 'Traction', 10 FROM programs p
WHERE p.slug = 'founding-500' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What have you built with agents in the last 6 months?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '60b5fb9c-15a1-44ab-8eff-ea5658cbfa38', 'Walk us through what you''re showing', true, 'Demo', 11 FROM programs p
WHERE p.slug = 'founding-500' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Walk us through what you''re showing'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'c7dbe31a-d3a1-413a-8bf6-b595ff4fd153', 'Why you''re the right person to build this', true, 'Founder', 12 FROM programs p
WHERE p.slug = 'founding-500' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Why you''re the right person to build this'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '6587d327-e795-4927-8df3-88be9a4be8a9', 'First Name', true, 'Founder', 1 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'First Name'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '9fff9a6e-37b7-49e2-8ddf-58281877b81e', 'Last Name', true, 'Founder', 2 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Last Name'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '4edbedec-afa5-4548-839b-2a0f5ba20b92', 'Email', true, 'Founder', 3 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Email'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '07ab0a2e-aa20-4a1c-89de-ba017b5afac8', 'Your LinkedIn', true, 'Founder', 4 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Your LinkedIn'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'b2d5e7ea-b6bd-49fd-8ab6-eb26b3ef4281', 'Where is home base? (State)', true, 'Founder', 5 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Where is home base? (State)'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '4e132c87-680a-4b38-88da-82a5ce87fa12', 'Company Name', true, 'Company', 6 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Company Name'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'ee617104-6065-470f-893b-d9d150469ada', 'Website', false, 'Company', 7 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Website'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '8411c768-2d0d-4434-85f2-181267491846', 'Industry', true, 'Company', 8 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Industry'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '26bd1db3-3b3b-4682-8e4d-9862d4cd78f6', '# of Founders', true, 'Company', 9 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = '# of Founders'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '9f2dd601-8080-4bf6-867c-7533dd5dcfef', 'Number of companies founded prior', true, 'Company', 10 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Number of companies founded prior'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '0f6df99d-06cb-423b-8e9c-099245e3c441', 'Someone technical on the team?', true, 'Team', 11 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Someone technical on the team?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '9d8509db-0c38-41a1-803f-a8836f4d8c05', 'Co-founder profile links', false, 'Team', 12 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Co-founder profile links'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '1c0e94cb-81bd-4ab9-80c1-6da77ef8b7b1', 'How long have you known your co-founders, and how did you meet?', true, 'Team', 13 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'How long have you known your co-founders, and how did you meet?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '70176f9e-e843-41fb-8ed6-d16c4ae3cf36', 'Idea/company elevator pitch (1-2 sentences)', true, 'Idea', 14 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Idea/company elevator pitch (1-2 sentences)'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'b2748373-8544-46b9-8d5c-f088304e8aca', 'Product phase', true, 'Product', 15 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Product phase'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'e34035ff-838f-4654-897b-3d87fc7ad740', 'How long have you been tinkering with/working on your idea?', true, 'Idea', 16 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'How long have you been tinkering with/working on your idea?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'd8c0afbd-5761-48d9-82ee-660fd38eab70', 'Why you/your team?', true, 'Team', 17 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Why you/your team?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '5f9031a0-5ee4-41fb-88d9-0fed397a78e8', 'Traction', true, 'Traction', 18 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Traction'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'aa3220d9-497a-4233-8841-69bd87ca46cc', 'Ideal customer profile / what you''ve learned from talking to them', true, 'Market', 19 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Ideal customer profile / what you''ve learned from talking to them'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'ce74e64c-c2a8-4692-8cb6-f96839707d7f', 'Who are your main competitors, and what do you know they don''t?', true, 'Competition', 20 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Who are your main competitors, and what do you know they don''t?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '246b28c2-699c-4c98-8a44-127b1ea0f653', 'Revenue opportunity and how does the opportunity expand with your vision?', true, 'Market', 21 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Revenue opportunity and how does the opportunity expand with your vision?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '9c759da7-b3db-4bad-815a-f2f5ebd9d14c', 'Have you raised capital for your current company?', true, 'Funding', 22 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Have you raised capital for your current company?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'a62881d6-78d3-4e77-845a-a7525135d406', 'Have you raised venture capital before?', true, 'Funding', 23 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Have you raised venture capital before?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '6adef7b6-824a-455d-8d5b-336c6d77ec86', 'How much capital have you raised, and any significant investors?', true, 'Funding', 24 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'How much capital have you raised, and any significant investors?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '6a5eb749-a348-457e-8ec8-735a05724717', 'Deck or One Pager (file upload)', true, 'Materials', 25 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Deck or One Pager (file upload)'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '53694c4f-0bef-4eec-83f0-93f1d6284087', 'Deck link', false, 'Materials', 26 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Deck link'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '358e0952-3632-46e4-8d4e-88d02859833e', 'How did you find us?', false, 'Attribution', 27 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'How did you find us?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '28d7178c-3fca-463a-8dcc-64d0b1356403', 'Who referred you?', false, 'Attribution', 28 FROM programs p
WHERE p.slug = 'redbud-vc' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Who referred you?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '7c873a14-5cd9-4910-80f3-b1f268f9596e', 'What is your name? If you have co-founders, please include their names too.', true, 'Intake', 1 FROM programs p
WHERE p.slug = 'cyberfund-monastery' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What is your name? If you have co-founders, please include their names too.'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'b37273e8-dcfd-4d8f-8b98-13b6af8b15ac', 'What''s your email address?', true, 'Intake', 2 FROM programs p
WHERE p.slug = 'cyberfund-monastery' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What''s your email address?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '42ff88bd-be24-4685-8d18-5bde38aca6f0', 'What''s your LinkedIn profile URL?', true, 'Intake', 3 FROM programs p
WHERE p.slug = 'cyberfund-monastery' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What''s your LinkedIn profile URL?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '9f5e268a-fcbb-4fb9-83c3-f52d188d8846', 'What''s your X (Twitter) handle?', false, 'Intake', 4 FROM programs p
WHERE p.slug = 'cyberfund-monastery' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What''s your X (Twitter) handle?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '0417fa59-5c29-4e7e-8207-8a58b3344b3a', 'Do you have a GitHub profile? If so, what''s the URL?', false, 'Intake', 5 FROM programs p
WHERE p.slug = 'cyberfund-monastery' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Do you have a GitHub profile? If so, what''s the URL?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'a032070d-bdbf-4458-80bf-37192e3a04ac', 'It looks like you''re flying solo — but if you do have co-founders, how long have you known them and why did you decide to work together? If you''re solo, just let me know and we''ll move on.', true, 'Team', 6 FROM programs p
WHERE p.slug = 'cyberfund-monastery' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'It looks like you''re flying solo — but if you do have co-founders, how long have you known them and why did you decide to work together? If you''re solo, just let me know and we''ll move on.'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'b5169c2a-47fb-4ff0-8e10-a1fc5c5ad052', 'What have you built or achieved in the past that you''re most proud of?', true, 'Track record', 7 FROM programs p
WHERE p.slug = 'cyberfund-monastery' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What have you built or achieved in the past that you''re most proud of?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '73e1b83e-e4ac-438d-8b8d-f22e91e7111e', 'What''s your project''s name?', true, 'Project', 8 FROM programs p
WHERE p.slug = 'cyberfund-monastery' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What''s your project''s name?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '838aefff-6a28-4bef-81d9-e76bbece8d45', 'What problem are you solving?', true, 'Problem', 9 FROM programs p
WHERE p.slug = 'cyberfund-monastery' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What problem are you solving?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'e93b2c2e-a02d-4ee9-8a6e-0af215469726', 'Why are you solving that problem?', true, 'Motivation', 10 FROM programs p
WHERE p.slug = 'cyberfund-monastery' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Why are you solving that problem?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'bae5c5ab-a651-42b3-8290-113f4882b988', 'Can you say more about the necessity part — what made this feel urgent or unavoidable for you specifically?', true, 'Motivation', 11 FROM programs p
WHERE p.slug = 'cyberfund-monastery' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Can you say more about the necessity part — what made this feel urgent or unavoidable for you specifically?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'ed35da7a-255e-4edd-8897-2b7899eaab22', 'Why is your project better than competitors and what''s your moat?', true, 'Competition', 12 FROM programs p
WHERE p.slug = 'cyberfund-monastery' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Why is your project better than competitors and what''s your moat?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '7d660d43-c40d-421e-8bb5-7e506246232e', 'What''s your current traction — waitlist signups, MRR, users, anything like that?', true, 'Traction', 13 FROM programs p
WHERE p.slug = 'cyberfund-monastery' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What''s your current traction — waitlist signups, MRR, users, anything like that?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '6a0f3cc9-c01b-4921-826d-04f85ed90e4a', 'Upload deck (.md or .pdf, max 50 MB each, up to 3 files)', true, 'Materials', 14 FROM programs p
WHERE p.slug = 'cyberfund-monastery' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Upload deck (.md or .pdf, max 50 MB each, up to 3 files)'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'd10a2eb4-72be-4ed3-8620-41956e85405e', 'What is your name?', true, 'Founder', 1 FROM programs p
WHERE p.slug = '3xcapital' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What is your name?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '06df477d-5d67-4fb0-8948-39c141485e8a', 'What is your email?', true, 'Founder', 2 FROM programs p
WHERE p.slug = '3xcapital' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What is your email?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '763fddf9-7e09-487e-8440-470215763566', 'What is your X / Twitter URL?', false, 'Founder', 3 FROM programs p
WHERE p.slug = '3xcapital' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What is your X / Twitter URL?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '1f98f8be-0c54-4d49-8028-1916ef89e418', 'What is your LinkedIn URL?', true, 'Founder', 4 FROM programs p
WHERE p.slug = '3xcapital' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What is your LinkedIn URL?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '20ba64e9-7df0-4d1c-8d2b-4912ecfc208a', 'What is your relationship to the startup?', true, 'Founder', 5 FROM programs p
WHERE p.slug = '3xcapital' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What is your relationship to the startup?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '70a19a68-aacf-4c1d-8197-fd7b8da0e751', 'What is the startup name?', true, 'Startup', 6 FROM programs p
WHERE p.slug = '3xcapital' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What is the startup name?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '2c65179a-8e40-4460-8dd6-b257662c60f0', 'One-line description of the startup', true, 'Startup', 7 FROM programs p
WHERE p.slug = '3xcapital' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'One-line description of the startup'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '978a1b0c-3c49-4bfb-882f-2df701a6f503', 'Websites', true, 'Startup', 8 FROM programs p
WHERE p.slug = '3xcapital' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Websites'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '06359df7-7f58-48b3-8b7d-7b2a8b8a03ae', 'Architecture link', false, 'Startup', 9 FROM programs p
WHERE p.slug = '3xcapital' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Architecture link'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '90955cc8-7cd3-4b8b-801b-7a678bc2da51', 'Legal entity', true, 'Startup', 10 FROM programs p
WHERE p.slug = '3xcapital' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Legal entity'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '12bd2f20-3e76-4ad5-8c7b-6d076a69ff9f', 'What sector does the startup belong to? (options: DeFi / Infrastructure / Web2-to-Web3 / Metaverse / GameFi / L1 / L2 / NFT / Other)', false, 'Startup', 11 FROM programs p
WHERE p.slug = '3xcapital' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What sector does the startup belong to? (options: DeFi / Infrastructure / Web2-to-Web3 / Metaverse / GameFi / L1 / L2 / NFT / Other)'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'ae1d1f9e-badb-4443-8090-2ba0723404a9', 'What is the stage of the product?', true, 'Product', 12 FROM programs p
WHERE p.slug = '3xcapital' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What is the stage of the product?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '5e49c7ac-0355-43b5-8c7f-6c364760bebe', 'How does the startup raise?', true, 'Funding', 13 FROM programs p
WHERE p.slug = '3xcapital' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'How does the startup raise?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'c23e3bef-f6e7-4ad8-8240-f6d482b180d1', 'What round?', true, 'Funding', 14 FROM programs p
WHERE p.slug = '3xcapital' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What round?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '0e24f3c6-9786-42c1-8a79-63fb596a6a98', 'What is the round / valuation type?', true, 'Funding', 15 FROM programs p
WHERE p.slug = '3xcapital' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What is the round / valuation type?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'b59b66f6-a54f-4c99-8347-62314fcbc37c', 'What is the range?', true, 'Funding', 16 FROM programs p
WHERE p.slug = '3xcapital' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What is the range?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, '2783d627-8c42-4239-8aec-60b7bc9446fc', 'What is the valuation for equity/token, and how did you develop it?', true, 'Funding', 17 FROM programs p
WHERE p.slug = '3xcapital' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What is the valuation for equity/token, and how did you develop it?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'd6d5ea8d-72fb-4b3f-88c3-492ef39d850b', 'What are the terms?', true, 'Funding', 18 FROM programs p
WHERE p.slug = '3xcapital' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'What are the terms?'
);
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)
SELECT p.id, 'ad53773e-c6e2-41c6-87a4-8e0507a2a7ec', 'Any other comments?', false, 'Other', 19 FROM programs p
WHERE p.slug = '3xcapital' AND NOT EXISTS (
  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = 'Any other comments?'
);

COMMIT;

-- Post-apply verification:
--   SELECT slug, source FROM programs WHERE source='canonical';  -- expect 5
--   SELECT count(*) FROM program_questions pq JOIN programs p ON p.id=pq.program_id WHERE p.source='canonical';
-- Registry slugs that must exist for the catalog to render these:
--   yc-summer-2026, founding-500, redbud-vc, cyberfund-monastery, 3xcapital
