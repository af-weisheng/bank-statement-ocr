# Testing Plan

## 1. Backend Unit Tests

### 1.1 OCR Functions Tests (`/backend/tests/unit/ocr/`)

#### 1.1.1 PDF Processor Tests (`pdfProcessor.test.ts`)

```typescript
describe('PDF Processor', () => {
  // Test files needed in /backend/tests/fixtures/pdfs/:
  // - valid-dbs-statement.pdf
  // - valid-uob-statement.pdf
  // - valid-hsbc-statement.pdf
  // - valid-citibank-statement.pdf
  // - scanned-statement.pdf (image-based)
  // - corrupted.pdf
  // - empty.pdf
  // - password-protected.pdf

  test('should extract text from text-based PDF', async () => {
    // Given: valid DBS PDF
    // When: extractTextFromPDF(buffer)
    // Then: should return text containing "DBS", dates, amounts
  });

  test('should extract images from scanned PDF', async () => {
    // Given: scanned statement PDF
    // When: extractImagesFromPDF(buffer)
    // Then: should return array of image buffers
  });

  test('should handle corrupted PDF gracefully', async () => {
    // Given: corrupted PDF
    // When: extractTextFromPDF(buffer)
    // Then: should throw descriptive error
  });

  test('should handle empty PDF', async () => {
    // Given: empty PDF
    // When: extractTextFromPDF(buffer)
    // Then: should return empty string or throw error
  });

  test('should handle password-protected PDF', async () => {
    // Given: password-protected PDF
    // When: extractTextFromPDF(buffer)
    // Then: should throw "password protected" error
  });
});
```

#### 1.1.2 Image Processor Tests (`imageProcessor.test.ts`)

```typescript
describe('Image Processor', () => {
  // Test files needed in /backend/tests/fixtures/images/:
  // - clear-statement.png (high quality)
  // - blurry-statement.jpg (low quality)
  // - rotated-statement.png (90° rotated)
  // - large-statement.png (>3000px width)
  // - dark-statement.jpg (low contrast)

  test('should preprocess clear image successfully', async () => {
    // Given: clear statement image
    // When: preprocessImage(buffer)
    // Then: should return grayscale, sharpened buffer
  });

  test('should enhance low contrast image', async () => {
    // Given: dark statement image
    // When: preprocessImage(buffer)
    // Then: should increase contrast, return enhanced buffer
  });

  test('should resize large images', async () => {
    // Given: 4000px width image
    // When: preprocessImage(buffer)
    // Then: should resize to max 2000px, maintain aspect ratio
  });

  test('should perform OCR on preprocessed image', async () => {
    // Given: preprocessed statement image
    // When: ocrImage(buffer)
    // Then: should return text with >90% accuracy
  });

  test('should handle corrupted image', async () => {
    // Given: corrupted image buffer
    // When: preprocessImage(buffer)
    // Then: should throw error
  });
});
```

#### 1.1.3 Bank Detection Tests (`textParser.test.ts`)

```typescript
describe('Bank Detection', () => {
  // Test data: text samples from each bank
  const dbsText   = 'DBS BANK LTD\nAccount Statement...';
  const uobText   = 'UNITED OVERSEAS BANK LIMITED...';
  const hsbcText  = 'HSBC BANK\nStatement of Account...';
  const citiText  = 'CITIBANK SINGAPORE LIMITED...';
  const unknownText = 'RANDOM BANK\nStatement...';

  test('should detect DBS bank', () => {
    expect(detectBankType(dbsText)).toBe('DBS');
  });

  test('should detect UOB bank', () => {
    expect(detectBankType(uobText)).toBe('UOB');
  });

  test('should detect HSBC bank', () => {
    expect(detectBankType(hsbcText)).toBe('HSBC');
  });

  test('should detect Citibank', () => {
    expect(detectBankType(citiText)).toBe('CITIBANK');
  });

  test('should return UNKNOWN for unsupported bank', () => {
    expect(detectBankType(unknownText)).toBe('UNKNOWN');
  });
});
```

#### 1.1.4 Bank-Specific Parser Tests (`bankParsers/*.test.ts`)

```typescript
describe('DBS Parser', () => {
  // Sample DBS statement text patterns
  const sampleText = `
    Date        Description                 Withdrawal    Deposit    Balance
    01/05/2026  Payment to ABC Ltd          500.00                   10,500.00
    03/05/2026  Salary from XYZ Corp                      5,000.00   15,500.00
    05/05/2026  ATM Withdrawal              100.00                   15,400.00
  `;

  test('should parse DBS transactions correctly', () => {
    const result = dbsParser.parseTransactions(sampleText);

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      date: new Date('2026-05-01'),
      payerPayeeName: 'ABC Ltd',
      transactionType: 'Debit',
      amount: -500.00,
      memo: 'Payment to ABC Ltd',
    });
    expect(result[1]).toMatchObject({
      date: new Date('2026-05-03'),
      payerPayeeName: 'XYZ Corp',
      transactionType: 'Credit',
      amount: 5000.00,
      memo: 'Salary from XYZ Corp',
    });
  });

  test('should handle date format variations', () => {
    // Test DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
  });

  test('should handle amount format variations', () => {
    // Test 1,000.00 / 1000.00 / 1.000,00 (European)
  });

  test('should extract transaction IDs when present', () => {
    // Test with reference numbers
  });

  test('should handle missing optional fields', () => {
    // Test transactions without all fields
  });
});

// Repeat similar tests for UOB, HSBC, Citibank parsers
```

#### 1.1.5 CSV Generator Tests (`csvGenerator.test.ts`)

