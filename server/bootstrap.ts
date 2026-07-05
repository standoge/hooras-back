import { Express } from 'express';
import { createApp } from '../app';
import db from '../database';
import { ModuleLoader } from '../platform/module/ModuleLoader';
import { ModuleRegistry } from '../platform/registry/ModuleRegistry';

const DEFAULT_MODULE_KEYS = [
  'dummy-auth-connector',
  'dummy-student-data-connector',
  'notifications',
  'rules',
  'projects',
  'assignments',
  'applications',
  'hours',
  'documents',
  'imports',
  'certificates',
  'student-profile',
  'reports',
] as const;

export interface BootstrapOptions {
  skipMigrations?: boolean;
}

export async function prepareDatabaseEnvironment(
  options: BootstrapOptions = {},
): Promise<void> {
  const descriptors = await ModuleLoader.loadFromPath();
  ModuleRegistry.loadCatalog(descriptors);

  if (!options.skipMigrations) {
    await db.migrate.latest();

    const demoUserCount = await db('demo_users').count('id as count').first();
    if (Number(demoUserCount?.count ?? 0) === 0) {
      await db.seed.run();
    }
  }

  await ModuleRegistry.ensureDefaultModulesInstalled([...DEFAULT_MODULE_KEYS]);
  await ModuleRegistry.loadModuleConfigs();
}

export function createConfiguredApp(): Express {
  const app = createApp();
  ModuleRegistry.initApp(app);
  return app;
}

export async function bootstrapPlatform(options: BootstrapOptions = {}): Promise<Express> {
  await prepareDatabaseEnvironment(options);
  return createConfiguredApp();
}
