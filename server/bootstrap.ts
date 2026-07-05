import { Express } from 'express';
import { createApp } from '../app';
import db from '../database';
import { ModuleLoader } from '../platform/module/ModuleLoader';
import { BUILTIN_MODULE_KEYS } from '../platform/registry/moduleCatalog';
import { ModuleRegistry } from '../platform/registry/ModuleRegistry';

const DEFAULT_MODULE_KEYS = [...BUILTIN_MODULE_KEYS] as const;

function assertCatalogContainsRequiredModules(
  descriptors: Array<{ moduleKey: string }>,
  requiredModuleKeys: readonly string[],
): void {
  const loadedKeys = new Set(descriptors.map((descriptor) => descriptor.moduleKey));
  const missing = requiredModuleKeys.filter((moduleKey) => !loadedKeys.has(moduleKey));
  if (missing.length > 0) {
    throw new Error(
      `Module catalog is incomplete. Missing descriptors for: ${missing.join(', ')}`,
    );
  }
}

export interface BootstrapOptions {
  skipMigrations?: boolean;
}

export async function prepareDatabaseEnvironment(
  options: BootstrapOptions = {},
): Promise<void> {
  const descriptors = await ModuleLoader.loadFromPath();
  assertCatalogContainsRequiredModules(descriptors, DEFAULT_MODULE_KEYS);
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
