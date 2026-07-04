import { v4 as uuidv4 } from 'uuid';
import db from '../../database';

export interface AuditEventInput {
  actorRef: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  await db('audit_events').insert({
    id: uuidv4(),
    actor_ref: input.actorRef,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    created_at: new Date(),
  });
}
