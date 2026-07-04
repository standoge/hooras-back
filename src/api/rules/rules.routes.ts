import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { validate } from '../../app/middleware/validate';
import { authMiddleware, rbac } from '../../app/middleware/auth';
import { writeAuditEvent } from '../../app/utils/audit';
import * as rulesService from './rules.service';

const ruleInputSchema = z.object({
  name: z.string(),
  scope: z.object({
    facultyCode: z.string().optional(),
    programCode: z.string().optional(),
    degreeLevel: z.string().optional(),
    modality: z.string().optional(),
  }).optional(),
  requiredHours: z.number(),
  categoryHours: z.record(z.number()).optional(),
  minimumProgressPercentage: z.number().optional(),
  requiredAcademicStatuses: z.array(z.string()).optional(),
  requiredCourseCodes: z.array(z.string()).optional(),
  calendarDuration: z.object({
    value: z.number(),
    unit: z.enum(['days', 'weeks', 'months', 'years']),
  }).optional(),
  active: z.boolean().optional(),
});

const evaluateSchema = z.object({
  studentRef: z.string(),
  projectId: z.string().uuid().optional(),
  academicProfile: z.record(z.unknown()).optional(),
});

const router = Router();

router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const rules = await rulesService.listRules({
    facultyCode: req.query.facultyCode as string,
    programCode: req.query.programCode as string,
    degreeLevel: req.query.degreeLevel as string,
  });
  res.json(rules);
}));

router.post('/', authMiddleware, rbac('admin', 'coordinator'), validate(ruleInputSchema), asyncHandler(async (req: Request, res: Response) => {
  const rule = await rulesService.createRule(req.body);
  await writeAuditEvent({
    actorRef: req.user!.externalUserId,
    action: 'rule.created',
    entityType: 'requirement_rule',
    entityId: rule.id as string,
  });
  res.status(201).json(rule);
}));

router.post('/evaluate', authMiddleware, validate(evaluateSchema), asyncHandler(async (req: Request, res: Response) => {
  const result = await rulesService.evaluateRules(
    req.body.studentRef,
    req.body.academicProfile,
    req.body.projectId
  );
  res.json(result);
}));

export default router;
