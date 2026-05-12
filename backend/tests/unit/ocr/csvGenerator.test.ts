import { generateCSV } from '../../../src/ocr/csvGenerator';
import type { Transaction } from '../../../src/ocr/bankParsers/parserUtils';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const sampleTransactions: Transaction[] = [
  { date: '2024-01-15', description: 'NTUC FairPrice', amount: 45.30, type: 'debit'  },
  { date: '2024-01-20', description: 'Salary Payment',  amount: 3000,  type: 'credit' },
  { date: '2024-01-25', description: 'Grab Ride',       amount: 12.50, type: 'debit'  },
];

const csvWithSpecialChars: Transaction[] = [
  { date: '2024-01-10', description: 'Company, Inc "Quote"', amount: 100, type: 'debit' },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateCSV', () => {
  it('returns a non-empty string', () => {
    const csv = generateCSV(sampleTransactions);
    expect(typeof csv).toBe('string');
    expect(csv.length).toBeGreaterThan(0);
  });

  it('includes the NetSuite header row', () => {
    const csv = generateCSV(sampleTransactions);
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toContain('Date');
    expect(firstLine).toContain('Amount');
  });

  it('produces one data row per transaction', () => {
    const csv = generateCSV(sampleTransactions);
    const lines = csv.split('\n').filter(l => l.trim() !== '');
    // header + 3 data rows
    expect(lines).toHaveLength(4);
  });

  it('formats dates as MM/DD/YYYY', () => {
    const csv = generateCSV(sampleTransactions);
    expect(csv).toContain('01/15/2024');
    expect(csv).toContain('01/20/2024');
  });

  it('represents debit amounts as negative numbers', () => {
    const csv = generateCSV(sampleTransactions);
    expect(csv).toContain('-45.30');
    expect(csv).toContain('-12.50');
  });

  it('represents credit amounts as positive numbers', () => {
    const csv = generateCSV(sampleTransactions);
    expect(csv).toContain('3000');
  });

  it('escapes commas and quotes per RFC 4180', () => {
    const csv = generateCSV(csvWithSpecialChars);
    // Description contains a comma and a quote — must be wrapped in double quotes
    expect(csv).toContain('"Company, Inc ""Quote"""');
  });

  it('returns an empty string (header only) for empty input', () => {
    const csv = generateCSV([]);
    const lines = csv.split('\n').filter(l => l.trim() !== '');
    expect(lines).toHaveLength(1); // just the header
  });
});
