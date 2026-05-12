import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'jest-test-secret-do-not-use-in-production';

// ─── JWT factories ────────────────────────────────────────────────────────────

/** Creates a valid user session JWT that the `authenticateUser` middleware accepts. */
export function createUserToken(
  email:  string,
  domain: string,
): string {
  return jwt.sign(
    { email, domain, type: 'user', purpose: 'session' },
    SECRET,
    { expiresIn: '1h' },
  );
}

/** Creates a valid admin session JWT that the `authenticateAdmin` middleware accepts. */
export function createAdminToken(email: string): string {
  return jwt.sign(
    { email, type: 'admin', purpose: 'session' },
    SECRET,
    { expiresIn: '1h' },
  );
}

/** Creates an already-expired JWT (for 401 tests). */
export function createExpiredToken(email: string): string {
  return jwt.sign(
    { email, type: 'user', purpose: 'session' },
    SECRET,
    { expiresIn: '-1s' },
  );
}

/** Creates a magic-link token (short-lived, purpose = 'magic-link'). */
export function createMagicLinkToken(
  email: string,
  type: 'user' | 'admin' = 'user',
): string {
  return jwt.sign(
    { email, type, purpose: 'magic-link' },
    SECRET,
    { expiresIn: '15m' },
  );
}

// ─── File factories ───────────────────────────────────────────────────────────

/**
 * Returns a minimal valid PDF buffer (plain text PDF with no embedded images).
 * Suitable for testing the upload endpoint — the OCR pipeline should be mocked
 * separately so this never actually runs through Tesseract.
 */
export function createMinimalPDFBuffer(): Buffer {
  const content =
    'BT /F1 12 Tf 100 700 Td (DBS Bank Statement Jan 2024) Tj ET\n' +
    'BT /F1 10 Tf 100 680 Td (15 Jan 2024  NTUC FairPrice            SGD  -45.30) Tj ET\n' +
    'BT /F1 10 Tf 100 660 Td (20 Jan 2024  Salary                    SGD 3000.00) Tj ET';

  const contentLen = Buffer.byteLength(content);

  const pdf = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    `3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Contents 4 0 R/Parent 2 0 R>>endobj`,
    `4 0 obj<</Length ${contentLen}>>`,
    'stream',
    content,
    'endstream',
    'endobj',
    'xref',
    '0 5',
    '0000000000 65535 f ',
    '0000000009 00000 n ',
    '0000000058 00000 n ',
    '0000000115 00000 n ',
    '0000000206 00000 n ',
    `trailer<</Size 5/Root 1 0 R>>`,
    'startxref',
    '400',
    '%%EOF',
  ].join('\n');

  return Buffer.from(pdf, 'utf-8');
}

/** Returns a minimal PNG buffer (1×1 white pixel). */
export function createMinimalPNGBuffer(): Buffer {
  // 1×1 white pixel, valid PNG
  return Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
    '2e00000000c4944415478016360f8ff000000020001e221bc330000000049454e44ae426082',
    'hex',
  );
}

// ─── Bank statement text fixtures ────────────────────────────────────────────

export const DBS_STATEMENT_TEXT = `
DBS Bank Statement
Account: 123-456-789
Period: 01 Jan 2024 to 31 Jan 2024

DATE        DESCRIPTION                    WITHDRAWAL  DEPOSIT    BALANCE
15 Jan 2024  NTUC FairPrice Ang Mo Kio      45.30                  1,954.70
18 Jan 2024  Grab*GRAB                      12.50                  1,942.20
20 Jan 2024  SALARY PAYMENT                             3,000.00   4,942.20
25 Jan 2024  SINGAPORE POWER                87.40                  4,854.80
`;

export const UOB_STATEMENT_TEXT = `
UOB Bank Statement
Account Number: 999-888-777
Statement Date: 31/01/2024

Date        Description                    Debit       Credit
10/01/2024  COLD STORAGE BUONA VISTA        32.80
15/01/2024  GRAB TECHNOLOGIES               18.40
22/01/2024  MONTHLY SALARY                              5,500.00
28/01/2024  STARHUB MOBILE                  42.00
`;

export const HSBC_STATEMENT_TEXT = `
HSBC Bank Statement
Account: 111-222-333
Statement Date: 31 Jan 2024

Date          Description                  Debit       Credit
05 Jan 2024   VISA WATSON'S                25.60
12 Jan 2024   NETS SHENG SIONG             88.20
18 Jan 2024   SALARY                                   4,200.00
24 Jan 2024   SINGTEL MOBILE               56.80
`;
