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
