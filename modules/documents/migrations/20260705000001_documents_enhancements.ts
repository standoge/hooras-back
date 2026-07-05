import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasDescription = await knex.schema.hasColumn('document_requirements', 'description');
  if (!hasDescription) {
    await knex.schema.alterTable('document_requirements', (t) => {
      t.text('description');
      t.boolean('active').notNullable().defaultTo(true);
      t.string('scope').notNullable().defaultTo('global');
      t.uuid('project_id').nullable().references('id').inTable('projects').onDelete('SET NULL');
      t.string('created_by');
    });
  }

  const hasMimeType = await knex.schema.hasColumn('document_uploads', 'mime_type');
  if (!hasMimeType) {
    await knex.schema.alterTable('document_uploads', (t) => {
      t.string('mime_type');
      t.bigInteger('size_bytes');
      t.string('reviewed_by');
      t.timestamp('reviewed_at');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('document_uploads', 'mime_type')) {
    await knex.schema.alterTable('document_uploads', (t) => {
      t.dropColumn('mime_type');
      t.dropColumn('size_bytes');
      t.dropColumn('reviewed_by');
      t.dropColumn('reviewed_at');
    });
  }
  if (await knex.schema.hasColumn('document_requirements', 'description')) {
    await knex.schema.alterTable('document_requirements', (t) => {
      t.dropColumn('description');
      t.dropColumn('active');
      t.dropColumn('scope');
      t.dropColumn('project_id');
      t.dropColumn('created_by');
    });
  }
}
