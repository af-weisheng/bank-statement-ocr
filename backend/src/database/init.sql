-- Seed the initial super-admin account.
--
-- ── Option A – psql (pass the variable on the command line) ─────────────────
--
--   psql "$DATABASE_URL" \
--     -v SUPER_ADMIN_EMAIL='admin@example.com' \
--     -f src/database/init.sql
--
-- ── Option B – npm script (reads SUPER_ADMIN_EMAIL from backend/.env) ────────
--
--   npm run db:migrate          (from the /backend directory)
--   # or from the monorepo root:
--   npm run db:migrate --workspace=backend
--
-- The INSERT is idempotent: running this file multiple times is safe.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO admins (email, is_super_admin)
VALUES (:'SUPER_ADMIN_EMAIL', true)
ON CONFLICT (email)
  DO UPDATE SET is_super_admin = true;

-- Confirm the result
SELECT
  id,
  email,
  is_super_admin,
  to_char(created_at, 'YYYY-MM-DD HH24:MI:SS TZ') AS created_at
FROM admins
WHERE is_super_admin = true
ORDER BY created_at;
