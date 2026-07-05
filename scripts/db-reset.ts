import db from '../database';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exitCode = 1;
    return;
  }

  console.log('Rolling back all migrations...');
  await db.migrate.rollback(undefined, true);

  console.log('Running migrations...');
  await db.migrate.latest();

  console.log('Running seeds...');
  await db.seed.run();

  console.log('Database reset complete');
}

main()
  .catch((err) => {
    console.error('Database reset failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
  });
