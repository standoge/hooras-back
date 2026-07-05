import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { isCompiledRuntime, resolveModulesRoot } from '../../config/runtime';
import { PlatformModuleDescriptor } from './PlatformModule';

export class ModuleLoader {
  /**
   * Discover module descriptors from a directory.
   * Each subdirectory with an index.ts/js exporting `default` as PlatformModuleDescriptor is loaded.
   */
  static async loadFromPath(modulesDir?: string): Promise<PlatformModuleDescriptor[]> {
    const resolvedDir = modulesDir ?? resolveModulesRoot();
    if (!fs.existsSync(resolvedDir)) {
      return [];
    }

    const extension = isCompiledRuntime() ? 'js' : 'ts';
    const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
    const descriptors: PlatformModuleDescriptor[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const indexPath = path.join(resolvedDir, entry.name, `index.${extension}`);
      if (!fs.existsSync(indexPath)) continue;

      try {
        const loaded = isCompiledRuntime()
          ? require(indexPath)
          : await import(pathToFileURL(indexPath).href);
        const descriptor = (loaded.default ?? loaded.module) as PlatformModuleDescriptor;
        if (!descriptor?.moduleKey || !descriptor?.instance || !descriptor?.manifest) {
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