```typescript
describe('CSV Generator', () => {
  const mockTransactions = [
    {
      date: new Date('2026-05-02'),
      payerPayeeName: 'Customer ABC',
      transactionId: '12345',
      transactionType: 'Debit' as const,
      amount: 500.50,
      memo: 'Payment for services',
    },
    {
      date: new Date('2026-05-03'),
      payerPayeeName: 'Supplier XYZ',
      transactionId: '67890',
      transactionType: 'Credit' as const,
      amount: -200.75,
      memo: 'Purchase of goods',
    },
  ];

  test('should generate CSV with correct headers', () => {
    const csv = generateCSV(mockTransactions);
    const lines = csv.split('\n');

    expect(lines[0]).toBe(
      'Date (MM/DD/YYYY),Payer/Payee Name,Transaction Id,Transaction Type,Amount,Memo,NS Internal Customer Id,NS Customer Name,Invoice Number(s)'
    );
  });

  test('should format dates as MM/DD/YYYY', () => {
    const csv = generateCSV(mockTransactions);
    expect(csv).toContain('05/02/2026');
    expect(csv).toContain('05/03/2026');
  });

  test('should handle positive amounts (receipts)', () => {
    const csv = generateCSV(mockTransactions);
    expect(csv).toContain('500.5'); // or 500.50
  });

  test('should handle negative amounts (payments)', () => {
    const csv = generateCSV(mockTransactions);
    expect(csv).toContain('-200.75');
  });

  test('should leave last 3 columns empty', () => {
    const csv = generateCSV(mockTransactions);
    const lines = csv.split('\n');
    expect(lines[1]).toMatch(/,,,$/); // ends with 3 empty fields
  });

  test('should escape commas in descriptions', () => {
    const txWithComma = [{
      ...mockTransactions[0],
      memo: 'Payment for services, equipment, supplies',
    }];
    const csv = generateCSV(txWithComma);
    expect(csv).toContain('"Payment for services, equipment, supplies"');
  });

  test('should escape quotes in descriptions', () => {
    const txWithQuote = [{
      ...mockTransactions[0],
      memo: 'Payment for "premium" services',
    }];
    const csv = generateCSV(txWithQuote);
    expect(csv).toContain('""premium""'); // CSV quote escaping
  });

  test('should handle empty transactions array', () => {
    const csv = generateCSV([]);
    expect(csv.split('\n')).toHaveLength(1); // only header
  });
});
```

---

### 1.2 Authentication Tests (`/backend/tests/unit/auth/`)

#### 1.2.1 Magic Link Tests (`magicLink.test.ts`)

```typescript
describe('Magic Link Authentication', () => {
  const validEmail = 'user@afon.com.sg';

  test('should generate valid JWT token', () => {
    const token = generateMagicLink(validEmail);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
  });

  test('should include email in token payload', () => {
    const token = generateMagicLink(validEmail);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.email).toBe(validEmail);
  });

  test('should set 15-minute expiry', () => {
    const token = generateMagicLink(validEmail);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const expiryTime = decoded.exp - decoded.iat;
    expect(expiryTime).toBe(900); // 15 minutes in seconds
  });

  test('should verify valid token', async () => {
    const token = generateMagicLink(validEmail);
    const result = await verifyMagicLink(token);
    expect(result.email).toBe(validEmail);
  });

  test('should reject expired token', async () => {
    const expiredToken = jwt.sign(
      { email: validEmail, exp: Math.floor(Date.now() / 1000) - 100 },
      process.env.JWT_SECRET
    );
    await expect(verifyMagicLink(expiredToken)).rejects.toThrow('expired');
  });

  test('should reject tampered token', async () => {
    const token = generateMagicLink(validEmail);
    const tamperedToken = token.slice(0, -5) + 'XXXXX';
    await expect(verifyMagicLink(tamperedToken)).rejects.toThrow();
  });

  test('should reject token with wrong secret', async () => {
    const token = jwt.sign({ email: validEmail }, 'wrong-secret');
    await expect(verifyMagicLink(token)).rejects.toThrow();
  });
});

describe('Email Sending', () => {
  test('should send email with magic link', async () => {
    const sendMailMock = jest.fn().mockResolvedValue({ messageId: '123' });

    await sendMagicLinkEmail(validEmail, 'test-token');

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: validEmail,
        subject: expect.stringContaining('Login'),
        html: expect.stringContaining('test-token'),
      })
    );
  });

  test('should handle email sending failure', async () => {
    const sendMailMock = jest.fn().mockRejectedValue(new Error('SMTP error'));

    await expect(sendMagicLinkEmail(validEmail, 'token')).rejects.toThrow('SMTP error');
  });
});
```

---

### 1.3 Database Query Tests (`/backend/tests/unit/database/`)

#### 1.3.1 User Queries Tests (`userQueries.test.ts`)

```typescript
describe('User Database Queries', () => {
  let testDb;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  });

  afterAll(async () => {
    await testDb.close();
  });

  beforeEach(async () => {
    await testDb.query('DELETE FROM users');
  });

  test('should create new user', async () => {
    const user = await createUser('user@afon.com.sg');

    expect(user.id).toBeTruthy();
    expect(user.email).toBe('user@afon.com.sg');
    expect(user.domain).toBe('afon.com.sg');
    expect(user.created_at).toBeInstanceOf(Date);
  });

  test('should find user by email', async () => {
    await createUser('user@afon.com.sg');
    const found = await findUserByEmail('user@afon.com.sg');

    expect(found).toBeTruthy();
    expect(found.email).toBe('user@afon.com.sg');
  });

  test('should return null for non-existent user', async () => {
    const found = await findUserByEmail('nonexistent@test.com');
    expect(found).toBeNull();
  });

  test('should update user last_login', async () => {
    const user = await createUser('user@afon.com.sg');
    const before = user.last_login;

    await new Promise(resolve => setTimeout(resolve, 1000));
    await updateUserLastLogin(user.id);

    const updated = await findUserByEmail('user@afon.com.sg');
    expect(updated.last_login).not.toBe(before);
  });

  test('should prevent duplicate emails', async () => {
    await createUser('user@afon.com.sg');
    await expect(createUser('user@afon.com.sg')).rejects.toThrow('duplicate');
  });

  test('should extract domain from email', async () => {
    const user = await createUser('john.doe@company.com');
    expect(user.domain).toBe('company.com');
  });
});
```

#### 1.3.2 Domain Queries Tests (`domainQueries.test.ts`)

```typescript
describe('Domain Database Queries', () => {
  beforeEach(async () => {
    await testDb.query('DELETE FROM domains');
    await testDb.query('DELETE FROM admins');
  });

  test('should register new domain', async () => {
    const admin = await createAdmin('admin@afon.com.sg', true);
    const domain = await registerDomain('company.com', admin.id);

    expect(domain.domain).toBe('company.com');
    expect(domain.is_active).toBe(true);
    expect(domain.registered_by_admin_id).toBe(admin.id);
  });

  test('should check if domain is registered', async () => {
    const admin = await createAdmin('admin@afon.com.sg', true);
    await registerDomain('company.com', admin.id);

    expect(await isDomainRegistered('company.com')).toBe(true);
    expect(await isDomainRegistered('other.com')).toBe(false);
  });

  test('should check if domain is active', async () => {
    const admin = await createAdmin('admin@afon.com.sg', true);
    const domain = await registerDomain('company.com', admin.id);

    expect(await isDomainActive('company.com')).toBe(true);

    await toggleDomainStatus(domain.id);
    expect(await isDomainActive('company.com')).toBe(false);
  });

  test('should get all domains with stats', async () => {
    const admin = await createAdmin('admin@afon.com.sg', true);
    await registerDomain('company1.com', admin.id);
    await registerDomain('company2.com', admin.id);

    await createUser('user@company1.com');
    await createProcessingStat('user@company1.com', 'company1.com', 'success');

    const domains = await getDomainsWithStats();

    expect(domains).toHaveLength(2);
    expect(domains[0]).toMatchObject({
      domain:          expect.any(String),
      user_count:      expect.any(Number),
      total_processed: expect.any(Number),
      success_count:   expect.any(Number),
      success_rate:    expect.any(Number),
    });
  });
});
```

