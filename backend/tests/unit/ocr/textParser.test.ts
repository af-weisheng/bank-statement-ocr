import { detectBankType, parseTransactions } from '../../../src/ocr/textParser';
import {
  DBS_STATEMENT_TEXT,
  UOB_STATEMENT_TEXT,
  HSBC_STATEMENT_TEXT,
} from '../../helpers/factories';

// ─── detectBankType ───────────────────────────────────────────────────────────

describe('detectBankType', () => {
  it('detects DBS', () => {
    expect(detectBankType(DBS_STATEMENT_TEXT)).toBe('DBS');
  });

  it('detects UOB', () => {
    expect(detectBankType(UOB_STATEMENT_TEXT)).toBe('UOB');
  });

  it('detects HSBC', () => {
    expect(detectBankType(HSBC_STATEMENT_TEXT)).toBe('HSBC');
  });

  it('falls back to Generic for unknown text', () => {
    expect(detectBankType('This is not a bank statement at all.')).toBe('Generic');
  });

  it('is case-insensitive', () => {
    expect(detectBankType('dbs bank statement account')).toBe('DBS');
  });
});

// ─── parseTransactions ────────────────────────────────────────────────────────

describe('parseTransactions — DBS', () => {
  const transactions = parseTransactions(DBS_STATEMENT_TEXT, 'DBS');

  it('returns an array of transactions', () => {
    expect(Array.isArray(transactions)).toBe(true);
    expect(transactions.length).toBeGreaterThan(0);
  });

  it('each transaction has required fields', () => {
    for (const tx of transactions) {
      expect(tx).toHaveProperty('date');
      expect(tx).toHaveProperty('description');
      expect(tx).toHaveProperty('amount');
      expect(tx).toHaveProperty('type');
      expect(['debit', 'credit']).toContain(tx.type);
    }
  });

  it('parses salary as credit', () => {
    const salary = transactions.find(t =>
      t.description.toLowerCase().includes('salary'));
    expect(salary).toBeDefined();
    expect(salary!.type).toBe('credit');
    expect(salary!.amount).toBeGreaterThan(0);
  });

  it('parses a grocery purchase as debit', () => {
    const grocery = transactions.find(t =>
      t.description.toLowerCase().includes('ntuc') ||
      t.description.toLowerCase().includes('fairprice'));
    expect(grocery).toBeDefined();
    expect(grocery!.type).toBe('debit');
  });
});

describe('parseTransactions — UOB', () => {
  const transactions = parseTransactions(UOB_STATEMENT_TEXT, 'UOB');

  it('extracts transactions', () => {
    expect(transactions.length).toBeGreaterThan(0);
  });

  it('parses DD/MM/YYYY dates', () => {
    for (const tx of transactions) {
      // date should be parseable
      expect(new Date(tx.date).toString()).not.toBe('Invalid Date');
    }
  });
});

describe('parseTransactions — empty text', () => {
  it('returns empty array for blank input', () => {
    expect(parseTransactions('', 'DBS')).toEqual([]);
  });

  it('returns empty array for text with no transaction rows', () => {
    expect(parseTransactions('DBS Bank Header Only\nNo transactions here.', 'DBS'))
      .toEqual([]);
  });
});
