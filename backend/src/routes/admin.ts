import { Router, Request, Response, NextFunction } from 'express';
import { authenticateAdmin } from '../auth/middleware';
import { query } from '../database/connection';
import { ApiResponse } from '@bank-statement-ocr/shared';

export const adminRouter = Router();

// All routes in this file require admin authentication.
adminRouter.use(authenticateAdmin);

// ─── Utilities ────────────────────────────────────────────────────────────────

const UUID_RE   = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Matches the CHECK constraint in schema.sql — lowercase labels + dots + TLD.
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Wraps an async route handler so unhandled rejections reach the global error handler. */
function asyncRoute(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

/**
 * Sends 403 and returns false when the authenticated admin is not a super-admin.
 * Use at the top of routes that require elevated access.
 */
function requireSuperAdmin(req: Request, res: Response): boolean {
  if (!req.admin?.is_super_admin) {
    res.status(403).json({ success: false, error: 'Super-admin access required.' });
    return false;
  }
  return true;
}

function validateUuid(id: string, res: Response): boolean {
  if (!UUID_RE.test(id)) {
    res.status(400).json({ success: false, error: 'Invalid ID format.' });
    return false;
  }
  return true;
}

/** Returns 0 when total is 0 to avoid division by zero. One decimal place. */
function pct(numerator: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((numerator / total) * 1000) / 10;
}

// ─── Filter builder for stats queries ────────────────────────────────────────
// Builds a parameterised WHERE clause from optional query parameters.
// The returned `params` array is ordered to match the $N placeholders.

interface StatsFilters {
  startDate?: string;
  endDate?: string;
  domain?: string;
  email?: string;
}

function buildStatsWhere(f: StatsFilters): { where: string; params: unknown[] } {
  const conds: string[] = [];
  const params: unknown[] = [];

  if (f.startDate) {
    params.push(new Date(f.startDate));
    conds.push(`processed_at >= $${params.length}`);
  }
  if (f.endDate) {
    params.push(new Date(f.endDate));
    conds.push(`processed_at <= $${params.length}`);
  }
  if (f.domain) {
    params.push(f.domain);
    conds.push(`user_domain = $${params.length}`);
  }
  if (f.email) {
    params.push(f.email);
    conds.push(`user_email = $${params.length}`);
  }

  return {
    where: conds.length ? `WHERE ${conds.join(' AND ')}` : '',
    params,
  };
}

/** RFC 4180 CSV field escaping. */
function csvEsc(val: string | null | undefined): string {
  const s = val == null ? '' : String(val);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function fmtTimestamp(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

// ─── 1. POST /api/admin/domains/register ─────────────────────────────────────

adminRouter.post(
  '/domains/register',
  asyncRoute(async (req, res) => {
    const raw = (req.body as { domain?: string }).domain;

    if (!raw || typeof raw !== 'string') {
      res.status(400).json({ success: false, error: 'domain is required.' });
      return;
    }
    if (raw.includes('@')) {
      res.status(400).json({
        success: false,
        error: "Domain must not include '@'. Use 'company.com', not 'user@company.com'.",
      });
      return;
    }

    const domain = raw.toLowerCase().trim();

    if (!DOMAIN_RE.test(domain)) {
      res.status(400).json({
        success: false,
        error:
          'Invalid domain format. Use lowercase labels separated by dots (e.g. company.com).',
      });
      return;
    }

    // Check for existing registration before hitting the UNIQUE constraint.
    const { rows: existing } = await query<{ id: string }>(
      'SELECT id FROM domains WHERE domain = $1',
      [domain]
    );
    if (existing.length > 0) {
      res.status(409).json({
        success: false,
        error: `Domain '${domain}' is already registered.`,
      });
      return;
    }

    // Resolve the admin's UUID via CTE and insert in one round-trip.
    // registered_by_admin_id is set to the current admin's row id.
    const { rows } = await query<{
      id: string;
      domain: string;
      is_active: boolean;
      created_at: Date;
      registered_by_admin_id: string;
    }>(
      `WITH admin AS (SELECT id FROM admins WHERE email = $2)
       INSERT INTO domains (domain, registered_by_admin_id, is_active)
       SELECT $1, id, true FROM admin
       RETURNING id, domain, is_active, created_at, registered_by_admin_id`,
      [domain, req.admin!.email]
    );

    if (rows.length === 0) {
      // Admin row not found — shouldn't happen since authenticateAdmin verified it.
      res.status(500).json({ success: false, error: 'Admin account not found.' });
      return;
    }

    const response: ApiResponse<typeof rows[0]> = { success: true, data: rows[0] };
    res.status(201).json(response);
  })
);

// ─── 2. GET /api/admin/domains ────────────────────────────────────────────────

adminRouter.get(
  '/domains',
  asyncRoute(async (_req, res) => {
    const { rows } = await query<{
      id: string;
      domain: string;
      is_active: boolean;
      created_at: Date;
      registered_by_admin_email: string | null;
      user_count: string;
      total_processed: string;
      success_count: string;
    }>(
      `SELECT
         d.id,
         d.domain,
         d.is_active,
         d.created_at,
         a.email                                         AS registered_by_admin_email,
         COUNT(DISTINCT u.id)                            AS user_count,
         COUNT(ps.id)                                    AS total_processed,
         COUNT(ps.id) FILTER (WHERE ps.status = 'completed') AS success_count
       FROM   domains d
       LEFT JOIN admins a           ON a.id   = d.registered_by_admin_id
       LEFT JOIN users u            ON u.domain = d.domain
       LEFT JOIN processing_stats ps ON ps.user_domain = d.domain
       GROUP  BY d.id, d.domain, d.is_active, d.created_at, a.email
       ORDER  BY d.created_at DESC`
    );

    const data = rows.map((r) => {
      const total   = parseInt(r.total_processed, 10);
      const success = parseInt(r.success_count, 10);
      return {
        id: r.id,
        domain: r.domain,
        is_active: r.is_active,
        created_at: r.created_at,
        registered_by_admin_email: r.registered_by_admin_email,
        user_count: parseInt(r.user_count, 10),
        total_processed: total,
        success_count: success,
        success_rate: pct(success, total),
      };
    });

    const response: ApiResponse<typeof data> = { success: true, data };
    res.json(response);
  })
);

// ─── 3. PATCH /api/admin/domains/:id/toggle ───────────────────────────────────

adminRouter.patch(
  '/domains/:id/toggle',
  asyncRoute(async (req, res) => {
    if (!validateUuid(req.params.id, res)) return;

    const { rows } = await query<{
      id: string;
      domain: string;
      is_active: boolean;
      created_at: Date;
    }>(
      `UPDATE domains
       SET    is_active = NOT is_active
       WHERE  id = $1
       RETURNING id, domain, is_active, created_at`,
      [req.params.id]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Domain not found.' });
      return;
    }

    const response: ApiResponse<typeof rows[0]> = { success: true, data: rows[0] };
    res.json(response);
  })
);

// ─── 4. DELETE /api/admin/domains/:id (super-admin only) ─────────────────────
// Soft-delete: sets is_active = false. The domain record and any referencing
// users are preserved. Users from this domain will no longer be able to log in
// once their domain is inactive.

adminRouter.delete(
  '/domains/:id',
  asyncRoute(async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    if (!validateUuid(req.params.id, res)) return;

    const { rows } = await query<{ id: string }>(
      `UPDATE domains SET is_active = false WHERE id = $1 RETURNING id`,
      [req.params.id]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Domain not found.' });
      return;
    }

    const response: ApiResponse<null> = { success: true };
    res.json(response);
  })
);

// ─── 5. GET /api/admin/stats ──────────────────────────────────────────────────

adminRouter.get(
  '/stats',
  asyncRoute(async (req, res) => {
    const q = req.query as Record<string, string | undefined>;

    // Validate date params before building the query.
    for (const key of ['startDate', 'endDate'] as const) {
      if (q[key] && isNaN(new Date(q[key]!).getTime())) {
        res.status(400).json({ success: false, error: `Invalid ${key} value.` });
        return;
      }
    }

    const { where, params } = buildStatsWhere({
      startDate: q.startDate,
      endDate:   q.endDate,
      domain:    q.domain,
      email:     q.email,
    });

    // Run all four aggregation queries in parallel.
    const [summaryRes, byDomainRes, byEmailRes, timelineRes] = await Promise.all([
      // Overall summary
      query<{
        total_files: string;
        success_count: string;
        failed_count: string;
      }>(
        `SELECT
           COUNT(*)                                          AS total_files,
           COUNT(*) FILTER (WHERE status = 'completed')     AS success_count,
           COUNT(*) FILTER (WHERE status = 'failed')        AS failed_count
         FROM processing_stats
         ${where}`,
        params
      ),

      // Breakdown by domain (top 50)
      query<{
        domain: string;
        total: string;
        success: string;
        failed: string;
      }>(
        `SELECT
           user_domain                                        AS domain,
           COUNT(*)                                           AS total,
           COUNT(*) FILTER (WHERE status = 'completed')      AS success,
           COUNT(*) FILTER (WHERE status = 'failed')         AS failed
         FROM processing_stats
         ${where}
         GROUP BY user_domain
         ORDER BY COUNT(*) DESC
         LIMIT 50`,
        params
      ),

      // Breakdown by email (top 50)
      query<{
        email: string;
        total: string;
        success: string;
        failed: string;
      }>(
        `SELECT
           user_email                                         AS email,
           COUNT(*)                                           AS total,
           COUNT(*) FILTER (WHERE status = 'completed')      AS success,
           COUNT(*) FILTER (WHERE status = 'failed')         AS failed
         FROM processing_stats
         ${where}
         GROUP BY user_email
         ORDER BY COUNT(*) DESC
         LIMIT 50`,
        params
      ),

      // Daily timeline
      query<{
        date: string;
        total: string;
        success: string;
        failed: string;
      }>(
        `SELECT
           (DATE_TRUNC('day', processed_at))::date::text      AS date,
           COUNT(*)                                            AS total,
           COUNT(*) FILTER (WHERE status = 'completed')       AS success,
           COUNT(*) FILTER (WHERE status = 'failed')          AS failed
         FROM processing_stats
         ${where}
         GROUP BY DATE_TRUNC('day', processed_at)
         ORDER BY DATE_TRUNC('day', processed_at) ASC`,
        params
      ),
    ]);

    const s = summaryRes.rows[0];
    const totalFiles   = parseInt(s?.total_files   ?? '0', 10);
    const successCount = parseInt(s?.success_count ?? '0', 10);
    const failedCount  = parseInt(s?.failed_count  ?? '0', 10);

    const data = {
      summary: {
        total_files:   totalFiles,
        success_count: successCount,
        failed_count:  failedCount,
        success_rate:  pct(successCount, totalFiles),
      },
      by_domain: byDomainRes.rows.map((r) => {
        const t = parseInt(r.total, 10);
        const sc = parseInt(r.success, 10);
        return { domain: r.domain, total: t, success: sc, failed: parseInt(r.failed, 10), success_rate: pct(sc, t) };
      }),
      by_email: byEmailRes.rows.map((r) => {
        const t = parseInt(r.total, 10);
        const sc = parseInt(r.success, 10);
        return { email: r.email, total: t, success: sc, failed: parseInt(r.failed, 10), success_rate: pct(sc, t) };
      }),
      timeline: timelineRes.rows.map((r) => ({
        date:    r.date,
        total:   parseInt(r.total,   10),
        success: parseInt(r.success, 10),
        failed:  parseInt(r.failed,  10),
      })),
    };

    const response: ApiResponse<typeof data> = { success: true, data };
    res.json(response);
  })
);

// ─── 6. GET /api/admin/stats/export ──────────────────────────────────────────
// Must be declared before any /:param route to prevent path shadowing.

adminRouter.get(
  '/stats/export',
  asyncRoute(async (req, res) => {
    const q = req.query as Record<string, string | undefined>;

    for (const key of ['startDate', 'endDate'] as const) {
      if (q[key] && isNaN(new Date(q[key]!).getTime())) {
        res.status(400).json({ success: false, error: `Invalid ${key} value.` });
        return;
      }
    }

    const { where, params } = buildStatsWhere({
      startDate: q.startDate,
      endDate:   q.endDate,
      domain:    q.domain,
      email:     q.email,
    });

    // Cap at 10,000 rows to prevent runaway responses.
    params.push(10_000);
    const limitParam = `$${params.length}`;

    const { rows } = await query<{
      processed_at: Date;
      user_email: string;
      user_domain: string;
      file_name: string;
      status: string;
      error_message: string | null;
    }>(
      `SELECT processed_at, user_email, user_domain, file_name, status, error_message
       FROM   processing_stats
       ${where}
       ORDER  BY processed_at DESC
       LIMIT  ${limitParam}`,
      params
    );

    const header = 'Date,Email,Domain,Filename,Status,Error';
    const lines  = rows.map((r) =>
      [
        csvEsc(fmtTimestamp(r.processed_at)),
        csvEsc(r.user_email),
        csvEsc(r.user_domain),
        csvEsc(r.file_name),
        csvEsc(r.status),
        csvEsc(r.error_message),
      ].join(',')
    );

    const csv = [header, ...lines].join('\n');
    const timestamp = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="stats-export-${timestamp}.csv"`
    );
    res.send(csv);
  })
);

// ─── 7. POST /api/admin/create (super-admin only) ─────────────────────────────

adminRouter.post(
  '/create',
  asyncRoute(async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;

    const { email, is_super_admin } = req.body as {
      email?: string;
      is_super_admin?: unknown;
    };

    if (!email || !EMAIL_RE.test(email)) {
      res.status(400).json({ success: false, error: 'A valid email address is required.' });
      return;
    }
    if (typeof is_super_admin !== 'boolean') {
      res.status(400).json({
        success: false,
        error: 'is_super_admin must be a boolean.',
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ON CONFLICT DO NOTHING: if the email already exists, RETURNING returns 0 rows.
    const { rows } = await query<{
      id: string;
      email: string;
      is_super_admin: boolean;
      created_at: Date;
    }>(
      `INSERT INTO admins (email, is_super_admin)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, is_super_admin, created_at`,
      [normalizedEmail, is_super_admin]
    );

    if (rows.length === 0) {
      res.status(409).json({
        success: false,
        error: `An admin with email '${normalizedEmail}' already exists.`,
      });
      return;
    }

    const response: ApiResponse<typeof rows[0]> = { success: true, data: rows[0] };
    res.status(201).json(response);
  })
);
