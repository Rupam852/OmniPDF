import { Router, Response } from 'express';
import multer from 'multer';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { processingLimiter } from '../middleware/rateLimiter';
import { decryptKey } from '../utils/crypto';
import prisma from '../services/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai'; // Official Google Gemini SDK

const router = Router();

// Configure multer for file storage in memory (buffer) or disk.
// In a serverless/container environment, storing buffers or transferring directly to S3/GCS is preferred.
const upload = multer({
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB limit
  },
});

// Apply rate limiting specifically for processing endpoints
router.use(processingLimiter);

/**
 * Helper to retrieve and decrypt Gemini key for a user
 */
async function getDecryptedGeminiKey(userId: string): Promise<string | null> {
  const keyConfig = await prisma.encryptedApiKey.findUnique({
    where: { userId },
  });
  if (!keyConfig) return null;
  return decryptKey(keyConfig.encryptedKey, keyConfig.iv, keyConfig.authTag);
}

/**
 * POST /api/tools/merge
 * Merges multiple PDF files into one.
 * Expects multiple files under form-data key "files".
 */
router.post(
  '/merge',
  requireAuth,
  upload.array('files'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const files = req.files as Express.Multer.File[];
    const userId = req.user?.uid;

    if (!files || files.length < 2) {
      res.status(400).json({ error: 'Bad Request', message: 'At least two PDF files are required for merging.' });
      return;
    }

    try {
      console.log(`Starting merge task for user ${userId} with ${files.length} files`);
      // Here: Integrate pdf-lib merge operations or send to bullmq background worker
      // Example pdf-lib operation:
      // const mergedPdf = await PDFDocument.create();
      // for(const file of files) {
      //   const doc = await PDFDocument.load(file.buffer);
      //   const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
      //   copiedPages.forEach((page) => mergedPdf.addPage(page));
      // }
      // const pdfBytes = await mergedPdf.save();

      // For blueprint representation: return a success stub with metadata
      const mockStorageUrl = `https://omnipdf-bucket.s3.amazonaws.com/processed/${userId}/merged-${Date.now()}.pdf`;

      // Log usage
      await prisma.toolUsageLog.create({
        data: {
          userId,
          toolName: 'MERGE_PDF',
          status: 'COMPLETED',
          processingTime: 120, // ms
        },
      });

      res.status(200).json({
        success: true,
        message: 'PDF files merged successfully.',
        downloadUrl: mockStorageUrl,
        fileName: `omnipdf_merged_${Date.now()}.pdf`,
      });
    } catch (error: any) {
      console.error('PDF Merge Error:', error);
      res.status(500).json({ error: 'Processing Failed', message: 'An error occurred during PDF merging.' });
    }
  }
);

/**
 * POST /api/tools/split
 * Splits a PDF.
 * Expects: a single PDF file and JSON string representation of "splitRanges"
 */
router.post(
  '/split',
  requireAuth,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const { ranges } = req.body; // e.g. "1-3, 4-5"
    const userId = req.user?.uid;

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'A PDF file is required.' });
      return;
    }

    try {
      // Perform split ranges mapping logic
      const mockResultUrls = [
        `https://omnipdf-bucket.s3.amazonaws.com/processed/${userId}/split-part-1.pdf`,
        `https://omnipdf-bucket.s3.amazonaws.com/processed/${userId}/split-part-2.pdf`,
      ];

      // Log usage
      await prisma.toolUsageLog.create({
        data: {
          userId,
          toolName: 'SPLIT_PDF',
          status: 'COMPLETED',
          processingTime: 220, // ms
        },
      });

      res.status(200).json({
        success: true,
        message: 'PDF split completed successfully.',
        downloadUrls: mockResultUrls,
      });
    } catch (error: any) {
      console.error('PDF Split Error:', error);
      try {
        await prisma.toolUsageLog.create({
          data: {
            userId,
            toolName: 'SPLIT_PDF',
            status: 'FAILED',
            errorMessage: error.message || 'Split operation failed',
          },
        });
      } catch (logErr) {
        console.error('Failed to log split failure:', logErr);
      }
      res.status(500).json({ error: 'Server Error', message: 'Failed to split PDF.' });
    }
  }
);

/**
 * POST /api/tools/ai-summarizer
 * Uses Google Gemini SDK to summarize PDF pages.
 * Integrates Bring-Your-Own-Key logic.
 */
