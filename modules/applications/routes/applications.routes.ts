import { Router, Request, Response } from 'express';
import db from '../../../database';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import { authMiddleware, rbac } from '../../../app/middleware/auth';
import { NotFoundError, ConflictError } from '../../../app/utils/errors';
import { writeAuditEvent } from '../../../app/utils/audit';
import { getService } from '../../../platform/module/ServiceRegistry';
import {
  ASSIGNMENTS_V1,
  AssignmentsServiceV1,
  NOTIFICATIONS_V1,
  NotificationsServiceV1,
} from '../../../platform/contracts/services';
import { assertNoActiveAssignment } from '../../assignments/services/assignments.service';

const router = Router();

function mapApplication(row: Record<string, unknown>) {
  return {
    id: row.id,
    projectId: row.project_id,
    studentRef: row.student_ref,
    status: row.status,
    motivation: row.motivation,
    rejectionReason: row.rejection_reason,
    createdAt: (row.created_at as Date)?.toISOString?.() ?? row.created_at,
  };
}

router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  let query = db('project_applications').select('*');
  if (req.query.status) query = query.where({ status: req.query.status });
  if (req.query.studentRef) query = query.where({ student_ref: req.query.studentRef });
  if (req.user?.roles.includes('student') && !req.user.roles.some((r) => ['admin', 'coordinator'].includes(r))) {
    query = query.where({ student_ref: req.user.studentRef });
  }
  const rows = await query.orderBy('created_at', 'desc');
  res.json(rows.map(mapApplication));
}));

router.post('/:applicationId/approve', authMiddleware, rbac('coordinator', 'admin'), asyncHandler(async (req: Request, res: Response) => {
  const app = await db('project_applications').where({ id: req.params.applicationId }).first();
  if (!app) throw new NotFoundError('Application not found');
  if (app.status === 'approved') throw new ConflictError('Application is already approved');

  await assertNoActiveAssignment(app.student_ref as string);

  const result = await db.transaction(async (trx) => {
    const [row] = await trx('project_applications')
      .where({ id: req.params.applicationId })
      .update({ status: 'approved' })
      .returning('*');

    const assignments = getService<AssignmentsServiceV1>(ASSIGNMENTS_V1);
    const assignment = await assignments.createFromApplication(
      app.project_id as string,
      app.student_ref as string,
      trx,
    );

    return { row, assignment };
  });

  await writeAuditEvent({
    actorRef: req.user!.externalUserId,
    action: 'application.approved',
    entityType: 'project_application',
    entityId: result.row.id as string,
  });

  const notifications = getService<NotificationsServiceV1>(NOTIFICATIONS_V1);
  await notifications.send('application_approved', app.student_ref as string, {
    studentRef: app.student_ref,
    applicationId: result.row.id,
    projectId: app.project_id,
    assignmentId: (result.assignment as { id: string }).id,
  });
  await notifications.send('assignment_created', app.student_ref as string, {
    studentRef: app.student_ref,
    assignmentId: (result.assignment as { id: string }).id,
    projectId: app.project_id,
  });

  res.json(mapApplication(result.row));
}));

router.post('/:applicationId/reject', authMiddleware, rbac('coordinator', 'admin'), asyncHandler(async (req: Request, res: Response) => {
  const app = await db('project_applications').where({ id: req.params.applicationId }).first();
  if (!app) throw new NotFoundError('Application not found');
  const [row] = await db('project_applications')
    .where({ id: req.params.applicationId })
    .update({ status: 'rejected', rejection_reason: req.body?.reason })
    .returning('*');

  const notifications = getService<NotificationsServiceV1>(NOTIFICATIONS_V1);
  await notifications.send('application_rejected', app.student_ref as string, {
    studentRef: app.student_ref,
    applicationId: row.id,
    reason: req.body?.reason,
  });
  await notifications.send('application_status_changed', app.student_ref as string, {
    studentRef: app.student_ref,
    status: 'rejected',
  });
  res.json(mapApplication(row));
}));

export default router;
