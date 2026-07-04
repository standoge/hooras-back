import { v4 as uuidv4 } from 'uuid';
import db from '../../database';
import { encrypt, decrypt } from '../../app/utils/crypto';
import { BadRequestError, NotFoundError } from '../../app/utils/errors';
import { AuthConnectorModule } from '../contracts/auth.contract';
import { StudentDataConnectorModule } from '../contracts/studentData.contract';
import {
  ModuleHealth,
  ModuleManifest,
  ModuleStatus,
  ModuleTestResult,
  ModuleType,
} from '../types';

interface RegisteredModule {
  instance: AuthConnectorModule | StudentDataConnectorModule;
  manifest: ModuleManifest;
}

class ModuleRegistryClass {
  private modules = new Map<string, RegisteredModule>();

  register(module: AuthConnectorModule | StudentDataConnectorModule): void {
    this.modules.set(module.moduleKey, {
      instance: module,
      manifest: module.manifest,
    });
  }

  getAll(): RegisteredModule[] {
    return Array.from(this.modules.values());
  }

  get(moduleKey: string): RegisteredModule | undefined {
    return this.modules.get(moduleKey);
  }

  getManifest(moduleKey: string): ModuleManifest {
    const mod = this.modules.get(moduleKey);
    if (!mod) throw new NotFoundError(`Module ${moduleKey} not found`);
    return mod.manifest;
  }

  async bootstrap(): Promise<void> {
    for (const [key, { manifest }] of this.modules) {
      const existing = await db('installed_modules').where({ module_key: key }).first();
      if (!existing) {
        await db('installed_modules').insert({
          id: uuidv4(),
          module_key: key,
          display_name: manifest.displayName,
          version: manifest.version,
          module_type: manifest.moduleType,
          status: 'enabled',
          enabled: true,
          capabilities: JSON.stringify(manifest.capabilities),
          installed_at: new Date(),
          updated_at: new Date(),
        });
      }
    }
  }

  async listInstalled() {
    const rows = await db('installed_modules').select('*').orderBy('module_key');
    return Promise.all(rows.map((row) => this.mapInstalledModule(row)));
  }

  async getInstalled(moduleKey: string) {
    const row = await db('installed_modules').where({ module_key: moduleKey }).first();
    if (!row) throw new NotFoundError(`Module ${moduleKey} not installed`);
    return this.mapInstalledModule(row);
  }

  private async mapInstalledModule(row: Record<string, unknown>) {
    const mod = this.modules.get(row.module_key as string);
    let health: ModuleHealth | undefined;
    if (mod && row.enabled) {
      try {
        health = await mod.instance.getHealth();
      } catch {
        health = {
          moduleKey: row.module_key as string,
          status: 'unknown',
          checkedAt: new Date().toISOString(),
        };
      }
    }
    return {
      moduleKey: row.module_key,
      displayName: row.display_name,
      version: row.version,
      moduleType: row.module_type,
      status: row.status as ModuleStatus,
      enabled: row.enabled,
      capabilities: typeof row.capabilities === 'string'
        ? JSON.parse(row.capabilities)
        : row.capabilities,
      health,
      installedAt: (row.installed_at as Date)?.toISOString?.() ?? row.installed_at,
      updatedAt: (row.updated_at as Date)?.toISOString?.() ?? row.updated_at,
    };
  }

  async enableModule(moduleKey: string) {
    const mod = this.modules.get(moduleKey);
    if (!mod) throw new NotFoundError(`Module ${moduleKey} not found`);
    await db('installed_modules').where({ module_key: moduleKey }).update({
      enabled: true,
      status: 'enabled',
      updated_at: new Date(),
    });
    return this.getInstalled(moduleKey);
  }

  async disableModule(moduleKey: string) {
    await db('installed_modules').where({ module_key: moduleKey }).update({
      enabled: false,
      status: 'disabled',
      updated_at: new Date(),
    });
    return this.getInstalled(moduleKey);
  }

  async getConfig(moduleKey: string) {
    const row = await db('module_configs').where({ module_key: moduleKey }).first();
    if (!row) {
      return { moduleKey, configured: false, values: {}, secretNames: [] };
    }
    return {
      moduleKey,
      configured: true,
      values: typeof row.values === 'string' ? JSON.parse(row.values) : row.values ?? {},
      secretNames: row.secret_names
        ? typeof row.secret_names === 'string'
          ? JSON.parse(row.secret_names)
          : row.secret_names
        : [],
      updatedAt: (row.updated_at as Date)?.toISOString?.() ?? row.updated_at,
    };
  }

