import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { parseCorsOrigins, resolveCorsOptions } from '../../config/cors';

describe('parseCorsOrigins', () => {
  it('returns allowAll for *', () => {
    expect(parseCorsOrigins('*')).toEqual({ allowAll: true });
    expect(parseCorsOrigins(' * ')).toEqual({ allowAll: true });
  });

  it('returns a single origin list for one URL', () => {
    expect(parseCorsOrigins('http://localhost:5173')).toEqual({
      allowAll: false,
      origins: ['http://localhost:5173'],
    });
  });

  it('normalizes comma-separated origins', () => {
    expect(parseCorsOrigins(' https://a.com , https://b.com ')).toEqual({
      allowAll: false,
      origins: ['https://a.com', 'https://b.com'],
    });
  });

  it('strips trailing slashes from origins', () => {
    expect(parseCorsOrigins('https://a.com/')).toEqual({
      allowAll: false,
      origins: ['https://a.com'],
    });
    expect(parseCorsOrigins('https://a.com/,https://b.com/')).toEqual({
      allowAll: false,
      origins: ['https://a.com', 'https://b.com'],
    });
  });

  it('throws for empty value', () => {
    expect(() => parseCorsOrigins('')).toThrow('CORS_ORIGINS must be * or at least one URL');
    expect(() => parseCorsOrigins(' , ')).toThrow('CORS_ORIGINS must be * or at least one URL');
  });

  it('throws for invalid URL', () => {
    expect(() => parseCorsOrigins('not-a-url')).toThrow('Invalid CORS origin URL: not-a-url');
  });
});

describe('resolveCorsOptions', () => {
  const uploadOptions = {
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'X-Requested-With'],
  };

  it('reflects any origin when all origins are allowed', () => {
    expect(resolveCorsOptions({ allowAll: true })).toEqual({
      origin: true,
      credentials: true,
      ...uploadOptions,
    });
  });

  it('returns origin list when restricted', () => {
    expect(
      resolveCorsOptions({
        allowAll: false,
        origins: ['http://localhost:5173'],
      })
    ).toEqual({
      origin: ['http://localhost:5173'],
      credentials: true,
      ...uploadOptions,
    });
  });
});

describe('CORS middleware integration', () => {
  const originalCorsOrigins = process.env.CORS_ORIGINS;

  afterEach(() => {
    if (originalCorsOrigins === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = originalCorsOrigins;
    }
    vi.resetModules();
  });

  it('allows any origin on preflight when CORS_ORIGINS is *', async () => {
    process.env.CORS_ORIGINS = '*';
    vi.resetModules();
    const { createApp } = await import('../../app');
    const app = createApp();

    const res = await request(app)
      .options('/health')
      .set('Origin', 'https://cualquier-frontend.com')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.headers['access-control-allow-origin']).toBe('https://cualquier-frontend.com');
  });

  it('allows whitelisted origin on preflight', async () => {
    process.env.CORS_ORIGINS = 'http://localhost:5173';
    vi.resetModules();
    const { createApp } = await import('../../app');
    const app = createApp();

    const res = await request(app)
      .options('/health')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('blocks non-whitelisted origin on preflight', async () => {
    process.env.CORS_ORIGINS = 'http://localhost:5173';
    vi.resetModules();
    const { createApp } = await import('../../app');
    const app = createApp();

    const res = await request(app)
      .options('/health')
      .set('Origin', 'http://evil.com')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
