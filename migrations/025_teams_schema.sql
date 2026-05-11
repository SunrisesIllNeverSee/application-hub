-- Migration 025: Teams schema
-- Shared workspaces for co-founders on the Team plan

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan          TEXT NOT NULL DEFAULT 'team' CHECK (plan IN ('team','enterprise')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  invited_by  UUID REFERENCES auth.users(id),
  joined_at   TIMESTAMPTZ,
  invited_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_invites (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  token       TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  role        TEXT NOT NULL DEFAULT 'member',
  invited_by  UUID NOT NULL REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, email)
);

-- Shared answer library: team answers visible to all members
CREATE TABLE IF NOT EXISTS team_answers (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id               UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  archived_question_id  UUID NOT NULL REFERENCES archived_questions(id) ON DELETE CASCADE,
  content               TEXT NOT NULL,
  confidence            TEXT NOT NULL DEFAULT 'draft' CHECK (confidence IN ('draft','solid','locked')),
  created_by            UUID NOT NULL REFERENCES auth.users(id),
  updated_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, archived_question_id)
);

-- Add team_id to user_applications (optional team-visible applications)
ALTER TABLE user_applications ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'teams_updated_at'
  ) THEN
    CREATE TRIGGER teams_updated_at
      BEFORE UPDATE ON teams
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'team_answers_updated_at'
  ) THEN
    CREATE TRIGGER team_answers_updated_at
      BEFORE UPDATE ON team_answers
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

-- RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_answers ENABLE ROW LEVEL SECURITY;

-- teams: visible to members
CREATE POLICY "teams_member_select" ON teams FOR SELECT USING (
  id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
CREATE POLICY "teams_owner_all" ON teams FOR ALL USING (owner_id = auth.uid());

-- team_members
CREATE POLICY "tm_member_select" ON team_members FOR SELECT USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
CREATE POLICY "tm_owner_manage" ON team_members FOR ALL USING (
  team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
);

-- team_invites
CREATE POLICY "ti_team_select" ON team_invites FOR SELECT USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
CREATE POLICY "ti_owner_manage" ON team_invites FOR ALL USING (
  team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
);

-- team_answers: readable by all members, writable by members
CREATE POLICY "ta_member_select" ON team_answers FOR SELECT USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
CREATE POLICY "ta_member_write" ON team_answers FOR INSERT WITH CHECK (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
CREATE POLICY "ta_member_update" ON team_answers FOR UPDATE USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
