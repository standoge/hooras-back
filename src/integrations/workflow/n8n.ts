import { env } from '../../config/env';

export interface PublicProjectPayload {
  id: string;
  title: string;
  description: string;
  organizationName: string;
  location?: string;
  modality?: string;
  categories: string[];
  applicationDeadline?: string;
}

export async function triggerProjectPostedWorkflow(project: PublicProjectPayload): Promise<void> {
  const payload = {
    event: 'project.published',
    project: {
      id: project.id,
      title: project.title,
      description: project.description,
      organizationName: project.organizationName,
      location: project.location,
      modality: project.modality,
      categories: project.categories,
      applicationDeadline: project.applicationDeadline,
    },
    timestamp: new Date().toISOString(),
  };

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn('[n8n stub] Failed to call webhook:', (e as Error).message);
    }
  } else {
    console.log('[n8n stub] Project published workflow triggered:', project.title);
  }
}
