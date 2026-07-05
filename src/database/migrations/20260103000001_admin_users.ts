import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('admin_users'))) {
    await knex.schema.createTable('admin_users', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.string('username').notNullable().unique();
      t.string('password_hash').notNullable();
      t.string('display_name');
      t.string('email');
      t.jsonb('roles').defaultTo('[]');
      t.boolean('active').notNullable().defaultTo(true);
      t.timestamps(true, true);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('admin_users');
}
