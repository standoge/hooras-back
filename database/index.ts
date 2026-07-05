import knex, { Knex } from 'knex';
import path from 'path';
import { env } from '../config/env';

const config: Knex.Config = {
  client: 'pg',
  connection: env.DATABASE_URL,
  pool: { min: 2, max: 10 },
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    extension: 'ts',
  },
  seeds: {
    directory: path.join(__dirname, 'seeds'),
    extension: 'ts',
  },
};

export const db = knex(config);

export default db;
