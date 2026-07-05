import { beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { bootstrapPlatform } from '../../server/bootstrap';
import { authHeader, login } from '../helpers/auth';

describe('student profile acceptance', () => {
  let app: Express;
  let studentToken: string;

  beforeAll(async () => {
    app = await bootstrapPlatform();
    studentToken = await login(app, 'student1');
  }, 60000);

  it('returns student profile with academic data and eligibility', async () => {
    const res = await request(app)
      .get('/api/v1/me/profile')
      .set(authHeader(studentToken));

    expect(res.status).toBe(200);
    expect(res.body.studentRef).toBe('student:STU-001');
    expect(res.body.academicProfile).toBeDefined();
    expect(res.body.academicProfile.externalStudentId).toBe('STU-001');
    expect(res.body.eligibility).toBeDefined();
    expect(typeof res.body.completedHours).toBe('number');
    expect(typeof res.body.remainingHours).toBe('number');
    expect(Array.isArray(res.body.requiredDocuments)).toBe(true);
  });
});
