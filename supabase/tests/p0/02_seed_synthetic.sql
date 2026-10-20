-- ============================================================
-- P0 local role-boundary harness: 02 synthetic seed
-- ============================================================
-- LOCAL THROWAWAY POSTGRES ONLY. Runs AFTER the real migration 053
-- (loaded by run_local.sh via \i) so canonical programs, questions and
-- relationships are the production canonical set (5 programs / 103
-- relationships). Everything below is synthetic (example.test emails).
-- Executed as the postgres superuser.
-- ============================================================

-- Users: a1 owner, a2 ordinary, a3 invitee, a4 wrong-email, a5 unconfirmed-email
INSERT INTO auth.users (id, aud, role, email, email_confirmed_at) VALUES
 ('00000000-0000-0000-0000-0000000000a1','authenticated','authenticated','owner@example.test',   now()),
 ('00000000-0000-0000-0000-0000000000a2','authenticated','authenticated','other@example.test',   now()),
 ('00000000-0000-0000-0000-0000000000a3','authenticated','authenticated','invitee@example.test', now()),
 ('00000000-0000-0000-0000-0000000000a4','authenticated','authenticated','stranger@example.test',now()),
 ('00000000-0000-0000-0000-0000000000a5','authenticated','authenticated','unverified@example.test', NULL),
 ('00000000-0000-0000-0000-0000000000a6','authenticated','authenticated','admin@example.test',   now()),
 ('00000000-0000-0000-0000-0000000000a7','authenticated','authenticated','esc@example.test',     now());

-- A user-owned, non-canonical program saved by its owner (the DBC-01 attack
-- precondition: owned + visible via user_applications).
INSERT INTO programs (id, slug, name, organization, type, kind, source, funder_user_id)
VALUES ('11111111-1111-1111-1111-111111111111','t-owned','T Owned','T Org','accel','accelerator','community',
        '00000000-0000-0000-0000-0000000000a1');
INSERT INTO user_applications (user_id, program_id)
VALUES ('00000000-0000-0000-0000-0000000000a1','11111111-1111-1111-1111-111111111111');

-- A seeded (legacy synthetic) non-canonical program saved by a2.
INSERT INTO programs (id, slug, name, organization, type, kind, source)
VALUES ('44444444-4444-4444-4444-444444444444','t-seeded','T Seeded','T Org','vc','vc','seeded');
INSERT INTO user_applications (user_id, program_id)
VALUES ('00000000-0000-0000-0000-0000000000a2','44444444-4444-4444-4444-444444444444');

-- Non-canonical question linked to the owned program (counter + visibility).
INSERT INTO archived_questions (id, text, theme, asked_by_count)
VALUES ('33333333-3333-3333-3333-333333333333','t-noncanon-q','personal',0);
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as)
VALUES ('55555555-5555-5555-5555-555555555555','11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','t-asked-as');

-- Team + invites (synthetic). Team owner a1 (+ owner member row), a6 is an admin member.
INSERT INTO teams (id, name, slug, owner_id)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001','T Team','t-team','00000000-0000-0000-0000-0000000000a1');
INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','owner', now()),
 ('aaaaaaaa-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a6','admin', now());

INSERT INTO team_invites (team_id, email, token, role, invited_by, accepted_at, expires_at) VALUES
 -- valid, mixed-case stored email, member role
 ('aaaaaaaa-0000-0000-0000-000000000001','  Invitee@Example.TEST ','tok-valid','member','00000000-0000-0000-0000-0000000000a1', NULL, now() + interval '3 days'),
 -- expired, matching email
 ('aaaaaaaa-0000-0000-0000-000000000001','invitee-expired@example.test','tok-expired','member','00000000-0000-0000-0000-0000000000a1', NULL, now() - interval '1 hour'),
 -- already accepted (single-use)
 ('aaaaaaaa-0000-0000-0000-000000000001','invitee-used@example.test','tok-used','member','00000000-0000-0000-0000-0000000000a1', now() - interval '1 day', now() + interval '3 days'),
 -- invitee is already a member (admin a6) with a different role on the invite
 ('aaaaaaaa-0000-0000-0000-000000000001','admin@example.test','tok-already','member','00000000-0000-0000-0000-0000000000a1', NULL, now() + interval '3 days'),
 -- escalation attempt: invite row says owner
 ('aaaaaaaa-0000-0000-0000-000000000001','esc@example.test','tok-owner-role','owner','00000000-0000-0000-0000-0000000000a1', NULL, now() + interval '3 days'),
 -- unconfirmed auth email matching the invite
 ('aaaaaaaa-0000-0000-0000-000000000001','unverified@example.test','tok-unverified','member','00000000-0000-0000-0000-0000000000a1', NULL, now() + interval '3 days'),
 -- admin role invite for race test
 ('aaaaaaaa-0000-0000-0000-000000000001','stranger@example.test','tok-race','admin','00000000-0000-0000-0000-0000000000a1', NULL, now() + interval '3 days');
