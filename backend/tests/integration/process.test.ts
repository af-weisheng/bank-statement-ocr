import request from 'supertest';
import { createApp } from '../../src/app';
import { resetDatabase, seedDomain, seedProcessingRecord } from '../helpers/db';
import { createUserToken, createMinimalPDFBuffer } from '../helpers/factories';

// Mock the OCR pipeline so tests are fast and don't require Tesseract or Sharp.
jest.mock('../../src/ocr', () => ({
  processBankStatement: jest.fn().mockResolvedValue({
    success:          true,
    csv:              'Date,Payer/Payee Name,Transaction Id,Transaction Type,Amount,Memo,,,\n01/15/2024,NTUC FairPrice,,Debit,-45.30,,,\n',
    bankType:         'DBS',
    transactionCount: 1,
  }),
}));

const app      = createApp();
const USER     = 'user@acme.com';
const DOMAIN   = 'acme.com';

let userToken: string;

beforeEach(async () => {
  await resetDatabase();
  await seedDomain(DOMAIN, 'admin@acme.com');
  userToken = createUserToken(USER, DOMAIN);
});

// ─── POST /api/process/upload ─────────────────────────────────────────────────

describe('POST /api/process/upload', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/process/upload')
      .attach('statement', createMinimalPDFBuffer(), 'statement.pdf');
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file is attached', async () => {
    const res = await request(app)
      .post('/api/process/upload')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for an unsupported file type', async () => {
    const res = await request(app)
      .post('/api/process/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('statement', Buffer.from('plain text'), {
        filename: 'statement.txt',
        contentType: 'text/plain',
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 and CSV data for a valid PDF upload', async () => {
    const res = await request(app)
      .post('/api/process/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('statement', createMinimalPDFBuffer(), {
        filename: 'statement.pdf',
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.csv).toBeDefined();
    expect(res.body.data.bankType).toBe('DBS');
    expect(res.body.data.transactionCount).toBe(1);
  });

  it('writes a processing_stats record on success', async () => {
    await request(app)
      .post('/api/process/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('statement', createMinimalPDFBuffer(), {
        filename: 'statement.pdf',
        contentType: 'application/pdf',
      });

    const history = await request(app)
      .get('/api/process/history')
      .set('Authorization', `Bearer ${userToken}`);

    expect(history.body.data.total).toBe(1);
    expect(history.body.data.items[0].status).toBe('completed');
  });

  it('returns 400 and records a failed status when OCR fails', async () => {
    const { processBankStatement } = jest.requireMock('../../src/ocr') as {
      processBankStatement: jest.Mock;
    };
    processBankStatement.mockResolvedValueOnce({
      success: false,
      error:   'No transactions found.',
    });

    const res = await request(app)
      .post('/api/process/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('statement', createMinimalPDFBuffer(), {
        filename: 'statement.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);

    const history = await request(app)
      .get('/api/process/history')
      .set('Authorization', `Bearer ${userToken}`);
    expect(history.body.data.items[0].status).toBe('failed');
  });
});

// ─── GET /api/process/history ─────────────────────────────────────────────────

describe('GET /api/process/history', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/process/history');
    expect(res.status).toBe(401);
  });

  it('returns empty results for a new user', async () => {
    const res = await request(app)
      .get('/api/process/history')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('returns only the requesting user's records', async () => {
    await seedProcessingRecord({ userEmail: USER, userDomain: DOMAIN, status: 'completed' });
    await seedProcessingRecord({ userEmail: 'other@acme.com', userDomain: DOMAIN, status: 'completed' });

    const res = await request(app)
      .get('/api/process/history')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].file_name).toBeDefined();
  });

  it('respects limit and offset pagination', async () => {
    for (let i = 0; i < 5; i++) {
      await seedProcessingRecord({ userEmail: USER, userDomain: DOMAIN });
    }

    const page1 = await request(app)
      .get('/api/process/history?limit=3&offset=0')
      .set('Authorization', `Bearer ${userToken}`);

    expect(page1.body.data.items).toHaveLength(3);
    expect(page1.body.data.total).toBe(5);

    const page2 = await request(app)
      .get('/api/process/history?limit=3&offset=3')
      .set('Authorization', `Bearer ${userToken}`);

    expect(page2.body.data.items).toHaveLength(2);
  });

  it('clamps limit to the [1, 100] range', async () => {
    const res = await request(app)
      .get('/api/process/history?limit=9999')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.body.data.limit).toBe(100);
  });
});
