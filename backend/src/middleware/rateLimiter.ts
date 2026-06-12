import rateLimit from 'express-rate-limit';

/**
 * Standard API rate limiter.
 * Limits users to 100 requests per 15 minutes.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this client. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * PDF conversion and operations rate limiter.
 * Processing PDFs is resource-intensive, so this limits execution
 * to 5 heavy operations per minute.
 */
export const processingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5,
  message: {
    error: 'Rate Limit Exceeded',
    message: 'Heavy processing rate limit reached. Please wait a minute before requesting another PDF operation.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict rate limiter for AI-powered endpoints (OCR, AI Summarizer).
 * These endpoints call the Gemini API and cost money — limit to 2 per minute.
 */
export const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 2,
  message: {
    error: 'AI Rate Limit Exceeded',
    message: 'AI processing limit reached. Please wait a minute before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
