import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { isCompiledRuntime } from '../../config/runtime';
import { BUILTIN_MODULE_DESCRIPTORS } from '../registry/moduleCatalog';
import { PlatformModuleDescriptor } from './PlatformModule';

function isValidDescriptor(descriptor: PlatformModuleDescriptor | undefined): descriptor is PlatformModuleDescriptor {
  return Boolean(descriptor?.moduleKey && descriptor?.instance && descriptor?.manifest);
}

function mergeDescriptors(
  primary: PlatformModuleDescriptor[],
  extra: PlatformModuleDescriptor[],
): PlatformModuleDescriptor[] {
  const merged = new Map<string, PlatformModuleDescriptor>();
  for (const descriptor of primary) {
    merged.set(descriptor.moduleKey, descriptor);
  }
  for (const descriptor of extra) {
    merged.set(descriptor.moduleKey, descriptor);
  }
  return Array.from(merged.values()).sort((a, b) => a.moduleKey.localeCompare(b.moduleKey));
}

export class ModuleLoader {
  /**
   * Load built-in module descriptors (always available, including in serverless bundles).
   */
  static loadBuiltinCatalog(): PlatformModuleDescriptor[] {
    return [...BUILTIN_MODULE_DESCRIPTORS];
  }

  /**
   * Discover optional module descriptors from a directory.
   * Each subdirectory with an index.ts/js exporting `default` as PlatformModuleDescriptor is loaded.
   */
  static async loadFromFilesystem(modulesDir: string): Promise<PlatformModuleDescriptor[]> {
    if (!fs.existsSync(modulesDir)) {
      return [];
    }

    const extension = isCompiledRuntime() ? 'js' : 'ts';
    const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
    const descriptors: PlatformModuleDescriptor[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const indexPath = path.join(modulesDir, entry.name, `index.${extension}`);
      if (!fs.existsSync(indexPath)) continue;

      try {
        const loaded = isCompiledRuntime()
          ? require(indexPath)
          : await import(pathToFileURL(indexPath).href);
        const descriptor = (loaded.default ?? loaded.module) as PlatformModuleDescriptor;
        if (!isValidDescriptor(descriptor)) {
          console.warn(`[ModuleLoader] Skipping ${entry.name}: invalid descriptor export`);
          continue;
        }
        descriptors.push(descriptor);
      } catch (err) {
        console.error(`[ModuleLoader] Failed to load module ${entry.name}:`, err);
      }
    }

    return descriptors.sort((a, b) => a.moduleKey.localeCompare(b.moduleKey));
  }

  /**
   * Built-in catalog first; optional filesystem modules override by moduleKey.
   */
  static async loadFromPath(modulesDir?: string): Promise<PlatformModuleDescriptor[]> {
    const builtin = this.loadBuiltinCatalog();
    if (!modulesDir) {
      return builtin;
    }

    const discovered = await this.loadFromFilesystem(modulesDir);
    return mergeDescriptors(builtin, discovered);
  }

  static async discoverAndRegister(
    register: (descriptor: PlatformModuleDescriptor) => void,
    modulesDir?: string
  ): Promise<PlatformModuleDescriptor[]> {
    const descriptors = await this.loadFromPath(modulesDir);
    for (const descriptor of descriptors) {
      register(descriptor);
    }
    return descriptors;
  }
}
