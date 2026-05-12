// ─── Environment ──────────────────────────────────────────────────────────────
// Must be set before any module imports the database connection or JWT utils.

process.env.NODE_ENV   = 'test';
process.env.JWT_SECRET = 'jest-test-secret-do-not-use-in-production';
process.env.JWT_EXPIRES_IN = '7d';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.MAX_FILE_SIZE_MB = '10';

// Point at the test database.  CI sets DATABASE_URL_TEST via the workflow env;
// locally developers can set it in .env.test or fall back to the dev database.
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

// ─── Global teardown ─────────────────────────────────────────────────────────

import { pool } from '../src/database/connection';

afterAll(async () => {
  await pool.end();
});
