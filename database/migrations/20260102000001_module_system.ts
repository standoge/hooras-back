import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('installed_modules', (t) => {
    t.string('install_state').notNullable().defaultTo('installed');
    t.jsonb('dependencies').defaultTo('[]');
  });

  await knex.schema.createTable('module_features', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('module_key').notNullable().references('module_key').inTable('installed_modules').onDelete('CASCADE');
    t.string('feature_key').notNullable();
    t.boolean('enabled').notNullable().defaultTo(true);
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.unique(['module_key', 'feature_key']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('module_features');
  await knex.schema.alterTable('installed_modules', (t) => {
    t.dropColumn('install_state');
    t.dropColumn('dependencies');
  });
}