#### 1.3.3 Stats Queries Tests (`statsQueries.test.ts`)

```typescript
describe('Processing Stats Queries', () => {
  beforeEach(async () => {
    await testDb.query('DELETE FROM processing_stats');
  });

  test('should record successful processing', async () => {
    const stat = await recordProcessingStat({
      user_email:  'user@afon.com.sg',
      user_domain: 'afon.com.sg',
      status:      'success',
      file_name:   'statement.pdf',
    });

    expect(stat.id).toBeTruthy();
    expect(stat.status).toBe('success');
    expect(stat.error_message).toBeNull();
  });

  test('should record failed processing with error', async () => {
    const stat = await recordProcessingStat({
      user_email:    'user@afon.com.sg',
      user_domain:   'afon.com.sg',
      status:        'failed',
      file_name:     'bad.pdf',
      error_message: 'OCR failed: corrupted file',
    });

    expect(stat.status).toBe('failed');
    expect(stat.error_message).toBe('OCR failed: corrupted file');
  });

  test('should get user processing history', async () => {
    await recordProcessingStat({
      user_email: 'user@afon.com.sg', user_domain: 'afon.com.sg',
      status: 'success', file_name: 'file1.pdf',
    });
    await recordProcessingStat({
      user_email: 'user@afon.com.sg', user_domain: 'afon.com.sg',
      status: 'failed', file_name: 'file2.pdf', error_message: 'Error',
    });

    const history = await getUserProcessingHistory('user@afon.com.sg', 10, 0);

    expect(history).toHaveLength(2);
    expect(history[0].processed_at > history[1].processed_at).toBe(true); // DESC order
  });

  test('should aggregate stats by domain', async () => {
    await recordProcessingStat({
      user_email: 'user1@domain1.com', user_domain: 'domain1.com',
      status: 'success', file_name: 'file1.pdf',
    });
    await recordProcessingStat({
      user_email: 'user2@domain1.com', user_domain: 'domain1.com',
      status: 'failed', file_name: 'file2.pdf', error_message: 'Error',
    });
    await recordProcessingStat({
      user_email: 'user3@domain2.com', user_domain: 'domain2.com',
      status: 'success', file_name: 'file3.pdf',
    });

    const stats = await getStatsByDomain();

    expect(stats).toContainEqual({
      domain: 'domain1.com', total: 2, success: 1, failed: 1, success_rate: 50,
    });
    expect(stats).toContainEqual({
      domain: 'domain2.com', total: 1, success: 1, failed: 0, success_rate: 100,
    });
  });

  test('should filter stats by date range', async () => {
    await recordProcessingStat({
      user_email: 'user@afon.com.sg', user_domain: 'afon.com.sg',
      status: 'success', file_name: 'file1.pdf',
    });

    const now       = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow  = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const stats = await getStats({ startDate: yesterday, endDate: tomorrow });
    expect(stats.total_files).toBe(1);

    const statsOutsideRange = await getStats({
      startDate: new Date('2020-01-01'),
      endDate:   new Date('2020-12-31'),
    });
    expect(statsOutsideRange.total_files).toBe(0);
  });
});
```

---

## 2. Backend Integration Tests

### 2.1 Auth Flow Integration Tests (`/backend/tests/integration/auth.test.ts`)

```typescript
describe('Authentication Flow Integration', () => {
  let server;
  let request;

  beforeAll(async () => {
    server  = await startTestServer();
    request = supertest(server);

    await testDb.query('DELETE FROM domains');
    await testDb.query('DELETE FROM users');
    const admin = await createAdmin('admin@afon.com.sg', true);
    await registerDomain('afon.com.sg', admin.id);
  });

  afterAll(async () => {
    await server.close();
  });

  test('should complete full user login flow', async () => {
    const email = 'user@afon.com.sg';

    // Step 1: Request magic link
    const response1 = await request
      .post('/api/auth/request-login')
      .send({ email })
      .expect(200);

    expect(response1.body).toMatchObject({
      success: true,
      message: expect.stringContaining('email'),
    });

    // Step 2: Extract token from sent email (mock)
    const sentEmails = getLastSentEmail();
    const magicLink  = sentEmails[0].html.match(/token=([^"]+)/)[1];

    // Step 3: Verify magic link
    const response2 = await request
      .post('/api/auth/verify')
      .send({ token: magicLink })
      .expect(200);

    expect(response2.body).toMatchObject({
      token: expect.any(String),
      user:  { email, domain: 'afon.com.sg' },
    });

    // Step 4: Use session token to access protected route
    const sessionToken = response2.body.token;
    const response3    = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(200);

    expect(response3.body.email).toBe(email);
  });

  test('should reject login for unregistered domain', async () => {
    await request
      .post('/api/auth/request-login')
      .send({ email: 'user@unregistered.com' })
      .expect(403);
  });

  test('should reject login with invalid email format', async () => {
    await request
      .post('/api/auth/request-login')
      .send({ email: 'invalid-email' })
      .expect(400);
  });

  test('should rate limit login requests', async () => {
    const email = 'user@afon.com.sg';

    for (let i = 0; i < 3; i++) {
      await request.post('/api/auth/request-login').send({ email }).expect(200);
    }

    // 4th request should be rate limited
    await request.post('/api/auth/request-login').send({ email }).expect(429);
  });

  test('should reject expired magic link', async () => {
    const expiredToken = jwt.sign(
      { email: 'user@afon.com.sg', exp: Math.floor(Date.now() / 1000) - 3600 },
      process.env.JWT_SECRET
    );

    await request.post('/api/auth/verify').send({ token: expiredToken }).expect(401);
  });

  test('should update last_login on successful verification', async () => {
    const email = 'newuser@afon.com.sg';

    await request.post('/api/auth/request-login').send({ email });
    const token = getLastSentEmail()[0].html.match(/token=([^"]+)/)[1];
    await request.post('/api/auth/verify').send({ token });

    const user = await findUserByEmail(email);
    expect(user.last_login).toBeTruthy();
    expect(new Date(user.last_login).getTime()).toBeCloseTo(Date.now(), -3000);
  });
});

describe('Admin Authentication Flow', () => {
  test('should complete admin login flow', async () => {
    const adminEmail = 'admin@afon.com.sg';

    await request.post('/api/auth/admin/request-login').send({ email: adminEmail }).expect(200);
    const token = getLastSentEmail()[0].html.match(/token=([^"]+)/)[1];

    const response = await request
      .post('/api/auth/admin/verify')
      .send({ token })
      .expect(200);

    expect(response.body.admin).toMatchObject({
      email:          adminEmail,
      is_super_admin: true,
    });
  });

  test('should reject non-admin trying admin login', async () => {
    await request
      .post('/api/auth/admin/request-login')
      .send({ email: 'user@afon.com.sg' })
      .expect(403);
  });
});
```

