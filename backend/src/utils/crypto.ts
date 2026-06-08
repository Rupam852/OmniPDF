import crypto from 'crypto';

// Use a secure environment variable for the encryption master key.
// Derive a 32-byte (256-bit) key deterministically from the user's secret.
const ENCRYPTION_SECRET = process.env.ENCRYPTION_KEY || 'default-dev-encryption-key-must-be-changed-in-prod-32chars!';
const SALT = 'omnipdf-system-aes-gcm-salt';
const KEY = crypto.scryptSync(ENCRYPTION_SECRET, SALT, 32);

interface EncryptionResult {
  encryptedKey: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypts a string (e.g. Gemini API Key) using AES-256-GCM
 * @param text The plaintext string to encrypt
 * @returns Object containing the encrypted string, initialization vector (IV), and authentication tag (authTag)
 */
export function encryptKey(text: string): EncryptionResult {
  if (!text) {
    throw new Error('Plaintext value is required for encryption.');
  }
  // AES-256-GCM recommended IV size is 12 bytes (96 bits)
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return {
    encryptedKey: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag,
  };
}

/**
 * Decrypts an encrypted key string using AES-256-GCM
 * @param encryptedKey The hex-encoded encrypted string
 * @param iv The hex-encoded initialization vector (IV)
 * @param authTag The hex-encoded authentication tag
 * @returns The original decrypted plaintext string
 */
export function decryptKey(encryptedKey: string, iv: string, authTag: string): string {
  if (!encryptedKey || !iv || !authTag) {
    throw new Error('All parameters (encryptedKey, iv, authTag) are required for decryption.');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
