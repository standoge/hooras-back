import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../../database';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { authMiddleware, rbac } from '../../app/middleware/auth';
import { NotFoundError } from '../../app/utils/errors';
import { writeAuditEvent } from '../../app/utils/audit';
import { sendNotification } from '../../integrations/zavu/notifications';

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
  const [row] = await db('project_applications')
    .where({ id: req.params.applicationId })
    .update({ status: 'approved' })
    .returning('*');
  await db('assignments').insert({
    id: uuidv4(),
    project_id: app.project_id,
    student_ref: app.student_ref,
    status: 'active',
  });
  await writeAuditEvent({
    actorRef: req.user!.externalUserId,
    action: 'application.approved',
    entityType: 'project_application',
    entityId: row.id as string,
  });
  await sendNotification('application_approved', app.student_ref as string, {
    applicationId: row.id,
    projectId: app.project_id,
  });
  res.json(mapApplication(row));
}));

router.post('/:applicationId/reject', authMiddleware, rbac('coordinator', 'admin'), asyncHandler(async (req: Request, res: Response) => {
  const app = await db('project_applications').where({ id: req.params.applicationId }).first();
  if (!app) throw new NotFoundError('Application not found');
  const [row] = await db('project_applications')
    .where({ id: req.params.applicationId })
    .update({ status: 'rejected', rejection_reason: req.body?.reason })
    .returning('*');
  await sendNotification('application_rejected', app.student_ref as string, {
    applicationId: row.id,
    reason: req.body?.reason,
  });
  res.json(mapApplication(row));
}));

export default router;
