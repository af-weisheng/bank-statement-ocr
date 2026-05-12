import sharp from 'sharp';
import Tesseract from 'tesseract.js';

// ─── Tesseract worker singleton ───────────────────────────────────────────────
// Re-using a single worker avoids the ~2 s startup cost on every OCR call.

let _worker: Tesseract.Worker | null = null;

async function getWorker(): Promise<Tesseract.Worker> {
  if (_worker) return _worker;

  console.log('[imageProcessor] Initialising Tesseract worker…');
  _worker = await Tesseract.createWorker('eng', 1, {
    logger: (m: Tesseract.LoggerMessage) => {
      if (m.status === 'recognizing text') {
        process.stdout.write(`\r[ocr] ${Math.round((m.progress ?? 0) * 100)}%`);
      }
    },
  });

  await _worker.setParameters({
    // PSM 6 – assume a single uniform block of text (good for tabular statements).
    tessedit_pageseg_mode: '6' as Tesseract.PSM,
    // Keep characters that appear in bank statements; exclude unlikely noise.
    tessedit_char_whitelist:
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
      " .,/()\\-+$:*#@&'\"",
    preserve_interword_spaces: '1',
  });

  console.log('[imageProcessor] Tesseract worker ready.');
  return _worker;
}

/** Terminates the shared Tesseract worker. Call on graceful shutdown. */
export async function terminateOcrWorker(): Promise<void> {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
    console.log('[imageProcessor] Tesseract worker terminated.');
  }
}

// ─── preprocessImage ─────────────────────────────────────────────────────────

/**
 * Prepares an image for OCR using Sharp:
 *  1. Converts to greyscale (removes colour noise)
 *  2. Normalises contrast (stretches histogram to 0–255)
 *  3. Sharpens edges (improves character boundary detection)
 *  4. Downscales to max 2000 px wide if wider (keeps aspect ratio)
 *
 * Returns a PNG buffer.
 */
export async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  try {
    const metadata = await sharp(buffer).metadata();
    const originalWidth = metadata.width ?? 0;

    let pipeline = sharp(buffer)
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1.5, flat: 0.5, jagged: 0.1 });

    if (originalWidth > 2000) {
      pipeline = pipeline.resize({ width: 2000, withoutEnlargement: true });
    }

    const result = await pipeline.png({ compressionLevel: 6 }).toBuffer();

    const finalMeta = await sharp(result).metadata();
    console.log(
      `[imageProcessor] Preprocessed: ${originalWidth}px → ${finalMeta.width}px wide.`
    );
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Image preprocessing failed: ${msg}`);
  }
}

// ─── ocrImage ────────────────────────────────────────────────────────────────

/**
 * Runs Tesseract OCR on a preprocessed image buffer.
 * Optimised for financial documents: PSM 6, numeric + alpha whitelist.
 * Returns the raw extracted text string.
 */
export async function ocrImage(buffer: Buffer): Promise<string> {
  try {
    const worker = await getWorker();
    console.log('[imageProcessor] Running OCR…');

    const {
      data: { text },
    } = await worker.recognize(buffer);

    process.stdout.write('\n'); // finish progress line
    console.log(`[imageProcessor] OCR complete — ${text.length} chars extracted.`);
    return text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`OCR failed: ${msg}`);
  }
}
