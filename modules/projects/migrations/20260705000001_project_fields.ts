import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasProjectType = await knex.schema.hasColumn('projects', 'project_type');
  if (!hasProjectType) {
    await knex.schema.alterTable('projects', (t) => {
      t.string('project_type');
      t.integer('offered_hours');
      t.jsonb('company_links').defaultTo('[]');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('projects', 'project_type')) {
    await knex.schema.alterTable('projects', (t) => {
      t.dropColumn('project_type');
      t.dropColumn('offered_hours');
      t.dropColumn('company_links');
    });
  }
}
