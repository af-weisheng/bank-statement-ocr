/**
 * OCR pipeline orchestrator.
 *
 * Pipeline:
 *  1. Extract text directly from PDF (pdf-parse)         — fast, no OCR
 *  2. If text is insufficient, extract embedded images   — pdfjs-dist
 *     OR treat the file as a raw image                   — JPEG / PNG input
 *  3. Preprocess each image for OCR                      — Sharp
 *  4. Run OCR on each image                              — Tesseract.js
 *  5. Detect bank from combined text                     — regex
 *  6. Parse transactions using bank-specific parser      — regex
 *  7. Generate CSV string                                — formatters
 *
 * All processing is in-memory. No files are written to disk.
 */

import { extractTextFromPDF, extractImagesFromPDF } from './pdfProcessor';
import { preprocessImage, ocrImage } from './imageProcessor';
import { detectBankType, parseTransactions } from './textParser';
import { generateCSV } from './csvGenerator';

// Minimum character count to consider PDF text extraction successful.
// Very short text typically means the PDF contains only images.
const MIN_TEXT_LENGTH = 150;

export interface ProcessResult {
  success: boolean;
  csv?: string;
  bankType?: string;
  transactionCount?: number;
  error?: string;
}

// ─── processBankStatement ─────────────────────────────────────────────────────

export async function processBankStatement(
  fileBuffer: Buffer,
  fileName: string
): Promise<ProcessResult> {
  console.log(`\n[ocr] ── Processing: ${fileName} (${(fileBuffer.length / 1024).toFixed(1)} KB) ──`);

  try {
    // ── Step 1: Extract text ───────────────────────────────────────────────────
    let text = '';
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    const isPdf = ext === 'pdf';

    if (isPdf) {
      try {
        text = await extractTextFromPDF(fileBuffer);
      } catch (pdfErr) {
        console.warn('[ocr] PDF text extraction error — will try image OCR:', pdfErr);
      }
    }

    // ── Step 2: Fall back to image OCR if text is insufficient ────────────────
    if (text.length < MIN_TEXT_LENGTH) {
      console.log(
        `[ocr] Text too short (${text.length} chars < ${MIN_TEXT_LENGTH}). ` +
        'Switching to image OCR pipeline…'
      );

      let imageBuffers: Buffer[] = [];

      if (isPdf) {
        imageBuffers = await extractImagesFromPDF(fileBuffer);
      } else if (['png', 'jpg', 'jpeg', 'tiff', 'bmp', 'webp'].includes(ext)) {
        // Input is already a raster image.
        imageBuffers = [fileBuffer];
      }

      if (imageBuffers.length === 0) {
        return {
          success: false,
          error:
            'Could not extract any text or images from the file. ' +
            'Ensure the PDF is not password-protected or corrupted.',
        };
      }

      const ocrFragments: string[] = [];
      for (let i = 0; i < imageBuffers.length; i++) {
        console.log(`[ocr] Processing image ${i + 1}/${imageBuffers.length}…`);
        const processed = await preprocessImage(imageBuffers[i]);
        const fragment = await ocrImage(processed);
        ocrFragments.push(fragment);
      }

      text = ocrFragments.join('\n\n');
      console.log(`[ocr] OCR complete — total text: ${text.length} chars.`);
    }

    if (!text.trim()) {
      return { success: false, error: 'No text could be extracted from the document.' };
    }

    // ── Step 3: Detect bank ───────────────────────────────────────────────────
    const bankType = detectBankType(text);
    console.log(`[ocr] Bank detected: ${bankType}`);

    // ── Step 4: Parse transactions ────────────────────────────────────────────
    const transactions = parseTransactions(text, bankType);
    console.log(`[ocr] Transactions parsed: ${transactions.length}`);

    if (transactions.length === 0) {
      return {
        success: false,
        bankType,
        error:
          `No transactions found in this ${bankType} statement. ` +
          'The document layout may not match the expected format.',
      };
    }

    // ── Step 5: Generate CSV ──────────────────────────────────────────────────
    const csv = generateCSV(transactions);
    console.log(`[ocr] CSV generated — ${transactions.length} rows, ${csv.length} bytes.`);

    return {
      success: true,
      csv,
      bankType,
      transactionCount: transactions.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ocr] processBankStatement failed:', message);
    return { success: false, error: message };
  }
}
