import { Router } from 'express';
import toolsRouter from './tools';

const router = Router();

// Register sub-routers
router.use('/tools', toolsRouter);

// Base status route
router.get('/status', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

export default router;
