import { Transaction } from './bankParsers/parserUtils';

// ─── CSV header ───────────────────────────────────────────────────────────────

const HEADER =
  'Date (MM/DD/YYYY),Payer/Payee Name,Transaction Id,Transaction Type,Amount,Memo,' +
  'NS Internal Customer Id,NS Customer Name,Invoice Number(s)';

// ─── generateCSV ─────────────────────────────────────────────────────────────

/**
 * Converts an array of OCR transactions to a NetSuite-compatible CSV string.
 *
 * Column rules:
 *  - Date:             MM/DD/YYYY
 *  - Amount:           positive for Credits (receipts), negative for Debits (payments)
 *  - Last 3 columns:   always empty (NS Internal Customer Id, NS Customer Name, Invoice Number(s))
 *  - CSV escaping:     fields containing commas, double-quotes, or newlines are wrapped
 *                      in double-quotes; internal double-quotes are doubled.
 */
export function generateCSV(transactions: Transaction[]): string {
  const rows = transactions.map((txn) => {
    const date = formatDate(txn.date);
    const name = escapeField(txn.payerPayeeName);
    const id = escapeField(txn.transactionId);
    const type = escapeField(txn.transactionType);
    const amount = formatAmount(txn.amount, txn.transactionType);
    const memo = escapeField(txn.memo);

    // Last three columns are intentionally blank (NS Internal Customer Id,
    // NS Customer Name, Invoice Number(s)).
    return `${date},${name},${id},${type},${amount},${memo},,,`;
  });

  return [HEADER, ...rows].join('\n');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Formats a Date as MM/DD/YYYY. */
function formatDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/**
 * Formats the transaction amount:
 *  - Credit (receipt) → positive number
 *  - Debit (payment)  → negative number
 */
function formatAmount(amount: number, type: 'Debit' | 'Credit'): string {
  const abs = Math.abs(amount).toFixed(2);
  return type === 'Debit' ? `-${abs}` : abs;
}

/**
 * RFC 4180 CSV field escaping.
 * Wraps in double-quotes and doubles any embedded double-quotes when necessary.
 */
function escapeField(value: string): string {
  if (!value) return '';
  const needsQuoting = value.includes(',') || value.includes('"') || value.includes('\n');
  if (!needsQuoting) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
