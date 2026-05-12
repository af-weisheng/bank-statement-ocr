import request from 'supertest';
import { createApp } from '../../src/app';
import { resetDatabase, seedDomain, seedAdmin } from '../helpers/db';
import { createUserToken, createAdminToken, createMagicLinkToken } from '../helpers/factories';

// Mock email sending so no real SMTP calls happen.
jest.mock('../../src/auth/magicLink', () => ({
  ...jest.requireActual('../../src/auth/magicLink'),
  sendMagicLinkEmail: jest.fn().mockResolvedValue(undefined),
}));

const app = createApp();

beforeEach(async () => {
  await resetDatabase();
  await seedDomain('acme.com', 'admin@acme.com');
  await seedAdmin('admin@acme.com', true);
});

// ─── POST /api/auth/request-login ─────────────────────────────────────────────

describe('POST /api/auth/request-login', () => {
  it('returns 200 for a valid email on a registered domain', async () => {
    const res = await request(app)
      .post('/api/auth/request-login')
      .send({ email: 'user@acme.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 for an email on an unregistered domain', async () => {
    const res = await request(app)
      .post('/api/auth/request-login')
      .send({ email: 'user@unknown.com' });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for a missing email', async () => {
    const res = await request(app)
      .post('/api/auth/request-login')
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed email', async () => {
    const res = await request(app)
      .post('/api/auth/request-login')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('returns 403 for an email on a deactivated domain', async () => {
    await resetDatabase();
    await seedDomain('inactive.com', 'admin@inactive.com', false);
    const res = await request(app)
      .post('/api/auth/request-login')
      .send({ email: 'user@inactive.com' });
    expect(res.status).toBe(403);
  });
});

// ─── POST /api/auth/verify ────────────────────────────────────────────────────

describe('POST /api/auth/verify', () => {
  it('returns 200 and a session token for a valid magic-link token', async () => {
    const magicToken = createMagicLinkToken('user@acme.com', 'user');
    const res = await request(app)
      .post('/api/auth/verify')
      .send({ token: magicToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe('user@acme.com');
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .post('/api/auth/verify')
      .send({ token: 'definitely.not.a.valid.jwt' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for a missing token', async () => {
    const res = await request(app)
      .post('/api/auth/verify')
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 when an admin token is used on the user endpoint', async () => {
    const adminMagicToken = createMagicLinkToken('admin@acme.com', 'admin');
    const res = await request(app)
      .post('/api/auth/verify')
      .send({ token: adminMagicToken });
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns the user from a valid session token', async () => {
    const token = createUserToken('user@acme.com', 'acme.com');
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('user@acme.com');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed Authorization header', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'NotBearer token');
    expect(res.status).toBe(401);
  });
});

// ─── Admin auth ───────────────────────────────────────────────────────────────

describe('POST /api/auth/admin/request-login', () => {
  it('always returns 200 (prevents enumeration)', async () => {
    const existing = await request(app)
      .post('/api/auth/admin/request-login')
      .send({ email: 'admin@acme.com' });
    expect(existing.status).toBe(200);

    const missing = await request(app)
      .post('/api/auth/admin/request-login')
      .send({ email: 'ghost@acme.com' });
    expect(missing.status).toBe(200);
    // Responses should be identical to avoid timing attacks
    expect(existing.body.message).toBe(missing.body.message);
  });
});

describe('GET /api/auth/admin/me', () => {
  it('returns admin info with a valid admin token', async () => {
    const token = createAdminToken('admin@acme.com');
    const res = await request(app)
      .get('/api/auth/admin/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('admin@acme.com');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/admin/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 when a user session token is used', async () => {
    const userToken = createUserToken('user@acme.com', 'acme.com');
    const res = await request(app)
      .get('/api/auth/admin/me')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(401);
  });
});
