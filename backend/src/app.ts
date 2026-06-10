import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import apiRouter from './routes';
import { apiLimiter } from './middleware/rateLimiter';
import { checkAndInstallPythonDependencies } from './utils/pythonSetup';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable trust proxy for correct IP rate limiting behind reverse proxies (Vercel, AWS, etc.)
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet());

// CORS Configuration - restrict origins in production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000', 'https://omnipdf.vercel.app', 'https://omnipdf-convertor.vercel.app'];

console.log("[OmniPDF Backend] Allowed Origins:", allowedOrigins.map(o => o.trim()));

app.use(
  cors({
    origin: (origin, callback) => {
      // Dynamically allow the request origin to bypass preflight issues globally
      callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

// Start Server (if file is run directly)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[OmniPDF Backend] Server listening on port ${PORT}`);
    console.log(`[OmniPDF Backend] Active Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Asynchronously check and setup python dependencies so server starts immediately
    checkAndInstallPythonDependencies().catch((err) => {
      console.error('[Python Setup] Unexpected error in dependency setup:', err);
    });
  });
}

export default app;
