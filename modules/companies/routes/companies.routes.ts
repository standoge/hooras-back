import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import db from '../../../database';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import { validate } from '../../../app/middleware/validate';
import { authMiddleware, rbac } from '../../../app/middleware/auth';
import { NotFoundError } from '../../../app/utils/errors';
import { writeAuditEvent } from '../../../app/utils/audit';

const companyInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
});

const router = Router();

function mapCompany(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    email: row.email,
    phone: row.phone,
    website: row.website,
    address: row.address,
    createdAt: (row.created_at as Date)?.toISOString?.() ?? row.created_at,
    updatedAt: (row.updated_at as Date)?.toISOString?.() ?? row.updated_at,
  };
}

router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const rows = await db('companies').select('*').orderBy('name', 'asc');
  res.json(rows.map(mapCompany));
}));

router.get('/:companyId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const row = await db('companies').where({ id: req.params.companyId }).first();
  if (!row) throw new NotFoundError('Company not found');
  res.json(mapCompany(row));
}));

router.post('/', authMiddleware, rbac('coordinator', 'admin'), validate(companyInputSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body;
  const [row] = await db('companies')
    .insert({
      id: uuidv4(),
      name: body.name,
      description: body.description,
      email: body.email || null,
      phone: body.phone,
      website: body.website || null,
      address: body.address,
    })
    .returning('*');

  await writeAuditEvent({
    actorRef: req.user!.externalUserId,
    action: 'company.created',
    entityType: 'company',
    entityId: row.id as string,
  });

  res.status(201).json(mapCompany(row));
}));

router.patch('/:companyId', authMiddleware, rbac('coordinator', 'admin'), validate(companyInputSchema.partial()), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body;
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.email !== undefined) updates.email = body.email || null;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.website !== undefined) updates.website = body.website || null;
  if (body.address !== undefined) updates.address = body.address;

  const [row] = await db('companies')
    .where({ id: req.params.companyId })
    .update(updates)
    .returning('*');

  if (!row) throw new NotFoundError('Company not found');

  await writeAuditEvent({
    actorRef: req.user!.externalUserId,
    action: 'company.updated',
    entityType: 'company',
    entityId: row.id as string,
  });

  res.json(mapCompany(row));
}));

router.delete('/:companyId', authMiddleware, rbac('coordinator', 'admin'), asyncHandler(async (req: Request, res: Response) => {
  const count = await db('companies').where({ id: req.params.companyId }).delete();
  if (!count) throw new NotFoundError('Company not found');

  await writeAuditEvent({
    actorRef: req.user!.externalUserId,
    action: 'company.deleted',
    entityType: 'company',
    entityId: req.params.companyId as string,
  });

  res.status(204).end();
}));

export default router;
export { mapCompany };
