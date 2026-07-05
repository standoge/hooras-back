import fs from 'fs';
import path from 'path';

export function isCompiledRuntime(): boolean {
  return __filename.endsWith('.js');
}

/**
 * Resolve the repository root in local dev, compiled Node, and Netlify/Lambda (/var/task).
 */
export function resolveProjectRoot(): string {
  const cwd = process.cwd();

  if (fs.existsSync(path.join(cwd, 'dist', 'modules')) || fs.existsSync(path.join(cwd, 'modules'))) {
    return cwd;
  }

  let dir = __dirname;
  for (let depth = 0; depth < 8; depth += 1) {
    if (fs.existsSync(path.join(dir, 'dist', 'modules'))) {
      return dir;
    }
    if (fs.existsSync(path.join(dir, 'modules'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return cwd;
}

export function resolveModulesRoot(): string {
  const root = resolveProjectRoot();
  return isCompiledRuntime()
    ? path.join(root, 'dist', 'modules')
    : path.join(root, 'modules');
}

export function resolveBundledAsset(...segments: string[]): string {
  return path.join(resolveProjectRoot(), ...segments);
}
