import type { Knex } from 'knex';
import { createHash } from 'crypto';

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function seed(knex: Knex): Promise<void> {
  await knex('instance_settings').del();
  await knex('instance_settings').insert({
    college_name: 'Universidad Demo El Salvador',
    settings: JSON.stringify({ locale: 'es-SV', timezone: 'America/El_Salvador' }),
  });

  await knex('admin_users').del();
  await knex('admin_users').insert({
    username: 'admin1',
    password_hash: hashPassword('demo123'),
    display_name: 'Admin Sistema',
    email: 'admin@demo.edu',
    roles: JSON.stringify(['admin']),
    active: true,
  });

  await knex('demo_users').del();
  const demoUsers = [
    { username: 'student1', password: 'demo123', external_user_id: 'usr-student-001', external_student_id: 'STU-001', display_name: 'María González', email: 'maria.gonzalez@demo.edu', roles: ['student'] },
    { username: 'coordinator1', password: 'demo123', external_user_id: 'usr-coord-001', display_name: 'Carlos Mendoza', email: 'carlos.mendoza@demo.edu', roles: ['coordinator'] },
    { username: 'supervisor1', password: 'demo123', external_user_id: 'usr-super-001', display_name: 'Ana Rodríguez', email: 'ana.rodriguez@demo.edu', roles: ['faculty_supervisor'] },
    { username: 'admin1', password: 'demo123', external_user_id: 'usr-admin-001', display_name: 'Admin Sistema', email: 'admin@demo.edu', roles: ['admin'] },
    { username: 'auditor1', password: 'demo123', external_user_id: 'usr-audit-001', display_name: 'Auditor Interno', email: 'auditor@demo.edu', roles: ['auditor'] },
  ];
  for (const u of demoUsers) {
    await knex('demo_users').insert({
      username: u.username,
      password_hash: hashPassword(u.password),
      external_user_id: u.external_user_id,
      external_student_id: u.external_student_id ?? null,
      display_name: u.display_name,
      email: u.email,
      roles: JSON.stringify(u.roles),
      provider_profile: 'default',
    });
  }

  await knex('demo_students').del();
  const students = [
    {
      external_student_id: 'STU-001',
      display_name: 'María González',
      email: 'maria.gonzalez@demo.edu',
      provider_profile: 'progress_percentage',
      raw: {
        id: 'STU-001',
        name: 'María González',
        email: 'maria.gonzalez@demo.edu',
        career: { code: 'ING-SIS', name: 'Ingeniería en Sistemas' },
        faculty: { code: 'ING', name: 'Facultad de Ingeniería' },
        academic: { progress: 72.5, status: 'active', gpa: 8.2 },
        degreeLevel: 'engineering',
        modality: 'onsite',
        cohort: '2022',
        courses: { completed: [{ code: 'MAT101' }, { code: 'PROG201' }] },
        skills: ['JavaScript', 'SQL'],
      },
    },
    {
      external_student_id: 'STU-002',
      display_name: 'Juan Pérez',
      email: 'juan.perez@demo.edu',
      provider_profile: 'credits_based',
      raw: {
        studentId: 'STU-002',
        fullName: 'Juan Pérez',
        mail: 'juan.perez@demo.edu',
        program: { id: 'ADM-001', title: 'Administración de Empresas' },
        dept: { id: 'ECO', label: 'Facultad de Ciencias Económicas' },
        credits: { approved: 85, total: 120 },
        statusCode: 'active',
        level: 'bachelor',
        mode: 'hybrid',
        batch: '2021',
        finishedCourses: ['ECO101', 'FIN201'],
      },
    },
    {
      external_student_id: 'STU-003',
      display_name: 'Laura Martínez',
      email: 'laura.martinez@demo.edu',
      provider_profile: 'subjects_based',
      raw: {
        carnet: 'STU-003',
        nombre: 'Laura Martínez',
        correo: 'laura.martinez@demo.edu',
        carrera: { codigo: 'PSI', nombre: 'Psicología' },
        facultad: { codigo: 'SAL', nombre: 'Facultad de Ciencias de la Salud' },
        materias: { aprobadas: 38, total: 52 },
        estado: 'egresado',
        grado: 'bachelor',
        modalidad: 'onsite',
        promocion: '2020',
        asignaturasCompletadas: ['PSI101', 'PSI202'],
      },
    },
  ];
  for (const s of students) {
    await knex('demo_students').insert({
      external_student_id: s.external_student_id,
      display_name: s.display_name,
      email: s.email,
      provider_profile: s.provider_profile,
      raw: JSON.stringify(s.raw),
    });
  }
}
