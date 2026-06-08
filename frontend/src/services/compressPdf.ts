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

    return resultPdf.save() as any;
  };

  // ── Step 5: Advanced Binary Search Quality Optimizer ──────────────────────
  const configs = [
    { scale: 0.6, quality: 0.20 }, // 0
    { scale: 0.7, quality: 0.25 }, // 1
    { scale: 0.8, quality: 0.32 }, // 2
    { scale: 0.9, quality: 0.40 }, // 3
    { scale: 1.0, quality: 0.48 }, // 4
    { scale: 1.1, quality: 0.54 }, // 5
    { scale: 1.2, quality: 0.60 }, // 6
    { scale: 1.3, quality: 0.65 }, // 7
    { scale: 1.4, quality: 0.70 }, // 8
    { scale: 1.5, quality: 0.75 }, // 9
    { scale: 1.6, quality: 0.79 }, // 10
    { scale: 1.7, quality: 0.83 }, // 11
    { scale: 1.8, quality: 0.86 }, // 12
    { scale: 1.9, quality: 0.89 }, // 13
    { scale: 2.0, quality: 0.92 }  // 14
  ];

  let compressedBytes: any = new Uint8Array();
  let compressedSize = 0;
  let scale = 1.5;
  let quality = 0.75;

  if (targetBytes <= 0) {
    // No target size: run medium compression pass directly
    quality = 0.75;
    scale = 1.5;
    compressedBytes = await buildPdf(quality, scale);
    compressedSize = compressedBytes.length;
  } else {
    let low = 0;
    let high = configs.length - 1;
    let bestBytes: any = new Uint8Array();
    let bestSize = 0;
    let bestScale = 1.5;
    let bestQuality = 0.75;
    let hasFoundValid = false;

    // Run up to 4 binary search iterations to home in on target
    for (let step = 0; step < 4; step++) {
      if (low > high) break;
      const mid = Math.floor((low + high) / 2);
      const conf = configs[mid];
      const bytes = await buildPdf(conf.quality, conf.scale);
      const size = bytes.length;

      console.log(`[Compress Step ${step + 1}] Try config index=${mid} (scale=${conf.scale.toFixed(2)}, quality=${conf.quality.toFixed(2)}) -> size=${(size/1024).toFixed(1)} KB`);

      // Allow a tiny 8% tolerance threshold to prevent massive quality loss when a config is just 1-2% over target
      if (size <= targetBytes * 1.08) {
        bestBytes = bytes;
        bestSize = size;
        bestScale = conf.scale;
        bestQuality = conf.quality;
        hasFoundValid = true;

        // Early Exit: If within 8% of target size, stop search to run faster and avoid over-compressing
        if (size >= targetBytes * 0.92 && size <= targetBytes * 1.08) {
          console.log(`[Compress] Found close match: ${(size/1024).toFixed(1)} KB. Stopping search early.`);
          break;
        }

        low = mid + 1; // Try to get a larger file size (better quality)
      } else {
        high = mid - 1; // Too big, try to get a smaller file size
      }
    }

    // Fallback: If even the absolute lowest quality was too big, use it
    if (!hasFoundValid) {
      console.log(`[Compress] Warning: File cannot be compressed below target ${targetSizeInput} ${targetUnit}. Using minimum quality.`);
      const conf = configs[0];
      bestBytes = await buildPdf(conf.quality, conf.scale);
      bestSize = bestBytes.length;
      bestScale = conf.scale;
      bestQuality = conf.quality;
    }

    compressedBytes = bestBytes;
    compressedSize = bestSize;
    scale = bestScale;
    quality = bestQuality;
  }

  compressedSize = compressedBytes.length;

  if (compressedSize >= originalSize) {
    const originalBytes = new Uint8Array(originalArrayBuffer);
    return {
      bytes: originalBytes,
      originalSize,
      compressedSize: originalSize,
      message: `This PDF is already highly optimized. Original size of ${(originalSize / 1024).toFixed(1)} KB was preserved.`,
    };
  }

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