### 2.2 File Processing Integration Tests (`/backend/tests/integration/process.test.ts`)

```typescript
describe('File Upload and Processing Integration', () => {
  let authToken;

  beforeAll(async () => {
    const email = 'testuser@afon.com.sg';
    await request.post('/api/auth/request-login').send({ email });
    const token    = getLastSentEmail()[0].html.match(/token=([^"]+)/)[1];
    const response = await request.post('/api/auth/verify').send({ token });
    authToken      = response.body.token;
  });

  test('should upload and process valid DBS PDF statement', async () => {
    const pdfBuffer = fs.readFileSync('./tests/fixtures/pdfs/valid-dbs-statement.pdf');

    const response = await request
      .post('/api/process/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('statement', pdfBuffer, 'dbs-statement.pdf')
      .expect(200);

    expect(response.body).toMatchObject({ success: true, csv: expect.stringContaining('Date (MM/DD/YYYY)') });

    const csvLines = response.body.csv.split('\n');
    expect(csvLines[0]).toBe(
      'Date (MM/DD/YYYY),Payer/Payee Name,Transaction Id,Transaction Type,Amount,Memo,NS Internal Customer Id,NS Customer Name,Invoice Number(s)'
    );
    expect(csvLines.length).toBeGreaterThan(1);
  });

  test('should process UOB statement', async () => {
    const pdfBuffer = fs.readFileSync('./tests/fixtures/pdfs/valid-uob-statement.pdf');

    const response = await request
      .post('/api/process/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('statement', pdfBuffer, 'uob-statement.pdf')
      .expect(200);

    expect(response.body.success).toBe(true);
  });

  test('should process scanned statement image', async () => {
    const imageBuffer = fs.readFileSync('./tests/fixtures/images/scanned-statement.png');

    const response = await request
      .post('/api/process/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('statement', imageBuffer, 'statement.png')
      .expect(200);

    expect(response.body.success).toBe(true);
  });

  test('should reject file larger than 10MB', async () => {
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);

    await request
      .post('/api/process/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('statement', largeBuffer, 'large.pdf')
      .expect(413);
  });

  test('should reject unsupported file type', async () => {
    const txtBuffer = Buffer.from('This is not a statement');

    await request
      .post('/api/process/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('statement', txtBuffer, 'file.txt')
      .expect(400);
  });

  test('should reject upload without authentication', async () => {
    const pdfBuffer = fs.readFileSync('./tests/fixtures/pdfs/valid-dbs-statement.pdf');

    await request
      .post('/api/process/upload')
      .attach('statement', pdfBuffer, 'statement.pdf')
      .expect(401);
  });

  test('should record success in processing_stats', async () => {
    const pdfBuffer = fs.readFileSync('./tests/fixtures/pdfs/valid-dbs-statement.pdf');

    await request
      .post('/api/process/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('statement', pdfBuffer, 'test.pdf')
      .expect(200);

    const stats = await testDb.query(
      'SELECT * FROM processing_stats WHERE user_email = $1 ORDER BY processed_at DESC LIMIT 1',
      ['testuser@afon.com.sg']
    );

    expect(stats.rows[0]).toMatchObject({
      status:        'success',
      file_name:     'test.pdf',
      error_message: null,
    });
  });

  test('should record failure in processing_stats', async () => {
    const corruptedBuffer = fs.readFileSync('./tests/fixtures/pdfs/corrupted.pdf');

    await request
      .post('/api/process/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('statement', corruptedBuffer, 'corrupted.pdf')
      .expect(400);

    const stats = await testDb.query(
      'SELECT * FROM processing_stats WHERE user_email = $1 ORDER BY processed_at DESC LIMIT 1',
      ['testuser@afon.com.sg']
    );

    expect(stats.rows[0]).toMatchObject({
      status:        'failed',
      file_name:     'corrupted.pdf',
      error_message: expect.any(String),
    });
  });

  test('should rate limit uploads', async () => {
    const pdfBuffer = fs.readFileSync('./tests/fixtures/pdfs/valid-dbs-statement.pdf');

    for (let i = 0; i < 10; i++) {
      await request
        .post('/api/process/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('statement', pdfBuffer, 'statement.pdf')
        .expect(200);
    }

    // 11th should be rate limited
    await request
      .post('/api/process/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('statement', pdfBuffer, 'statement.pdf')
      .expect(429);
  });

  test('should get user processing history', async () => {
    const pdfBuffer = fs.readFileSync('./tests/fixtures/pdfs/valid-dbs-statement.pdf');
    await request
      .post('/api/process/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('statement', pdfBuffer, 'history-test.pdf');

    const response = await request
      .get('/api/process/history?limit=10&offset=0')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toMatchObject({
      file_name:    expect.any(String),
      status:       expect.stringMatching(/^(success|failed)$/),
      processed_at: expect.any(String),
    });
  });
});
```

### 2.3 Admin Operations Integration Tests (`/backend/tests/integration/admin.test.ts`)

