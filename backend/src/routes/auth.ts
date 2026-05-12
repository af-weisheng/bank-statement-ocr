import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../database/connection';
import {
  generateMagicLink,
  generateSessionToken,
  sendMagicLinkEmail,
  verifyMagicLink,
  verifyAdminMagicLink,
} from '../auth/magicLink';
import { authenticateUser, authenticateAdmin } from '../auth/middleware';
import { ApiResponse } from '@bank-statement-ocr/shared';

export const authRouter = Router();

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Wraps an async handler so unhandled promise rejections flow to Express's error handler. */
function asyncRoute(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normEmail(email: string): string {
  return email.toLowerCase().trim();
}

function domainOf(email: string): string {
  return email.split('@')[1].toLowerCase();
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────
// Keyed per email address (falls back to IP if body hasn't been parsed yet).
// NOTE: uses an in-memory store — swap for a Redis store in multi-instance prod.

const magicLinkLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  keyGenerator: (req: Request) =>
    `magic:${(((req.body as Record<string, unknown>)?.email as string) || req.ip || '').toLowerCase()}`,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many login attempts. Please wait an hour before trying again.',
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── POST /api/auth/request-login ────────────────────────────────────────────

authRouter.post(
  '/request-login',
  magicLinkLimiter,
  asyncRoute(async (req, res) => {
    const { email } = req.body as { email?: string };

    if (!email || !EMAIL_RE.test(email)) {
      res.status(400).json({ success: false, error: 'A valid email address is required.' });
      return;
    }

    const normalized = normEmail(email);
    const domain = domainOf(normalized);

    const { rows } = await query<{ domain: string }>(
      'SELECT domain FROM domains WHERE domain = $1 AND is_active = true',
      [domain]
    );

    if (rows.length === 0) {
      res.status(403).json({
        success: false,
        error: 'Your email domain is not registered. Please contact your administrator.',
      });
      return;
    }

    const token = generateMagicLink(normalized, 'user');
    await sendMagicLinkEmail(normalized, token);

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Check your email for a login link.' },
    };
    res.json(response);
  })
);

// ─── POST /api/auth/verify ────────────────────────────────────────────────────

authRouter.post(
  '/verify',
  asyncRoute(async (req, res) => {
    const { token } = req.body as { token?: string };

    if (!token || typeof token !== 'string') {
      res.status(400).json({ success: false, error: 'Token is required.' });
      return;
    }

    let email: string;
    try {
      ({ email } = await verifyMagicLink(token));
    } catch (err) {
      res.status(401).json({
        success: false,
        error: err instanceof Error ? err.message : 'Invalid token.',
      });
      return;
    }

    const domain = domainOf(email);

    // Upsert user and refresh last_login in a single round-trip
    const { rows } = await query<{ email: string; domain: string }>(
      `INSERT INTO users (email, domain)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET last_login = now()
       RETURNING email, domain`,
      [email, domain]
    );

    const user = rows[0];
    const sessionToken = generateSessionToken(user.email, user.domain, 'user');

    const response: ApiResponse<{ token: string; user: { email: string; domain: string } }> = {
      success: true,
      data: { token: sessionToken, user: { email: user.email, domain: user.domain } },
    };
    res.json(response);
  })
);

// ─── POST /api/auth/admin/request-login ──────────────────────────────────────

authRouter.post(
  '/admin/request-login',
  magicLinkLimiter,
  asyncRoute(async (req, res) => {
    const { email } = req.body as { email?: string };

    if (!email || !EMAIL_RE.test(email)) {
      res.status(400).json({ success: false, error: 'A valid email address is required.' });
      return;
    }

    const normalized = normEmail(email);

    const { rows } = await query<{ email: string }>(
      'SELECT email FROM admins WHERE email = $1',
      [normalized]
    );

    // Return the same message regardless of whether the admin exists,
    // to prevent admin email enumeration.
    const safeResponse: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'If that address is registered, you will receive a login link.' },
    };

    if (rows.length === 0) {
      res.json(safeResponse);
      return;
    }

    const token = generateMagicLink(normalized, 'admin');
    await sendMagicLinkEmail(normalized, token);

    res.json(safeResponse);
  })
);

// ─── POST /api/auth/admin/verify ─────────────────────────────────────────────

authRouter.post(
  '/admin/verify',
  asyncRoute(async (req, res) => {
    const { token } = req.body as { token?: string };

    if (!token || typeof token !== 'string') {
      res.status(400).json({ success: false, error: 'Token is required.' });
      return;
    }

    let email: string;
    try {
      ({ email } = await verifyAdminMagicLink(token));
    } catch (err) {
      res.status(401).json({
        success: false,
        error: err instanceof Error ? err.message : 'Invalid token.',
      });
      return;
    }

    const { rows } = await query<{ email: string; is_super_admin: boolean }>(
      'SELECT email, is_super_admin FROM admins WHERE email = $1',
      [email]
    );

    if (rows.length === 0) {
      res.status(403).json({ success: false, error: 'Admin account not found.' });
      return;
    }

    const admin = rows[0];
    const sessionToken = generateSessionToken(admin.email, undefined, 'admin');

    const response: ApiResponse<{
      token: string;
      admin: { email: string; is_super_admin: boolean };
    }> = {
      success: true,
      data: { token: sessionToken, admin: { email: admin.email, is_super_admin: admin.is_super_admin } },
    };
    res.json(response);
  })
);

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

authRouter.get('/me', authenticateUser, (req: Request, res: Response) => {
  const response: ApiResponse<{ email: string; domain: string }> = {
    success: true,
    data: { email: req.user!.email, domain: req.user!.domain },
  };
  res.json(response);
});

// ─── GET /api/auth/admin/me ───────────────────────────────────────────────────

authRouter.get(
  '/admin/me',
  authenticateAdmin,
  asyncRoute(async (req, res) => {
    const response: ApiResponse<{ email: string; is_super_admin: boolean }> = {
      success: true,
      data: { email: req.admin!.email, is_super_admin: req.admin!.is_super_admin },
    };
    res.json(response);
  })
);
