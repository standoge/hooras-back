import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('instance_settings', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('college_name').notNullable();
    t.jsonb('settings').defaultTo('{}');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('installed_modules', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('module_key').notNullable().unique();
    t.string('display_name').notNullable();
    t.string('version').notNullable();
    t.string('module_type').notNullable();
    t.string('status').notNullable().defaultTo('installed');
    t.boolean('enabled').notNullable().defaultTo(false);
    t.jsonb('capabilities').defaultTo('[]');
    t.timestamp('installed_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('module_configs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('module_key').notNullable().unique().references('module_key').inTable('installed_modules');
    t.jsonb('values').defaultTo('{}');
    t.text('encrypted_secrets');
    t.jsonb('secret_names').defaultTo('[]');
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('provider_connections', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('module_key').notNullable();
    t.string('provider_key').notNullable();
    t.string('provider_type').notNullable();
    t.string('base_url').notNullable();
    t.boolean('enabled').notNullable().defaultTo(true);
    t.string('auth_method').notNullable().defaultTo('none');
    t.text('encrypted_secret');
    t.jsonb('capabilities').defaultTo('[]');
    t.jsonb('field_mappings').defaultTo('{}');
    t.string('last_health_status').defaultTo('unknown');
    t.timestamps(true, true);
    t.unique(['module_key', 'provider_key']);
  });

  await knex.schema.createTable('external_user_refs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('external_user_id').notNullable();
    t.string('module_key').notNullable();
    t.string('provider_key').notNullable();
    t.string('display_name');
    t.string('email');
    t.jsonb('roles').defaultTo('[]');
    t.string('student_ref');
    t.timestamp('last_seen_at').defaultTo(knex.fn.now());
    t.timestamps(true, true);
    t.unique(['external_user_id', 'provider_key']);
  });

  await knex.schema.createTable('student_refs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('student_ref').notNullable().unique();
    t.string('external_student_id').notNullable();
    t.string('module_key').notNullable();
    t.string('provider_key').notNullable();
    t.jsonb('cached_profile');
    t.timestamp('profile_cached_at');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('requirement_rules', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name').notNullable();
    t.jsonb('scope').defaultTo('{}');
    t.decimal('required_hours', 10, 2).notNullable();
    t.jsonb('category_hours').defaultTo('{}');
    t.decimal('minimum_progress_percentage', 5, 2);
    t.jsonb('required_academic_statuses').defaultTo('[]');
    t.jsonb('required_course_codes').defaultTo('[]');
    t.jsonb('calendar_duration');
    t.boolean('active').defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('requirement_evaluations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('student_ref').notNullable();
    t.string('status').notNullable();
    t.decimal('required_hours', 10, 2);
    t.jsonb('result').notNullable();
    t.timestamp('evaluated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('projects', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('title').notNullable();
    t.text('description').notNullable();
    t.string('organization_name').notNullable();
    t.string('location');
    t.string('modality');
    t.jsonb('categories').defaultTo('[]');
    t.integer('capacity');
    t.date('starts_at');
    t.date('ends_at');
    t.date('application_deadline');
    t.boolean('public_safe').defaultTo(false);
    t.string('status').notNullable().defaultTo('draft');
    t.string('source_type').notNullable().defaultTo('college_created');
    t.string('source_url');
    t.decimal('extraction_confidence', 5, 2);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('import_runs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('status').notNullable().defaultTo('queued');
    t.jsonb('request').defaultTo('{}');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('completed_at');
  });

  await knex.schema.createTable('import_results', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('run_id').references('id').inTable('import_runs');
    t.string('status').notNullable().defaultTo('pending_review');
    t.string('source_url').notNullable();
    t.jsonb('extracted_project').notNullable();
    t.decimal('extraction_confidence', 5, 2);
    t.jsonb('duplicate_project_ids').defaultTo('[]');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('project_applications', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('project_id').notNullable().references('id').inTable('projects');
    t.string('student_ref').notNullable();
    t.string('status').notNullable().defaultTo('submitted');
    t.text('motivation');
    t.text('rejection_reason');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('assignments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('project_id').notNullable().references('id').inTable('projects');
    t.string('student_ref').notNullable();
    t.string('supervisor_ref');
    t.string('status').notNullable().defaultTo('active');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('evidence', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('owner_ref').notNullable();
    t.string('file_name').notNullable();
    t.string('storage_ref').notNullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('hour_logs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('assignment_id').notNullable().references('id').inTable('assignments');
    t.date('date').notNullable();
    t.string('start_time');
    t.string('end_time');
    t.decimal('duration_hours', 10, 2).notNullable();
    t.string('category').notNullable();
    t.text('description').notNullable();
    t.jsonb('evidence_ids').defaultTo('[]');
    t.string('status').notNullable().defaultTo('pending');
    t.text('rejection_reason');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('document_requirements', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('key').notNullable().unique();
    t.string('label').notNullable();
    t.boolean('required').notNullable().defaultTo(true);
    t.jsonb('applies_to').defaultTo('{}');
    t.jsonb('allowed_file_types').defaultTo('[]');
    t.integer('max_file_size_mb');
    t.boolean('requires_approval').defaultTo(true);
    t.string('template_id');
  });

  await knex.schema.createTable('document_uploads', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('document_requirement_id').references('id').inTable('document_requirements');
    t.string('owner_ref').notNullable();
    t.string('file_name').notNullable();
    t.string('storage_ref').notNullable();
    t.uuid('assignment_id').references('id').inTable('assignments');
    t.string('status').notNullable().defaultTo('pending');
    t.text('rejection_reason');
    t.timestamp('uploaded_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('certificates', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('student_ref').notNullable();
    t.uuid('assignment_id').references('id').inTable('assignments');
    t.string('status').notNullable().defaultTo('generated');
    t.uuid('document_id').references('id').inTable('document_uploads');
    t.string('verification_code').notNullable().unique();
    t.timestamp('generated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('notifications', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('provider_key').notNullable();
    t.string('event_type').notNullable();
    t.string('recipient').notNullable();
    t.string('status').notNullable().defaultTo('queued');
    t.jsonb('payload').defaultTo('{}');
    t.string('external_message_id');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('audit_events', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('actor_ref').notNullable();
    t.string('action').notNullable();
    t.string('entity_type').notNullable();
    t.string('entity_id').notNullable();
    t.jsonb('metadata');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('demo_users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('username').notNullable().unique();
    t.string('password_hash').notNullable();
    t.string('external_user_id').notNullable().unique();
    t.string('external_student_id');
    t.string('display_name');
    t.string('email');
    t.jsonb('roles').defaultTo('[]');
    t.string('provider_profile').defaultTo('default');
  });

  await knex.schema.createTable('demo_students', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('external_student_id').notNullable();
    t.string('display_name').notNullable();
    t.string('email');
    t.string('provider_profile').notNullable().defaultTo('progress_percentage');
    t.jsonb('raw').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  const tables = [
    'demo_students', 'demo_users', 'audit_events', 'notifications', 'certificates',
    'document_uploads', 'document_requirements', 'hour_logs', 'evidence',
    'assignments', 'project_applications', 'import_results', 'import_runs',
    'projects', 'requirement_evaluations', 'requirement_rules', 'student_refs',
    'external_user_refs', 'provider_connections', 'module_configs', 'installed_modules',
    'instance_settings',
  ];
  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
}
