import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const duplicates = await knex('assignments')
    .select('student_ref')
    .whereIn('status', ['active', 'suspended'])
    .groupBy('student_ref')
    .havingRaw('count(*) > 1');

  for (const row of duplicates) {
    const studentRef = row.student_ref as string;
    const activeRows = await knex('assignments')
      .where({ student_ref: studentRef })
      .whereIn('status', ['active', 'suspended'])
      .orderBy('created_at', 'desc');
    const [, ...rest] = activeRows;
    for (const assignment of rest) {
      await knex('assignments')
        .where({ id: assignment.id })
        .update({ status: 'cancelled', updated_at: new Date() });
    }
  }

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS assignments_one_active_per_student
    ON assignments (student_ref)
    WHERE status IN ('active', 'suspended')
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS project_applications_one_open_per_project_student
    ON project_applications (project_id, student_ref)
    WHERE status NOT IN ('cancelled', 'rejected')
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS project_applications_one_open_per_project_student');
  await knex.raw('DROP INDEX IF EXISTS assignments_one_active_per_student');
}
