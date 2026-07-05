import path from 'path';

export function isCompiledRuntime(): boolean {
  return __filename.endsWith('.js');
}

export function resolveModulesRoot(): string {
  return isCompiledRuntime()
    ? path.join(process.cwd(), 'dist', 'modules')
    : path.join(process.cwd(), 'modules');
}
