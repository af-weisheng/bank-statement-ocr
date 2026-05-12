import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// ─── Payload shapes ───────────────────────────────────────────────────────────

interface MagicLinkPayload {
  email: string;
  purpose: 'magic-link';
  type: 'user' | 'admin';
}

export interface SessionPayload {
  email: string;
  domain?: string;
  type: 'user' | 'admin';
  purpose: 'session';
}

// ─── SMTP transporter (singleton) ────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

function parseFrontendUrl(): string {
  const origins = process.env.ALLOWED_ORIGINS || 'http://localhost:3000';
  return origins.split(',')[0].trim();
}

function buildMagicLinkEmailHtml(email: string, magicLink: string): string {
  // Load and cache the HTML template from disk.
  // At runtime (ts-node or compiled): resolves to src/templates/ or dist/templates/.
  const templatePath = path.resolve(__dirname, '../templates/magicLinkEmail.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  return template
    .replace(/\{\{EMAIL\}\}/g, escapeHtml(email))
    .replace(/\{\{MAGIC_LINK\}\}/g, magicLink);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Token generation ─────────────────────────────────────────────────────────

/**
 * Generates a 15-minute JWT intended for a single-use magic-link login.
 * @param type  'user' (default) or 'admin' — enforced at verification time.
 */
export function generateMagicLink(email: string, type: 'user' | 'admin' = 'user'): string {
  const payload: MagicLinkPayload = { email, purpose: 'magic-link', type };
  return jwt.sign(payload, jwtSecret(), { expiresIn: '15m' });
}

/**
 * Generates a long-lived session JWT returned to the client after successful login.
 */
export function generateSessionToken(
  email: string,
  domain: string | undefined,
  type: 'user' | 'admin'
): string {
  const payload: SessionPayload = { email, domain, type, purpose: 'session' };
  return jwt.sign(payload, jwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// ─── Email delivery ───────────────────────────────────────────────────────────

/**
 * Sends a magic-link email to `email`.
 * The link points to {ALLOWED_ORIGINS[0]}/verify?token=<token>.
 */
export async function sendMagicLinkEmail(email: string, token: string): Promise<void> {
  const frontendUrl = parseFrontendUrl();
  const magicLink = `${frontendUrl}/verify?token=${encodeURIComponent(token)}`;
  const html = buildMagicLinkEmailHtml(email, magicLink);

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@bankstatementocr.com',
    to: email,
    subject: 'Login to Bank Statement OCR',
    html,
  });
}

// ─── Token verification ───────────────────────────────────────────────────────

/** Verifies a user magic-link token and returns the encoded email. */
export async function verifyMagicLink(token: string): Promise<{ email: string }> {
  return decodeMagicLinkToken(token, 'user');
}

/** Verifies an admin magic-link token and returns the encoded email. */
export async function verifyAdminMagicLink(token: string): Promise<{ email: string }> {
  return decodeMagicLinkToken(token, 'admin');
}

/** Decodes and validates a session token. Used by auth middleware. */
export function decodeSessionToken(token: string): SessionPayload {
  let payload: SessionPayload;
  try {
    payload = jwt.verify(token, jwtSecret()) as SessionPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new Error('Session has expired. Please log in again.');
    }
    throw new Error('Invalid session token.');
  }
  if (payload.purpose !== 'session') {
    throw new Error('Invalid token purpose.');
  }
  return payload;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function decodeMagicLinkToken(token: string, expectedType: 'user' | 'admin'): { email: string } {
  let payload: MagicLinkPayload;
  try {
    payload = jwt.verify(token, jwtSecret()) as MagicLinkPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new Error('Magic link has expired. Please request a new one.');
    }
    throw new Error('Invalid or malformed magic link.');
  }

  if (payload.purpose !== 'magic-link') {
    throw new Error('This token cannot be used as a magic link.');
  }
  if (payload.type !== expectedType) {
    throw new Error(`This link is not valid for ${expectedType} login.`);
  }

  return { email: payload.email };
}
