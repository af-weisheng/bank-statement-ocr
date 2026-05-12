import { Transaction, parseAmount, parseDate, classifyByKeywords } from './parserUtils';

// ─── Date patterns ────────────────────────────────────────────────────────────
// DBS/POSB statements use several date formats depending on account type:
//   "15 Dec"  "15 Dec 2023"  "15/12/2023"  "15-12-2023"

const DATE_RE = new RegExp(
  [
    // DD Mon YYYY or DD Mon
    String.raw`(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+\d{4})?)`,
    // DD/MM/YYYY or DD-MM-YYYY
    String.raw`(\d{2}[\/\-]\d{2}[\/\-]\d{4})`,
  ].join('|'),
  'i'
);

// A monetary amount: optional leading sign, digits with optional commas, decimal part.
const AMOUNT_RE = /(\d{1,3}(?:,\d{3})*\.\d{2})/g;

// ─── parseTransactions ────────────────────────────────────────────────────────

/**
 * Parses DBS/POSB bank statement text into Transaction objects.
 *
 * Handles the common multi-column layout:
 *   DATE   DESCRIPTION   [WITHDRAWAL]   [DEPOSIT]   BALANCE
 *
 * The balance is assumed to be the last amount on each line.
 * Debit/credit is inferred from description keywords when column
 * position cannot be determined (post-OCR).
 */
export function parseTransactions(text: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let txnIndex = 0;

  for (const line of lines) {
    const dateMatch = line.match(DATE_RE);
    if (!dateMatch) continue;

    const matchedDate = dateMatch[1] || dateMatch[2];
    if (!matchedDate) continue;

    // Remove date from line to get the rest.
    const rest = line.slice(line.indexOf(matchedDate) + matchedDate.length).trim();

    // Find all monetary amounts in the remaining text.
    const amountMatches = [...rest.matchAll(AMOUNT_RE)];
    if (amountMatches.length === 0) continue;

    const amounts = amountMatches.map((m) => parseAmount(m[1]));

    // Last amount is the running balance; ignore it.
    // If only one amount remains, it is the transaction amount (no balance on this line).
    const txnAmount = amounts.length >= 2 ? amounts[amounts.length - 2] : amounts[0];
    if (txnAmount === 0) continue;

    // Description is everything before the first amount.
    const firstAmountIdx = rest.search(AMOUNT_RE);
    const description = firstAmountIdx > 0
      ? rest.slice(0, firstAmountIdx).replace(/\s{2,}/g, ' ').trim()
      : rest.replace(AMOUNT_RE, '').replace(/\s{2,}/g, ' ').trim();

    if (!description) continue;

    const transactionType = classifyByKeywords(description);
    const date = parseDate(matchedDate);

    transactions.push({
      date,
      payerPayeeName: description,
      transactionId: `DBS-${++txnIndex}`,
      transactionType,
      amount: txnAmount,
      memo: '',
    });
  }

  console.log(`[dbsParser] Parsed ${transactions.length} transaction(s).`);
  return transactions;
}
