// ─── OCR Transaction type ─────────────────────────────────────────────────────
// This is the internal type used within the OCR pipeline.
// It is separate from the shared Transaction type used by the API/DB layers.

export interface Transaction {
  date: Date;
  payerPayeeName: string;
  transactionId: string;
  transactionType: 'Debit' | 'Credit';
  amount: number;
  memo: string;
}

// ─── parseAmount ──────────────────────────────────────────────────────────────

/** Strips commas and parses a formatted amount string to a number. */
export function parseAmount(value: string): number {
  return parseFloat(value.replace(/,/g, '')) || 0;
}

// ─── parseDate ───────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parses a date string from a bank statement.
 * Supported formats:
 *  - "15 Dec 2023"  "15 Dec"  "15 Dec 23"
 *  - "15/12/2023"   "15-12-2023"  (DD/MM/YYYY — Singapore locale)
 */
export function parseDate(dateStr: string): Date {
  const cleaned = dateStr.trim();

  // "DD Mon YYYY" or "DD Mon YY" or "DD Mon"
  const longDateMatch = cleaned.match(
    /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+(\d{2,4}))?$/i
  );
  if (longDateMatch) {
    const day = parseInt(longDateMatch[1], 10);
    const month = MONTH_MAP[longDateMatch[2].toLowerCase()];
    let year = longDateMatch[3] ? parseInt(longDateMatch[3], 10) : NaN;

    if (isNaN(year)) {
      year = inferYear(month);
    } else if (year < 100) {
      year += 2000;
    }
    return new Date(year, month, day);
  }

  // "DD/MM/YYYY" or "DD-MM-YYYY"
  const slashMatch = cleaned.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    const year = parseInt(slashMatch[3], 10);
    return new Date(year, month, day);
  }

  // Fallback: let Date constructor try (best-effort)
  const fallback = new Date(cleaned);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

/**
 * When a statement only shows "DD Mon" with no year, infer the year.
 * If the month is more than 2 months ahead of today it must be last year.
 */
function inferYear(month: number): number {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  return month > currentMonth + 2 ? currentYear - 1 : currentYear;
}

// ─── classifyByKeywords ───────────────────────────────────────────────────────

const DEBIT_KEYWORDS = [
  'WITHDRAWAL', 'WITHDRL', 'ATM CASH', 'CASH ATM', 'ATM WITHDR',
  'PAYMENT', 'BILL PAYMENT', 'BILL PAY', 'PAY TO',
  'TRANSFER OUT', 'OUTWARD TRANSFER', 'OUTWARD GIRO',
  'DEBIT', ' DR ', ' DR$',
  'PURCHASE', 'POS PURCHASE', 'INTERNET PURCHASE', 'ONLINE PURCHASE',
  'GIRO DEBIT', 'GIRO-DEBIT', 'GIRO PAYMENT',
  'NETS', 'EZ-LINK', 'EZLINK',
  'SERVICE FEE', 'BANK FEE', 'ADMIN FEE', 'CHARGE',
  'INTEREST CHARGED', 'INTEREST CHARGE',
  'CHEQUE', ' CHQ', 'CASHIER',
  'PAYNOW TO', 'PAYLAH', 'FUND TRANSFER TO', 'FAST PAYMENT TO',
];

const CREDIT_KEYWORDS = [
  'CREDIT', ' CR ', ' CR$',
  'DEPOSIT', 'CASH DEPOSIT',
  'SALARY', 'PAYROLL', 'WAGES', 'REMUNERATION',
  'GIRO CREDIT', 'GIRO-CREDIT', 'INWARD GIRO', 'INWARD TRANSFER',
  'TRANSFER IN', 'INCOMING', 'RECEIPT', 'RECEIVED',
  'REFUND', 'CASHBACK', 'CASH BACK', 'REBATE',
  'INTEREST EARNED', 'INTEREST CREDIT', 'INTEREST INCOME',
  'DIVIDEND', 'BONUS', 'INCENTIVE',
  'PAYNOW FROM', 'FUND TRANSFER FROM', 'FAST INCOMING', 'FAST RECEIPT',
];

/**
 * Classifies a transaction as Debit or Credit based on description keywords.
 * Defaults to 'Debit' when no conclusive keyword is found.
 */
export function classifyByKeywords(description: string): 'Debit' | 'Credit' {
  const upper = ` ${description.toUpperCase()} `;

  for (const kw of CREDIT_KEYWORDS) {
    if (upper.includes(kw)) return 'Credit';
  }
  for (const kw of DEBIT_KEYWORDS) {
    if (upper.includes(kw)) return 'Debit';
  }

  // Conservative default: treat unclassified transactions as debits.
  return 'Debit';
}
