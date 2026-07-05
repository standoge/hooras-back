import { Router, Request, Response } from 'express';
import db from '../../database';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { authMiddleware } from '../../app/middleware/auth';
import { ForbiddenError, NotFoundError } from '../../app/utils/errors';
import { getStorageProvider } from '../../app/storage/getStorageProvider';

const STAFF_ROLES = ['admin', 'coordinator', 'auditor', 'faculty_supervisor', 'external_supervisor'] as const;

const router = Router();

async function assertCanAccessFile(req: Request, storageRef: string): Promise<void> {
  if (!req.user) throw new ForbiddenError();

  if (req.user.roles.some((role) => STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number]))) {
    return;
  }

  const studentRef = req.user.studentRef;
  if (!studentRef) throw new ForbiddenError();

  const [document, evidence] = await Promise.all([
    db('document_uploads').where({ storage_ref: storageRef, owner_ref: studentRef }).first(),
    db('evidence').where({ storage_ref: storageRef, owner_ref: studentRef }).first(),
  ]);

  if (!document && !evidence) {
    throw new ForbiddenError('You do not have access to this file');
  }
}

router.get(
  /.+/,
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const storageRef = req.path.replace(/^\//, '');
    if (!storageRef) throw new NotFoundError('File not found');

    await assertCanAccessFile(req, storageRef);

    const provider = getStorageProvider();
    const file = await provider.get(storageRef);
    if (!file) throw new NotFoundError('File not found');

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${storageRef.split('/').pop()}"`);
    res.send(file.buffer);
  }),
);

export default router;
