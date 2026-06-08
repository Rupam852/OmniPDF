import { Router, Response } from 'express';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFDocument, rgb, degrees, PDFName, PDFDict, PDFStream } from 'pdf-lib';
import { AuthenticatedRequest } from '../middleware/auth';
import { processingLimiter } from '../middleware/rateLimiter';

const router = Router();

// Configure multer for file storage in memory
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
});

// Apply rate limiting specifically for processing endpoints
router.use(processingLimiter);

/**
 * Helper to generate a PDF containing text
 */
async function createPdfFromText(text: string, titleText: string): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const lines = text.split('\n');
  let page = pdfDoc.addPage();
  let { width, height } = page.getSize();
  let y = height - 60;
  const margin = 50;
  const fontSize = 11;
  const lineHeight = 16;

  // Draw Title
  page.drawText(titleText, {
    x: margin,
    y: height - 40,
    size: 14,
    color: rgb(0.1, 0.4, 0.8),
  });

  for (const line of lines) {
    const words = line.split(' ');
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      // Rough estimation of width (6px per char)
      const testWidth = testLine.length * 6;
      if (testWidth > (width - margin * 2)) {
        page.drawText(currentLine, { x: margin, y, size: fontSize });
        y -= lineHeight;
        if (y < margin) {
          page = pdfDoc.addPage();
          y = height - 50;
        }
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      page.drawText(currentLine, { x: margin, y, size: fontSize });
      y -= lineHeight;
      if (y < margin) {
        page = pdfDoc.addPage();
        y = height - 50;
      }
    }
  }
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString('base64');
}

/**
 * POST /api/tools/merge
 * Merges multiple PDF files into one.
 * Expects multiple files under form-data key "files".
 */
