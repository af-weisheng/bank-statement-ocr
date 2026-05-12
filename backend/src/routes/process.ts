import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { authenticateUser } from '../auth/middleware';
import { processBankStatement } from '../ocr';
import { query } from '../database/connection';
import { ApiResponse } from '@bank-statement-ocr/shared';

export const processRouter = Router();

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_BYTES =
  parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10) * 1024 * 1024;

// Accepted MIME types. image/jpg is non-standard but sent by some clients.
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
]);

// ─── Multer ───────────────────────────────────────────────────────────────────

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `'${file.mimetype}' is not allowed. Upload a PDF, PNG, or JPEG.`
        )
      );
    }
  },
});

/**
 * Wraps multer so that its errors are returned as JSON rather than
 * Express's default HTML error page.
 */
function withUpload(req: Request, res: Response, next: NextFunction): void {
  multerUpload.single('statement')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
          success: false,
          error: `File exceeds the ${process.env.MAX_FILE_SIZE_MB ?? 10} MB limit.`,
        });
      } else {
        res.status(400).json({ success: false, error: err.message });
      }
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    next();
  });
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────
// Runs after authenticateUser so req.user is available for per-email keying.
// Intentionally placed BEFORE withUpload so we reject rate-limited requests
// before accepting the multipart body into memory.
// NOTE: In-memory store — swap for a Redis store in multi-instance deployments.

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  keyGenerator: (req: Request) =>
    req.user?.email ?? req.ip ?? 'unknown',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Upload limit reached. You may process up to 10 files per hour.',
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Filename sanitization ────────────────────────────────────────────────────

/**
 * Returns a safe filename:
 *  - strips directory components (path traversal protection)
 *  - removes null bytes
 *  - replaces characters that are illegal on Windows or Linux filesystems
 *  - trims and truncates to 255 characters
 */
function sanitizeFilename(raw: string): string {
  return (
    path
      .basename(raw)                    // remove any directory prefix
      .replace(/\0/g, '')               // null bytes
      .replace(/\.\./g, '')             // double-dot traversal sequences
      .replace(/[<>:"|?*\\/]/g, '_')    // chars illegal on Windows / path separators
      .trim()
      .slice(0, 255) || 'unnamed'
  );
}

// ─── asyncRoute ───────────────────────────────────────────────────────────────

function asyncRoute(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

// ─── POST /api/process/upload ─────────────────────────────────────────────────

processRouter.post(
  '/upload',
  authenticateUser,   // 1. verify session JWT → req.user
  uploadLimiter,      // 2. rate-limit by email BEFORE body is buffered
  withUpload,         // 3. accept multipart body → req.file
  asyncRoute(async (req, res) => {
    // ── File presence + MIME check ────────────────────────────────────────────
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: "No file received. Include the file in a field named 'statement'.",
      });
      return;
    }

    // Re-validate MIME type after upload (belt-and-suspenders; fileFilter already
    // ran, but Content-Type can be spoofed in the multipart headers).
    if (!ALLOWED_MIME.has(req.file.mimetype)) {
      req.file.buffer = Buffer.alloc(0); // discard before rejecting
      res.status(400).json({
        success: false,
        error: `File type '${req.file.mimetype}' is not accepted.`,
      });
      return;
    }

    const fileName = sanitizeFilename(req.file.originalname);
    const { email: userEmail, domain: userDomain } = req.user!;

    console.log(
      `[process] Upload: ${fileName} | ${req.file.size} bytes | user: ${userEmail}`
    );

    // ── OCR pipeline ──────────────────────────────────────────────────────────
    // Pass the buffer and filename; all processing is in-memory.
    const result = await processBankStatement(req.file.buffer, fileName);

    // ── Discard file buffer immediately after use ─────────────────────────────
    // Replaces the buffer reference with an empty allocation so the GC can
    // reclaim the original data as soon as possible.
    req.file.buffer = Buffer.alloc(0);

    // ── Persist processing record ─────────────────────────────────────────────
    // We never store file content — only metadata and outcome.
    await query(
      `INSERT INTO processing_stats
         (user_email, user_domain, status, file_name, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userEmail,
        userDomain,
        result.success ? 'completed' : 'failed',
        fileName,
        result.error ?? null,
      ]
    );

    // ── Respond ───────────────────────────────────────────────────────────────
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error ?? 'Statement processing failed.',
      });
      return;
    }

    const response: ApiResponse<{
      csv: string;
      bankType?: string;
      transactionCount?: number;
    }> = {
      success: true,
      data: {
        csv: result.csv!,
        bankType: result.bankType,
        transactionCount: result.transactionCount,
      },
    };
    res.json(response);
  })
);

// ─── GET /api/process/history ─────────────────────────────────────────────────

interface HistoryRow {
  file_name: string;
  status: string;
  processed_at: Date;
  error_message: string | null;
}

processRouter.get(
  '/history',
  authenticateUser,
  asyncRoute(async (req, res) => {
    // Parse and clamp pagination params.
    const rawLimit  = parseInt((req.query.limit  as string) || '20', 10);
    const rawOffset = parseInt((req.query.offset as string) || '0',  10);
    const limit  = Number.isFinite(rawLimit)  ? Math.min(Math.max(rawLimit,  1), 100) : 20;
    const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

    // Fetch items and total in parallel.
    const [itemsResult, countResult] = await Promise.all([
      query<HistoryRow>(
        `SELECT file_name, status, processed_at, error_message
         FROM   processing_stats
         WHERE  user_email = $1
         ORDER  BY processed_at DESC
         LIMIT  $2 OFFSET $3`,
        [req.user!.email, limit, offset]
      ),
      query<{ count: string }>(
        'SELECT COUNT(*) AS count FROM processing_stats WHERE user_email = $1',
        [req.user!.email]
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const response: ApiResponse<{
      items: HistoryRow[];
      total: number;
      limit: number;
      offset: number;
    }> = {
      success: true,
      data: {
        items: itemsResult.rows,
        total,
        limit,
        offset,
      },
    };
    res.json(response);
  })
);
