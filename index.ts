import { env } from './config/env';
import { bootstrapPlatform } from './server/bootstrap';

bootstrapPlatform()
  .then((app) => {
    app.listen(env.PORT, () => {
      console.log(`Social Hours Platform API running on http://localhost:${env.PORT}`);
      console.log(`Swagger UI: http://localhost:${env.PORT}/docs`);
      console.log(`Demo auth: POST http://localhost:${env.PORT}/api/v1/auth/login`);
      console.log(`  username: student1 / password: demo123`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
