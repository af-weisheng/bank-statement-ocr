import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
  // Enable SSL in production (required by most hosted Postgres providers)
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

pool.on('error', (err: Error) => {
  console.error('[db] Unexpected pool error:', err.message);
});

/**
 * Run a single parameterised query, borrowing a client from the pool.
 * The client is released automatically whether the query succeeds or throws.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const client = await pool.connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}

/**
 * Run multiple queries inside a single transaction.
 * Rolls back automatically on any error and re-throws.
 *
 * @example
 * await withTransaction(async (client) => {
 *   await client.query('INSERT INTO users ...', [...]);
 *   await client.query('INSERT INTO processing_stats ...', [...]);
 * });
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Verify the pool can reach the database. Used in health checks. */
export async function checkConnection(): Promise<void> {
  const { rows } = await query<{ now: Date }>('SELECT now()');
  if (!rows[0]?.now) throw new Error('Database ping returned no result');
}
