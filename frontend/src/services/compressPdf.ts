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

  // ── Step 5: Initial scale and quality estimation ──────────────────────────
  const ratio = targetBytes > 0 ? targetBytes / originalSize : 0.75;
  let scale = 1.5;
  if (ratio >= 0.9) scale = 2.0;
  else if (ratio >= 0.7) scale = 1.8;
  else if (ratio >= 0.5) scale = 1.5;
  else if (ratio >= 0.3) scale = 1.25;
  else scale = 1.0;

  let quality = estimateQuality();

  console.log(`[Compress] Initial pass: scale=${scale.toFixed(2)}, quality=${quality.toFixed(2)}`);
  let compressedBytes = await buildPdf(quality, scale);
  let compressedSize = compressedBytes.length;

  // ── Step 6: Refinement Pass ────────────────────────────────────────────────
  if (targetBytes > 0) {
    const marginMin = targetBytes * 0.75;
    const marginMax = targetBytes;

    if (compressedSize < marginMin && (quality < 0.92 || scale < 2.0)) {
      // Too small! Let's increase quality and scale for a better result
      const newQuality = Math.min(0.92, quality + 0.15);
      const newScale = Math.min(2.0, scale * 1.25);
      console.log(
        `[Compress] Result ${(compressedSize / 1024).toFixed(0)} KB is way below target ${(targetBytes / 1024).toFixed(0)} KB. ` +
        `Retrying with higher quality=${newQuality.toFixed(2)}, scale=${newScale.toFixed(2)}`
      );
      const retryBytes = await buildPdf(newQuality, newScale);
      if (retryBytes.length <= targetBytes) {
        compressedBytes = retryBytes;
        compressedSize = retryBytes.length;
      }
    } else if (compressedSize > marginMax && quality > 0.3) {
      // Too big! Let's reduce quality and scale to fit
      const newQuality = Math.max(0.25, quality * 0.65);
      const newScale = Math.max(0.8, scale * 0.75);
      console.log(
        `[Compress] Result ${(compressedSize / 1024).toFixed(0)} KB exceeds target ${(targetBytes / 1024).toFixed(0)} KB. ` +
        `Retrying with lower quality=${newQuality.toFixed(2)}, scale=${newScale.toFixed(2)}`
      );
      const retryBytes = await buildPdf(newQuality, newScale);
      if (retryBytes.length < compressedBytes.length) {
        compressedBytes = retryBytes;
        compressedSize = retryBytes.length;
      }
    }
  }

  compressedSize = compressedBytes.length;
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
