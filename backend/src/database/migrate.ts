/**
 * Database migration script.
 * Applies schema.sql then seeds the initial super-admin from SUPER_ADMIN_EMAIL.
 *
 * Usage:
 *   npm run db:migrate           (from /backend)
 *   npm run db:migrate --workspace=backend   (from monorepo root)
 */
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { pool } from './connection';

const SQL_DIR = path.join(__dirname, '.');

async function applySchema(client: Awaited<ReturnType<typeof pool.connect>>) {
  const sql = fs.readFileSync(path.join(SQL_DIR, 'schema.sql'), 'utf8');
  await client.query(sql);
  console.log('  ✓ schema applied');
}

async function seedSuperAdmin(client: Awaited<ReturnType<typeof pool.connect>>) {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim();
  if (!email) {
    console.warn('  ⚠  SUPER_ADMIN_EMAIL not set – skipping super-admin seed');
    return;
  }

  await client.query(
    `INSERT INTO admins (email, is_super_admin)
     VALUES ($1, true)
     ON CONFLICT (email) DO UPDATE SET is_super_admin = true`,
    [email]
  );
  console.log(`  ✓ super-admin seeded: ${email}`);
}

async function migrate() {
  console.log('Running database migrations…\n');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await applySchema(client);
    await seedSuperAdmin(client);
    await client.query('COMMIT');
    console.log('\nMigration complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err: Error) => {
  console.error('\nMigration failed:', err.message);
  process.exit(1);
});
