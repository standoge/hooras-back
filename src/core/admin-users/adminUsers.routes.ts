import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { z } from 'zod';
import db from '../../database';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { validate } from '../../app/middleware/validate';
import { authMiddleware, rbac } from '../../app/middleware/auth';
import { NotFoundError } from '../../app/utils/errors';

const createSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  displayName: z.string().optional(),
  email: z.string().email().optional(),
  roles: z.array(z.enum(['admin', 'coordinator', 'auditor'])).min(1),
  active: z.boolean().optional(),
});

const updateSchema = z.object({
  displayName: z.string().optional(),
  email: z.string().email().optional(),
  roles: z.array(z.enum(['admin', 'coordinator', 'auditor'])).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function mapAdminUser(row: Record<string, unknown>) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    roles: typeof row.roles === 'string' ? JSON.parse(row.roles) : row.roles,
    active: row.active,
    createdAt: (row.created_at as Date)?.toISOString?.() ?? row.created_at,
    updatedAt: (row.updated_at as Date)?.toISOString?.() ?? row.updated_at,
  };
}

const router = Router();

router.get('/', authMiddleware, rbac('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const rows = await db('admin_users').select('*').orderBy('username');
  res.json(rows.map(mapAdminUser));
}));

router.post('/', authMiddleware, rbac('admin'), validate(createSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body;
  const [row] = await db('admin_users')
    .insert({
      id: uuidv4(),
      username: body.username,
      password_hash: hashPassword(body.password),
      display_name: body.displayName,
      email: body.email,
      roles: JSON.stringify(body.roles),
      active: body.active ?? true,
    })
    .returning('*');
  res.status(201).json(mapAdminUser(row));
}));

router.get('/:adminUserId', authMiddleware, rbac('admin'), asyncHandler(async (req: Request, res: Response) => {
  const row = await db('admin_users').where({ id: req.params.adminUserId }).first();
  if (!row) throw new NotFoundError('Admin user not found');
  res.json(mapAdminUser(row));
}));

router.patch('/:adminUserId', authMiddleware, rbac('admin'), validate(updateSchema), asyncHandler(async (req: Request, res: Response) => {
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (req.body.displayName !== undefined) updates.display_name = req.body.displayName;
  if (req.body.email !== undefined) updates.email = req.body.email;
  if (req.body.roles) updates.roles = JSON.stringify(req.body.roles);
  if (req.body.active !== undefined) updates.active = req.body.active;
  if (req.body.password) updates.password_hash = hashPassword(req.body.password);
  const [row] = await db('admin_users').where({ id: req.params.adminUserId }).update(updates).returning('*');
  if (!row) throw new NotFoundError('Admin user not found');
  res.json(mapAdminUser(row));
}));

router.delete('/:adminUserId', authMiddleware, rbac('admin'), asyncHandler(async (req: Request, res: Response) => {
  const deleted = await db('admin_users').where({ id: req.params.adminUserId }).delete();
  if (!deleted) throw new NotFoundError('Admin user not found');
  res.status(204).send();
}));

export default router;
