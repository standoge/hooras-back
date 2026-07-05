import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('document_requirements', 'description'))) {
    await knex.schema.alterTable('document_requirements', (t) => {
      t.text('description');
      t.boolean('active').notNullable().defaultTo(true);
      t.string('scope').notNullable().defaultTo('global');
      t.uuid('project_id').nullable().references('id').inTable('projects').onDelete('SET NULL');
      t.string('created_by');
    });
  }

  if (!(await knex.schema.hasColumn('document_uploads', 'mime_type'))) {
    await knex.schema.alterTable('document_uploads', (t) => {
      t.string('mime_type');
      t.bigInteger('size_bytes');
      t.string('reviewed_by');
      t.timestamp('reviewed_at');
    });
  }

  if (!(await knex.schema.hasColumn('notifications', 'recipient_student_ref'))) {
    await knex.schema.alterTable('notifications', (t) => {
      t.string('recipient_student_ref');
      t.string('title');
      t.text('body');
      t.timestamp('read_at');
      t.string('channel').notNullable().defaultTo('in_app');
    });
    await knex('notifications')
      .whereNull('recipient_student_ref')
      .update({ recipient_student_ref: knex.ref('recipient') });
  }

  if (!(await knex.schema.hasColumn('projects', 'project_type'))) {
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
  if (await knex.schema.hasColumn('notifications', 'recipient_student_ref')) {
    await knex.schema.alterTable('notifications', (t) => {
      t.dropColumn('recipient_student_ref');
      t.dropColumn('title');
      t.dropColumn('body');
      t.dropColumn('read_at');
      t.dropColumn('channel');
    });
  }
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
