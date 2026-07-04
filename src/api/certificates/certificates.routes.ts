import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import db from '../../database';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { validate } from '../../app/middleware/validate';
import { authMiddleware, rbac } from '../../app/middleware/auth';
import { BadRequestError } from '../../app/utils/errors';
import { writeAuditEvent } from '../../app/utils/audit';
import { sendNotification } from '../../integrations/zavu/notifications';
import { getStudentHours } from '../student-profile/studentProfile.service';
import { evaluateRules } from '../rules/rules.service';

const generateSchema = z.object({
  studentRef: z.string(),
  assignmentId: z.string().uuid().optional(),
});

const router = Router();

router.post('/generate', authMiddleware, rbac('coordinator', 'admin'), validate(generateSchema), asyncHandler(async (req: Request, res: Response) => {
  const { studentRef, assignmentId } = req.body;
  const eligibility = await evaluateRules(studentRef);
  if (eligibility.status !== 'eligible') {
    throw new BadRequestError('Student is not eligible for certificate generation');
  }
  const completedHours = await getStudentHours(studentRef);
  if (completedHours < eligibility.requiredHours) {
    throw new BadRequestError(`Student has ${completedHours} approved hours, requires ${eligibility.requiredHours}`);
  }
  const verificationCode = randomBytes(8).toString('hex').toUpperCase();
  const docId = uuidv4();
  await db('document_uploads').insert({
    id: docId,
    document_requirement_id: null,
    owner_ref: studentRef,
    file_name: `certificate-${verificationCode}.pdf`,
    storage_ref: `certificates/${verificationCode}.pdf`,
    assignment_id: assignmentId,
    status: 'approved',
    uploaded_at: new Date(),
  });
  const [cert] = await db('certificates')
    .insert({
      id: uuidv4(),
      student_ref: studentRef,
      assignment_id: assignmentId,
      status: 'generated',
      document_id: docId,
      verification_code: verificationCode,
      generated_at: new Date(),
    })
    .returning('*');
  await writeAuditEvent({
    actorRef: req.user!.externalUserId,
    action: 'certificate.generated',
    entityType: 'certificate',
    entityId: cert.id as string,
  });
  await sendNotification('certificate_generated', studentRef, {
    certificateId: cert.id,
    verificationCode,
  });
  res.status(201).json({
    id: cert.id,
    studentRef: cert.student_ref,
    assignmentId: cert.assignment_id,
    status: cert.status,
    documentId: cert.document_id,
    verificationCode: cert.verification_code,
    generatedAt: (cert.generated_at as Date)?.toISOString?.() ?? cert.generated_at,
  });
}));

export default router;
