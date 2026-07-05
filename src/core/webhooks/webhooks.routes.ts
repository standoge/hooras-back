import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { webhookSignature } from '../../app/middleware/webhookSignature';
import { getService } from '../../platform/module/ServiceRegistry';
import { STUDENT_PROFILE_V1, StudentProfileServiceV1 } from '../../platform/contracts/services';
import db from '../../database';

const router = Router();

router.post('/student-data/updated', webhookSignature, asyncHandler(async (req: Request, res: Response) => {
  const { externalStudentId } = req.body;
  if (externalStudentId) {
    const profileService = getService<StudentProfileServiceV1>(STUDENT_PROFILE_V1);
    await profileService.invalidateCache(externalStudentId);
  }
  res.status(202).json({ accepted: true });
}));

router.post('/notifications/status', webhookSignature, asyncHandler(async (req: Request, res: Response) => {
  const { messageId, status } = req.body;
  if (messageId) {
    await db('notifications')
      .where({ external_message_id: messageId })
      .update({ status });
  }
  res.status(202).json({ accepted: true });
}));

router.post('/workflows/project-posted', webhookSignature, asyncHandler(async (_req: Request, res: Response) => {
  res.status(202).json({ accepted: true });
}));

router.post('/scraper/crawl-completed', webhookSignature, asyncHandler(async (_req: Request, res: Response) => {
  res.status(202).json({ accepted: true });
}));

export default router;
