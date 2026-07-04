import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { authMiddleware } from '../../app/middleware/auth';
import { ForbiddenError } from '../../app/utils/errors';
import { evaluateRules } from '../rules/rules.service';
import { buildStudentProfile, refreshStudentProfile } from '../student-profile/studentProfile.service';

const router = Router();

router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json(req.user);
}));

router.get('/profile', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.studentRef) throw new ForbiddenError('Current user is not a student');
  const eligibility = await evaluateRules(req.user.studentRef);
  const profile = await buildStudentProfile(req.user.studentRef, eligibility);
  res.json(profile);
}));

router.post('/profile/refresh', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.studentRef) throw new ForbiddenError('Current user is not a student');
  await refreshStudentProfile(req.user.studentRef);
  const eligibility = await evaluateRules(req.user.studentRef);
  const profile = await buildStudentProfile(req.user.studentRef, eligibility);
  res.json(profile);
}));

export default router;
