import { Transaction, parseAmount, parseDate, classifyByKeywords } from './parserUtils';

// HSBC statements use "DD Mon YYYY" or "DD Mon YY" dates.
const DATE_RE = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})/i;

const AMOUNT_RE = /(\d{1,3}(?:,\d{3})*\.\d{2})/g;

// ─── parseTransactions ────────────────────────────────────────────────────────

/**
 * Parses HSBC bank statement text into Transaction objects.
 *
 * Common HSBC layout:
 *   DATE   PARTICULARS   [DEBIT (SGD)]   [CREDIT (SGD)]   BALANCE
 *
 * HSBC uses "Debit" / "Credit" column headers and sometimes "(SGD)" suffixes
 * which are already stripped by the whitelist during OCR.
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

    const amountMatches = [...rest.matchAll(AMOUNT_RE)];
    if (amountMatches.length === 0) continue;

    const amounts = amountMatches.map((m) => parseAmount(m[1]));
    const txnAmount = amounts.length >= 2 ? amounts[amounts.length - 2] : amounts[0];
    if (txnAmount === 0) continue;

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
      transactionId: `HSBC-${++txnIndex}`,
      transactionType,
      amount: txnAmount,
      memo: '',
    });
  }

  console.log(`[hsbcParser] Parsed ${transactions.length} transaction(s).`);
  return transactions;
}
