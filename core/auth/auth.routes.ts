import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import db from '../../database';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { validate } from '../../app/middleware/validate';
import { ModuleRegistry } from '../../platform/registry/ModuleRegistry';

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
  moduleKey: z.string().optional(),
  providerProfile: z.string().optional(),
});

const introspectSchema = z.object({ token: z.string() });

const router = Router();

router.post('/login', validate(loginSchema), asyncHandler(async (req: Request, res: Response) => {
  const connector = await ModuleRegistry.getActiveAuthConnector();
  const result = await connector.login({
    username: req.body.username,
    password: req.body.password,
    providerProfile: req.body.providerProfile,
  });

  if (result.user) {
    await db('external_user_refs')
      .insert({
        id: uuidv4(),
        external_user_id: result.user.externalUserId,
        module_key: result.user.moduleKey,
        provider_key: result.user.providerKey,
        display_name: result.user.displayName,
        email: result.user.email,
        roles: JSON.stringify(result.user.roles),
        student_ref: result.user.studentRef,
        last_seen_at: new Date(),
      })
      .onConflict(['external_user_id', 'provider_key'])
      .merge({
        display_name: result.user.displayName,
        email: result.user.email,
        roles: JSON.stringify(result.user.roles),
        student_ref: result.user.studentRef,
        last_seen_at: new Date(),
        updated_at: new Date(),
      });
  }

  res.json(result);
}));

router.post('/introspect', validate(introspectSchema), asyncHandler(async (req: Request, res: Response) => {
  const connector = await ModuleRegistry.getActiveAuthConnector();
  const result = await connector.introspectToken(req.body.token);
  res.json(result);
}));

export default router;
