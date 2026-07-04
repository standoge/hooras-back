import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { authMiddleware, rbac } from '../../app/middleware/auth';
import { ModuleRegistry } from '../../platform/registry/ModuleRegistry';
import { param } from '../../app/utils/params';

const router = Router();

router.get('/students', authMiddleware, rbac('coordinator', 'admin', 'faculty_supervisor'), asyncHandler(async (req: Request, res: Response) => {
  const connector = await ModuleRegistry.getActiveStudentDataConnector();
  const query = req.query.query as string;
  if (!query) return res.json([]);
  const results = await connector.searchStudents(query);
  res.json(results);
}));

router.get('/students/:studentRef/academic-profile', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const studentRef = decodeURIComponent(param(req.params.studentRef));
  const connector = await ModuleRegistry.getActiveStudentDataConnector();
  const profile = await connector.getStudentProfile(studentRef);
  res.json(profile);
}));

router.get('/schema', authMiddleware, asyncHandler(async (_req: Request, res: Response) => {
  const connector = await ModuleRegistry.getActiveStudentDataConnector();
  const schema = await connector.getSchema();
  res.json(schema);
}));

export default router;
