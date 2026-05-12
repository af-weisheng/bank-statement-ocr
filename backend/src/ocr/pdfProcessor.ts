import pdfParse from 'pdf-parse';
import sharp from 'sharp';

// Load the pdfjs-dist legacy CommonJS build.
// The ESM build requires a bundler; the legacy build works in Node.js directly.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
// Run everything in the main thread — no web worker in Node.js.
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

// ImageKind values as defined by pdfjs-dist internals.
const ImageKind = { GRAYSCALE_1BPP: 1, RGB_24BPP: 2, RGBA_32BPP: 3 } as const;

// ─── extractTextFromPDF ───────────────────────────────────────────────────────

/**
 * Extracts selectable text from a PDF buffer using pdf-parse.
 * Returns a non-empty string for digital/electronic PDFs.
 * Returns an empty string for image-only (scanned) PDFs.
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const result = await pdfParse(buffer);
    const text = result.text?.trim() ?? '';
    console.log(`[pdfProcessor] Text extraction: ${text.length} chars, ${result.numpages} page(s).`);
    return text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to extract PDF text: ${msg}`);
  }
}

// ─── extractImagesFromPDF ─────────────────────────────────────────────────────

/**
 * Extracts all embedded image XObjects from a PDF buffer.
 * Works without a canvas — uses pdfjs-dist's operator list to locate images,
 * then converts raw pixel data to PNG via Sharp.
 *
 * Typical use case: scanned bank statement PDFs where each page IS a JPEG/PNG
 * image embedded as an XObject. Returns one Buffer per embedded image.
 */
export async function extractImagesFromPDF(buffer: Buffer): Promise<Buffer[]> {
  const images: Buffer[] = [];

  const data = new Uint8Array(buffer);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadingTask = pdfjsLib.getDocument({ data, verbosity: 0 }) as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = await loadingTask.promise;
  console.log(`[pdfProcessor] Image extraction: ${doc.numPages} page(s).`);

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page: any = await doc.getPage(pageNum);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opList: any = await page.getOperatorList();

    // Collect unique XObject image names referenced on this page.
    const imageNames = new Set<string>();
    for (let i = 0; i < opList.fnArray.length; i++) {
      // OPS.paintImageXObject === 85
      if (opList.fnArray[i] === 85) {
        imageNames.add(opList.argsArray[i][0] as string);
      }
    }

    // Extract each XObject image.
    for (const imageName of imageNames) {
      const imgData = await new Promise<Record<string, unknown> | null>((resolve) => {
        try {
          // page.objs.get(name, callback) fires callback when the object is ready.
          page.objs.get(imageName, (obj: unknown) =>
            resolve(obj as Record<string, unknown> | null)
          );
        } catch {
          resolve(null);
        }
      });

      if (!imgData?.data || !imgData.width || !imgData.height) {
        console.warn(`[pdfProcessor] Skipping image ${imageName}: no pixel data.`);
        continue;
      }

      const width = imgData.width as number;
      const height = imgData.height as number;
      const kind = (imgData.kind as number) ?? ImageKind.RGB_24BPP;
      const channels: 1 | 3 | 4 =
        kind === ImageKind.GRAYSCALE_1BPP ? 1 :
        kind === ImageKind.RGBA_32BPP ? 4 : 3;

      try {
        const pixelBuffer = Buffer.from(imgData.data as Uint8ClampedArray);
        const pngBuffer = await sharp(pixelBuffer, {
          raw: { width, height, channels },
        })
          .png()
          .toBuffer();

        images.push(pngBuffer);
        console.log(
          `[pdfProcessor] Page ${pageNum}: extracted image ${imageName} ` +
          `(${width}×${height}, ${channels}ch).`
        );
      } catch (sharpErr) {
        console.warn(
          `[pdfProcessor] Could not convert image ${imageName}:`,
          sharpErr instanceof Error ? sharpErr.message : sharpErr
        );
      }
    }

    // Also capture inline images (paintInlineImageXObject === 87).
    for (let i = 0; i < opList.fnArray.length; i++) {
      if (opList.fnArray[i] === 87) {
        const imgData = opList.argsArray[i][0] as Record<string, unknown> | undefined;
        if (!imgData?.data || !imgData.width || !imgData.height) continue;

        const width = imgData.width as number;
        const height = imgData.height as number;
        const kind = (imgData.kind as number) ?? ImageKind.RGB_24BPP;
        const channels: 1 | 3 | 4 =
          kind === ImageKind.GRAYSCALE_1BPP ? 1 :
          kind === ImageKind.RGBA_32BPP ? 4 : 3;

        try {
          const pixelBuffer = Buffer.from(imgData.data as Uint8ClampedArray);
          const pngBuffer = await sharp(pixelBuffer, {
            raw: { width, height, channels },
          })
            .png()
            .toBuffer();

          images.push(pngBuffer);
        } catch {
          // Inline images that fail to convert are silently skipped.
        }
      }
    }

    page.cleanup();
  }

  await doc.destroy();
  console.log(`[pdfProcessor] Extracted ${images.length} image(s) from PDF.`);
  return images;
}
