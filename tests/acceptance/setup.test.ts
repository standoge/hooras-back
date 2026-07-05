import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { bootstrapPlatform } from '../../server/bootstrap';

describe('setup acceptance', () => {
  let app: Express;

  beforeAll(async () => {
    app = await bootstrapPlatform();
  }, 60000);

  it('returns setup status with completed flag', async () => {
    const res = await request(app).get('/api/v1/setup/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('completed');
    expect(res.body).toHaveProperty('steps');
    expect(res.body).toHaveProperty('missingRequirements');
  });

  it('returns health with setupCompleted', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('setupCompleted');
    expect(res.body).toHaveProperty('db');
  });

  it('blocks setup mutations after completion', async () => {
    const res = await request(app)
      .put('/api/v1/setup/instance')
      .send({ collegeName: 'Should Fail' });
    expect(res.status).toBe(410);
  });

  it('lists setup modules catalog when setup is open or returns 410 when closed', async () => {
    const status = await request(app).get('/api/v1/setup/status');
    const res = await request(app).get('/api/v1/setup/modules');
    if (status.body.completed) {
      expect(res.status).toBe(410);
    } else {
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    }
  });
});
