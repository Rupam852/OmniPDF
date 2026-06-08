import { Router } from 'express';
import apiKeysRouter from './apiKeys';
import toolsRouter from './tools';

const router = Router();

// Register sub-routers
router.use('/keys', apiKeysRouter);
router.use('/tools', toolsRouter);

// Base status route
router.get('/status', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

export default router;
