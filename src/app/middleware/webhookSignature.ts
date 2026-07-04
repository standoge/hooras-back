import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { UnauthorizedError } from '../utils/errors';

export const webhookSignature = (req: Request, _res: Response, next: NextFunction) => {
  const signature = req.headers['x-webhook-signature'] as string;
  if (!signature) return next(new UnauthorizedError('Missing webhook signature'));

  const body = JSON.stringify(req.body);
  const expected = createHmac('sha256', env.WEBHOOK_SECRET).update(body).digest('hex');

  try {
    const valid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) return next(new UnauthorizedError('Invalid webhook signature'));
  } catch {
    return next(new UnauthorizedError('Invalid webhook signature'));
  }
  next();
};

export function signWebhookPayload(payload: unknown): string {
  return createHmac('sha256', env.WEBHOOK_SECRET).update(JSON.stringify(payload)).digest('hex');
}
