/**
 * compressPdf.ts
 *
 * Browser-side PDF compression using:
 *   1. pdfjs-dist  → renders each page onto an HTML Canvas
 *   2. Canvas.toBlob (JPEG) → re-encodes at target quality (lossy)
 *   3. pdf-lib     → assembles the compressed JPEG images into a new PDF
 *
 * This produces REAL file-size reduction (typically 40–80%) for image-heavy
 * PDFs such as certificates, scanned docs, etc.
 */

import * as pdfjs from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

// Point the worker at the bundled worker file (Vite will handle the URL)
// Using legacy build that works without workerSrc configuration issues
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

export interface CompressResult {
  /** Compressed PDF as a Uint8Array */
  bytes: Uint8Array;
  originalSize: number;
  compressedSize: number;
  /** Human-readable summary message */
  message: string;
}

/**
 * Compress a PDF file in the browser.
 *
 * @param file        The PDF File object from the input
 * @param targetKB    Target size in KB  (0 = no specific target, just compress)
 * @param targetUnit  'KB' | 'MB'
 * @returns CompressResult with the compressed bytes and stats
 */
export async function compressPdfInBrowser(
  file: File,
  targetSizeInput: number,
  targetUnit: 'KB' | 'MB'
): Promise<CompressResult> {
  const targetBytes =
    targetUnit === 'MB'
      ? targetSizeInput * 1024 * 1024
      : targetSizeInput * 1024;

  // ── Step 1: Read the original file as ArrayBuffer ─────────────────────────
  const originalArrayBuffer = await file.arrayBuffer();
  const originalSize = originalArrayBuffer.byteLength;

  // ── Step 2: Load with pdfjs ───────────────────────────────────────────────
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(originalArrayBuffer) });
  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;

  // ── Step 3: Determine JPEG quality based on target ────────────────────────
  // Start at 0.85, then try lower if still too big
  // We do 1 pass at an estimated quality, then optionally a second pass
  const estimateQuality = (): number => {
    if (targetBytes <= 0) return 0.75;
    const ratio = targetBytes / originalSize;
    if (ratio >= 0.9) return 0.9;
    if (ratio >= 0.7) return 0.82;
    if (ratio >= 0.5) return 0.72;
    if (ratio >= 0.3) return 0.58;
    if (ratio >= 0.2) return 0.45;
    return 0.35;
  };

  // ── Step 4: Render pages to JPEG canvases ────────────────────────────────
  const renderPageToJpegBlob = async (
    pageNum: number,
    quality: number,
    scale: number
  ): Promise<{ blob: Blob; width: number; height: number }> => {
    const page = await pdfDocument.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx as any,
      viewport,
    } as any).promise;

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve({ blob, width: canvas.width, height: canvas.height });
          else reject(new Error(`Failed to encode page ${pageNum} as JPEG`));
        },
        'image/jpeg',
        quality
      );
    });
  };

  const buildPdf = async (quality: number, scale: number): Promise<Uint8Array> => {
    const resultPdf = await PDFDocument.create();

    for (let i = 1; i <= numPages; i++) {
      const { blob, width, height } = await renderPageToJpegBlob(i, quality, scale);
      const arrayBuf = await blob.arrayBuffer();
      const jpegImage = await resultPdf.embedJpg(new Uint8Array(arrayBuf));

      // Use points (1pt = 1/72 inch). pdfjs viewport is in CSS pixels at 96 DPI.
      // Convert to pt: pts = pixels * 72 / (96 * scale)
      const ptWidth = (width * 72) / (96 * scale);
      const ptHeight = (height * 72) / (96 * scale);

      const page = resultPdf.addPage([ptWidth, ptHeight]);
      page.drawImage(jpegImage, { x: 0, y: 0, width: ptWidth, height: ptHeight });
    }

    return resultPdf.save();
  };

  // ── Step 5: First compression pass ───────────────────────────────────────
  let quality = estimateQuality();
  // Scale: higher = better quality/larger file. 1.5 gives ~144 DPI which is good for most uses.
  let scale = 1.5;

  let compressedBytes = await buildPdf(quality, scale);

  // ── Step 6: If still too big, lower quality and retry ────────────────────
  if (targetBytes > 0 && compressedBytes.length > targetBytes && quality > 0.3) {
    // Reduce quality by ~30% more
    const newQuality = Math.max(0.25, quality * 0.65);
    const newScale = Math.max(1.0, scale * 0.8);
    console.log(
      `[Compress] First pass ${(compressedBytes.length / 1024).toFixed(0)} KB > target ${(targetBytes / 1024).toFixed(0)} KB. ` +
      `Retrying quality=${newQuality.toFixed(2)}, scale=${newScale.toFixed(2)}`
    );
    const attempt2 = await buildPdf(newQuality, newScale);
    if (attempt2.length < compressedBytes.length) {
      compressedBytes = attempt2;
    }
  }

  const compressedSize = compressedBytes.length;
  const reductionPct = (((originalSize - compressedSize) / originalSize) * 100).toFixed(1);
  const origKB = (originalSize / 1024).toFixed(1);
  const compKB = (compressedSize / 1024).toFixed(1);

  return {
    bytes: compressedBytes,
    originalSize,
    compressedSize,
    message: `Compressed from ${origKB} KB → ${compKB} KB (${reductionPct}% reduction). Target was ${targetSizeInput} ${targetUnit}.`,
  };
}
