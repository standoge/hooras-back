import type { CorsOptions } from 'cors';
import { z } from 'zod';

export type CorsOriginConfig =
  | { allowAll: true }
  | { allowAll: false; origins: string[] };

const urlSchema = z.string().url();

export function parseCorsOrigins(raw: string): CorsOriginConfig {
  const trimmed = raw.trim();

  if (trimmed === '*') {
    return { allowAll: true };
  }

  const origins = trimmed
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error('CORS_ORIGINS must be * or at least one URL');
  }

  for (const origin of origins) {
    const result = urlSchema.safeParse(origin);
    if (!result.success) {
      throw new Error(`Invalid CORS origin URL: ${origin}`);
    }
  }

  return { allowAll: false, origins };
}

export function resolveCorsOptions(config: CorsOriginConfig): CorsOptions {
  if (config.allowAll) {
    return {};
  }

  return { origin: config.origins };
}
