import request from 'supertest';
import { createApp } from '../../src/app';
import { resetDatabase, seedDomain, seedAdmin, seedProcessingRecord } from '../helpers/db';
import { createAdminToken } from '../helpers/factories';

const app = createApp();

let superAdminToken:  string;
let regularAdminToken: string;

beforeEach(async () => {
  await resetDatabase();
  await seedAdmin('super@acme.com',   true);
  await seedAdmin('regular@acme.com', false);
  superAdminToken   = createAdminToken('super@acme.com');
  regularAdminToken = createAdminToken('regular@acme.com');
});

// ─── Domain management ────────────────────────────────────────────────────────

describe('POST /api/admin/domains/register', () => {
  it('registers a new domain', async () => {
    const res = await request(app)
      .post('/api/admin/domains/register')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ domain: 'newco.com' });
    expect(res.status).toBe(201);
    expect(res.body.data.domain).toBe('newco.com');
  });

  it('returns 409 for a duplicate domain', async () => {
    await seedDomain('dupe.com', 'super@acme.com');
    const res = await request(app)
      .post('/api/admin/domains/register')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ domain: 'dupe.com' });
    expect(res.status).toBe(409);
  });

  it('returns 400 for an invalid domain format', async () => {
    const res = await request(app)
      .post('/api/admin/domains/register')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ domain: 'not a domain' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/admin/domains/register')
      .send({ domain: 'x.com' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/domains', () => {
  it('returns all domains with aggregated stats', async () => {
    await seedDomain('alpha.com', 'super@acme.com');
    await seedDomain('beta.com',  'super@acme.com');
    await seedProcessingRecord({ userEmail: 'u@alpha.com', userDomain: 'alpha.com', status: 'completed' });

    const res = await request(app)
      .get('/api/admin/domains')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);

    const alpha = res.body.data.find((d: { domain: string }) => d.domain === 'alpha.com');
    expect(alpha.files_processed).toBe(1);
    expect(alpha.success_count).toBe(1);
  });
});

describe('PATCH /api/admin/domains/:id/toggle', () => {
  it('toggles the is_active flag', async () => {
    const id = await seedDomain('toggle.com', 'super@acme.com', true);

    const res = await request(app)
      .patch(`/api/admin/domains/${id}/toggle`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(false);

    const res2 = await request(app)
      .patch(`/api/admin/domains/${id}/toggle`)
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res2.body.data.is_active).toBe(true);
  });

  it('returns 404 for an unknown domain id', async () => {
    const res = await request(app)
      .patch('/api/admin/domains/00000000-0000-0000-0000-000000000000/toggle')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for a non-UUID id', async () => {
    const res = await request(app)
      .patch('/api/admin/domains/not-a-uuid/toggle')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/admin/domains/:id', () => {
  it('allows a super admin to delete a domain', async () => {
    const id = await seedDomain('goodbye.com', 'super@acme.com');
    const res = await request(app)
      .delete(`/api/admin/domains/${id}`)
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
  });

  it('returns 403 for a regular admin', async () => {
    const id = await seedDomain('protected.com', 'super@acme.com');
    const res = await request(app)
      .delete(`/api/admin/domains/${id}`)
      .set('Authorization', `Bearer ${regularAdminToken}`);
    expect(res.status).toBe(403);
  });
});

// ─── Statistics ───────────────────────────────────────────────────────────────

describe('GET /api/admin/stats', () => {
  it('returns summary, by_domain, by_email, and timeline', async () => {
    await seedDomain('stats.com', 'super@acme.com');
    await seedProcessingRecord({ userEmail: 'u@stats.com', userDomain: 'stats.com', status: 'completed' });
    await seedProcessingRecord({ userEmail: 'u@stats.com', userDomain: 'stats.com', status: 'failed' });

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const { summary, by_domain, by_email, timeline } = res.body.data;
    expect(summary.total).toBe(2);
    expect(summary.completed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(Array.isArray(by_domain)).toBe(true);
    expect(Array.isArray(by_email)).toBe(true);
    expect(Array.isArray(timeline)).toBe(true);
  });

  it('filters by domain', async () => {
    await seedDomain('a.com', 'super@acme.com');
    await seedDomain('b.com', 'super@acme.com');
    await seedProcessingRecord({ userEmail: 'u@a.com', userDomain: 'a.com' });
    await seedProcessingRecord({ userEmail: 'u@b.com', userDomain: 'b.com' });

    const res = await request(app)
      .get('/api/admin/stats?domain=a.com')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.body.data.summary.total).toBe(1);
  });
});

describe('GET /api/admin/stats/export', () => {
  it('returns a CSV file attachment', async () => {
    await seedDomain('export.com', 'super@acme.com');
    await seedProcessingRecord({ userEmail: 'u@export.com', userDomain: 'export.com' });

    const res = await request(app)
      .get('/api/admin/stats/export')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.text).toContain('user_email');
  });
});

// ─── Admin creation ───────────────────────────────────────────────────────────

describe('POST /api/admin/create', () => {
  it('allows a super admin to create a new admin', async () => {
    const res = await request(app)
      .post('/api/admin/create')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ email: 'new@acme.com', is_super_admin: false });
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('new@acme.com');
  });

  it('returns 403 for a regular admin', async () => {
    const res = await request(app)
      .post('/api/admin/create')
      .set('Authorization', `Bearer ${regularAdminToken}`)
      .send({ email: 'new@acme.com' });
    expect(res.status).toBe(403);
  });

  it('returns 409 when the email already exists', async () => {
    const res = await request(app)
      .post('/api/admin/create')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ email: 'regular@acme.com' });
    expect(res.status).toBe(409);
  });
});
