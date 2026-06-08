import { Request, Response, NextFunction } from 'express';
import { firebaseAdmin } from '../config/firebase';

// Augment Express Request type definition to include user metadata
export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    emailVerified?: boolean;
    name?: string;
    picture?: string;
  };
  file?: any;
  files?: any;
}

/**
 * Middleware to verify Firebase Auth ID Token.
 * Expects header: Authorization: Bearer <ID_TOKEN>
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token is missing or invalid. Use authorization header format: Bearer <token>',
    });
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      name: decodedToken.name,
      picture: decodedToken.picture,
    };
    
    next();
  } catch (error: any) {
    console.error('Firebase Auth Verification Error:', error.message);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token expired or verification failed.',
    });
  }
}