```typescript
describe('Admin Operations Integration', () => {
  let superAdminToken;
  let regularAdminToken;

  beforeAll(async () => {
    // Login as super admin
    await request.post('/api/auth/admin/request-login').send({ email: 'admin@afon.com.sg' });
    let token    = getLastSentEmail()[0].html.match(/token=([^"]+)/)[1];
    let response = await request.post('/api/auth/admin/verify').send({ token });
    superAdminToken = response.body.token;

    // Create and login as regular admin
    await request
      .post('/api/admin/create')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ email: 'regular@afon.com.sg', is_super_admin: false });

    await request.post('/api/auth/admin/request-login').send({ email: 'regular@afon.com.sg' });
    token    = getLastSentEmail()[0].html.match(/token=([^"]+)/)[1];
    response = await request.post('/api/auth/admin/verify').send({ token });
    regularAdminToken = response.body.token;
  });

  test('should register new domain', async () => {
    const response = await request
      .post('/api/admin/domains/register')
      .set('Authorization', `Bearer ${regularAdminToken}`)
      .send({ domain: 'newcompany.com' })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      domain:  { domain: 'newcompany.com', is_active: true },
    });
  });

  test('should reject duplicate domain registration', async () => {
    await request
      .post('/api/admin/domains/register')
      .set('Authorization', `Bearer ${regularAdminToken}`)
      .send({ domain: 'duplicate.com' });

    await request
      .post('/api/admin/domains/register')
      .set('Authorization', `Bearer ${regularAdminToken}`)
      .send({ domain: 'duplicate.com' })
      .expect(400);
  });

  test('should get all domains with stats', async () => {
    const response = await request
      .get('/api/admin/domains')
      .set('Authorization', `Bearer ${regularAdminToken}`)
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body[0]).toMatchObject({
      domain:          expect.any(String),
      user_count:      expect.any(Number),
      total_processed: expect.any(Number),
      success_count:   expect.any(Number),
      success_rate:    expect.any(Number),
    });
  });

  test('should toggle domain active status', async () => {
    const registerResponse = await request
      .post('/api/admin/domains/register')
      .set('Authorization', `Bearer ${regularAdminToken}`)
      .send({ domain: 'toggle-test.com' });

    const domainId = registerResponse.body.domain.id;

    const response = await request
      .patch(`/api/admin/domains/${domainId}/toggle`)
      .set('Authorization', `Bearer ${regularAdminToken}`)
      .expect(200);

    expect(response.body.is_active).toBe(false);

    // Verify user can't login with inactive domain
    await request
      .post('/api/auth/request-login')
      .send({ email: 'user@toggle-test.com' })
      .expect(403);
  });

  test('should delete domain (super admin only)', async () => {
    const registerResponse = await request
      .post('/api/admin/domains/register')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ domain: 'delete-test.com' });

    const domainId = registerResponse.body.domain.id;

    // Regular admin should not be able to delete
    await request
      .delete(`/api/admin/domains/${domainId}`)
      .set('Authorization', `Bearer ${regularAdminToken}`)
      .expect(403);

    // Super admin should be able to delete
    await request
      .delete(`/api/admin/domains/${domainId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
  });

  test('should get aggregated stats', async () => {
    const response = await request
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${regularAdminToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      total_files:   expect.any(Number),
      success_count: expect.any(Number),
      failed_count:  expect.any(Number),
      success_rate:  expect.any(Number),
      by_domain:     expect.any(Array),
      by_email:      expect.any(Array),
      timeline:      expect.any(Array),
    });
  });

  test('should filter stats by date range', async () => {
    const startDate = '2026-05-01T00:00:00.000Z';
    const endDate   = '2026-05-31T23:59:59.999Z';

    const response = await request
      .get(`/api/admin/stats?startDate=${startDate}&endDate=${endDate}`)
      .set('Authorization', `Bearer ${regularAdminToken}`)
      .expect(200);

    expect(response.body.total_files).toBeGreaterThanOrEqual(0);
  });

  test('should export stats as CSV', async () => {
    const response = await request
      .get('/api/admin/stats/export')
      .set('Authorization', `Bearer ${regularAdminToken}`)
      .expect(200);

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.text).toContain('Date,Email,Domain,Filename,Status');
  });

  test('should create new admin (super admin only)', async () => {
    const response = await request
      .post('/api/admin/create')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ email: 'newadmin@afon.com.sg', is_super_admin: false })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      admin:   { email: 'newadmin@afon.com.sg', is_super_admin: false },
    });

    // Regular admin should not be able to create admin
    await request
      .post('/api/admin/create')
      .set('Authorization', `Bearer ${regularAdminToken}`)
      .send({ email: 'another@afon.com.sg', is_super_admin: false })
      .expect(403);
  });
});
```

---

## 3. Frontend Tests

### 3.1 Component Tests (`/frontend/tests/components/`)

```typescript
// Login.test.tsx
describe('Login Component', () => {
  test('should render email input and submit button', () => {
    render(<Login />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send login link/i })).toBeInTheDocument();
  });

  test('should validate email format', async () => {
    render(<Login />);

    await userEvent.type(screen.getByLabelText(/email/i), 'invalid-email');
    await userEvent.click(screen.getByRole('button', { name: /send login link/i }));

    expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
  });

  test('should call API on valid email submission', async () => {
    const mockRequestLogin = jest.fn().mockResolvedValue({ success: true });
    render(<Login />, { provideAuthContext: { requestLogin: mockRequestLogin } });

    await userEvent.type(screen.getByLabelText(/email/i), 'user@afon.com.sg');
    await userEvent.click(screen.getByRole('button', { name: /send login link/i }));

    expect(mockRequestLogin).toHaveBeenCalledWith('user@afon.com.sg');
  });

  test('should show success message after sending', async () => {
    const mockRequestLogin = jest.fn().mockResolvedValue({ success: true });
    render(<Login />, { provideAuthContext: { requestLogin: mockRequestLogin } });

    await userEvent.type(screen.getByLabelText(/email/i), 'user@afon.com.sg');
    await userEvent.click(screen.getByRole('button', { name: /send login link/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });

  test('should show error on API failure', async () => {
    const mockRequestLogin = jest.fn().mockRejectedValue(new Error('Domain not registered'));
    render(<Login />, { provideAuthContext: { requestLogin: mockRequestLogin } });

    await userEvent.type(screen.getByLabelText(/email/i), 'user@unregistered.com');
    await userEvent.click(screen.getByRole('button', { name: /send login link/i }));

    await waitFor(() => {
      expect(screen.getByText(/domain not registered/i)).toBeInTheDocument();
    });
  });
});

// FileUpload.test.tsx
describe('FileUpload Component', () => {
  test('should render drag & drop zone', () => {
    render(<FileUpload onUpload={jest.fn()} />);

    expect(screen.getByText(/drag.*here/i)).toBeInTheDocument();
  });

  test('should accept file drop', async () => {
    const mockOnUpload = jest.fn();
    render(<FileUpload onUpload={mockOnUpload} />);

    const file     = new File(['content'], 'statement.pdf', { type: 'application/pdf' });
    const dropZone = screen.getByText(/drag.*here/i).parentElement;

    await userEvent.upload(dropZone, file);

    expect(screen.getByText('statement.pdf')).toBeInTheDocument();
  });

  test('should reject invalid file type', async () => {
    render(<FileUpload onUpload={jest.fn()} />);

    const file     = new File(['content'], 'document.txt', { type: 'text/plain' });
    const dropZone = screen.getByText(/drag.*here/i).parentElement;

    await userEvent.upload(dropZone, file);

    expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
  });

  test('should reject file larger than 10MB', async () => {
    render(<FileUpload onUpload={jest.fn()} />);

    const largeFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'large.pdf', {
      type: 'application/pdf',
    });
    const dropZone = screen.getByText(/drag.*here/i).parentElement;

    await userEvent.upload(dropZone, largeFile);

    expect(screen.getByText(/file too large/i)).toBeInTheDocument();
  });
});

