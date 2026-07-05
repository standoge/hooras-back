import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../../../database';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import { validate } from '../../../app/middleware/validate';
import { authMiddleware, rbac } from '../../../app/middleware/auth';
import { NotFoundError } from '../../../app/utils/errors';
import { param } from '../../../app/utils/params';
import { writeAuditEvent } from '../../../app/utils/audit';
import { getService } from '../../../platform/module/ServiceRegistry';
import {
  ASSIGNMENTS_V1,
  AssignmentsServiceV1,
  NOTIFICATIONS_V1,
  NotificationsServiceV1,
} from '../../../platform/contracts/services';
import { mapAssignment } from '../services/assignments.service';

const supervisorSchema = z.object({ supervisorRef: z.string() });

const router = Router();

router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  let query = db('assignments').select('*');
  if (req.query.studentRef) query = query.where({ student_ref: req.query.studentRef });
  if (req.query.projectId) query = query.where({ project_id: req.query.projectId });
  if (req.user?.roles.includes('student') && !req.user.roles.some((r) => ['admin', 'coordinator', 'faculty_supervisor'].includes(r))) {
    query = query.where({ student_ref: req.user.studentRef });
  }
  const rows = await query;
  res.json(rows.map(mapAssignment));
}));

router.put('/:assignmentId/supervisor', authMiddleware, rbac('coordinator', 'admin', 'faculty_supervisor'), validate(supervisorSchema), asyncHandler(async (req: Request, res: Response) => {
  const [row] = await db('assignments')
    .where({ id: req.params.assignmentId })
    .update({ supervisor_ref: req.body.supervisorRef, updated_at: new Date() })
    .returning('*');
  if (!row) throw new NotFoundError('Assignment not found');
  res.json(mapAssignment(row));
}));

router.post('/:assignmentId/complete', authMiddleware, rbac('coordinator', 'admin', 'faculty_supervisor'), asyncHandler(async (req: Request, res: Response) => {
  const assignments = getService<AssignmentsServiceV1>(ASSIGNMENTS_V1);
  const assignment = await assignments.completeAssignment(param(req.params.assignmentId));
  if (!assignment) throw new NotFoundError('Assignment not found');

  await writeAuditEvent({
    actorRef: req.user!.externalUserId,
    action: 'assignment.completed',
    entityType: 'assignment',
    entityId: param(req.params.assignmentId),
  });

  const notifications = getService<NotificationsServiceV1>(NOTIFICATIONS_V1);
  await notifications.send('application_status_changed', (assignment as { studentRef: string }).studentRef, {
    studentRef: (assignment as { studentRef: string }).studentRef,
    status: 'completed',
    assignmentId: param(req.params.assignmentId),
  });

  res.json(assignment);
}));

export default router;
