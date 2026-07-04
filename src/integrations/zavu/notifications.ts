import { v4 as uuidv4 } from 'uuid';
import db from '../../database';

export type NotificationEvent =
  | 'application_submitted'
  | 'application_approved'
  | 'application_rejected'
  | 'missing_document'
  | 'document_approved'
  | 'document_rejected'
  | 'hours_approved'
  | 'hours_rejected'
  | 'project_deadline_approaching'
  | 'final_report_required'
  | 'certificate_generated';

export async function sendNotification(
  eventType: NotificationEvent,
  recipient: string,
  payload: Record<string, unknown> = {}
): Promise<string> {
  const messageId = uuidv4();
  await db('notifications').insert({
    id: uuidv4(),
    provider_key: 'zavu',
    event_type: eventType,
    recipient,
    status: 'sent',
    payload: JSON.stringify({ ...payload, messageId }),
    external_message_id: messageId,
    created_at: new Date(),
  });
  console.log(`[ZAVU stub] ${eventType} -> ${recipient}`);
  return messageId;
}