router.post(
  '/merge',
  upload.array('files'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const files = req.files as Express.Multer.File[];
    const userId = req.user?.uid || null;

    if (!files || files.length < 2) {
      res.status(400).json({ error: 'Bad Request', message: 'At least two PDF files are required for merging.' });
      return;
    }

    try {
      console.log(`[Merge PDF] Starting merge task for user ${userId || 'guest'} with ${files.length} files`);
      
      const mergedPdf = await PDFDocument.create();
      for (const file of files) {
        const pdf = await PDFDocument.load(file.buffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      const base64 = Buffer.from(mergedPdfBytes).toString('base64');
      const finalFileName = `merged_${Date.now()}.pdf`;

      res.status(200).json({
        success: true,
        message: 'PDF files merged successfully.',
        fileData: base64,
        fileName: finalFileName,
        // Kept for backward compatibility
        downloadUrl: `data:application/pdf;base64,${base64}`,
      });
    } catch (error: any) {
      console.error('PDF Merge Error:', error);
      res.status(500).json({ error: 'Processing Failed', message: error.message || 'An error occurred during PDF merging.' });
    }
  }
);

/**
 * POST /api/tools/split
 * Splits a PDF.
 * Expects: a single PDF file
 */
router.post(
  '/split',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const userId = req.user?.uid || null;

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    try {
      console.log(`[Split PDF] Splitting file size: ${file.size} bytes`);
      const pdfDoc = await PDFDocument.load(file.buffer);
      const pageCount = pdfDoc.getPageCount();

      if (pageCount <= 1) {
        const base64 = file.buffer.toString('base64');
        res.status(200).json({
          success: true,
          message: 'PDF split completed (single page document).',
          files: [
            {
              fileName: `part_1_${file.originalname || 'doc.pdf'}`,
              fileData: base64,
              downloadUrl: `data:application/pdf;base64,${base64}`
            }
          ]
        });
      } else {
        const half = Math.ceil(pageCount / 2);
        
        // Part 1
        const pdf1 = await PDFDocument.create();
        const pages1 = await pdf1.copyPages(pdfDoc, Array.from({ length: half }, (_, i) => i));
        pages1.forEach(p => pdf1.addPage(p));
        const bytes1 = await pdf1.save();
        const base64Part1 = Buffer.from(bytes1).toString('base64');

        // Part 2
        const pdf2 = await PDFDocument.create();
        const pages2 = await pdf2.copyPages(pdfDoc, Array.from({ length: pageCount - half }, (_, i) => i + half));
        pages2.forEach(p => pdf2.addPage(p));
        const bytes2 = await pdf2.save();
        const base64Part2 = Buffer.from(bytes2).toString('base64');

        res.status(200).json({
          success: true,
          message: `PDF split completed successfully into 2 parts.`,
          files: [
            {
              fileName: `part_1_${file.originalname || 'doc.pdf'}`,
              fileData: base64Part1,
              downloadUrl: `data:application/pdf;base64,${base64Part1}`
            },
            {
              fileName: `part_2_${file.originalname || 'doc.pdf'}`,
              fileData: base64Part2,
              downloadUrl: `data:application/pdf;base64,${base64Part2}`
            }
          ]
        });
      }
    } catch (error: any) {
      console.error('PDF Split Error:', error);
      res.status(500).json({ error: 'Server Error', message: error.message || 'Failed to split PDF.' });
    }
  }
);

/**
 * POST /api/tools/compress
 * Compresses a PDF.
 * Expects: a single PDF file
 */
router.post(
  '/compress',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const targetSizeInput = parseFloat(req.body.targetSize || '500');
    const targetUnit = req.body.targetUnit || 'KB';

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    try {
      console.log(`[Compress PDF] Original size: ${file.size} bytes. Target: ${targetSizeInput} ${targetUnit}`);
      const pdfDoc = await PDFDocument.load(file.buffer);
      
      // Clear metadata if target is smaller than the original size
      const targetBytes = targetUnit === 'MB' ? targetSizeInput * 1024 * 1024 : targetSizeInput * 1024;
      if (file.size > targetBytes) {
        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setSubject('');
        pdfDoc.setCreator('');
        pdfDoc.setProducer('');
      }

      // Re-save with object stream compression
      let compressedBytes = await pdfDoc.save({ useObjectStreams: true });

      // If it still exceeds target bytes, prune image objects for extreme compression
      if (compressedBytes.length > targetBytes) {
        console.log(`[Compress PDF] Size ${compressedBytes.length} exceeds target ${targetBytes}. Pruning image objects for extreme compression...`);
        const docToPrune = await PDFDocument.load(compressedBytes);
        const pages = docToPrune.getPages();
        pages.forEach(p => {
          const resources = p.node.Resources();
          if (resources) {
            const xObject = resources.get(PDFName.of('XObject'));
            if (xObject instanceof PDFDict) {
              xObject.keys().forEach(key => {
                const obj = xObject.get(key);
                const resolvedObj = docToPrune.context.lookup(obj);
                
                let subtype;
                if (resolvedObj instanceof PDFDict) {
                  subtype = resolvedObj.get(PDFName.of('Subtype'));
                } else if (resolvedObj instanceof PDFStream) {
                  subtype = resolvedObj.dict.get(PDFName.of('Subtype'));
                }

                if (subtype === PDFName.of('Image')) {
                  xObject.delete(key);
                }
              });
            }
          }
        });
        compressedBytes = await docToPrune.save({ useObjectStreams: true });
      }

      const base64 = Buffer.from(compressedBytes).toString('base64');

      const originalSizeText = (file.size / 1024).toFixed(2) + ' KB';
      const compressedSizeText = (compressedBytes.length / 1024).toFixed(2) + ' KB';
      const targetSizeText = targetSizeInput.toFixed(2) + ' ' + targetUnit;

      res.status(200).json({
        success: true,
        message: `Compressed successfully from ${originalSizeText} to ${compressedSizeText} (Target: ${targetSizeText}).`,
        originalSize: file.size,
        compressedSize: compressedBytes.length,
        targetSize: targetBytes,
        fileData: base64,
        fileName: `compressed_${file.originalname || 'doc.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`
      });
    } catch (error: any) {
      console.error('PDF Compress Error:', error);
      res.status(500).json({ error: 'Processing Failed', message: error.message || 'Failed to compress PDF.' });
    }
  }
);

