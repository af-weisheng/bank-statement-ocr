import { Transaction, parseAmount, parseDate, classifyByKeywords } from './parserUtils';

// UOB statements primarily use DD/MM/YYYY dates.
const DATE_RE = /(\d{2}[\/\-]\d{2}[\/\-]\d{4})/;

const AMOUNT_RE = /(\d{1,3}(?:,\d{3})*\.\d{2})/g;

// ─── parseTransactions ────────────────────────────────────────────────────────

/**
 * Parses UOB bank statement text into Transaction objects.
 *
 * Common UOB layout:
 *   DATE   DESCRIPTION   [WITHDRAWALS]   [DEPOSITS]   BALANCE
 *
 * UOB occasionally uses "Dr" / "Cr" suffixes on amounts, which are also
 * handled by the keyword classifier.
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

    // UOB labels: "GIRO DEBIT", "GIRO CREDIT", "NETS PURCHASE", "FAST PAYMENT"
    const transactionType = classifyByKeywords(description);
    const date = parseDate(matchedDate);

    transactions.push({
      date,
      payerPayeeName: description,
      transactionId: `UOB-${++txnIndex}`,
      transactionType,
      amount: txnAmount,
      memo: '',
    });
  }

  console.log(`[uobParser] Parsed ${transactions.length} transaction(s).`);
  return transactions;
}
