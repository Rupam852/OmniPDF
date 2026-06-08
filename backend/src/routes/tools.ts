import { Router, Response } from 'express';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  PDFDocument,
  rgb,
  degrees,
  PDFName,
  PDFDict,
  PDFStream,
  StandardFonts,
} from 'pdf-lib';
import { AuthenticatedRequest } from '../middleware/auth';
import { processingLimiter } from '../middleware/rateLimiter';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

const router = Router();

// Configure multer for file storage in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
});

// Apply rate limiting specifically for processing endpoints
router.use(processingLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads a PDFDocument safely, returning a friendly error on parse failure.
 */
async function loadPdf(buffer: Buffer): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(buffer, { ignoreEncryption: true });
  } catch (err: any) {
    throw new Error(
      `Failed to parse the PDF file. It may be corrupted or password-protected. Details: ${err.message}`
    );
  }
}

/**
 * Wraps text to fit within maxWidth characters per line (rough approximation).
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(' ');
    let currentLine = '';
    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      if (test.length > maxCharsPerLine) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) lines.push(currentLine);
  }
  return lines;
}

/**
 * Creates a multi-page PDF from plain text.
 */
async function createPdfFromText(text: string, title: string): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595; // A4
  const pageHeight = 842;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  const fontSize = 11;
  const titleFontSize = 14;
  const lineHeight = 18;

  const wrappedLines = wrapText(text, Math.floor(contentWidth / 6.5));

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Draw title
  page.drawText(title, {
    x: margin,
    y,
    size: titleFontSize,
    font: titleFont,
    color: rgb(0.1, 0.4, 0.8),
  });
  y -= lineHeight * 2;

  for (const line of wrappedLines) {
    if (y < margin + lineHeight) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    if (line) {
      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
    }
    y -= lineHeight;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes).toString('base64');
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/merge
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/merge',
  upload.array('files'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length < 2) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'At least two PDF files are required for merging.',
      });
      return;
    }

    try {
      console.log(`[Merge PDF] Merging ${files.length} files`);
      const mergedPdf = await PDFDocument.create();

      for (const file of files) {
        const pdf = await loadPdf(file.buffer);
        const indices = pdf.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(pdf, indices);
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const bytes = await mergedPdf.save();
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: `${files.length} PDF files merged successfully.`,
        fileData: base64,
        fileName: `merged_${Date.now()}.pdf`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Merge PDF] Error:', error);
      res.status(500).json({
        error: 'Processing Failed',
        message: error.message || 'Failed to merge PDF files.',
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/split
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/split',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    // splitMode: 'all' = one PDF per page, 'range' = use pageRanges param
    const splitMode: string = req.body.splitMode || 'all';
    // pageRanges: comma-separated page numbers or ranges, e.g. "1-3,5,7-9" (1-indexed)
    const pageRangesRaw: string = req.body.pageRanges || '';

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    try {
      const pdfDoc = await loadPdf(file.buffer);
      const totalPages = pdfDoc.getPageCount();
      console.log(`[Split PDF] ${totalPages} pages, mode=${splitMode}`);

      if (totalPages === 0) {
        res.status(400).json({ error: 'Bad Request', message: 'The PDF has no pages.' });
        return;
      }

      // Parse page ranges helper
      const parsePageRanges = (raw: string, total: number): number[][] => {
        if (!raw.trim()) {
          // Default: split every page individually
          return Array.from({ length: total }, (_, i) => [i]);
        }
        const groups: number[][] = [];
        for (const part of raw.split(',')) {
          const trimmed = part.trim();
          if (!trimmed) continue;
          if (trimmed.includes('-')) {
            const [startStr, endStr] = trimmed.split('-');
            const start = Math.max(1, parseInt(startStr, 10));
            const end = Math.min(total, parseInt(endStr, 10));
            if (start <= end) {
              groups.push(Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i));
            }
          } else {
            const pg = parseInt(trimmed, 10);
            if (pg >= 1 && pg <= total) {
              groups.push([pg - 1]);
            }
          }
        }
        if (groups.length === 0) {
          return Array.from({ length: total }, (_, i) => [i]);
        }
        return groups;
      };

      let groups: number[][];
      if (splitMode === 'half') {
        const half = Math.ceil(totalPages / 2);
        groups = [
          Array.from({ length: half }, (_, i) => i),
          Array.from({ length: totalPages - half }, (_, i) => i + half),
        ];
      } else if (splitMode === 'range' && pageRangesRaw) {
        groups = parsePageRanges(pageRangesRaw, totalPages);
      } else {
        // Default: one page per file
        groups = Array.from({ length: totalPages }, (_, i) => [i]);
      }

      const resultFiles: { fileName: string; fileData: string; downloadUrl?: string }[] = [];

      for (let gi = 0; gi < groups.length; gi++) {
        const pageIndices = groups[gi];
        const partPdf = await PDFDocument.create();
        const copied = await partPdf.copyPages(pdfDoc, pageIndices);
        copied.forEach((p) => partPdf.addPage(p));
        const bytes = await partPdf.save();
        const b64 = Buffer.from(bytes).toString('base64');
        const baseName = (file.originalname || 'document.pdf').replace(/\.pdf$/i, '');
        const partName = groups.length === 1
          ? `${baseName}_page${pageIndices[0] + 1}.pdf`
          : `${baseName}_part${gi + 1}_pages${pageIndices[0] + 1}-${pageIndices[pageIndices.length - 1] + 1}.pdf`;
        resultFiles.push({
          fileName: partName,
          fileData: b64,
          downloadUrl: `data:application/pdf;base64,${b64}`,
        });
      }

      res.status(200).json({
        success: true,
        message: `PDF split into ${resultFiles.length} part(s) successfully.`,
        files: resultFiles,
      });
    } catch (error: any) {
      console.error('[Split PDF] Error:', error);
      res.status(500).json({ error: 'Server Error', message: error.message || 'Failed to split PDF.' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/compress
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/compress',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const targetSizeInput = parseFloat(req.body.targetSize || '500');
    const targetUnit = (req.body.targetUnit || 'KB').toUpperCase();

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    const targetBytes =
      targetUnit === 'MB' ? targetSizeInput * 1024 * 1024 : targetSizeInput * 1024;

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const inputTempPath = path.join(tempDir, `input-${uniqueSuffix}.pdf`);
    const outputTempPath = path.join(tempDir, `output-${uniqueSuffix}.pdf`);

    try {
      console.log(
        `[Compress PDF] Original: ${file.size} bytes, Target: ${targetSizeInput} ${targetUnit} (${targetBytes} bytes)`
      );

      await fs.promises.writeFile(inputTempPath, file.buffer);

      const scriptPath = path.join(__dirname, '../scripts/compress.py');
      console.log(`[Compress PDF] Running python compression script: ${scriptPath}`);

      await execFileAsync('python', [
        scriptPath,
        inputTempPath,
        outputTempPath,
        targetSizeInput.toString(),
        targetUnit,
      ]);

      if (!fs.existsSync(outputTempPath)) {
        throw new Error('Python compression script did not generate output file.');
      }

      const compressedBytes = await fs.promises.readFile(outputTempPath);
      console.log(`[Compress PDF] Successfully compressed file from python script: ${compressedBytes.length} bytes`);

      const base64 = compressedBytes.toString('base64');
      const originalKB = (file.size / 1024).toFixed(1);
      const compressedKB = (compressedBytes.length / 1024).toFixed(1);
      const reduction = (((file.size - compressedBytes.length) / file.size) * 100).toFixed(1);

      res.status(200).json({
        success: true,
        message: `Compressed from ${originalKB} KB → ${compressedKB} KB (${reduction}% reduction). Target was ${targetSizeInput} ${targetUnit}.`,
        originalSize: file.size,
        compressedSize: compressedBytes.length,
        targetSize: targetBytes,
        fileData: base64,
        fileName: `compressed_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Compress PDF] Error:', error);
      res.status(500).json({
        error: 'Processing Failed',
        message: error.message || 'Failed to compress PDF.',
      });
    } finally {
      try {
        if (fs.existsSync(inputTempPath)) {
          fs.unlinkSync(inputTempPath);
        }
        if (fs.existsSync(outputTempPath)) {
          fs.unlinkSync(outputTempPath);
        }
      } catch (cleanupErr) {
        console.error('[Compress PDF] Temp file cleanup error:', cleanupErr);
      }
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/protect
// NOTE: pdf-lib does NOT support AES/RC4 password encryption.
// We add a visible protection stamp on every page as a deterrent.
// For real password protection, an external binary (Ghostscript/qpdf) is needed.
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/protect',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const password = req.body.password || '';

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    try {
      console.log(`[Protect PDF] File: ${file.size} bytes`);
      const pdfDoc = await loadPdf(file.buffer);
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pages = pdfDoc.getPages();

      pages.forEach((page) => {
        const { width, height } = page.getSize();

        // Top banner
        page.drawRectangle({
          x: 0,
          y: height - 22,
          width,
          height: 22,
          color: rgb(0.8, 0.15, 0.15),
          opacity: 0.85,
        });
        page.drawText('🔒 PROTECTED — OmniPDF Security Engine', {
          x: 10,
          y: height - 16,
          size: 9,
          font,
          color: rgb(1, 1, 1),
        });

        // Centre diagonal watermark
        page.drawText('PROTECTED', {
          x: width / 2 - 80,
          y: height / 2 - 20,
          size: 36,
          font,
          color: rgb(0.8, 0.1, 0.1),
          opacity: 0.08,
          rotate: degrees(45),
        });
      });

      pdfDoc.setTitle(`Protected — ${pdfDoc.getTitle() || 'Document'}`);
      pdfDoc.setCreator('OmniPDF Security Engine');

      const bytes = await pdfDoc.save();
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message:
          'PDF has been stamped with a security overlay. Note: full AES password encryption requires a server-side binary (Ghostscript). Contact support for enterprise encryption.',
        fileData: base64,
        fileName: `protected_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Protect PDF] Error:', error);
      res.status(500).json({
        error: 'Processing Failed',
        message: error.message || 'Failed to protect PDF.',
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/rotate
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/rotate',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    // angle: 90 | 180 | 270 (default 90)
    const angle = parseInt(req.body.angle || '90', 10);
    // pages: 'all' | comma-separated 1-indexed page numbers e.g. '1,3,5'
    const pagesParam: string = req.body.pages || 'all';

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    const validAngles = [90, 180, 270];
    if (!validAngles.includes(angle)) {
      res.status(400).json({ error: 'Bad Request', message: `Invalid angle. Must be one of: ${validAngles.join(', ')}.` });
      return;
    }

    try {
      const pdfDoc = await loadPdf(file.buffer);
      const pages = pdfDoc.getPages();
      const totalPages = pages.length;

      // Determine which pages to rotate
      let pageIndices: number[];
      if (pagesParam === 'all') {
        pageIndices = pages.map((_, i) => i);
      } else {
        pageIndices = pagesParam
          .split(',')
          .map((s) => parseInt(s.trim(), 10) - 1)
          .filter((i) => i >= 0 && i < totalPages);
      }

      console.log(`[Rotate PDF] Rotating ${pageIndices.length}/${totalPages} pages by ${angle}°`);

      for (const idx of pageIndices) {
        const page = pages[idx];
        const currentAngle = page.getRotation().angle;
        page.setRotation(degrees((currentAngle + angle) % 360));
      }

      const bytes = await pdfDoc.save();
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: `Rotated ${pageIndices.length} page(s) by ${angle}° successfully.`,
        fileData: base64,
        fileName: `rotated_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Rotate PDF] Error:', error);
      res.status(500).json({
        error: 'Processing Failed',
        message: error.message || 'Failed to rotate PDF.',
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/watermark
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/watermark',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const watermarkText = (req.body.watermarkText || 'OmniPDF').trim() || 'OmniPDF';
    const opacity = Math.min(1, Math.max(0.05, parseFloat(req.body.opacity || '0.15')));
    const fontSize = Math.min(80, Math.max(12, parseInt(req.body.fontSize || '40', 10)));

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    try {
      const pdfDoc = await loadPdf(file.buffer);
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pages = pdfDoc.getPages();

      console.log(`[Watermark PDF] Applying watermark "${watermarkText}" to ${pages.length} pages`);

      pages.forEach((page) => {
        const { width, height } = page.getSize();
        // Estimate text width at given font size (Helvetica-Bold: ~0.6 ratio)
        const textWidth = watermarkText.length * fontSize * 0.55;
        const textHeight = fontSize;

        // Centre it properly accounting for 45° rotation
        // When text is rotated 45°, its bounding box centre needs adjustment
        const cx = width / 2;
        const cy = height / 2;

        page.drawText(watermarkText, {
          x: cx - textWidth / 2,
          y: cy - textHeight / 2,
          size: fontSize,
          font,
          color: rgb(0.5, 0.5, 0.5),
          opacity,
          rotate: degrees(45),
        });
      });

      const bytes = await pdfDoc.save();
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: `Watermark "${watermarkText}" applied to all ${pages.length} page(s) successfully.`,
        fileData: base64,
        fileName: `watermarked_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Watermark PDF] Error:', error);
      res.status(500).json({
        error: 'Processing Failed',
        message: error.message || 'Failed to watermark PDF.',
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/remove-pages
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/remove-pages',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    // pageNumbers: comma-separated 1-indexed pages to remove, e.g. "1,3,5"
    const pageNumbersRaw: string = req.body.pageNumbers || '';

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }
    if (!pageNumbersRaw.trim()) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'pageNumbers is required. Provide comma-separated 1-indexed page numbers to remove.',
      });
      return;
    }

    try {
      const pdfDoc = await loadPdf(file.buffer);
      const totalPages = pdfDoc.getPageCount();

      const pagesToRemove = new Set(
        pageNumbersRaw
          .split(',')
          .map((s) => parseInt(s.trim(), 10) - 1)
          .filter((i) => i >= 0 && i < totalPages)
      );

      if (pagesToRemove.size === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: `No valid page numbers provided. Document has ${totalPages} page(s).`,
        });
        return;
      }

      if (pagesToRemove.size >= totalPages) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Cannot remove all pages. At least one page must remain.',
        });
        return;
      }

      console.log(`[Remove Pages] Removing pages ${[...pagesToRemove].map(i => i+1).join(',')} from ${totalPages}-page PDF`);

      const keepIndices = Array.from({ length: totalPages }, (_, i) => i).filter(
        (i) => !pagesToRemove.has(i)
      );

      const resultPdf = await PDFDocument.create();
      const copied = await resultPdf.copyPages(pdfDoc, keepIndices);
      copied.forEach((p) => resultPdf.addPage(p));

      const bytes = await resultPdf.save();
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: `Removed ${pagesToRemove.size} page(s). Document now has ${keepIndices.length} page(s).`,
        fileData: base64,
        fileName: `pages_removed_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Remove Pages] Error:', error);
      res.status(500).json({ error: 'Processing Failed', message: error.message || 'Failed to remove pages.' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/extract-pages
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/extract-pages',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    // pageRanges: e.g. "1-3,5,7-9" (1-indexed)
    const pageRangesRaw: string = req.body.pageRanges || '';

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }
    if (!pageRangesRaw.trim()) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'pageRanges is required. E.g. "1-3,5,7-9"',
      });
      return;
    }

    try {
      const pdfDoc = await loadPdf(file.buffer);
      const totalPages = pdfDoc.getPageCount();

      const extractIndices: number[] = [];
      for (const part of pageRangesRaw.split(',')) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
          const [startStr, endStr] = trimmed.split('-');
          const start = Math.max(1, parseInt(startStr, 10));
          const end = Math.min(totalPages, parseInt(endStr, 10));
          for (let i = start; i <= end; i++) extractIndices.push(i - 1);
        } else {
          const pg = parseInt(trimmed, 10);
          if (pg >= 1 && pg <= totalPages) extractIndices.push(pg - 1);
        }
      }

      const uniqueIndices = [...new Set(extractIndices)].sort((a, b) => a - b);

      if (uniqueIndices.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: `No valid pages found. Document has ${totalPages} page(s).`,
        });
        return;
      }

      console.log(`[Extract Pages] Extracting ${uniqueIndices.length} pages from ${totalPages}-page PDF`);

      const resultPdf = await PDFDocument.create();
      const copied = await resultPdf.copyPages(pdfDoc, uniqueIndices);
      copied.forEach((p) => resultPdf.addPage(p));

      const bytes = await resultPdf.save();
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: `Extracted ${uniqueIndices.length} page(s) from a ${totalPages}-page document.`,
        fileData: base64,
        fileName: `extracted_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Extract Pages] Error:', error);
      res.status(500).json({ error: 'Processing Failed', message: error.message || 'Failed to extract pages.' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/page-numbers
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/page-numbers',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const position: string = req.body.position || 'bottom-center'; // top-left, top-center, top-right, bottom-left, bottom-center, bottom-right
    const startNumber = parseInt(req.body.startNumber || '1', 10);
    const fontSize = Math.min(18, Math.max(6, parseInt(req.body.fontSize || '10', 10)));
    const prefix: string = req.body.prefix || '';

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    try {
      const pdfDoc = await loadPdf(file.buffer);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      const margin = 20;

      console.log(`[Page Numbers] Adding page numbers to ${pages.length} pages, position=${position}`);

      pages.forEach((page, idx) => {
        const { width, height } = page.getSize();
        const pageLabel = `${prefix}${startNumber + idx}`;
        const textWidth = pageLabel.length * fontSize * 0.55;

        let x: number;
        let y: number;

        const isBottom = position.startsWith('bottom');
        y = isBottom ? margin : height - margin - fontSize;

        if (position.endsWith('left')) {
          x = margin;
        } else if (position.endsWith('right')) {
          x = width - margin - textWidth;
        } else {
          x = (width - textWidth) / 2;
        }

        page.drawText(pageLabel, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });
      });

      const bytes = await pdfDoc.save();
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: `Page numbers added to all ${pages.length} page(s) starting from ${startNumber}.`,
        fileData: base64,
        fileName: `numbered_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Page Numbers] Error:', error);
      res.status(500).json({ error: 'Processing Failed', message: error.message || 'Failed to add page numbers.' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/repair
// Attempts to reload and re-save the PDF to fix minor structural corruption.
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/repair',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    try {
      console.log(`[Repair PDF] Attempting repair on ${file.size}-byte file`);
      // Load with ignoreEncryption and then re-save — fixes most cross-reference table issues
      const pdfDoc = await PDFDocument.load(file.buffer, {
        ignoreEncryption: true,
        updateMetadata: false,
      });

      const bytes = await pdfDoc.save({ useObjectStreams: false });
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: 'PDF repaired and re-serialised successfully. Cross-reference tables and object streams have been rebuilt.',
        fileData: base64,
        fileName: `repaired_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Repair PDF] Error:', error);
      res.status(500).json({
        error: 'Repair Failed',
        message: `Could not repair PDF: ${error.message}. The file may be too severely corrupted.`,
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/unlock
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/unlock',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    try {
      console.log(`[Unlock PDF] Attempting to unlock ${file.size}-byte file`);
      const pdfDoc = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
      const bytes = await pdfDoc.save();
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message:
          'PDF unlocked and re-saved without encryption headers. Note: only PDFs without strict password protection can be unlocked this way.',
        fileData: base64,
        fileName: `unlocked_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Unlock PDF] Error:', error);
      res.status(500).json({
        error: 'Unlock Failed',
        message: `Could not unlock PDF: ${error.message}. The file may be strongly password-protected.`,
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/jpg-to-pdf
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/jpg-to-pdf',
  upload.array('files'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'Bad Request', message: 'At least one image file is required.' });
      return;
    }

    try {
      console.log(`[JPG to PDF] Converting ${files.length} image(s) to PDF`);
      const pdfDoc = await PDFDocument.create();

      for (const file of files) {
        const mime = file.mimetype;
        let image;
        if (mime === 'image/jpeg' || mime === 'image/jpg') {
          image = await pdfDoc.embedJpg(file.buffer);
        } else if (mime === 'image/png') {
          image = await pdfDoc.embedPng(file.buffer);
        } else {
          console.warn(`[JPG to PDF] Skipping unsupported mime type: ${mime}`);
          continue;
        }

        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      }

      if (pdfDoc.getPageCount() === 0) {
        res.status(400).json({ error: 'Bad Request', message: 'No valid JPG or PNG images found in the upload.' });
        return;
      }

      const bytes = await pdfDoc.save();
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: `${pdfDoc.getPageCount()} image(s) converted to PDF successfully.`,
        fileData: base64,
        fileName: `converted_images_${Date.now()}.pdf`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[JPG to PDF] Error:', error);
      res.status(500).json({
        error: 'Processing Failed',
        message: error.message || 'Failed to convert image(s) to PDF.',
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/pdf-to-jpg  (extracts text as a "page-list" alternative)
// Note: Real rasterisation needs canvas/puppeteer. We return page metadata instead.
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/pdf-to-jpg',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    try {
      const pdfDoc = await loadPdf(file.buffer);
      const pages = pdfDoc.getPages();

      res.status(200).json({
        success: true,
        message: `PDF has ${pages.length} page(s). Server-side rasterisation to JPG requires an additional binary (e.g. pdf2pic, Ghostscript). This endpoint confirms page count and dimensions.`,
        pageCount: pages.length,
        pages: pages.map((p, i) => ({
          page: i + 1,
          width: Math.round(p.getSize().width),
          height: Math.round(p.getSize().height),
        })),
      });
    } catch (error: any) {
      console.error('[PDF to JPG] Error:', error);
      res.status(500).json({ error: 'Processing Failed', message: error.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/ai-summarizer
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/ai-summarizer',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const geminiApiKey = (req.headers['x-gemini-key'] as string) || req.body.apiKey;
    const summaryFormat: string = req.body.summaryFormat || 'bullets';

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF document is required.' });
      return;
    }
    if (!geminiApiKey) {
      res.status(400).json({
        error: 'Gemini Key Missing',
        message: 'A Google Gemini API key must be provided to use the AI Summarizer.',
      });
      return;
    }

    try {
      console.log(`[AI Summarizer] File: ${file.size} bytes, format: ${summaryFormat}`);
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt =
        summaryFormat === 'paragraph'
          ? 'Analyze this PDF document and generate a clear, concise executive summary in fluid paragraph form, highlighting key points and conclusions.'
          : 'Analyze this PDF document and generate a structured executive summary with clear bullet points for key findings, main topics, and actionable insights.';

      const result = await model.generateContent([
        {
          inlineData: {
            data: file.buffer.toString('base64'),
            mimeType: 'application/pdf',
          },
        },
        { text: prompt },
      ]);

      const summaryText = result.response.text();
      const summaryPdfBase64 = await createPdfFromText(summaryText, 'AI EXECUTIVE SUMMARY — OmniPDF');

      res.status(200).json({
        success: true,
        summary: summaryText,
        fileData: summaryPdfBase64,
        fileName: `summary_${file.originalname || 'document'}.pdf`,
        downloadUrl: `data:application/pdf;base64,${summaryPdfBase64}`,
      });
    } catch (error: any) {
      console.error('[AI Summarizer] Error:', error);
      res.status(500).json({
        error: 'AI Processing Failed',
        message: error.message || 'Could not summarize document. Check your Gemini API key.',
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/translate
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/translate',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const { targetLanguage } = req.body;
    const geminiApiKey = (req.headers['x-gemini-key'] as string) || req.body.apiKey;

    if (!file || !targetLanguage) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'PDF document and targetLanguage are required.',
      });
      return;
    }
    if (!geminiApiKey) {
      res.status(400).json({
        error: 'Gemini Key Missing',
        message: 'A Google Gemini API key must be provided to translate documents.',
      });
      return;
    }

    try {
      console.log(`[Translate PDF] Target: ${targetLanguage}, File: ${file.size} bytes`);
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const result = await model.generateContent([
        {
          inlineData: {
            data: file.buffer.toString('base64'),
            mimeType: 'application/pdf',
          },
        },
        {
          text: `Translate the full content of this PDF document into ${targetLanguage}. Return only the translated text, maintaining structural paragraphs, headings, and lists as closely as possible.`,
        },
      ]);

      const translatedText = result.response.text();
      console.log(`[Translate PDF] Done. ${translatedText.length} characters.`);

      const translatedPdfBase64 = await createPdfFromText(
        translatedText,
        `TRANSLATED PDF — ${targetLanguage.toUpperCase()}`
      );

      res.status(200).json({
        success: true,
        message: `PDF translated to ${targetLanguage} successfully.`,
        fileData: translatedPdfBase64,
        fileName: `translated_${targetLanguage}_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${translatedPdfBase64}`,
      });
    } catch (error: any) {
      console.error('[Translate PDF] Error:', error);
      res.status(500).json({
        error: 'Translation Failed',
        message: error.message || 'Translation failed. Ensure your Gemini API key is valid.',
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/organize-pdf (reorder pages)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/organize-pdf',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    // pageOrder: comma-separated 1-indexed new order, e.g. "3,1,2" for 3-page PDF
    const pageOrderRaw: string = req.body.pageOrder || '';

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    try {
      const pdfDoc = await loadPdf(file.buffer);
      const totalPages = pdfDoc.getPageCount();

      let newOrder: number[];
      if (!pageOrderRaw.trim()) {
        // Default: reverse pages
        newOrder = Array.from({ length: totalPages }, (_, i) => totalPages - 1 - i);
      } else {
        newOrder = pageOrderRaw
          .split(',')
          .map((s) => parseInt(s.trim(), 10) - 1)
          .filter((i) => i >= 0 && i < totalPages);

        if (newOrder.length === 0) {
          res.status(400).json({ error: 'Bad Request', message: 'Invalid pageOrder provided.' });
          return;
        }
      }

      console.log(`[Organize PDF] Reordering ${totalPages} pages`);
      const resultPdf = await PDFDocument.create();
      const copied = await resultPdf.copyPages(pdfDoc, newOrder);
      copied.forEach((p) => resultPdf.addPage(p));

      const bytes = await resultPdf.save();
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: `Pages reorganised successfully (${newOrder.length} pages in new order).`,
        fileData: base64,
        fileName: `organized_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Organize PDF] Error:', error);
      res.status(500).json({ error: 'Processing Failed', message: error.message || 'Failed to organize PDF.' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/log
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/log',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { toolName, status } = req.body;
    console.log(`[OmniPDF Log] Tool Usage: ${toolName} - Status: ${status}`);
    res.status(200).json({ success: true, logId: `log_${Date.now()}` });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Generic "Not Implemented" handler for tools shown in UI but not yet supported
// ─────────────────────────────────────────────────────────────────────────────
const NOT_IMPLEMENTED_TOOLS = [
  'ocr',
  'crop',
  'edit-pdf',
  'pdf-forms',
  'sign',
  'redact',
  'compare',
  'word-to-pdf',
  'powerpoint-to-pdf',
  'excel-to-pdf',
  'html-to-pdf',
  'pdf-to-word',
  'pdf-to-powerpoint',
  'pdf-to-excel',
  'pdf-to-pdfa',
  'scan-to-pdf',
];

NOT_IMPLEMENTED_TOOLS.forEach((toolId) => {
  router.post(`/${toolId}`, upload.any(), (req, res) => {
    res.status(501).json({
      error: 'Not Implemented',
      message: `The "${toolId}" tool requires a server-side binary or third-party API (e.g. LibreOffice, Ghostscript, OCR engine) that is not currently installed on this server. This tool is planned for a future release.`,
      toolId,
      status: 'coming_soon',
    });
  });
});

export default router;
