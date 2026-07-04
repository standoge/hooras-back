import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import db from '../../database';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { validate } from '../../app/middleware/validate';
import { authMiddleware, rbac } from '../../app/middleware/auth';
import { NotFoundError, BadRequestError } from '../../app/utils/errors';
import { writeAuditEvent } from '../../app/utils/audit';
import { triggerProjectPostedWorkflow } from '../../integrations/workflow/n8n';

const projectInputSchema = z.object({
  title: z.string(),
  description: z.string(),
  organizationName: z.string(),
  location: z.string().optional(),
  modality: z.enum(['onsite', 'remote', 'hybrid']).optional(),
  categories: z.array(z.string()),
  capacity: z.number().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  applicationDeadline: z.string().optional(),
  publicSafe: z.boolean().optional(),
});

const router = Router();

function mapProject(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    organizationName: row.organization_name,
    location: row.location,
    modality: row.modality,
    categories: typeof row.categories === 'string' ? JSON.parse(row.categories) : row.categories,
    capacity: row.capacity,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    applicationDeadline: row.application_deadline,
    publicSafe: row.public_safe,
    status: row.status,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    extractionConfidence: row.extraction_confidence ? Number(row.extraction_confidence) : undefined,
    createdAt: (row.created_at as Date)?.toISOString?.() ?? row.created_at,
    updatedAt: (row.updated_at as Date)?.toISOString?.() ?? row.updated_at,
  };
}

router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  let query = db('projects').select('*');
  if (req.query.status) query = query.where({ status: req.query.status });
  if (req.query.sourceType) query = query.where({ source_type: req.query.sourceType });
  if (req.query.category) {
    query = query.whereRaw('categories::text ILIKE ?', [`%${req.query.category}%`]);
  }
  if (req.user?.roles.includes('student') && !req.user.roles.some((r) => ['admin', 'coordinator'].includes(r))) {
    query = query.whereIn('status', ['published', 'accepting_applications', 'in_execution']);
  }
  const rows = await query.orderBy('created_at', 'desc');
  res.json(rows.map(mapProject));
}));

router.post('/', authMiddleware, rbac('coordinator', 'admin'), validate(projectInputSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body;
  const [row] = await db('projects')
    .insert({
      id: uuidv4(),
      title: body.title,
      description: body.description,
      organization_name: body.organizationName,
      location: body.location,
      modality: body.modality,
      categories: JSON.stringify(body.categories),
      capacity: body.capacity,
      starts_at: body.startsAt,
      ends_at: body.endsAt,
      application_deadline: body.applicationDeadline,
      public_safe: body.publicSafe ?? false,
      status: 'draft',
      source_type: 'college_created',
    })
    .returning('*');
  await writeAuditEvent({
    actorRef: req.user!.externalUserId,
    action: 'project.created',
    entityType: 'project',
    entityId: row.id as string,
  });
  res.status(201).json(mapProject(row));
}));

router.get('/:projectId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const row = await db('projects').where({ id: req.params.projectId }).first();
  if (!row) throw new NotFoundError('Project not found');
  res.json(mapProject(row));
}));

router.patch('/:projectId', authMiddleware, rbac('coordinator', 'admin'), validate(projectInputSchema.partial()), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body;
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (body.title) updates.title = body.title;
  if (body.description) updates.description = body.description;
  if (body.organizationName) updates.organization_name = body.organizationName;
  if (body.location !== undefined) updates.location = body.location;
  if (body.modality) updates.modality = body.modality;
  if (body.categories) updates.categories = JSON.stringify(body.categories);
  if (body.capacity !== undefined) updates.capacity = body.capacity;
  if (body.startsAt) updates.starts_at = body.startsAt;
  if (body.endsAt) updates.ends_at = body.endsAt;
  if (body.applicationDeadline) updates.application_deadline = body.applicationDeadline;
  if (body.publicSafe !== undefined) updates.public_safe = body.publicSafe;
  const [row] = await db('projects').where({ id: req.params.projectId }).update(updates).returning('*');
  if (!row) throw new NotFoundError('Project not found');
  res.json(mapProject(row));
}));

router.post('/:projectId/publish', authMiddleware, rbac('coordinator', 'admin'), asyncHandler(async (req: Request, res: Response) => {
  const row = await db('projects').where({ id: req.params.projectId }).first();
  if (!row) throw new NotFoundError('Project not found');
  if (row.status === 'archived') throw new BadRequestError('Cannot publish archived project');
  const [updated] = await db('projects')
    .where({ id: req.params.projectId })
    .update({ status: 'accepting_applications', updated_at: new Date() })
    .returning('*');
  await writeAuditEvent({
    actorRef: req.user!.externalUserId,
    action: 'project.published',
    entityType: 'project',
    entityId: updated.id as string,
  });
  if (updated.public_safe) {
    await triggerProjectPostedWorkflow({
      id: updated.id as string,
      title: updated.title as string,
      description: updated.description as string,
      organizationName: updated.organization_name as string,
      location: updated.location as string | undefined,
      modality: updated.modality as string | undefined,
      categories: JSON.parse(updated.categories as string),
      applicationDeadline: updated.application_deadline as string | undefined,
    });
  }
  res.json(mapProject(updated));
}));

router.post('/:projectId/archive', authMiddleware, rbac('coordinator', 'admin'), asyncHandler(async (req: Request, res: Response) => {
  const [row] = await db('projects')
    .where({ id: req.params.projectId })
    .update({ status: 'archived', updated_at: new Date() })
    .returning('*');
  if (!row) throw new NotFoundError('Project not found');
  res.json(mapProject(row));
}));

export default router;