// Dashboard.test.tsx
describe('Dashboard Component', () => {
  test('should display user email', () => {
    const mockUser = { email: 'user@afon.com.sg', domain: 'afon.com.sg' };
    render(<Dashboard />, { provideAuthContext: { user: mockUser } });

    expect(screen.getByText('user@afon.com.sg')).toBeInTheDocument();
  });

  test('should show processing history table', async () => {
    jest.spyOn(api, 'get').mockResolvedValue({
      data: [
        { file_name: 'test.pdf',  status: 'success', processed_at: '2026-05-12T10:00:00Z' },
        { file_name: 'test2.pdf', status: 'failed',  processed_at: '2026-05-11T09:00:00Z', error_message: 'OCR failed' },
      ],
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
      expect(screen.getByText('test2.pdf')).toBeInTheDocument();
    });
  });

  test('should handle file upload flow', async () => {
    const mockUpload = jest.spyOn(api, 'post').mockResolvedValue({
      data: { success: true, csv: 'Date,Amount\n05/12/2026,100' },
    });

    render(<Dashboard />);

    const file      = new File(['content'], 'statement.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByLabelText(/upload/i);
    await userEvent.upload(fileInput, file);

    const processButton = screen.getByRole('button', { name: /process/i });
    await userEvent.click(processButton);

    expect(screen.getByText(/processing/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });

    expect(mockUpload).toHaveBeenCalled();
  });
});

// AdminDashboard.test.tsx
describe('AdminDashboard Component', () => {
  test('should display domain management tab', () => {
    render(<AdminDashboard />);

    expect(screen.getByRole('tab', { name: /domain management/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /statistics/i })).toBeInTheDocument();
  });

  test('should show registered domains', async () => {
    jest.spyOn(api, 'get').mockResolvedValue({
      data: [
        { domain: 'afon.com.sg',  user_count: 5, total_processed: 20, success_rate: 95, is_active: true },
        { domain: 'company.com',  user_count: 3, total_processed: 10, success_rate: 80, is_active: true },
      ],
    });

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText('afon.com.sg')).toBeInTheDocument();
      expect(screen.getByText('company.com')).toBeInTheDocument();
    });
  });

  test('should register new domain', async () => {
    const mockRegister = jest.spyOn(api, 'post').mockResolvedValue({
      data: { success: true, domain: { domain: 'newdomain.com' } },
    });

    render(<AdminDashboard />);

    await userEvent.type(screen.getByPlaceholderText(/domain/i), 'newdomain.com');
    await userEvent.click(screen.getByRole('button', { name: /register/i }));

    expect(mockRegister).toHaveBeenCalledWith(
      '/api/admin/domains/register',
      { domain: 'newdomain.com' }
    );
  });

  test('should show statistics charts', async () => {
    jest.spyOn(api, 'get').mockResolvedValue({
      data: {
        total_files:   100,
        success_count: 85,
        failed_count:  15,
        success_rate:  85,
        by_domain: [{ domain: 'afon.com.sg', total: 50, success: 48, success_rate: 96 }],
        timeline:  [{ date: '2026-05-12', total: 10, success: 9, failed: 1 }],
      },
    });

    render(<AdminDashboard />);
    await userEvent.click(screen.getByRole('tab', { name: /statistics/i }));

    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument();  // total files
      expect(screen.getByText('85%')).toBeInTheDocument();  // success rate
    });
  });
});
```

### 3.2 Integration / Flow Tests (`/frontend/tests/flows/`)

```typescript
// userFlow.test.tsx
describe('User Complete Flow', () => {
  test('should complete login → upload → download flow', async () => {
    const mockRequestLogin = jest.fn().mockResolvedValue({ success: true });
    const mockVerifyLogin  = jest.fn().mockResolvedValue({
      token: 'test-token',
      user:  { email: 'user@afon.com.sg', domain: 'afon.com.sg' },
    });
    const mockUpload = jest.fn().mockResolvedValue({
      data: { success: true, csv: 'Date,Amount\n05/12/2026,100' },
    });

    render(<App />, {
      mockAuthContext: { requestLogin: mockRequestLogin, verifyLogin: mockVerifyLogin },
      mockApi:         { post: mockUpload },
    });

    // Step 1: Login
    await userEvent.type(screen.getByLabelText(/email/i), 'user@afon.com.sg');
    await userEvent.click(screen.getByRole('button', { name: /send login link/i }));

    // Step 2: Verify (simulate clicking magic link)
    await mockVerifyLogin('test-token');

    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });

    // Step 3: Upload file
    const file      = new File(['content'], 'statement.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByLabelText(/upload/i);
    await userEvent.upload(fileInput, file);

    // Step 4: Process
    await userEvent.click(screen.getByRole('button', { name: /process/i }));

    // Step 5: Verify success and CSV download
    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });
  });
});

