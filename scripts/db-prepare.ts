import db from '../database';
import { prepareDatabaseEnvironment } from '../server/bootstrap';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not set — skipping database preparation');
    return;
  }

  await prepareDatabaseEnvironment({ skipMigrations: false });
  console.log('Database prepared successfully');
}

main()
  .catch((err) => {
    console.error('Database preparation failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
  });
