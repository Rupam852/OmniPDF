import { Router } from 'express';
import toolsRouter from './tools';
import { getPythonStatus } from '../utils/pythonSetup';

const router = Router();

// Register sub-routers
router.use('/tools', toolsRouter);

// Base status route
router.get('/status', (req, res) => {
  const pythonStatus = getPythonStatus();
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date(),
    pythonReady: pythonStatus.ready,
    pythonError: pythonStatus.error,
  });
});

export default router;