  async configureModule(
    moduleKey: string,
    values: Record<string, unknown> = {},
    secrets: Record<string, string> = {}
  ) {
    const mod = this.modules.get(moduleKey);
    if (!mod) throw new NotFoundError(`Module ${moduleKey} not found`);

    const encryptedSecrets: Record<string, string> = {};
    for (const [key, value] of Object.entries(secrets)) {
      encryptedSecrets[key] = encrypt(value);
    }

    const existing = await db('module_configs').where({ module_key: moduleKey }).first();
    const secretNames = Object.keys(secrets);
    const mergedSecrets = existing?.encrypted_secrets
      ? {
          ...(typeof existing.encrypted_secrets === 'string'
            ? JSON.parse(existing.encrypted_secrets)
            : existing.encrypted_secrets),
          ...encryptedSecrets,
        }
      : encryptedSecrets;

    if (existing) {
      await db('module_configs').where({ module_key: moduleKey }).update({
        values: JSON.stringify({ ...(JSON.parse(existing.values || '{}')), ...values }),
        encrypted_secrets: JSON.stringify(mergedSecrets),
        secret_names: JSON.stringify([...new Set([...secretNames, ...(JSON.parse(existing.secret_names || '[]'))])]),
        updated_at: new Date(),
      });
    } else {
      await db('module_configs').insert({
        id: uuidv4(),
        module_key: moduleKey,
        values: JSON.stringify(values),
        encrypted_secrets: JSON.stringify(encryptedSecrets),
        secret_names: JSON.stringify(secretNames),
        updated_at: new Date(),
      });
    }

    const config = await this.getConfig(moduleKey);
    const decryptedSecrets: Record<string, string> = {};
    const stored = await db('module_configs').where({ module_key: moduleKey }).first();
    const enc = stored?.encrypted_secrets
      ? typeof stored.encrypted_secrets === 'string'
        ? JSON.parse(stored.encrypted_secrets)
        : stored.encrypted_secrets
      : {};
    for (const [k, v] of Object.entries(enc)) {
      decryptedSecrets[k] = decrypt(v as string);
    }
    await mod.instance.configure(config.values as Record<string, unknown>, decryptedSecrets);
    return config;
  }

  async testModule(moduleKey: string): Promise<ModuleTestResult> {
    const mod = this.modules.get(moduleKey);
    if (!mod) throw new NotFoundError(`Module ${moduleKey} not found`);
    return mod.instance.testConnection();
  }

  async getModuleHealth(moduleKey: string): Promise<ModuleHealth> {
    const mod = this.modules.get(moduleKey);
    if (!mod) throw new NotFoundError(`Module ${moduleKey} not found`);
    return mod.instance.getHealth();
  }

  async getActiveAuthConnector(): Promise<AuthConnectorModule> {
    const row = await db('installed_modules')
      .where({ module_type: 'auth_connector', enabled: true })
      .first();
    if (!row) throw new BadRequestError('No auth connector module is enabled');
    const mod = this.modules.get(row.module_key as string);
    if (!mod) throw new BadRequestError('Auth connector module not registered');
    return mod.instance as AuthConnectorModule;
  }

  async getActiveStudentDataConnector(): Promise<StudentDataConnectorModule> {
    const row = await db('installed_modules')
      .where({ module_type: 'student_data_connector', enabled: true })
      .first();
    if (!row) throw new BadRequestError('No student-data connector module is enabled');
    const mod = this.modules.get(row.module_key as string);
    if (!mod) throw new BadRequestError('Student-data connector module not registered');
    return mod.instance as StudentDataConnectorModule;
  }

  async getCapabilities() {
    const modules = await this.listInstalled();
    const providers = await db('provider_connections').select('*');
    return {
      modules: modules.map((m) => ({
        key: m.moduleKey,
        enabled: m.enabled,
        version: m.version,
      })),
      providers: providers.map((p) => ({
        moduleKey: p.module_key,
        providerKey: p.provider_key,
        providerType: p.provider_type,
        status: p.enabled ? (p.last_health_status === 'ok' ? 'connected' : 'configured') : 'disabled',
        capabilities: p.capabilities
          ? typeof p.capabilities === 'string'
            ? JSON.parse(p.capabilities)
            : p.capabilities
          : [],
      })),
    };
  }

  async loadModuleConfigs(): Promise<void> {
    for (const [key, { instance }] of this.modules) {
      const config = await db('module_configs').where({ module_key: key }).first();
      if (config) {
        const values = typeof config.values === 'string' ? JSON.parse(config.values) : config.values ?? {};
        const enc = config.encrypted_secrets
          ? typeof config.encrypted_secrets === 'string'
            ? JSON.parse(config.encrypted_secrets)
            : config.encrypted_secrets
          : {};
        const secrets: Record<string, string> = {};
        for (const [k, v] of Object.entries(enc)) {
          try {
            secrets[k] = decrypt(v as string);
          } catch {
            /* skip invalid */
          }
        }
        await instance.configure(values, secrets);
      }
    }
  }
}

export const ModuleRegistry = new ModuleRegistryClass();
