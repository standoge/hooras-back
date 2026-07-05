import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import db from '../../../database';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import { validate } from '../../../app/middleware/validate';
import { authMiddleware, rbac } from '../../../app/middleware/auth';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../../../app/utils/errors';
import { assertStudentEligibleForAction } from '../../../app/rules/assertStudentEligible';
import { writeAuditEvent } from '../../../app/utils/audit';
import { getService } from '../../../platform/module/ServiceRegistry';
import { NOTIFICATIONS_V1, NotificationsServiceV1 } from '../../../platform/contracts/services';
import { assertNoActiveAssignment } from '../../assignments/services/assignments.service';
import { param } from '../../../app/utils/params';

const applicationSchema = z.object({
  studentRef: z.string().optional(),
  motivation: z.string().optional(),
});

export const projectApplicationsRouter = Router({ mergeParams: true });

projectApplicationsRouter.post('/', authMiddleware, rbac('student'), validate(applicationSchema), asyncHandler(async (req: Request, res: Response) => {
  const projectId = param(req.params.projectId);
  const project = await db('projects').where({ id: projectId }).first();
  if (!project) throw new NotFoundError('Project not found');
  if (!['published', 'accepting_applications'].includes(project.status as string)) {
    throw new BadRequestError('Project is not accepting applications');
  }
  const studentRef = req.body.studentRef ?? req.user!.studentRef;
  if (!studentRef) throw new ForbiddenError('Student reference required');

  await assertNoActiveAssignment(studentRef);
  await assertStudentEligibleForAction(studentRef, projectId, req.user!.externalUserId);

  const existing = await db('project_applications')
    .where({ project_id: projectId, student_ref: studentRef })
    .whereNotIn('status', ['cancelled', 'rejected'])
    .first();
  if (existing) throw new ConflictError('You already have an open application for this project');

  const [row] = await db('project_applications')
    .insert({
      id: uuidv4(),
      project_id: projectId,
      student_ref: studentRef,
      status: 'submitted',
      motivation: req.body.motivation,
      created_at: new Date(),
    })
    .returning('*');

  await writeAuditEvent({
    actorRef: req.user!.externalUserId,
    action: 'application.submitted',
    entityType: 'project_application',
    entityId: row.id as string,
  });

  const notifications = getService<NotificationsServiceV1>(NOTIFICATIONS_V1);
  await notifications.send('application_submitted', req.user!.email ?? studentRef, {
    studentRef,
    applicationId: row.id,
    projectId,
  });

  res.status(201).json({
    id: row.id,
    projectId: row.project_id,
    studentRef: row.student_ref,
    status: row.status,
    motivation: row.motivation,
    createdAt: (row.created_at as Date)?.toISOString?.() ?? row.created_at,
  });
}));
