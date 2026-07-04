import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import db from '../../database';
import { encrypt } from '../../app/utils/crypto';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { validate } from '../../app/middleware/validate';
import { authMiddleware, rbac } from '../../app/middleware/auth';
import { NotFoundError } from '../../app/utils/errors';
import { ModuleRegistry } from '../../platform/registry/ModuleRegistry';

const createSchema = z.object({
  moduleKey: z.string(),
  providerKey: z.string(),
  providerType: z.enum(['auth', 'student_data', 'email', 'workflow', 'scraper']),
  baseUrl: z.string().url(),
  authMethod: z.enum(['none', 'bearer_token', 'api_key', 'oauth2', 'signed_webhook']),
  secret: z.string().optional(),
  fieldMappings: z.record(z.unknown()).optional(),
});

const updateSchema = z.object({
  baseUrl: z.string().url().optional(),
  enabled: z.boolean().optional(),
  secret: z.string().optional(),
  fieldMappings: z.record(z.unknown()).optional(),
});

const router = Router();

function mapProvider(row: Record<string, unknown>) {
  return {
    id: row.id,
    moduleKey: row.module_key,
    providerKey: row.provider_key,
    providerType: row.provider_type,
    baseUrl: row.base_url,
    enabled: row.enabled,
    authMethod: row.auth_method,
    capabilities: typeof row.capabilities === 'string' ? JSON.parse(row.capabilities) : row.capabilities,
    fieldMappings: typeof row.field_mappings === 'string' ? JSON.parse(row.field_mappings) : row.field_mappings,
    lastHealthStatus: row.last_health_status,
    createdAt: (row.created_at as Date)?.toISOString?.() ?? row.created_at,
    updatedAt: (row.updated_at as Date)?.toISOString?.() ?? row.updated_at,
  };
}

router.get('/', authMiddleware, rbac('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const rows = await db('provider_connections').select('*');
  res.json(rows.map(mapProvider));
}));

router.post('/', authMiddleware, rbac('admin'), validate(createSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body;
  const [row] = await db('provider_connections')
    .insert({
      id: uuidv4(),
      module_key: body.moduleKey,
      provider_key: body.providerKey,
      provider_type: body.providerType,
      base_url: body.baseUrl,
      enabled: true,
      auth_method: body.authMethod,
      encrypted_secret: body.secret ? encrypt(body.secret) : null,
      field_mappings: JSON.stringify(body.fieldMappings ?? {}),
      capabilities: JSON.stringify([]),
    })
    .returning('*');
  res.status(201).json(mapProvider(row));
}));

router.get('/:providerId', authMiddleware, rbac('admin'), asyncHandler(async (req: Request, res: Response) => {
  const row = await db('provider_connections').where({ id: req.params.providerId }).first();
  if (!row) throw new NotFoundError('Provider connection not found');
  res.json(mapProvider(row));
}));

router.patch('/:providerId', authMiddleware, rbac('admin'), validate(updateSchema), asyncHandler(async (req: Request, res: Response) => {
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (req.body.baseUrl) updates.base_url = req.body.baseUrl;
  if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;
  if (req.body.secret) updates.encrypted_secret = encrypt(req.body.secret);
  if (req.body.fieldMappings) updates.field_mappings = JSON.stringify(req.body.fieldMappings);
  const [row] = await db('provider_connections')
    .where({ id: req.params.providerId })
    .update(updates)
    .returning('*');
  if (!row) throw new NotFoundError('Provider connection not found');
  res.json(mapProvider(row));
}));

router.post('/:providerId/test', authMiddleware, rbac('admin'), asyncHandler(async (req: Request, res: Response) => {
  const row = await db('provider_connections').where({ id: req.params.providerId }).first();
  if (!row) throw new NotFoundError('Provider connection not found');
  try {
    const res2 = await fetch(row.base_url as string, { method: 'HEAD' }).catch(() =>
      fetch(row.base_url as string)
    );
    const ok = res2.ok || res2.status < 500;
    await db('provider_connections').where({ id: req.params.providerId }).update({
      last_health_status: ok ? 'ok' : 'down',
    });
    res.json({ status: ok ? 'success' : 'failure', checkedAt: new Date().toISOString() });
  } catch {
    res.json({ status: 'failure', message: 'Connection failed', checkedAt: new Date().toISOString() });
  }
}));

router.get('/:providerId/schema', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const row = await db('provider_connections').where({ id: req.params.providerId }).first();
  if (!row) throw new NotFoundError('Provider connection not found');
  if (row.provider_type === 'student_data') {
    const connector = await ModuleRegistry.getActiveStudentDataConnector();
    const schema = await connector.getSchema();
    return res.json(schema);
  }
  res.json({ providerKey: row.provider_key, fields: [] });
}));

export default router;
