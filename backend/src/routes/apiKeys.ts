import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { encryptKey } from '../utils/crypto';
import prisma from '../services/prisma';

const router = Router();

// Apply auth middleware to all key endpoints
router.use(requireAuth);

/**
 * POST /api/keys
 * Securely encrypts and saves/updates the user's Gemini API key.
 */
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { apiKey } = req.body;
  const userId = req.user?.uid;

  if (!apiKey || typeof apiKey !== 'string') {
    res.status(400).json({ error: 'Bad Request', message: 'A valid apiKey string is required.' });
    return;
  }

  if (!userId) {
    res.status(500).json({ error: 'Internal Error', message: 'User context not found.' });
    return;
  }

  try {
    // 1. Encrypt API key using AES-256-GCM
    const { encryptedKey, iv, authTag } = encryptKey(apiKey);

    // 2. Ensure User exists in local DB (upsert user record to match Firebase Auth UID)
    await prisma.user.upsert({
      where: { id: userId },
      update: { email: req.user?.email || '' },
      create: { id: userId, email: req.user?.email || '' },
    });

    // 3. Upsert the encrypted key configuration
    const savedKey = await prisma.encryptedApiKey.upsert({
      where: { userId },
      update: { encryptedKey, iv, authTag },
      create: { userId, encryptedKey, iv, authTag },
    });

    res.status(200).json({
      success: true,
      message: 'Gemini API key stored and encrypted successfully.',
      updatedAt: savedKey.updatedAt,
    });
  } catch (error: any) {
    console.error('Failed to encrypt/store API key:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to securely store Gemini API key.',
    });
  }
});

/**
 * GET /api/keys
 * Returns if API key exists and returns a masked key version (does NOT return decrypted key).
 */
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;

  if (!userId) {
    res.status(500).json({ error: 'Internal Error', message: 'User context not found.' });
    return;
  }

  try {
    const keyConfig = await prisma.encryptedApiKey.findUnique({
      where: { userId },
    });

    if (!keyConfig) {
      res.status(200).json({ isConfigured: false, keyMasked: null });
      return;
    }

    // Since GCM encryption does not store key plaintext in db, we do not decrypt it here.
    // Return a masked version for UI status indicator.
    res.status(200).json({
      isConfigured: true,
      updatedAt: keyConfig.updatedAt,
      // Provide standard API key masking
      keyMasked: '••••••••••••••••••••',
    });
  } catch (error: any) {
    console.error('Failed to check API key:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Could not fetch key configuration status.',
    });
  }
});

/**
 * DELETE /api/keys
 * Removes the stored Gemini API key configuration for the authenticated user.
 */
router.delete('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;

  if (!userId) {
    res.status(500).json({ error: 'Internal Error', message: 'User context not found.' });
    return;
  }

  try {
    const deleted = await prisma.encryptedApiKey.deleteMany({
      where: { userId },
    });

    if (deleted.count === 0) {
      res.status(404).json({ error: 'Not Found', message: 'No Gemini API key found to delete.' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Gemini API key config removed successfully.',
    });
  } catch (error) {
    console.error('Failed to delete API key:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to delete Gemini API key.',
    });
  }
});

export default router;
