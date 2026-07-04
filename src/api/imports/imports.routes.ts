import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import db from '../../database';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { validate } from '../../app/middleware/validate';
import { authMiddleware, rbac } from '../../app/middleware/auth';
import { NotFoundError } from '../../app/utils/errors';
import { writeAuditEvent } from '../../app/utils/audit';
import { simulateFirecrawlRun } from '../../integrations/scraper/firecrawl';

const runSchema = z.object({
  startUrls: z.array(z.string().url()),
  query: z.string().optional(),
  maxPages: z.number().min(1).optional(),
});

const router = Router();

function mapImportResult(row: Record<string, unknown>) {
  return {
    id: row.id,
    status: row.status,
    sourceUrl: row.source_url,
    extractedProject: typeof row.extracted_project === 'string'
      ? JSON.parse(row.extracted_project)
      : row.extracted_project,
    extractionConfidence: row.extraction_confidence ? Number(row.extraction_confidence) : undefined,
    duplicateProjectIds: typeof row.duplicate_project_ids === 'string'
      ? JSON.parse(row.duplicate_project_ids)
      : row.duplicate_project_ids,
  };
}

function mapProject(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    organizationName: row.organization_name,
    location: row.location,
    modality: row.modality,
    categories: typeof row.categories === 'string' ? JSON.parse(row.categories) : row.categories,
    status: row.status,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    extractionConfidence: row.extraction_confidence ? Number(row.extraction_confidence) : undefined,
    publicSafe: row.public_safe,
    createdAt: (row.created_at as Date)?.toISOString?.() ?? row.created_at,
  };
}

router.post('/firecrawl/runs', authMiddleware, rbac('coordinator', 'admin'), validate(runSchema), asyncHandler(async (req: Request, res: Response) => {
  const runId = uuidv4();
  await db('import_runs').insert({
    id: runId,
    status: 'queued',
    request: JSON.stringify(req.body),
    created_at: new Date(),
  });
  simulateFirecrawlRun(runId, req.body);
  res.status(202).json({ id: runId, status: 'queued', createdAt: new Date().toISOString() });
}));

router.get('/firecrawl/results', authMiddleware, rbac('coordinator', 'admin'), asyncHandler(async (req: Request, res: Response) => {
  let query = db('import_results').select('*');
  if (req.query.status) query = query.where({ status: req.query.status });
  const rows = await query.orderBy('created_at', 'desc');
  res.json(rows.map(mapImportResult));
}));

router.post('/firecrawl/results/:importResultId/approve', authMiddleware, rbac('coordinator', 'admin'), asyncHandler(async (req: Request, res: Response) => {
  const result = await db('import_results').where({ id: req.params.importResultId }).first();
  if (!result) throw new NotFoundError('Import result not found');
  const extracted = typeof result.extracted_project === 'string'
    ? JSON.parse(result.extracted_project)
    : result.extracted_project;
  const [project] = await db('projects')
    .insert({
      id: uuidv4(),
      title: extracted.title,
      description: extracted.description,
      organization_name: extracted.organizationName,
      location: extracted.location,
      modality: extracted.modality,
      categories: JSON.stringify(extracted.categories ?? []),
      status: 'pending_review',
      source_type: 'scraped',
      source_url: result.source_url,
      extraction_confidence: result.extraction_confidence,
      public_safe: false,
    })
    .returning('*');
  await db('import_results').where({ id: req.params.importResultId }).update({ status: 'approved' });
  await writeAuditEvent({
    actorRef: req.user!.externalUserId,
    action: 'import.approved',
    entityType: 'import_result',
    entityId: result.id as string,
    metadata: { projectId: project.id },
  });
  res.status(201).json(mapProject(project));
}));

router.post('/firecrawl/results/:importResultId/reject', authMiddleware, rbac('coordinator', 'admin'), asyncHandler(async (req: Request, res: Response) => {
  const [row] = await db('import_results')
    .where({ id: req.params.importResultId })
    .update({ status: 'rejected' })
    .returning('*');
  if (!row) throw new NotFoundError('Import result not found');
  res.json(mapImportResult(row));
}));

export default router;
