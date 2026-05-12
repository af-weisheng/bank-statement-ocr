import { Request, Response, NextFunction } from 'express';
import { decodeSessionToken } from './magicLink';
import { query } from '../database/connection';

// ─── authenticateUser ─────────────────────────────────────────────────────────

/**
 * Express middleware that validates a Bearer session token for regular users.
 * On success, populates `req.user` with { email, domain }.
 * Returns 401 if the token is missing, invalid, or expired.
 */
export async function authenticateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ success: false, error: 'No authorization token provided.' });
    return;
  }

  try {
    const payload = decodeSessionToken(token);
    if (payload.type !== 'user') {
      res.status(401).json({ success: false, error: 'Token is not a user session token.' });
      return;
    }
    req.user = { email: payload.email, domain: payload.domain ?? '' };
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Authentication failed.';
    res.status(401).json({ success: false, error: message });
  }
}

// ─── authenticateAdmin ────────────────────────────────────────────────────────

/**
 * Express middleware that validates a Bearer session token for admins.
 * Performs a live database lookup to confirm the admin account still exists.
 * Populates `req.admin` with { email, is_super_admin }.
 * Returns 401 for invalid/expired tokens and 403 if not an admin.
 */
export async function authenticateAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ success: false, error: 'No authorization token provided.' });
    return;
  }

  try {
    const payload = decodeSessionToken(token);
    if (payload.type !== 'admin') {
      res.status(403).json({ success: false, error: 'Admin access required.' });
      return;
    }

    const { rows } = await query<{ email: string; is_super_admin: boolean }>(
      'SELECT email, is_super_admin FROM admins WHERE email = $1',
      [payload.email]
    );

    if (rows.length === 0) {
      res.status(403).json({ success: false, error: 'Admin account not found.' });
      return;
    }

    req.admin = { email: rows[0].email, is_super_admin: rows[0].is_super_admin };
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Authentication failed.';
    // JWT errors → 401; DB errors → pass to global error handler
    const isAuthError =
      message.includes('expired') ||
      message.includes('Invalid') ||
      message.includes('not valid');
    if (isAuthError) {
      res.status(401).json({ success: false, error: message });
    } else {
      next(err);
    }
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}
