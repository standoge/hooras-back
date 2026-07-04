import { Router, Request, Response } from 'express';
import db from '../../database';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { authMiddleware } from '../../app/middleware/auth';

const router = Router();

router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  let dbStatus = 'ok';
  try {
    await db.raw('SELECT 1');
  } catch {
    dbStatus = 'down';
  }
  res.json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    checkedAt: new Date().toISOString(),
  });
}));

export default router;
