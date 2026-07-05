import path from 'path';
import { isCompiledRuntime } from '../../config/runtime';
import db from '../../database';

export interface ModuleMigrationConfig {
  directory: string;
  tableName: string;
}

export function moduleMigrationConfig(moduleKey: string, migrationsDir: string): ModuleMigrationConfig {
  return {
    directory: migrationsDir,
    tableName: `knex_migrations_${moduleKey.replace(/-/g, '_')}`,
  };
}

export function resolveModuleMigrationsDir(moduleKey: string): string {
  const modulesRoot = isCompiledRuntime()
    ? path.join(process.cwd(), 'dist', 'modules')
    : path.join(process.cwd(), 'modules');
  return path.join(modulesRoot, moduleKey, 'migrations');
}

export async function runModuleMigrations(config: ModuleMigrationConfig): Promise<void> {
  await db.migrate.latest({
    directory: config.directory,
    tableName: config.tableName,
    loadExtensions: ['.ts', '.js'],
  });
}

export async function rollbackModuleMigrations(config: ModuleMigrationConfig): Promise<void> {
  await db.migrate.rollback(
    {
      directory: config.directory,
      tableName: config.tableName,
      loadExtensions: ['.ts', '.js'],
    },
    true
  );
}
