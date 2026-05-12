import { query, withTransaction } from '../../src/database/connection';

/**
 * Deletes all rows from every application table in dependency-safe order.
 * Call in `beforeEach` for integration tests that write to the database.
 */
export async function resetDatabase(): Promise<void> {
  await query(
    'TRUNCATE TABLE processing_stats, users, domains, admins RESTART IDENTITY CASCADE'
  );
}

/**
 * Seeds a domain row and returns its `id`.
 */
export async function seedDomain(
  domain: string,
  registeredByEmail: string,
  isActive = true,
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO domains (domain, registered_by_email, is_active)
     VALUES ($1, $2, $3) RETURNING id`,
    [domain, registeredByEmail, isActive],
  );
  return result.rows[0].id;
}

/**
 * Seeds an admin row and returns its `id`.
 */
export async function seedAdmin(
  email: string,
  isSuperAdmin = false,
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO admins (email, is_super_admin)
     VALUES ($1, $2) RETURNING id`,
    [email, isSuperAdmin],
  );
  return result.rows[0].id;
}

/**
 * Seeds a processing_stats row for the given user.
 */
export async function seedProcessingRecord(opts: {
  userEmail:  string;
  userDomain: string;
  status?:    'completed' | 'failed';
  fileName?:  string;
}): Promise<void> {
  await query(
    `INSERT INTO processing_stats (user_email, user_domain, status, file_name)
     VALUES ($1, $2, $3, $4)`,
    [
      opts.userEmail,
      opts.userDomain,
      opts.status  ?? 'completed',
      opts.fileName ?? 'statement.pdf',
    ],
  );
}

export { withTransaction };
