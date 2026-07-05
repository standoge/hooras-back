import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { authMiddleware } from '../../app/middleware/auth';

const router = Router();

router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json(req.user);
}));

export default router;
