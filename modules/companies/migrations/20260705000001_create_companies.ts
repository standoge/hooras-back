import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('companies'))) {
    await knex.schema.createTable('companies', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.string('name').notNullable();
      t.text('description');
      t.string('email');
      t.string('phone');
      t.string('website');
      t.text('address');
      t.timestamps(true, true);
    });
  }

  const hasCompanyId = await knex.schema.hasColumn('projects', 'company_id');
  if (!hasCompanyId) {
    await knex.schema.alterTable('projects', (t) => {
      t.uuid('company_id').references('id').inTable('companies').onDelete('SET NULL');
    });

    // Seed existing organization names as companies
    const projects = await knex('projects').select('id', 'organization_name');
    const uniqueOrgNames = Array.from(new Set(projects.map((p) => p.organization_name).filter(Boolean)));

    for (const name of uniqueOrgNames) {
      // Check if company already exists
      let company = await knex('companies').where({ name }).first();
      if (!company) {
        const [inserted] = await knex('companies')
          .insert({
            name,
            description: `Generated from existing project organization: ${name}`,
          })
          .returning('id');
        company = { id: inserted.id };
      }

      await knex('projects')
        .where({ organization_name: name })
        .update({ company_id: company.id });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('projects', 'company_id')) {
    await knex.schema.alterTable('projects', (t) => {
      t.dropColumn('company_id');
    });
  }
  await knex.schema.dropTableIfExists('companies');
}
