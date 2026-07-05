import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { validate } from '../../app/middleware/validate';
import { authMiddleware, rbac } from '../../app/middleware/auth';
import { ModuleRegistry } from '../../platform/registry/ModuleRegistry';
import { ModuleLifecycleService } from '../../platform/module/ModuleLifecycleService';
import { param } from '../../app/utils/params';

const configSchema = z.object({
  values: z.record(z.unknown()).optional(),
  secrets: z.record(z.string()).optional(),
});

const featuresSchema = z.object({
  features: z.array(z.object({
    featureKey: z.string(),
    enabled: z.boolean(),
  })),
});

const router = Router();

router.get('/available', authMiddleware, rbac('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const modules = await ModuleLifecycleService.listAvailable();
  res.json(modules);
}));

router.get('/', authMiddleware, rbac('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const modules = await ModuleRegistry.listInstalled();
  res.json(modules);
}));

router.get('/:moduleKey', authMiddleware, rbac('admin'), asyncHandler(async (req: Request, res: Response) => {
  const mod = await ModuleRegistry.getInstalled(param(req.params.moduleKey));
  res.json(mod);
}));

router.get('/:moduleKey/manifest', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const manifest = ModuleRegistry.getManifest(param(req.params.moduleKey));
  res.json(manifest);
}));

router.post('/:moduleKey/install', authMiddleware, rbac('admin'), asyncHandler(async (req: Request, res: Response) => {
  const mod = await ModuleLifecycleService.install(param(req.params.moduleKey));
  res.status(201).json(mod);
}));

router.post('/:moduleKey/uninstall', authMiddleware, rbac('admin'), asyncHandler(async (req: Request, res: Response) => {
  const result = await ModuleLifecycleService.uninstall(param(req.params.moduleKey));
  res.json(result);
}));

router.post('/:moduleKey/enable', authMiddleware, rbac('admin'), asyncHandler(async (req: Request, res: Response) => {
  const mod = await ModuleLifecycleService.enable(param(req.params.moduleKey));
  res.json(mod);
}));

router.post('/:moduleKey/disable', authMiddleware, rbac('admin'), asyncHandler(async (req: Request, res: Response) => {
  const mod = await ModuleLifecycleService.disable(param(req.params.moduleKey));
  res.json(mod);
}));

router.get('/:moduleKey/config', authMiddleware, rbac('admin'), asyncHandler(async (req: Request, res: Response) => {
  const config = await ModuleRegistry.getConfig(param(req.params.moduleKey));
  res.json(config);
}));

router.put('/:moduleKey/config', authMiddleware, rbac('admin'), validate(configSchema), asyncHandler(async (req: Request, res: Response) => {
  const { values, secrets } = req.body;
  const config = await ModuleRegistry.configureModule(param(req.params.moduleKey), values, secrets);
  res.json(config);
}));

router.get('/:moduleKey/features', authMiddleware, rbac('admin'), asyncHandler(async (req: Request, res: Response) => {
  const features = await ModuleLifecycleService.listFeatures(param(req.params.moduleKey));
  res.json(features);
}));

router.put('/:moduleKey/features', authMiddleware, rbac('admin'), validate(featuresSchema), asyncHandler(async (req: Request, res: Response) => {
  const features = await ModuleLifecycleService.setFeatures(
    param(req.params.moduleKey),
    req.body.features
  );
  res.json(features);
}));

router.post('/:moduleKey/test', authMiddleware, rbac('admin'), asyncHandler(async (req: Request, res: Response) => {
  const result = await ModuleRegistry.testModule(param(req.params.moduleKey));
  res.json(result);
}));

router.get('/:moduleKey/health', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const health = await ModuleRegistry.getModuleHealth(param(req.params.moduleKey));
  res.json(health);
}));

export default router;
