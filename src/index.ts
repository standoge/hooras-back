import { env } from './config/env';
import { createApp } from './app';
import db from './database';
import { ModuleRegistry } from './platform/registry/ModuleRegistry';
import { dummyAuthConnector } from './connectors/dummy-auth-connector/DummyAuthConnector';
import { dummyStudentDataConnector } from './connectors/dummy-student-data-connector/DummyStudentDataConnector';

async function bootstrap() {
  ModuleRegistry.register(dummyAuthConnector);
  ModuleRegistry.register(dummyStudentDataConnector);

  await db.migrate.latest();

  const demoUserCount = await db('demo_users').count('id as count').first();
  if (Number(demoUserCount?.count ?? 0) === 0) {
    await db.seed.run();
  }

  await ModuleRegistry.bootstrap();
  await ModuleRegistry.loadModuleConfigs();

  const defaultConfigs = [
    {
      moduleKey: 'dummy-auth-connector',
      values: { providerProfile: 'default' },
      secrets: { apiBaseUrl: `${env.BASE_URL}/demo-auth` },
    },
    {
      moduleKey: 'dummy-student-data-connector',
      values: { providerProfile: 'progress_percentage' },
      secrets: { apiBaseUrl: `${env.BASE_URL}/demo-student-data` },
    },
  ];

  for (const cfg of defaultConfigs) {
    const existing = await db('module_configs').where({ module_key: cfg.moduleKey }).first();
    if (!existing) {
      await ModuleRegistry.configureModule(cfg.moduleKey, cfg.values, cfg.secrets);
    }
  }

  const app = createApp();
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