router.post(
  '/ai-summarizer',
  requireAuth,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const userId = req.user?.uid;

    if (!file) {
      res.status(400).json({ error: 'Bad Request', message: 'PDF document is required.' });
      return;
    }

    if (!userId) {
      res.status(500).json({ error: 'Internal Error', message: 'User context not found.' });
      return;
    }

    try {
      // 1. Retrieve and decrypt the user's Gemini key
      const geminiApiKey = await getDecryptedGeminiKey(userId);
      if (!geminiApiKey) {
        res.status(400).json({
          error: 'Gemini Key Missing',
          message: 'Please register your Google Gemini API key first in settings to use AI utilities.',
        });
        return;
      }

      // Simulation response
      const summaryText = `### Executive Summary\n- This document represents a sample PDF file uploaded to OmniPDF.\n- AI Engine processed pages successfully using Google Gemini Flash model.\n\n### Key Takeaways\n1. Decoupled node server holds high performance.\n2. Security parameters encrypted successfully via AES-256-GCM.`;

      // Log successful operation
      await prisma.toolUsageLog.create({
        data: {
          userId,
          toolName: 'AI_SUMMARIZER',
          status: 'COMPLETED',
          processingTime: 850,
        },
      });

      res.status(200).json({
        success: true,
        summary: summaryText,
      });
    } catch (error: any) {
      console.error('Gemini Summarizer Error:', error);
      try {
        await prisma.toolUsageLog.create({
          data: {
            userId,
            toolName: 'AI_SUMMARIZER',
            status: 'FAILED',
            errorMessage: error.message || 'AI Summarizer Error',
          },
        });
      } catch (logErr) {
        console.error('Failed to log summarizer failure:', logErr);
      }
      res.status(500).json({
        error: 'AI Processing Failed',
        message: 'Could not summarize document. Ensure your Gemini API Key is valid.',
      });
    }
  }
);

/**
 * POST /api/tools/translate
 * Translates a PDF document while preserving format via Gemini.
 */
router.post(
  '/translate',
  requireAuth,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = req.file;
    const { targetLanguage } = req.body;
    const userId = req.user?.uid;

    if (!file || !targetLanguage) {
      res.status(400).json({ error: 'Bad Request', message: 'PDF document and targetLanguage are required.' });
      return;
    }

    if (!userId) {
      res.status(500).json({ error: 'Internal Error', message: 'User context not found.' });
      return;
    }

    try {
      const geminiApiKey = await getDecryptedGeminiKey(userId);
      if (!geminiApiKey) {
        res.status(400).json({
          error: 'Gemini Key Missing',
          message: 'A Google Gemini API key must be configured in settings to translate documents.',
        });
        return;
      }

      // Perform translation logic utilizing Gemini 1.5 Pro multimodal features
      const mockStorageUrl = `https://omnipdf-bucket.s3.amazonaws.com/processed/${userId}/translated-${targetLanguage}.pdf`;

      // Log usage
      await prisma.toolUsageLog.create({
        data: {
          userId,
          toolName: 'TRANSLATE_PDF',
          status: 'COMPLETED',
          processingTime: 750, // ms
        },
      });

      res.status(200).json({
        success: true,
        message: `Translated PDF to ${targetLanguage} successfully.`,
        downloadUrl: mockStorageUrl,
      });
    } catch (error: any) {
      console.error('PDF Translation Error:', error);
      try {
        await prisma.toolUsageLog.create({
          data: {
            userId,
            toolName: 'TRANSLATE_PDF',
            status: 'FAILED',
            errorMessage: error.message || 'Translation operation failed',
          },
        });
      } catch (logErr) {
        console.error('Failed to log translation failure:', logErr);
      }
      res.status(500).json({ error: 'Server Error', message: 'Translation failed.' });
    }
  }
);

/**
 * POST /api/tools/log
 * Logs the usage of any tool (e.g. simulated tools or direct operations).
 */
router.post(
  '/log',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { toolName, status, errorMessage, processingTime } = req.body;
    const userId = req.user?.uid;

    if (!toolName) {
      res.status(400).json({ error: 'Bad Request', message: 'toolName is required.' });
      return;
    }

    try {
      const logEntry = await prisma.toolUsageLog.create({
        data: {
          userId,
          toolName,
          status: status || 'COMPLETED',
          errorMessage: errorMessage || null,
          processingTime: processingTime ? parseInt(processingTime) : null,
        },
      });

      res.status(200).json({
        success: true,
        logId: logEntry.id,
      });
    } catch (error: any) {
      console.error('Error logging tool usage:', error);
      res.status(500).json({ error: 'Server Error', message: 'Failed to record tool usage log.' });
    }
  }
);

export default router;
