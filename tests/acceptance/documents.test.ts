import { beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { bootstrapPlatform } from '../../server/bootstrap';
import { authHeader, login } from '../helpers/auth';
import db from '../../database';

describe('documents acceptance', () => {
  let app: Express;
  let adminToken: string;
  let studentToken: string;
  let requirementId: string;

  beforeAll(async () => {
    // Force-enable documents module to ensure isolated test environment
    await db('installed_modules')
      .where({ module_key: 'documents' })
      .update({ enabled: true });

    app = await bootstrapPlatform();

    adminToken = await login(app, 'admin1');
    studentToken = await login(app, 'student1');
  }, 60000);

  it('admin creates document requirement and student sees it', async () => {
    const createRes = await request(app)
      .post('/api/v1/document-requirements')
      .set(authHeader(adminToken))
      .send({
        key: `test-req-${Date.now()}`,
        label: 'Test ID Document',
        description: 'Upload national ID',
        required: true,
        allowedFileTypes: ['application/pdf', 'image/jpeg'],
        maxFileSizeMb: 5,
      });
    expect(createRes.status).toBe(201);
    requirementId = createRes.body.id;

    const listRes = await request(app)
      .get('/api/v1/me/document-requirements')
      .set(authHeader(studentToken));
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((item: { requirement: { id: string } }) => item.requirement.id === requirementId)).toBe(true);
  });

  it('student uploads allowed MIME type', async () => {
    const uploadRes = await request(app)
      .post(`/api/v1/me/document-requirements/${requirementId}/upload`)
      .set(authHeader(studentToken))
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'id.pdf', contentType: 'application/pdf' });
    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.status).toBe('pending');
  });

  it('cannot create active requirement with duplicate key', async () => {
    const key = `dup-req-${Date.now()}`;
    // Create first one
    const res1 = await request(app)
      .post('/api/v1/document-requirements')
      .set(authHeader(adminToken))
      .send({
        key,
        label: 'First Requirement',
        required: true,
        allowedFileTypes: ['application/pdf'],
      });
    expect(res1.status).toBe(201);

    // Try to create second with same key
    const res2 = await request(app)
      .post('/api/v1/document-requirements')
      .set(authHeader(adminToken))
      .send({
        key,
        label: 'Second Requirement',
        required: true,
        allowedFileTypes: ['application/pdf'],
      });
    expect(res2.status).toBe(400);
    expect(res2.body.error.message).toContain('already exists');
  });

  it('deletes requirement physically if it has no uploads', async () => {
    const key = `delete-req-${Date.now()}`;
    const createRes = await request(app)
      .post('/api/v1/document-requirements')
      .set(authHeader(adminToken))
      .send({
        key,
        label: 'To Be Deleted',
        required: true,
        allowedFileTypes: ['application/pdf'],
      });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;

    // Delete it
    const deleteRes = await request(app)
      .delete(`/api/v1/document-requirements/${id}`)
      .set(authHeader(adminToken));
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.deleted).toBe(true);

    // Verify it is physically gone by checking if we can create it again with the same key
    const recreateRes = await request(app)
      .post('/api/v1/document-requirements')
      .set(authHeader(adminToken))
      .send({
        key,
        label: 'Recreated Requirement',
        required: true,
        allowedFileTypes: ['application/pdf'],
      });
    expect(recreateRes.status).toBe(201);
  });

  it('deactivates requirement if it has uploads, freeing the key for new active ones', async () => {
    const key = `soft-delete-req-${Date.now()}`;
    const createRes = await request(app)
      .post('/api/v1/document-requirements')
      .set(authHeader(adminToken))
      .send({
        key,
        label: 'Soft Deleted Requirement',
        required: true,
        allowedFileTypes: ['application/pdf'],
      });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;

    // Student uploads a document
    const uploadRes = await request(app)
      .post(`/api/v1/me/document-requirements/${id}/upload`)
      .set(authHeader(studentToken))
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'file.pdf', contentType: 'application/pdf' });
    expect(uploadRes.status).toBe(201);

    // Delete requirement (should soft-delete/deactivate)
    const deleteRes = await request(app)
      .delete(`/api/v1/document-requirements/${id}`)
      .set(authHeader(adminToken));
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.active).toBe(false);

    // Try to create another requirement with the same key (should succeed because the first one is deactivated)
    const recreateRes = await request(app)
      .post('/api/v1/document-requirements')
      .set(authHeader(adminToken))
      .send({
        key,
        label: 'New Active Requirement with same key',
        required: true,
        allowedFileTypes: ['application/pdf'],
      });
    expect(recreateRes.status).toBe(201);
  });
});
