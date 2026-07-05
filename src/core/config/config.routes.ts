import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../../database';
import { encrypt } from '../../app/utils/crypto';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { validate } from '../../app/middleware/validate';
import { authMiddleware, rbac } from '../../app/middleware/auth';
import { NotFoundError } from '../../app/utils/errors';

const settingsSchema = z.object({
  collegeName: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
});

const smtpSchema = z.object({
  host: z.string(),
  port: z.number(),
  user: z.string(),
  password: z.string().optional(),
  fromAddress: z.string().email(),
  secure: z.boolean().optional(),
});

const router = Router();

async function getInstanceRow() {
  const row = await db('instance_settings').first();
  if (!row) throw new NotFoundError('Instance settings not configured');
  return row;
}

function parseSettings(row: Record<string, unknown>) {
  return typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings ?? {};
}

router.get('/instance', authMiddleware, rbac('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const row = await getInstanceRow();
  const settings = parseSettings(row);
  const smtp = settings.smtp as Record<string, unknown> | undefined;
  res.json({
    id: row.id,
    collegeName: row.college_name,
    settings: {
      ...settings,
      smtp: smtp
        ? {
            host: smtp.host,
            port: smtp.port,
            user: smtp.user,
            fromAddress: smtp.fromAddress,
            secure: smtp.secure,
            configured: !!smtp.encryptedPassword,
          }
        : undefined,
    },
    updatedAt: (row.updated_at as Date)?.toISOString?.() ?? row.updated_at,
  });
}));

router.put('/instance', authMiddleware, rbac('admin'), validate(settingsSchema), asyncHandler(async (req: Request, res: Response) => {
  const row = await getInstanceRow();
  const current = parseSettings(row);
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (req.body.collegeName) updates.college_name = req.body.collegeName;
  if (req.body.settings) {
    updates.settings = JSON.stringify({ ...current, ...req.body.settings });
  }
  const [updated] = await db('instance_settings').where({ id: row.id }).update(updates).returning('*');
  res.json({
    id: updated.id,
    collegeName: updated.college_name,
    settings: parseSettings(updated),
    updatedAt: (updated.updated_at as Date)?.toISOString?.() ?? updated.updated_at,
  });
}));

router.get('/smtp', authMiddleware, rbac('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const row = await getInstanceRow();
  const settings = parseSettings(row);
  const smtp = settings.smtp as Record<string, unknown> | undefined;
  if (!smtp) {
    return res.json({ configured: false });
  }
  res.json({
    configured: true,
    host: smtp.host,
    port: smtp.port,
    user: smtp.user,
    fromAddress: smtp.fromAddress,
    secure: smtp.secure,
  });
}));

router.put('/smtp', authMiddleware, rbac('admin'), validate(smtpSchema), asyncHandler(async (req: Request, res: Response) => {
  const row = await getInstanceRow();
  const settings = parseSettings(row);
  const existingSmtp = (settings.smtp ?? {}) as Record<string, unknown>;
  const smtpConfig: Record<string, unknown> = {
    host: req.body.host,
    port: req.body.port,
    user: req.body.user,
    fromAddress: req.body.fromAddress,
    secure: req.body.secure ?? false,
    encryptedPassword: existingSmtp.encryptedPassword,
  };
  if (req.body.password) {
    smtpConfig.encryptedPassword = encrypt(req.body.password);
  }
  const updatedSettings = { ...settings, smtp: smtpConfig };
  await db('instance_settings').where({ id: row.id }).update({
    settings: JSON.stringify(updatedSettings),
    updated_at: new Date(),
  });
  res.json({
    configured: true,
    host: smtpConfig.host,
    port: smtpConfig.port,
    user: smtpConfig.user,
    fromAddress: smtpConfig.fromAddress,
    secure: smtpConfig.secure,
  });
}));

export default router;
