import { Transaction, parseAmount, parseDate, classifyByKeywords } from './parserUtils';

// Citibank Singapore uses DD/MM/YYYY or MM/DD/YYYY.
// We normalise ambiguous dates to DD/MM/YYYY (matching Singapore locale).
const DATE_RE = /(\d{2}[\/\-]\d{2}[\/\-]\d{4})/;

// Citibank uses a single signed amount column: negative = debit, positive = credit.
const SIGNED_AMOUNT_RE = /(-?\d{1,3}(?:,\d{3})*\.\d{2})/;
const AMOUNT_RE = /(-?\d{1,3}(?:,\d{3})*\.\d{2})/g;

// ─── parseTransactions ────────────────────────────────────────────────────────

/**
 * Parses Citibank bank statement text into Transaction objects.
 *
 * Common Citibank layout (single signed amount column):
 *   TRANSACTION DATE   DESCRIPTION   AMOUNT (SGD)
 *
 * Negative amounts are debits; positive are credits.
 * Falls back to keyword classification when sign is ambiguous.
 */
export function parseTransactions(text: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let txnIndex = 0;

  for (const line of lines) {
    const dateMatch = line.match(DATE_RE);
    if (!dateMatch) continue;

    const matchedDate = dateMatch[1];
    const rest = line.slice(line.indexOf(matchedDate) + matchedDate.length).trim();

    // Citibank: last amount on the line is the transaction amount (no balance column).
    const amountMatches = [...rest.matchAll(AMOUNT_RE)];
    if (amountMatches.length === 0) continue;

    const lastAmountStr = amountMatches[amountMatches.length - 1][1];
    const rawAmount = parseFloat(lastAmountStr.replace(/,/g, ''));
    if (rawAmount === 0) continue;

    // Signed amount gives us debit/credit direction directly.
    let transactionType: 'Debit' | 'Credit';
    if (rawAmount < 0) {
      transactionType = 'Debit';
    } else if (rawAmount > 0) {
      transactionType = 'Credit';
    } else {
      continue;
    }

    const signedAmountMatch = rest.match(SIGNED_AMOUNT_RE);
    const firstAmountIdx = signedAmountMatch
      ? rest.indexOf(signedAmountMatch[0])
      : rest.search(AMOUNT_RE);

    const description = firstAmountIdx > 0
      ? rest.slice(0, firstAmountIdx).replace(/\s{2,}/g, ' ').trim()
      : rest.replace(AMOUNT_RE, '').replace(/\s{2,}/g, ' ').trim();

    // Override sign-based classification with keywords for ambiguous zero-sign cases.
    const finalType =
      rawAmount === 0 ? classifyByKeywords(description) : transactionType;

    const date = parseDate(matchedDate);

    transactions.push({
      date,
      payerPayeeName: description || 'Unknown',
      transactionId: `CITI-${++txnIndex}`,
      transactionType: finalType,
      amount: Math.abs(rawAmount),
      memo: '',
    });
  }

  console.log(`[citiParser] Parsed ${transactions.length} transaction(s).`);
  return transactions;
}
