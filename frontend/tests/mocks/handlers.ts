import { http, HttpResponse } from 'msw';

const BASE = 'http://localhost:5000/api';

// ─── Default response shapes ──────────────────────────────────────────────────
// These are the happy-path defaults. Individual tests can override specific
// handlers with `server.use(...)` to exercise error / edge-case branches.

export const handlers = [

  // ── Auth ──────────────────────────────────────────────────────────────────

  http.post(`${BASE}/auth/request-login`, () =>
    HttpResponse.json({ success: true, message: 'Magic link sent.' }),
  ),

  http.post(`${BASE}/auth/verify`, () =>
    HttpResponse.json({
      success: true,
      data: {
        token: 'mock-session-token',
        user:  { email: 'user@acme.com', domain: 'acme.com' },
      },
    }),
  ),

  http.get(`${BASE}/auth/me`, () =>
    HttpResponse.json({
      success: true,
      data:    { email: 'user@acme.com', domain: 'acme.com' },
    }),
  ),

  // ── Admin auth ────────────────────────────────────────────────────────────

  http.post(`${BASE}/auth/admin/request-login`, () =>
    HttpResponse.json({ success: true, message: 'If this email is registered, a link has been sent.' }),
  ),

  http.post(`${BASE}/auth/admin/verify`, () =>
    HttpResponse.json({
      success: true,
      data: {
        token: 'mock-admin-session-token',
        admin: { email: 'admin@acme.com', is_super_admin: true },
      },
    }),
  ),

  http.get(`${BASE}/auth/admin/me`, () =>
    HttpResponse.json({
      success: true,
      data:    { email: 'admin@acme.com', is_super_admin: true },
    }),
  ),

  // ── Process ───────────────────────────────────────────────────────────────

  http.post(`${BASE}/process/upload`, () =>
    HttpResponse.json({
      success: true,
      data: {
        csv:              'Date,Amount\n01/15/2024,-45.30\n',
        bankType:         'DBS',
        transactionCount: 1,
      },
    }),
  ),

  http.get(`${BASE}/process/history`, () =>
    HttpResponse.json({
      success: true,
      data: {
        items: [
          {
            file_name:    'statement.pdf',
            status:       'completed',
            processed_at: '2024-01-15T10:00:00.000Z',
            error_message: null,
          },
        ],
        total:  1,
        limit:  20,
        offset: 0,
      },
    }),
  ),

  // ── Admin ─────────────────────────────────────────────────────────────────

  http.get(`${BASE}/admin/domains`, () =>
    HttpResponse.json({
      success: true,
      data: [
        {
          id:                  'uuid-1',
          domain:              'acme.com',
          registered_by_email: 'admin@acme.com',
          is_active:           true,
          user_count:          3,
          files_processed:     10,
          success_count:       9,
          failed_count:        1,
        },
      ],
    }),
  ),

  http.post(`${BASE}/admin/domains/register`, () =>
    HttpResponse.json({ success: true, data: { id: 'uuid-new', domain: 'newco.com' } }, { status: 201 }),
  ),

  http.patch(`${BASE}/admin/domains/:id/toggle`, () =>
    HttpResponse.json({ success: true, data: { id: 'uuid-1', is_active: false } }),
  ),

  http.delete(`${BASE}/admin/domains/:id`, () =>
    HttpResponse.json({ success: true }),
  ),

  http.get(`${BASE}/admin/stats`, () =>
    HttpResponse.json({
      success: true,
      data: {
        summary:   { total: 10, completed: 9, failed: 1, success_rate: 90.0 },
        by_domain: [{ domain: 'acme.com', total: 10, completed: 9, failed: 1 }],
        by_email:  [{ user_email: 'user@acme.com', user_domain: 'acme.com', total: 10, completed: 9, failed: 1 }],
        timeline:  [{ date: '2024-01-15', total: 10, completed: 9, failed: 1 }],
      },
    }),
  ),

  http.post(`${BASE}/admin/create`, () =>
    HttpResponse.json({ success: true, data: { email: 'new@acme.com' } }, { status: 201 }),
  ),
];
