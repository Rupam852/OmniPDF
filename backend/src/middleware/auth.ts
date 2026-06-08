import { Request } from 'express';

/**
 * Augmented Express Request that optionally carries decoded Firebase user metadata.
 * Populated by the auth middleware when a valid Bearer token is present.
 */
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
