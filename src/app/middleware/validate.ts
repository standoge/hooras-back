import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { BadRequestError } from '../utils/errors';

type ValidationTarget = 'body' | 'query' | 'params';

export const validate = (schema: ZodSchema, target: ValidationTarget = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      throw new BadRequestError('Validation failed', 'VALIDATION_ERROR', result.error.flatten());
    }
    (req as unknown as Record<string, unknown>)[target] = result.data;
    next();
  };
