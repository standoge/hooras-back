import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import {
  getDemoStudent,
  getDemoStudentAcademicProfile,
  getDemoStudentProgramProgress,
  getProviderSchema,
  listDemoPrograms,
  searchDemoStudents,
} from './service';

const router = Router();

function getProfile(req: Request): string {
  return (req.query.providerProfile as string) || 'progress_percentage';
}

router.get('/schema', asyncHandler(async (req: Request, res: Response) => {
  res.json(getProviderSchema(getProfile(req)));
}));

router.get('/students', asyncHandler(async (req: Request, res: Response) => {
  const profile = getProfile(req);
  const q = (req.query.query as string) || '';
  const students = await searchDemoStudents(q, profile);
  res.json(students);
}));

router.get('/students/:externalStudentId', asyncHandler(async (req: Request, res: Response) => {
  const student = await getDemoStudent(String(req.params.externalStudentId), getProfile(req));
  res.json(student);
}));

router.get('/students/:externalStudentId/academic-profile', asyncHandler(async (req: Request, res: Response) => {
  const profile = await getDemoStudentAcademicProfile(
    String(req.params.externalStudentId),
    getProfile(req),
  );
  res.json(profile);
}));

router.get('/students/:externalStudentId/program-progress', asyncHandler(async (req: Request, res: Response) => {
  const progress = await getDemoStudentProgramProgress(
    String(req.params.externalStudentId),
    getProfile(req),
  );
  res.json(progress);
}));

router.get('/programs', asyncHandler(async (_req: Request, res: Response) => {
  res.json(listDemoPrograms());
}));

export default router;