// adminFlow.test.tsx
describe('Admin Complete Flow', () => {
  test('should complete admin login → register domain → view stats', async () => {
    // Similar to user flow but for admin operations.
    // Test domain registration, viewing stats, exporting CSV.
  });
});
```

---

## 4. End-to-End Tests (E2E)

### 4.1 User Journey E2E (`/e2e/user.spec.ts` — Playwright)

```typescript
describe('User Journey E2E', () => {
  test('full user workflow', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Login
    await page.fill('input[type="email"]', 'e2euser@afon.com.sg');
    await page.click('button:has-text("Send Login Link")');
    await expect(page.locator('text=Check your email')).toBeVisible();

    // Navigate to verify page with magic-link token
    const token = await getMagicLinkTokenFromTestEmail('e2euser@afon.com.sg');
    await page.goto(`http://localhost:3000/verify?token=${token}`);

    await expect(page).toHaveURL('http://localhost:3000/dashboard');
    await expect(page.locator('text=e2euser@afon.com.sg')).toBeVisible();

    // Upload file
    await page.setInputFiles('input[type="file"]', './tests/fixtures/pdfs/valid-dbs-statement.pdf');
    await expect(page.locator('text=valid-dbs-statement.pdf')).toBeVisible();

    // Process
    await page.click('button:has-text("Process Statement")');
    await expect(page.locator('text=Processing')).toBeVisible();
    await expect(page.locator('text=processed successfully')).toBeVisible({ timeout: 30000 });

    // Download CSV
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Download CSV")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');

    // Check history table
    await expect(page.locator('text=valid-dbs-statement.pdf')).toBeVisible();
    await expect(page.locator('.status-badge.success')).toBeVisible();

    // Logout
    await page.click('button:has-text("Logout")');
    await expect(page).toHaveURL('http://localhost:3000/');
  });

  test('handles processing errors gracefully', async ({ page }) => {
    await loginAsUser(page, 'e2euser@afon.com.sg');

    await page.setInputFiles('input[type="file"]', './tests/fixtures/pdfs/corrupted.pdf');
    await page.click('button:has-text("Process Statement")');

    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('text=failed')).toBeVisible();
  });
});
```

### 4.2 Admin Journey E2E (`/e2e/admin.spec.ts`)

```typescript
describe('Admin Journey E2E', () => {
  test('full admin workflow', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/login');
    await page.fill('input[type="email"]', 'admin@afon.com.sg');
    await page.click('button:has-text("Send Login Link")');

    const token = await getMagicLinkTokenFromTestEmail('admin@afon.com.sg');
    await page.goto(`http://localhost:3000/admin/verify?token=${token}`);
    await expect(page).toHaveURL('http://localhost:3000/admin');

    // Register new domain
    await page.fill('input[placeholder*="domain"]', 'e2etest.com');
    await page.click('button:has-text("Register")');
    await expect(page.locator('text=e2etest.com')).toBeVisible();

    // Toggle domain status
    const domainRow = page.locator('tr:has-text("e2etest.com")');
    await domainRow.locator('.toggle-switch').click();
    await expect(domainRow.locator('.status-inactive')).toBeVisible();

    // Switch to Statistics tab
    await page.click('button:has-text("Statistics")');

    // Apply date filter
    await page.fill('input[type="date"]:nth-of-type(1)', '2026-05-01');
    await page.fill('input[type="date"]:nth-of-type(2)', '2026-05-31');
    await page.click('button:has-text("Apply Filters")');

    // Verify stats cards
    await expect(page.locator('.stat-card:has-text("Total Files")')).toBeVisible();
    await expect(page.locator('.stat-card:has-text("Success Rate")')).toBeVisible();

    // Verify charts
    await expect(page.locator('canvas')).toHaveCount(2);

    // Export CSV
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export CSV")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');

    // Create new admin (super admin only)
    await page.click('button:has-text("Create Admin")');
    await page.fill('input[placeholder*="email"]', 'newadmin@afon.com.sg');
    await page.click('button:has-text("Create")');
    await expect(page.locator('text=Admin created successfully')).toBeVisible();
  });
});
```

---

## 5. Security Tests

### 5.1 SQL Injection Tests (`/backend/tests/security/sql-injection.test.ts`)

```typescript
describe('SQL Injection Prevention', () => {
  const maliciousInputs = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "admin'--",
    "' UNION SELECT * FROM users--",
    "1' AND '1'='1",
  ];

  test('should prevent SQL injection in login email', async () => {
    for (const maliciousEmail of maliciousInputs) {
      await request
        .post('/api/auth/request-login')
        .send({ email: maliciousEmail })
        .expect(400);
    }

    const users = await testDb.query('SELECT COUNT(*) FROM users');
    expect(users.rows[0].count).toBe('0');
  });

  test('should prevent SQL injection in domain registration', async () => {
    for (const maliciousDomain of maliciousInputs) {
      await request
        .post('/api/admin/domains/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ domain: maliciousDomain })
        .expect(400);
    }
  });

  test('should prevent SQL injection in stats filters', async () => {
    const response = await request
      .get('/api/admin/stats?domain=' + encodeURIComponent("' OR '1'='1"))
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Should return empty results, not all results
    expect(response.body.total_files).toBe(0);
  });

  test('should use parameterized queries everywhere', async () => {
    const dbFiles = glob.sync('./backend/src/**/*.ts');

    for (const file of dbFiles) {
      const content = fs.readFileSync(file, 'utf-8');

      // Check for string concatenation in queries (bad practice)
      const hasConcatenation      = /query\([`'"].*\$\{/.test(content);
      const hasStringInterpolation = /query\(.*\+.*\)/.test(content);

      expect(hasConcatenation).toBe(false);
      expect(hasStringInterpolation).toBe(false);
    }
  });
});
```

### 5.2 XSS Prevention Tests (`/backend/tests/security/xss.test.ts`)

```typescript
describe('XSS Prevention', () => {
  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    '<svg onload=alert("XSS")>',
    'javascript:alert("XSS")',
    '<iframe src="javascript:alert(\'XSS\')">',
  ];

  test('should sanitize file names', async () => {
    for (const payload of xssPayloads) {
      await request
        .post('/api/process/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('statement', Buffer.from('test'), payload + '.pdf')
        .expect(400);
    }
  });

  test('should escape user input in database', async () => {
    await request
      .post('/api/auth/request-login')
      .send({ email: '<script>alert("XSS")</script>@test.com' })
      .expect(400);
  });

  test('should not reflect user input in error messages', async () => {
    const response = await request
      .post('/api/auth/request-login')
      .send({ email: '<script>alert("XSS")</script>' })
      .expect(400);

    expect(response.body.error).not.toContain('<script>');
  });
});

// Frontend XSS tests
describe('Frontend XSS Prevention', () => {
  test('should escape user data in DOM', () => {
    const maliciousData = {
      email:     '<script>alert("XSS")</script>',
      file_name: '<img src=x onerror=alert("XSS")>',
    };

    render(<Dashboard />, { mockUser: maliciousData });

    expect(screen.getByText(maliciousData.email)).toBeInTheDocument();

    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      expect(script.textContent).not.toContain('alert("XSS")');
    }
  });

  test('should use dangerouslySetInnerHTML nowhere', () => {
    const componentFiles = glob.sync('./frontend/src/**/*.tsx');

    for (const file of componentFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toContain('dangerouslySetInnerHTML');
    }
  });
});
```

### 5.3 Rate Limiting Tests (`/backend/tests/security/rate-limiting.test.ts`)

```typescript
describe('Rate Limiting', () => {
  test('should rate limit login requests (5 per 15 min per IP)', async () => {
    const email = 'ratelimit@afon.com.sg';

    for (let i = 0; i < 5; i++) {
      await request.post('/api/auth/request-login').send({ email }).expect(200);
    }

    // 6th request should be rate limited
    await request.post('/api/auth/request-login').send({ email }).expect(429);
  });

  test('should rate limit file uploads (10 per hour per user)', async () => {
    const pdfBuffer = fs.readFileSync('./tests/fixtures/pdfs/valid-dbs-statement.pdf');

    for (let i = 0; i < 10; i++) {
      await request
        .post('/api/process/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('statement', pdfBuffer, 'test.pdf')
        .expect(200);
    }

    // 11th should be rate limited
    await request
      .post('/api/process/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('statement', pdfBuffer, 'test.pdf')
      .expect(429);
  });

  test('should rate limit API globally (100 req per 15 min per IP)', async () => {
    for (let i = 0; i < 100; i++) {
      await request.get('/api/health').expect(200);
    }

    // 101st should be rate limited
    await request.get('/api/health').expect(429);
  });

  test('should reset rate limit after time window', async () => {
    // This test requires time manipulation or waiting.
    // Mock Date.now() to simulate time passing.
  });
});
```

### 5.4 File Upload Security Tests (`/backend/tests/security/file-upload.test.ts`)

```typescript
describe('File Upload Security', () => {
  test('should reject executable files', async () => {
    const exeBuffer = Buffer.from('MZ'); // EXE file signature

    await request
      .post('/api/process/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('statement', exeBuffer, 'malware.exe')
      .expect(400);
  });

  test('should validate MIME type, not just extension', async () => {
    // PHP file disguised as PDF
    const phpBuffer = Buffer.from('<?php system($_GET["cmd"]); ?>');

    await request
      .post('/api/process/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('statement', phpBuffer, 'statement.pdf')
      .expect(400);
  });

  test('should enforce file size limit', async () => {
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB

    await request
      .post('/api/process/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('statement', largeBuffer, 'large.pdf')
      .expect(413);
  });

  test('should sanitize filenames to prevent path traversal', async () => {
    const pathTraversalNames = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      'statement.pdf\0.exe',
      'statement.pdf%00.exe',
    ];

    for (const filename of pathTraversalNames) {
      await request
        .post('/api/process/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('statement', Buffer.from('test'), filename)
        .expect(400);
    }
  });

  test('should not store files on disk', async () => {
    const pdfBuffer  = fs.readFileSync('./tests/fixtures/pdfs/valid-dbs-statement.pdf');
    const filesBefore = glob.sync('./backend/**/*.pdf');

    await request
      .post('/api/process/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('statement', pdfBuffer, 'test.pdf')
      .expect(200);

    const filesAfter = glob.sync('./backend/**/*.pdf');
    expect(filesAfter.length).toBe(filesBefore.length);
  });

  test('should clear file buffer from memory after processing', async () => {
    // Verify via memory profiling or heap snapshots.
  });
});
```

### 5.5 Authentication Security Tests (`/backend/tests/security/auth.test.ts`)

```typescript
describe('Authentication Security', () => {
  test('should use strong JWT secret', () => {
    const secret = process.env.JWT_SECRET;

    expect(secret.length).toBeGreaterThanOrEqual(32);
    expect(/[A-Za-z0-9]/.test(secret)).toBe(true);
  });

  test('should set secure token expiry', () => {
    const token   = generateMagicLink('test@afon.com.sg');
    const decoded = jwt.decode(token);

    const expiryMinutes = (decoded.exp - decoded.iat) / 60;
    expect(expiryMinutes).toBeLessThanOrEqual(15);
  });

  test('should reject reused magic links', async () => {
    await request.post('/api/auth/request-login').send({ email: 'user@afon.com.sg' });
    const token = getLastSentEmail()[0].html.match(/token=([^"]+)/)[1];

    // First use: should succeed
    await request.post('/api/auth/verify').send({ token }).expect(200);

    // Second use: should fail
    await request.post('/api/auth/verify').send({ token }).expect(401);
  });

  test('should not expose sensitive info in JWTs', () => {
    const token   = generateMagicLink('user@afon.com.sg');
    const decoded = jwt.decode(token);

    expect(Object.keys(decoded)).toEqual(expect.arrayContaining(['email', 'exp', 'iat']));
    expect(decoded).not.toHaveProperty('password');
    expect(decoded).not.toHaveProperty('ssn');
  });
});
```

---

## Test Data Requirements

### Sample Bank Statement PDFs (`/backend/tests/fixtures/pdfs/`)

| File | Description |
|------|-------------|
| `valid-dbs-statement.pdf` | Real or realistic DBS statement, 5–10 transactions, mix of debits and credits, text-based |
| `valid-uob-statement.pdf` | UOB statement, similar structure |
| `valid-hsbc-statement.pdf` | HSBC statement |
| `valid-citibank-statement.pdf` | Citibank statement |
| `scanned-statement.pdf` | Image-based PDF (scanned document), lower quality |
| `corrupted.pdf` | Intentionally corrupted, for error handling tests |
| `empty.pdf` | Valid PDF with no content |
| `password-protected.pdf` | PDF with password protection |
| `multi-page-statement.pdf` | Statement spanning 10+ pages |

### Sample Images (`/backend/tests/fixtures/images/`)

| File | Description |
|------|-------------|
| `clear-statement.png` | High-quality screenshot, ~1200×1600 px |
| `blurry-statement.jpg` | Low-quality/blurry image for OCR robustness testing |
| `rotated-statement.png` | Statement rotated 90° |
| `large-statement.png` | Very high resolution (4000×5000 px) for resize testing |
| `dark-statement.jpg` | Low-contrast image for preprocessing testing |

### Mock Data Generators

```typescript
// /backend/tests/helpers/mockData.ts

export function generateMockTransactions(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    date:            new Date(2026, 4, i + 1),
    payerPayeeName:  `Customer ${i + 1}`,
    transactionId:   `TXN${String(i + 1).padStart(6, '0')}`,
    transactionType: i % 2 === 0 ? 'Debit' : 'Credit',
    amount:          (Math.random() * 1000).toFixed(2),
    memo:            `Payment for services ${i + 1}`,
  }));
}

export function generateMockCSV(transactions: Transaction[]) {
  // Generate valid CSV from transactions
}

export async function createTestUser(email: string) {
  // Create user in test database
}

export async function createTestAdmin(email: string, isSuperAdmin: boolean) {
  // Create admin in test database
}
```

---

## Test Coverage Goals

| Layer | Target |
|-------|--------|
| Backend unit tests | > 80% code coverage |
| Backend integration tests | All API endpoints covered |
| Frontend component tests | > 70% component coverage |
| E2E tests | All critical user paths covered |
| Security tests | All OWASP Top 10 vulnerabilities tested |

---

## Running Tests

```bash
# Backend tests
cd backend
npm test                    # Run all tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:security       # Security tests only
npm run test:coverage       # With coverage report

# Frontend tests
cd frontend
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage

# E2E tests
npm run test:e2e            # Run Playwright/Cypress tests
npm run test:e2e:headed     # With browser UI
```
