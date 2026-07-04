import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { errorHandler } from './app/middleware/errorHandler';

import healthRoutes from './api/health/health.routes';
import modulesRoutes from './api/modules/modules.routes';
import providerConnectionsRoutes from './api/provider-connections/providerConnections.routes';
import authRoutes from './api/auth/auth.routes';
import studentDataRoutes from './api/student-data/studentData.routes';
import meRoutes from './api/me/me.routes';
import rulesRoutes from './api/rules/rules.routes';
import projectsRoutes from './api/projects/projects.routes';
import { projectApplicationsRouter } from './api/projects/projectApplications.routes';
import importsRoutes from './api/imports/imports.routes';
import applicationsRoutes from './api/applications/applications.routes';
import assignmentsRoutes from './api/assignments/assignments.routes';
import hourLogsRoutes from './api/hour-logs/hourLogs.routes';
import documentsRoutes from './api/documents/documents.routes';
import certificatesRoutes from './api/certificates/certificates.routes';
import reportsRoutes from './api/reports/reports.routes';
import auditRoutes from './api/audit/audit.routes';
import webhooksRoutes from './api/webhooks/webhooks.routes';
import demoAuthRoutes from './demo/demo-auth/routes';
import demoStudentDataRoutes from './demo/demo-student-data/routes';
import { authMiddleware } from './app/middleware/auth';

export function createApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());

  const openapiPath = path.join(process.cwd(), 'openapi.yml');
  try {
    const spec = parseYaml(readFileSync(openapiPath, 'utf8'));
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
  } catch {
    console.warn('Could not load openapi.yml for Swagger UI');
  }

  app.use(healthRoutes);
  app.use('/demo-auth', demoAuthRoutes);
  app.use('/demo-student-data', demoStudentDataRoutes);

  app.use('/api/v1/modules', modulesRoutes);
  app.use('/api/v1/provider-connections', providerConnectionsRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/student-data', studentDataRoutes);
  app.use('/api/v1/me', meRoutes);
  app.use('/api/v1/rules', rulesRoutes);
  app.use('/api/v1/projects', projectsRoutes);
  app.use('/api/v1/projects/:projectId/applications', projectApplicationsRouter);
  app.use('/api/v1/imports', importsRoutes);
  app.use('/api/v1/applications', applicationsRoutes);
  app.use('/api/v1/assignments', assignmentsRoutes);
  app.use('/api/v1/hour-logs', hourLogsRoutes);
  app.use('/api/v1', documentsRoutes);
  app.use('/api/v1/certificates', certificatesRoutes);
  app.use('/api/v1/reports', reportsRoutes);
  app.use('/api/v1/audit-log', auditRoutes);
  app.use('/api/v1/webhooks', webhooksRoutes);

  app.get('/api/v1/capabilities', authMiddleware, async (_req, res, next) => {
    try {
      const { ModuleRegistry } = await import('./platform/registry/ModuleRegistry');
      const capabilities = await ModuleRegistry.getCapabilities();
      res.json(capabilities);
    } catch (e) {
      next(e);
    }
  });

  app.use(errorHandler);
  return app;
}
