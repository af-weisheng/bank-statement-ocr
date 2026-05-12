-- Bank Statement OCR – database schema
-- All statements use IF NOT EXISTS / IF EXISTS so this file is safe to re-run.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- provides gen_random_uuid()

-- ─── admins ──────────────────────────────────────────────────────────────────
-- Created first because domains.registered_by_admin_id references it.
CREATE TABLE IF NOT EXISTS admins (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT        NOT NULL,
  is_super_admin BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT admins_email_unique UNIQUE (email),
  CONSTRAINT admins_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- ─── domains ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS domains (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain                 TEXT        NOT NULL,
  registered_by_admin_id UUID        REFERENCES admins (id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active              BOOLEAN     NOT NULL DEFAULT true,

  CONSTRAINT domains_domain_unique UNIQUE (domain),
  -- Basic domain format: at least one label, a dot, and a TLD
  CONSTRAINT domains_domain_format CHECK (domain ~* '^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?)+$')
);

-- ─── users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL,
  domain     TEXT        NOT NULL REFERENCES domains (domain) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login TIMESTAMPTZ,

  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- ─── processing_stats ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS processing_stats (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email    TEXT        NOT NULL,
  user_domain   TEXT        NOT NULL,
  status        TEXT        NOT NULL,
  file_name     TEXT        NOT NULL,
  error_message TEXT,                      -- NULL when status != 'failed'
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT processing_stats_status_values
    CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- admins
CREATE INDEX IF NOT EXISTS idx_admins_email
  ON admins (email);

CREATE INDEX IF NOT EXISTS idx_admins_super
  ON admins (is_super_admin)
  WHERE is_super_admin = true;

-- domains
CREATE INDEX IF NOT EXISTS idx_domains_domain
  ON domains (domain);

CREATE INDEX IF NOT EXISTS idx_domains_admin_id
  ON domains (registered_by_admin_id);

CREATE INDEX IF NOT EXISTS idx_domains_active
  ON domains (domain)
  WHERE is_active = true;

-- users
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users (email);

CREATE INDEX IF NOT EXISTS idx_users_domain
  ON users (domain);

-- processing_stats
CREATE INDEX IF NOT EXISTS idx_stats_user_email
  ON processing_stats (user_email);

CREATE INDEX IF NOT EXISTS idx_stats_user_domain
  ON processing_stats (user_domain);

CREATE INDEX IF NOT EXISTS idx_stats_status
  ON processing_stats (status);

CREATE INDEX IF NOT EXISTS idx_stats_processed_at
  ON processing_stats (processed_at DESC);

-- Composite: dashboard queries filter by domain + status together
CREATE INDEX IF NOT EXISTS idx_stats_domain_status
  ON processing_stats (user_domain, status);
