import { Router, Request, Response } from 'express';
import db from '../../database';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { authMiddleware, rbac } from '../../app/middleware/auth';

const router = Router();

router.get('/', authMiddleware, rbac('admin', 'auditor'), asyncHandler(async (req: Request, res: Response) => {
  let query = db('audit_events').select('*');
  if (req.query.actorRef) query = query.where({ actor_ref: req.query.actorRef });
  if (req.query.entityType) query = query.where({ entity_type: req.query.entityType });
  const rows = await query.orderBy('created_at', 'desc').limit(100);
  res.json(rows.map((row) => ({
    id: row.id,
    actorRef: row.actor_ref,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    createdAt: (row.created_at as Date)?.toISOString?.() ?? row.created_at,
  })));
}));

export default router;
