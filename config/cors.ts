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
    .map((entry) => entry.trim().replace(/\/$/, ''))
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

const UPLOAD_CORS_OPTIONS: Pick<CorsOptions, 'methods' | 'allowedHeaders'> = {
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'X-Requested-With'],
};

export function resolveCorsOptions(config: CorsOriginConfig): CorsOptions {
  if (config.allowAll) {
    return {
      origin: true,
      credentials: true,
      ...UPLOAD_CORS_OPTIONS,
    };
  }

  return {
    origin: config.origins,
    credentials: true,
    ...UPLOAD_CORS_OPTIONS,
  };
}