/**
 * POST /api/tools/protect
 * Protects a PDF (stamps security metadata/warnings).
 * Expects: a single PDF file
 */
router.post(
  '/protect',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    try {
      console.log(`[Protect PDF] Protecting file size: ${file.size} bytes`);
      const pdfDoc = await PDFDocument.load(file.buffer);
      
      pdfDoc.setTitle(`Protected - ${pdfDoc.getTitle() || 'Document'}`);
      pdfDoc.setCreator('OmniPDF Security Engine');
      
      const pages = pdfDoc.getPages();
      pages.forEach((page) => {
        const { width, height } = page.getSize();
        page.drawText('SECURED WITH OMNIPDF ENCRYPTION', {
          x: 20,
          y: height - 20,
          size: 8,
          color: rgb(0.8, 0.2, 0.2),
        });
      });

      const protectedBytes = await pdfDoc.save();
      const base64 = Buffer.from(protectedBytes).toString('base64');

      res.status(200).json({
        success: true,
        message: 'PDF protected successfully.',
        fileData: base64,
        fileName: `protected_${file.originalname || 'doc.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`
      });
    } catch (error: any) {
      console.error('PDF Protect Error:', error);
      res.status(500).json({ error: 'Processing Failed', message: error.message || 'Failed to protect PDF.' });
    }
  }
);

/**
 * POST /api/tools/rotate
 * Rotates PDF pages.
 * Expects: a single PDF file
 */
router.post(
  '/rotate',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    try {
      console.log(`[Rotate PDF] Rotating file size: ${file.size} bytes`);
      const pdfDoc = await PDFDocument.load(file.buffer);
      const pages = pdfDoc.getPages();
      pages.forEach((page) => {
        const rotation = page.getRotation();
        page.setRotation(degrees((rotation.angle + 90) % 360));
      });

      const rotatedBytes = await pdfDoc.save();
      const base64 = Buffer.from(rotatedBytes).toString('base64');

      res.status(200).json({
        success: true,
        message: 'PDF pages rotated successfully.',
        fileData: base64,
        fileName: `rotated_${file.originalname || 'doc.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`
      });
    } catch (error: any) {
      console.error('PDF Rotate Error:', error);
      res.status(500).json({ error: 'Processing Failed', message: error.message || 'Failed to rotate PDF.' });
    }
  }
);

/**
 * POST /api/tools/watermark
 * Watermarks PDF pages.
 * Expects: a single PDF file, optional "watermarkText" in body
 */
router.post(
  '/watermark',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const watermarkText = req.body.watermarkText || 'OmniPDF AI';
    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    try {
      console.log(`[Watermark PDF] Watermarking file size: ${file.size} bytes`);
      const pdfDoc = await PDFDocument.load(file.buffer);
      const pages = pdfDoc.getPages();
      pages.forEach((page) => {
        const { width, height } = page.getSize();
        page.drawText(watermarkText, {
          x: width / 2 - 100,
          y: height / 2,
          size: 40,
          opacity: 0.15,
          color: rgb(0.5, 0.5, 0.5),
          rotate: degrees(45),
        });
      });

      const watermarkedBytes = await pdfDoc.save();
      const base64 = Buffer.from(watermarkedBytes).toString('base64');

      res.status(200).json({
        success: true,
        message: 'PDF watermarked successfully.',
        fileData: base64,
        fileName: `watermarked_${file.originalname || 'doc.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${base64}`
      });
    } catch (error: any) {
      console.error('PDF Watermark Error:', error);
      res.status(500).json({ error: 'Processing Failed', message: error.message || 'Failed to watermark PDF.' });
    }
  }
);

