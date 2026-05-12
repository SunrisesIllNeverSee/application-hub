-- ============================================================
-- Migration 001: Extensions and Enums
-- Application Hub Platform — Ello Cello LLC
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- fuzzy text search on questions
CREATE EXTENSION IF NOT EXISTS "vector";         -- pgvector for semantic search

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE program_type AS ENUM (
  'grant',
  'accel',
  'vc',
  'corp',
  'uni',
  'job',
  'fellowship',
  'other'
);

CREATE TYPE program_status AS ENUM (
  'upcoming',
  'open',
  'closed',
  'results'
);

CREATE TYPE program_source AS ENUM (
  'seeded',
  'community',
  'funder'
);

CREATE TYPE application_status AS ENUM (
  'saved',
  'drafting',
  'submitted',
  'accepted',
  'rejected',
  'waitlist'
);

CREATE TYPE answer_confidence AS ENUM (
  'draft',
  'solid',
  'locked'
);

CREATE TYPE response_type AS ENUM (
  'text_short',
  'text_long',
  'multiple_choice',
  'yes_no',
  'number',
  'url',
  'file_upload',
  'date'
);

CREATE TYPE signal_type AS ENUM (
  'view',
  'save',
  'start',
  'submit'
);

CREATE TYPE outcome_type AS ENUM (
  'accepted',
  'rejected',
  'waitlist'
);

CREATE TYPE integration_type AS ENUM (
  'claude',
  'openai',
  'custom_agent',
  'mcp',
  'webhook'
);

CREATE TYPE import_status AS ENUM (
  'pending',
  'mapped',
  'rejected',
  'manual'
);
