import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import apiRouter from './routes';
import { apiLimiter } from './middleware/rateLimiter';
import { checkAndInstallPythonDependencies } from './utils/pythonSetup';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable trust proxy for correct IP rate limiting behind reverse proxies (Vercel, AWS, etc.)
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet());

// CORS Configuration - strictly restrict to allowed origins only
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'https://omnipdf-converter.vercel.app'];

console.log('[OmniPDF Backend] Allowed Origins:', allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (no origin header) and whitelisted origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
        callback(new Error(`CORS policy: Origin "${origin}" is not allowed.`));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  })
);

// Logging Middleware
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body Parsing Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply general API rate limiter to all api routes
app.use('/api', apiLimiter);

// Register API Routes
app.use('/api', apiRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Handle CORS errors
  if (err.message && err.message.startsWith('CORS policy')) {
    res.status(403).json({ error: 'Forbidden', message: err.message });
    return;
  }
  console.error('Unhandled Server Error:', err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({
      error: 'File Too Large',
      message: 'Uploaded file exceeds the maximum size limit of 10MB.',
    });
    return;
  }
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred.'
      : err.message || 'Server error',
  });
});

// Cleanup stale temp files (older than 1 hour) on startup to prevent accumulation after crashes
function cleanupStaleTempFiles() {
  const tempDir = path.join(__dirname, '../temp');
  if (!fs.existsSync(tempDir)) return;
  const ONE_HOUR = 60 * 60 * 1000;
  const now = Date.now();
  try {
    const files = fs.readdirSync(tempDir);
    let cleaned = 0;
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > ONE_HOUR) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    }
    if (cleaned > 0) console.log(`[Startup Cleanup] Removed ${cleaned} stale temp file(s).`);
  } catch (err) {
    console.warn('[Startup Cleanup] Could not clean temp directory:', err);
  }
}

// Start Server (if file is run directly)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[OmniPDF Backend] Server listening on port ${PORT}`);
    console.log(`[OmniPDF Backend] Active Environment: ${process.env.NODE_ENV || 'development'}`);

    // Clean stale temp files from previous crashed runs
    cleanupStaleTempFiles();

    // Asynchronously check and setup python dependencies so server starts immediately
    checkAndInstallPythonDependencies().catch((err) => {
      console.error('[Python Setup] Unexpected error in dependency setup:', err);
    });
  });
}

export default app;