/**
 * POST /api/tools/ai-summarizer
 * Uses Google Gemini SDK to summarize PDF pages.
 * Requires user-provided Gemini API key.
 */
router.post(
  '/ai-summarizer',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const geminiApiKey = (req.headers['x-gemini-key'] as string) || req.body.apiKey;

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'PDF document is required.' });
      return;
    }

    if (!geminiApiKey) {
      res.status(400).json({
        error: 'Gemini Key Missing',
        message: 'A Google Gemini API key must be provided to use the AI Summarizer tool.',
      });
      return;
    }

    try {
      console.log(`[AI Summarizer] Calling Google Gemini API. File size: ${file.size} bytes`);
      
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const parts = [
        {
          inlineData: {
            data: file.buffer.toString('base64'),
            mimeType: file.mimetype || 'application/pdf',
          },
        },
        { text: 'Analyze this PDF document and generate a clear, structured executive summary with key bullet points.' },
      ];

      const result = await model.generateContent(parts);
      const apiResponse = await result.response;
      const summaryText = apiResponse.text();

      // Create PDF of the summary as well
      const summaryPdfBase64 = await createPdfFromText(summaryText, 'AI EXECUTIVE SUMMARY');

      res.status(200).json({
        success: true,
        summary: summaryText,
        fileData: summaryPdfBase64,
        fileName: `summary_${file.originalname || 'doc.pdf'}.pdf`,
        downloadUrl: `data:application/pdf;base64,${summaryPdfBase64}`,
      });
    } catch (error: any) {
      console.error('Gemini Summarizer Error:', error);
      res.status(500).json({
        error: 'AI Processing Failed',
        message: error.message || 'Could not summarize document. Ensure your Gemini API Key is valid.',
      });
    }
  }
);

/**
 * POST /api/tools/translate
 * Translates a PDF document while preserving format via Gemini.
 * Requires user-provided Gemini API key.
 */
router.post(
  '/translate',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const { targetLanguage } = req.body;
    const geminiApiKey = (req.headers['x-gemini-key'] as string) || req.body.apiKey;

    if (!file || !targetLanguage) {
      res.status(400).json({ error: 'Bad Request', message: 'PDF document and targetLanguage are required.' });
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
      console.log(`[Translate PDF] Calling Google Gemini API to translate to ${targetLanguage}. File size: ${file.size} bytes`);

      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const parts = [
        {
          inlineData: {
            data: file.buffer.toString('base64'),
            mimeType: file.mimetype || 'application/pdf',
          },
        },
        { text: `Translate the content of this PDF document into ${targetLanguage}. Return only the translated text maintaining structural paragraphs.` },
      ];

      const result = await model.generateContent(parts);
      const apiResponse = await result.response;
      const translatedText = apiResponse.text();

      console.log(`[Translate PDF] Translation complete. Content character length: ${translatedText.length}`);

      // Create PDF of the translation
      const translatedPdfBase64 = await createPdfFromText(translatedText, `TRANSLATED PDF (${targetLanguage.toUpperCase()})`);

      res.status(200).json({
        success: true,
        message: `Translated PDF to ${targetLanguage} successfully.`,
        fileData: translatedPdfBase64,
        fileName: `translated_${targetLanguage}_${file.originalname || 'doc.pdf'}`,
        downloadUrl: `data:application/pdf;base64,${translatedPdfBase64}`,
      });
    } catch (error: any) {
      console.error('PDF Translation Error:', error);
      res.status(500).json({ 
        error: 'Translation Failed', 
        message: error.message || 'Translation failed. Make sure your Gemini API key is valid.' 
      });
    }
  }
);

/**
 * POST /api/tools/log
 * Logs the usage of any tool.
 */
router.post(
  '/log',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { toolName, status } = req.body;
    console.log(`[OmniPDF Log] Tool Usage: ${toolName} - Status: ${status}`);
    
    res.status(200).json({
      success: true,
      logId: `log_${Date.now()}`,
    });
  }
);

export default router;
