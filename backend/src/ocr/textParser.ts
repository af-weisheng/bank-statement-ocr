import { Transaction } from './bankParsers/parserUtils';
import { parseTransactions as parseDbs } from './bankParsers/dbsParser';
import { parseTransactions as parseUob } from './bankParsers/uobParser';
import { parseTransactions as parseHsbc } from './bankParsers/hsbcParser';
import { parseTransactions as parseCiti } from './bankParsers/citiParser';

export type { Transaction } from './bankParsers/parserUtils';

export type BankType = 'DBS' | 'UOB' | 'HSBC' | 'CITIBANK' | 'UNKNOWN';

// ─── detectBankType ───────────────────────────────────────────────────────────

/**
 * Identifies the issuing bank from statement text by matching known identifiers:
 * bank name strings, product names, account type headers, and routing prefixes.
 */
export function detectBankType(text: string): BankType {
  const upper = text.toUpperCase();

  if (/\b(DBS BANK|POSB|DEVELOPMENT BANK OF SINGAPORE|DBS MULTIPLIER|DBS EVERYDAY)\b/.test(upper))
    return 'DBS';

  if (/\b(UNITED OVERSEAS BANK|UOB SAVINGS|UOB CURRENT|UOB ONE|UOB STASH)\b/.test(upper))
    return 'UOB';

  if (/\b(HSBC BANK|HSBC EVERYDAY GLOBAL|HSBC ADVANCE|HONGKONG AND SHANGHAI)\b/.test(upper))
    return 'HSBC';

  if (/\b(CITIBANK|CITI BANK|CITI SINGAPORE|CITIBANK SINGAPORE LIMITED|CITI PLUS)\b/.test(upper))
    return 'CITIBANK';

  // Shorter identifiers checked last to avoid false positives.
  if (/\bDBS\b/.test(upper)) return 'DBS';
  if (/\bUOB\b/.test(upper)) return 'UOB';
  if (/\bHSBC\b/.test(upper)) return 'HSBC';
  if (/\bCITIBANK\b/.test(upper)) return 'CITIBANK';

  return 'UNKNOWN';
}

// ─── parseTransactions ───────────────────────────────────────────────────────

/**
 * Delegates to the appropriate bank-specific parser.
 * Falls back to a generic heuristic parser for UNKNOWN bank types.
 */
export function parseTransactions(text: string, bankType: BankType): Transaction[] {
  console.log(`[textParser] Parsing transactions for bank: ${bankType}`);

  switch (bankType) {
    case 'DBS':      return parseDbs(text);
    case 'UOB':      return parseUob(text);
    case 'HSBC':     return parseHsbc(text);
    case 'CITIBANK': return parseCiti(text);
    default:
      console.warn('[textParser] Unknown bank — attempting generic parse.');
      return genericParse(text);
  }
}

// ─── Generic fallback parser ──────────────────────────────────────────────────

const GENERIC_DATE_RE = new RegExp(
  [
    String.raw`(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+\d{2,4})?)`,
    String.raw`(\d{2}[\/\-]\d{2}[\/\-]\d{4})`,
  ].join('|'),
  'i'
);

const AMOUNT_RE = /(\d{1,3}(?:,\d{3})*\.\d{2})/g;

import { parseAmount, parseDate, classifyByKeywords } from './bankParsers/parserUtils';

function genericParse(text: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let idx = 0;

  for (const line of lines) {
    const dateMatch = line.match(GENERIC_DATE_RE);
    if (!dateMatch) continue;

    const matchedDate = dateMatch[1] || dateMatch[2];
    if (!matchedDate) continue;

    const rest = line.slice(line.indexOf(matchedDate) + matchedDate.length).trim();
    const amounts = [...rest.matchAll(AMOUNT_RE)].map((m) => parseAmount(m[1]));
    if (amounts.length === 0) continue;

    const txnAmount = amounts.length >= 2 ? amounts[amounts.length - 2] : amounts[0];
    if (txnAmount === 0) continue;

    const firstAmountIdx = rest.search(AMOUNT_RE);
    const description = firstAmountIdx > 0
      ? rest.slice(0, firstAmountIdx).replace(/\s{2,}/g, ' ').trim()
      : rest.replace(AMOUNT_RE, '').replace(/\s{2,}/g, ' ').trim();

    if (!description) continue;

    transactions.push({
      date: parseDate(matchedDate),
      payerPayeeName: description,
      transactionId: `TXN-${++idx}`,
      transactionType: classifyByKeywords(description),
      amount: txnAmount,
      memo: '',
    });
  }

  console.log(`[textParser] Generic parser: ${transactions.length} transaction(s).`);
  return transactions;
}
