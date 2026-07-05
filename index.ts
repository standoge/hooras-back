import { env } from './config/env';
import { createApp } from './app';
import db from './database';
import { ModuleLoader } from './platform/module/ModuleLoader';
import { ModuleRegistry } from './platform/registry/ModuleRegistry';

async function bootstrap() {
  await db.migrate.latest();

  const descriptors = await ModuleLoader.loadFromPath();
  ModuleRegistry.loadCatalog(descriptors);

  const demoUserCount = await db('demo_users').count('id as count').first();
  if (Number(demoUserCount?.count ?? 0) === 0) {
    await db.seed.run();
  }

  await ModuleRegistry.ensureDefaultModulesInstalled([
    'dummy-auth-connector',
    'dummy-student-data-connector',
    'notifications',
    'rules',
    'projects',
    'assignments',
    'applications',
    'hours',
    'documents',
    'imports',
    'certificates',
    'student-profile',
    'reports',
  ]);

  await ModuleRegistry.loadModuleConfigs();

  const app = createApp();
  ModuleRegistry.initApp(app);

  app.listen(env.PORT, () => {
    console.log(`Social Hours Platform API running on http://localhost:${env.PORT}`);
    console.log(`Swagger UI: http://localhost:${env.PORT}/docs`);
    console.log(`Demo auth: POST http://localhost:${env.PORT}/api/v1/auth/login`);
    console.log(`  username: student1 / password: demo123`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
