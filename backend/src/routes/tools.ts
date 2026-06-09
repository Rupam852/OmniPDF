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

async function runPythonScript(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const pythonCmd = process.env.PYTHON_PATH || 'python';
  const pathSeparator = process.platform === 'win32' ? ';' : ':';
  const pythonPackagesPath = path.resolve(path.join(__dirname, '../../python_packages'));
  const customEnv = {
    ...process.env,
    PYTHONPATH: process.env.PYTHONPATH 
      ? `${pythonPackagesPath}${pathSeparator}${process.env.PYTHONPATH}` 
      : pythonPackagesPath
  };

  try {
    return await execFileAsync(pythonCmd, args, { env: customEnv });
  } catch (err: any) {
    if (process.env.PYTHON_PATH) {
      throw err;
    }
    if (err.code === 'ENOENT' && pythonCmd === 'python') {
      try {
        return await execFileAsync('python3', args, { env: customEnv });
      } catch (err3: any) {
        throw new Error(`Failed to execute Python script. Tried 'python' and 'python3'. Details: ${err3.message}`);
      }
    }
    throw err;
  }
}

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

      await runPythonScript( [
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
    if (!password.trim()) {
      res.status(400).json({ error: 'Bad Request', message: 'Password is required to protect the PDF.' });
      return;
    }

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const inputTempPath = path.join(tempDir, `input-${uniqueSuffix}.pdf`);
    const outputTempPath = path.join(tempDir, `output-${uniqueSuffix}.pdf`);

    try {
      console.log(`[Protect PDF] Protecting ${file.size}-byte file`);
      await fs.promises.writeFile(inputTempPath, file.buffer);

      const scriptPath = path.join(__dirname, '../scripts/protect.py');
      await runPythonScript( [
        scriptPath,
        inputTempPath,
        outputTempPath,
        password,
      ]);

      if (!fs.existsSync(outputTempPath)) {
        throw new Error('Python protect script did not generate output file.');
      }

      const protectedBytes = await fs.promises.readFile(outputTempPath);
      const base64 = protectedBytes.toString('base64');

      res.status(200).json({
        success: true,
        message: 'PDF protected with password encryption successfully.',
        fileData: base64,
        fileName: `protected_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Protect PDF] Error:', error);
      res.status(500).json({
        error: 'Protect Failed',
        message: error.message || 'Failed to protect/encrypt PDF.',
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
        console.error('[Protect PDF] Temp file cleanup error:', cleanupErr);
      }
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
    const password = req.body.password || '';

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const inputTempPath = path.join(tempDir, `input-${uniqueSuffix}.pdf`);
    const outputTempPath = path.join(tempDir, `output-${uniqueSuffix}.pdf`);

    try {
      console.log(`[Unlock PDF] Attempting to unlock ${file.size}-byte file`);
      await fs.promises.writeFile(inputTempPath, file.buffer);

      const scriptPath = path.join(__dirname, '../scripts/unlock.py');
      await runPythonScript( [
        scriptPath,
        inputTempPath,
        outputTempPath,
        password,
      ]);

      if (!fs.existsSync(outputTempPath)) {
        throw new Error('Python unlock script did not generate output file.');
      }

      const unlockedBytes = await fs.promises.readFile(outputTempPath);
      const base64 = unlockedBytes.toString('base64');

      res.status(200).json({
        success: true,
        message: 'PDF unlocked and decrypted successfully.',
        fileData: base64,
        fileName: `unlocked_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Unlock PDF] Error:', error);
      if (error.stderr && error.stderr.includes('AUTH_FAILED')) {
        res.status(401).json({
          error: 'Authentication Failed',
          message: 'Incorrect password. Please enter the correct password to unlock this PDF.',
        });
      } else {
        res.status(500).json({
          error: 'Unlock Failed',
          message: error.message || 'Failed to decrypt/unlock PDF.',
        });
      }
    } finally {
      try {
        if (fs.existsSync(inputTempPath)) {
          fs.unlinkSync(inputTempPath);
        }
        if (fs.existsSync(outputTempPath)) {
          fs.unlinkSync(outputTempPath);
        }
      } catch (cleanupErr) {
        console.error('[Unlock PDF] Temp file cleanup error:', cleanupErr);
      }
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

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const inputTempPath = path.join(tempDir, `input-${uniqueSuffix}.pdf`);
    const outputTempPath = path.join(tempDir, `output-${uniqueSuffix}.zip`);

    try {
      console.log(`[PDF to JPG] Converting ${file.size}-byte PDF to JPEG Zip`);
      await fs.promises.writeFile(inputTempPath, file.buffer);

      const scriptPath = path.join(__dirname, '../scripts/pdf_to_jpg.py');
      await runPythonScript( [
        scriptPath,
        inputTempPath,
        outputTempPath,
      ]);

      if (!fs.existsSync(outputTempPath)) {
        throw new Error('Python pdf-to-jpg script did not generate output file.');
      }

      const zipBytes = await fs.promises.readFile(outputTempPath);
      const base64 = zipBytes.toString('base64');

      res.status(200).json({
        success: true,
        message: 'PDF pages converted to JPEG images and packaged in a ZIP file successfully.',
        fileData: base64,
        fileName: `${path.parse(file.originalname || 'document').name}_images.zip`,
        downloadUrl: `data:application/zip;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[PDF to JPG] Error:', error);
      res.status(500).json({
        error: 'Processing Failed',
        message: error.message || 'Failed to convert PDF to JPEGs.',
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
        console.error('[PDF to JPG] Temp file cleanup error:', cleanupErr);
      }
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
      const trimmedOrder = pageOrderRaw.trim().toLowerCase();
      if (!trimmedOrder || trimmedOrder === 'reverse') {
        // Default: reverse pages
        newOrder = Array.from({ length: totalPages }, (_, i) => totalPages - 1 - i);
      } else if (trimmedOrder === 'normal') {
        // Keep original order
        newOrder = Array.from({ length: totalPages }, (_, i) => i);
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
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/ocr
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/ocr',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const geminiApiKey = (req.headers['x-gemini-key'] as string) || req.body.apiKey;

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF document is required.' });
      return;
    }
    if (!geminiApiKey) {
      res.status(400).json({
        error: 'Gemini Key Missing',
        message: 'A Google Gemini API key must be provided to use the OCR PDF tool.',
      });
      return;
    }

    try {
      console.log(`[OCR PDF] File: ${file.size} bytes`);
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt =
        "Analyze this scanned PDF document and perform full OCR. Extract all the text page by page, preserving the document's structure, headings, paragraphs, and lists as closely as possible. Return only the clean extracted text. Do not add any extra explanations or conversational text.";

      const result = await model.generateContent([
        {
          inlineData: {
            data: file.buffer.toString('base64'),
            mimeType: 'application/pdf',
          },
        },
        { text: prompt },
      ]);

      const ocrText = result.response.text();
      const ocrPdfBase64 = await createPdfFromText(ocrText, 'OCR EXTRACTED DOCUMENT — OmniPDF');

      res.status(200).json({
        success: true,
        summary: ocrText,
        fileData: ocrPdfBase64,
        fileName: `ocr_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${ocrPdfBase64}`,
      });
    } catch (error: any) {
      console.error('[OCR PDF] Error:', error);
      res.status(500).json({
        error: 'OCR Processing Failed',
        message: error.message || 'Could not perform OCR. Check if your Gemini API key is valid.',
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/word-to-pdf
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/word-to-pdf',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A Word file is required.' });
      return;
    }

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const inputTempPath = path.join(tempDir, `input-${uniqueSuffix}.docx`);
    const outputTempPath = path.join(tempDir, `output-${uniqueSuffix}.pdf`);

    try {
      await fs.promises.writeFile(inputTempPath, file.buffer);
      const scriptPath = path.join(__dirname, '../scripts/word_to_pdf.py');

      await runPythonScript( [scriptPath, inputTempPath, outputTempPath]);

      if (!fs.existsSync(outputTempPath)) {
        throw new Error('Word to PDF script did not generate output file.');
      }

      const bytes = await fs.promises.readFile(outputTempPath);
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: 'Word document converted to PDF successfully.',
        fileData: base64,
        fileName: `converted_${file.originalname.replace(/\.[^/.]+$/, '')}.pdf`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Word to PDF] Error:', error);
      res.status(500).json({
        error: 'Conversion Failed',
        message: error.message || 'Could not convert Word to PDF.',
      });
    } finally {
      if (fs.existsSync(inputTempPath)) fs.unlinkSync(inputTempPath);
      if (fs.existsSync(outputTempPath)) fs.unlinkSync(outputTempPath);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/powerpoint-to-pdf
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/powerpoint-to-pdf',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PowerPoint file is required.' });
      return;
    }

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const inputTempPath = path.join(tempDir, `input-${uniqueSuffix}.pptx`);
    const outputTempPath = path.join(tempDir, `output-${uniqueSuffix}.pdf`);

    try {
      await fs.promises.writeFile(inputTempPath, file.buffer);
      const scriptPath = path.join(__dirname, '../scripts/powerpoint_to_pdf.py');

      await runPythonScript( [scriptPath, inputTempPath, outputTempPath]);

      if (!fs.existsSync(outputTempPath)) {
        throw new Error('PowerPoint to PDF script did not generate output file.');
      }

      const bytes = await fs.promises.readFile(outputTempPath);
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: 'PowerPoint presentation converted to PDF successfully.',
        fileData: base64,
        fileName: `converted_${file.originalname.replace(/\.[^/.]+$/, '')}.pdf`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[PowerPoint to PDF] Error:', error);
      res.status(500).json({
        error: 'Conversion Failed',
        message: error.message || 'Could not convert PowerPoint to PDF.',
      });
    } finally {
      if (fs.existsSync(inputTempPath)) fs.unlinkSync(inputTempPath);
      if (fs.existsSync(outputTempPath)) fs.unlinkSync(outputTempPath);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/excel-to-pdf
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/excel-to-pdf',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'An Excel file is required.' });
      return;
    }

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const inputTempPath = path.join(tempDir, `input-${uniqueSuffix}.xlsx`);
    const outputTempPath = path.join(tempDir, `output-${uniqueSuffix}.pdf`);

    try {
      await fs.promises.writeFile(inputTempPath, file.buffer);
      const scriptPath = path.join(__dirname, '../scripts/excel_to_pdf.py');

      await runPythonScript( [scriptPath, inputTempPath, outputTempPath]);

      if (!fs.existsSync(outputTempPath)) {
        throw new Error('Excel to PDF script did not generate output file.');
      }

      const bytes = await fs.promises.readFile(outputTempPath);
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: 'Excel spreadsheet converted to PDF successfully.',
        fileData: base64,
        fileName: `converted_${file.originalname.replace(/\.[^/.]+$/, '')}.pdf`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Excel to PDF] Error:', error);
      res.status(500).json({
        error: 'Conversion Failed',
        message: error.message || 'Could not convert Excel to PDF.',
      });
    } finally {
      if (fs.existsSync(inputTempPath)) fs.unlinkSync(inputTempPath);
      if (fs.existsSync(outputTempPath)) fs.unlinkSync(outputTempPath);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/html-to-pdf
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/html-to-pdf',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'An HTML file is required.' });
      return;
    }

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const inputTempPath = path.join(tempDir, `input-${uniqueSuffix}.html`);
    const outputTempPath = path.join(tempDir, `output-${uniqueSuffix}.pdf`);

    try {
      await fs.promises.writeFile(inputTempPath, file.buffer);
      const scriptPath = path.join(__dirname, '../scripts/html_to_pdf.py');

      await runPythonScript( [scriptPath, inputTempPath, outputTempPath]);

      if (!fs.existsSync(outputTempPath)) {
        throw new Error('HTML to PDF script did not generate output file.');
      }

      const bytes = await fs.promises.readFile(outputTempPath);
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: 'HTML converted to PDF successfully.',
        fileData: base64,
        fileName: `converted_${file.originalname.replace(/\.[^/.]+$/, '')}.pdf`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[HTML to PDF] Error:', error);
      res.status(500).json({
        error: 'Conversion Failed',
        message: error.message || 'Could not convert HTML to PDF.',
      });
    } finally {
      if (fs.existsSync(inputTempPath)) fs.unlinkSync(inputTempPath);
      if (fs.existsSync(outputTempPath)) fs.unlinkSync(outputTempPath);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/pdf-to-word
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/pdf-to-word',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const geminiApiKey = (req.headers['x-gemini-key'] as string) || req.body.geminiKey || req.body.apiKey || '';

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const inputTempPath = path.join(tempDir, `input-${uniqueSuffix}.pdf`);
    const outputTempPath = path.join(tempDir, `output-${uniqueSuffix}.docx`);

    try {
      await fs.promises.writeFile(inputTempPath, file.buffer);
      const scriptPath = path.join(__dirname, '../scripts/pdf_to_word.py');

      await runPythonScript( [scriptPath, inputTempPath, outputTempPath, geminiApiKey]);

      if (!fs.existsSync(outputTempPath)) {
        throw new Error('PDF to Word script did not generate output file.');
      }

      const bytes = await fs.promises.readFile(outputTempPath);
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: geminiApiKey
          ? 'PDF converted to editable Word document using Gemini AI.'
          : 'PDF converted to Word document successfully.',
        fileData: base64,
        fileName: `converted_${file.originalname.replace(/\.[^/.]+$/, '')}.docx`,
        downloadUrl: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[PDF to Word] Error:', error);
      res.status(500).json({
        error: 'Conversion Failed',
        message: error.message || 'Could not convert PDF to Word.',
      });
    } finally {
      if (fs.existsSync(inputTempPath)) fs.unlinkSync(inputTempPath);
      if (fs.existsSync(outputTempPath)) fs.unlinkSync(outputTempPath);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/pdf-to-powerpoint
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/pdf-to-powerpoint',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const geminiApiKey = (req.headers['x-gemini-key'] as string) || req.body.geminiKey || req.body.apiKey || '';

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const inputTempPath = path.join(tempDir, `input-${uniqueSuffix}.pdf`);
    const outputTempPath = path.join(tempDir, `output-${uniqueSuffix}.pptx`);

    try {
      await fs.promises.writeFile(inputTempPath, file.buffer);
      const scriptPath = path.join(__dirname, '../scripts/pdf_to_powerpoint.py');

      await runPythonScript( [scriptPath, inputTempPath, outputTempPath, geminiApiKey]);

      if (!fs.existsSync(outputTempPath)) {
        throw new Error('PDF to PowerPoint script did not generate output file.');
      }

      const bytes = await fs.promises.readFile(outputTempPath);
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: geminiApiKey
          ? 'PDF converted to slide presentation outline using Gemini AI.'
          : 'PDF converted to PowerPoint slides successfully.',
        fileData: base64,
        fileName: `converted_${file.originalname.replace(/\.[^/.]+$/, '')}.pptx`,
        downloadUrl: `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[PDF to PowerPoint] Error:', error);
      res.status(500).json({
        error: 'Conversion Failed',
        message: error.message || 'Could not convert PDF to PowerPoint.',
      });
    } finally {
      if (fs.existsSync(inputTempPath)) fs.unlinkSync(inputTempPath);
      if (fs.existsSync(outputTempPath)) fs.unlinkSync(outputTempPath);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/pdf-to-excel
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/pdf-to-excel',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const geminiApiKey = (req.headers['x-gemini-key'] as string) || req.body.geminiKey || req.body.apiKey || '';

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const inputTempPath = path.join(tempDir, `input-${uniqueSuffix}.pdf`);
    const outputTempPath = path.join(tempDir, `output-${uniqueSuffix}.xlsx`);

    try {
      await fs.promises.writeFile(inputTempPath, file.buffer);
      const scriptPath = path.join(__dirname, '../scripts/pdf_to_excel.py');

      await runPythonScript( [scriptPath, inputTempPath, outputTempPath, geminiApiKey]);

      if (!fs.existsSync(outputTempPath)) {
        throw new Error('PDF to Excel script did not generate output file.');
      }

      const bytes = await fs.promises.readFile(outputTempPath);
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: geminiApiKey
          ? 'PDF tables extracted into Excel spreadsheet using Gemini AI.'
          : 'PDF tables converted to Excel workbook successfully.',
        fileData: base64,
        fileName: `converted_${file.originalname.replace(/\.[^/.]+$/, '')}.xlsx`,
        downloadUrl: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[PDF to Excel] Error:', error);
      res.status(500).json({
        error: 'Conversion Failed',
        message: error.message || 'Could not convert PDF to Excel.',
      });
    } finally {
      if (fs.existsSync(inputTempPath)) fs.unlinkSync(inputTempPath);
      if (fs.existsSync(outputTempPath)) fs.unlinkSync(outputTempPath);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/pdf-to-pdfa
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/pdf-to-pdfa',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const inputTempPath = path.join(tempDir, `input-${uniqueSuffix}.pdf`);
    const outputTempPath = path.join(tempDir, `output-${uniqueSuffix}.pdf`);

    try {
      await fs.promises.writeFile(inputTempPath, file.buffer);
      const scriptPath = path.join(__dirname, '../scripts/pdf_to_pdfa.py');

      await runPythonScript( [scriptPath, inputTempPath, outputTempPath]);

      if (!fs.existsSync(outputTempPath)) {
        throw new Error('PDF to PDF/A script did not generate output file.');
      }

      const bytes = await fs.promises.readFile(outputTempPath);
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: 'PDF converted to PDF/A compliant document successfully.',
        fileData: base64,
        fileName: `pdfa_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[PDF to PDF/A] Error:', error);
      res.status(500).json({
        error: 'Conversion Failed',
        message: error.message || 'Could not convert PDF to PDF/A.',
      });
    } finally {
      if (fs.existsSync(inputTempPath)) fs.unlinkSync(inputTempPath);
      if (fs.existsSync(outputTempPath)) fs.unlinkSync(outputTempPath);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/crop
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/crop',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const left = req.body.left || '10';
    const top = req.body.top || '10';
    const right = req.body.right || '10';
    const bottom = req.body.bottom || '10';

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const inputTempPath = path.join(tempDir, `input-${uniqueSuffix}.pdf`);
    const outputTempPath = path.join(tempDir, `output-${uniqueSuffix}.pdf`);

    try {
      await fs.promises.writeFile(inputTempPath, file.buffer);
      const scriptPath = path.join(__dirname, '../scripts/crop.py');

      await runPythonScript( [scriptPath, inputTempPath, outputTempPath, left, top, right, bottom]);

      if (!fs.existsSync(outputTempPath)) {
        throw new Error('Crop script did not generate output file.');
      }

      const bytes = await fs.promises.readFile(outputTempPath);
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: `PDF margins cropped successfully (Left: ${left}%, Top: ${top}%, Right: ${right}%, Bottom: ${bottom}%).`,
        fileData: base64,
        fileName: `cropped_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Crop PDF] Error:', error);
      res.status(500).json({
        error: 'Cropping Failed',
        message: error.message || 'Could not crop PDF.',
      });
    } finally {
      if (fs.existsSync(inputTempPath)) fs.unlinkSync(inputTempPath);
      if (fs.existsSync(outputTempPath)) fs.unlinkSync(outputTempPath);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/edit-pdf
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/edit-pdf',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const prompt = req.body.prompt || 'Fix formatting and layout';
    const geminiApiKey = (req.headers['x-gemini-key'] as string) || req.body.geminiKey || req.body.apiKey;

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    if (!geminiApiKey) {
      res.status(400).json({
        error: 'Gemini Key Missing',
        message: 'A Google Gemini API key must be provided to use the AI Edit PDF tool.',
      });
      return;
    }

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const inputTempPath = path.join(tempDir, `input-${uniqueSuffix}.pdf`);
    const outputTempPath = path.join(tempDir, `output-${uniqueSuffix}.pdf`);

    try {
      await fs.promises.writeFile(inputTempPath, file.buffer);
      const scriptPath = path.join(__dirname, '../scripts/edit_pdf.py');

      await runPythonScript( [scriptPath, inputTempPath, outputTempPath, prompt, geminiApiKey]);

      if (!fs.existsSync(outputTempPath)) {
        throw new Error('AI Edit PDF script did not generate output file.');
      }

      const bytes = await fs.promises.readFile(outputTempPath);
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: 'PDF edited successfully using Gemini AI.',
        fileData: base64,
        fileName: `edited_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Edit PDF] Error:', error);
      res.status(500).json({
        error: 'Editing Failed',
        message: error.message || 'Could not edit PDF.',
      });
    } finally {
      if (fs.existsSync(inputTempPath)) fs.unlinkSync(inputTempPath);
      if (fs.existsSync(outputTempPath)) fs.unlinkSync(outputTempPath);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/pdf-forms
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/pdf-forms',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const inputTempPath = path.join(tempDir, `input-${uniqueSuffix}.pdf`);
    const outputTempPath = path.join(tempDir, `output-${uniqueSuffix}.pdf`);

    try {
      await fs.promises.writeFile(inputTempPath, file.buffer);
      const scriptPath = path.join(__dirname, '../scripts/pdf_forms.py');

      await runPythonScript( [scriptPath, inputTempPath, outputTempPath]);

      if (!fs.existsSync(outputTempPath)) {
        throw new Error('PDF Forms flattening script did not generate output file.');
      }

      const bytes = await fs.promises.readFile(outputTempPath);
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: 'Interactive form fields flattened successfully.',
        fileData: base64,
        fileName: `flattened_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Flatten Forms] Error:', error);
      res.status(500).json({
        error: 'Flatten Failed',
        message: error.message || 'Could not flatten PDF forms.',
      });
    } finally {
      if (fs.existsSync(inputTempPath)) fs.unlinkSync(inputTempPath);
      if (fs.existsSync(outputTempPath)) fs.unlinkSync(outputTempPath);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/sign
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/sign',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const signatureText = req.body.signatureText || 'Signed by OmniPDF';

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const inputTempPath = path.join(tempDir, `input-${uniqueSuffix}.pdf`);
    const outputTempPath = path.join(tempDir, `output-${uniqueSuffix}.pdf`);

    try {
      await fs.promises.writeFile(inputTempPath, file.buffer);
      const scriptPath = path.join(__dirname, '../scripts/sign.py');

      await runPythonScript( [scriptPath, inputTempPath, outputTempPath, signatureText]);

      if (!fs.existsSync(outputTempPath)) {
        throw new Error('Sign script did not generate output file.');
      }

      const bytes = await fs.promises.readFile(outputTempPath);
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: `PDF signed successfully as: '${signatureText}'.`,
        fileData: base64,
        fileName: `signed_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Sign PDF] Error:', error);
      res.status(500).json({
        error: 'Sign Failed',
        message: error.message || 'Could not sign PDF.',
      });
    } finally {
      if (fs.existsSync(inputTempPath)) fs.unlinkSync(inputTempPath);
      if (fs.existsSync(outputTempPath)) fs.unlinkSync(outputTempPath);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/redact
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/redact',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const term = req.body.term || req.body.termToRedact || '';

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    if (!term) {
      res.status(400).json({ error: 'Bad Request', message: 'A term to redact is required.' });
      return;
    }

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const inputTempPath = path.join(tempDir, `input-${uniqueSuffix}.pdf`);
    const outputTempPath = path.join(tempDir, `output-${uniqueSuffix}.pdf`);

    try {
      await fs.promises.writeFile(inputTempPath, file.buffer);
      const scriptPath = path.join(__dirname, '../scripts/redact.py');

      await runPythonScript( [scriptPath, inputTempPath, outputTempPath, term]);

      if (!fs.existsSync(outputTempPath)) {
        throw new Error('Redact script did not generate output file.');
      }

      const bytes = await fs.promises.readFile(outputTempPath);
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: `Permanently redacted all instances of '${term}' from the PDF.`,
        fileData: base64,
        fileName: `redacted_${file.originalname || 'document.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Redact PDF] Error:', error);
      res.status(500).json({
        error: 'Redaction Failed',
        message: error.message || 'Could not redact PDF.',
      });
    } finally {
      if (fs.existsSync(inputTempPath)) fs.unlinkSync(inputTempPath);
      if (fs.existsSync(outputTempPath)) fs.unlinkSync(outputTempPath);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tools/compare
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/compare',
  upload.any(),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let file1: Express.Multer.File | undefined;
    let file2: Express.Multer.File | undefined;

    if (Array.isArray(req.files)) {
      const filesArray = req.files as Express.Multer.File[];
      file1 = filesArray.find((f) => f.fieldname === 'file1') || filesArray[0];
      file2 = filesArray.find((f) => f.fieldname === 'file2') || filesArray[1];
    }

    if (!file1 || !file2) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Two PDF files (file1 and file2) are required for comparison.',
      });
      return;
    }

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const path1 = path.join(tempDir, `input1-${uniqueSuffix}.pdf`);
    const path2 = path.join(tempDir, `input2-${uniqueSuffix}.pdf`);
    const reportPath = path.join(tempDir, `report-${uniqueSuffix}.pdf`);

    try {
      await fs.promises.writeFile(path1, file1.buffer);
      await fs.promises.writeFile(path2, file2.buffer);
      const scriptPath = path.join(__dirname, '../scripts/compare.py');

      await runPythonScript( [scriptPath, path1, path2, reportPath]);

      if (!fs.existsSync(reportPath)) {
        throw new Error('Comparison script did not generate report file.');
      }

      const bytes = await fs.promises.readFile(reportPath);
      const base64 = Buffer.from(bytes).toString('base64');

      res.status(200).json({
        success: true,
        message: 'PDF comparison report generated successfully.',
        fileData: base64,
        fileName: 'comparison_report.pdf',
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('[Compare PDFs] Error:', error);
      res.status(500).json({
        error: 'Compare Failed',
        message: error.message || 'Could not compare PDFs.',
      });
    } finally {
      if (fs.existsSync(path1)) fs.unlinkSync(path1);
      if (fs.existsSync(path2)) fs.unlinkSync(path2);
      if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
    }
  }
);

// Generic placeholder for tools that are truly coming soon or not implemented
const NOT_IMPLEMENTED_TOOLS: string[] = [];

NOT_IMPLEMENTED_TOOLS.forEach((toolId) => {
  router.post(`/${toolId}`, upload.any(), (req, res) => {
    res.status(501).json({
      error: 'Not Implemented',
      message: `The "${toolId}" tool requires a server-side binary or third-party API that is not currently installed.`,
      toolId,
      status: 'coming_soon',
    });
  });
});

export default router;

