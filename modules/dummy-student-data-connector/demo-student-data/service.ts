import db from '../../../database';
import { NotFoundError } from '../../../app/utils/errors';
import { AcademicProfile, ProviderSchema } from '../../../platform/types';
import { PROFILE_MAPPINGS, buildAcademicProfile } from './profiles';

const DEMO_PROGRAMS = [
  { facultyCode: 'ING', facultyName: 'Facultad de Ingeniería', programCode: 'ING-SIS', programName: 'Ingeniería en Sistemas', degreeLevel: 'engineering', modality: 'onsite' },
  { facultyCode: 'ECO', facultyName: 'Facultad de Ciencias Económicas', programCode: 'ADM-001', programName: 'Administración de Empresas', degreeLevel: 'bachelor', modality: 'hybrid' },
  { facultyCode: 'SAL', facultyName: 'Facultad de Ciencias de la Salud', programCode: 'PSI', programName: 'Psicología', degreeLevel: 'bachelor', modality: 'onsite' },
];

function parseRaw(raw: unknown): unknown {
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export function getProviderSchema(providerProfile: string): ProviderSchema {
  const mapping = PROFILE_MAPPINGS[providerProfile];
  return {
    providerKey: 'dummy-student-data',
    providerProfile,
    fields: Object.entries(mapping?.mappings ?? {}).map(([field, path]) => ({
      path,
      type: 'string',
      required: mapping?.required?.includes(field) ?? false,
      description: `Maps to ${field}`,
    })),
  };
}

export async function searchDemoStudents(
  query: string,
  providerProfile: string,
): Promise<Array<{ externalStudentId: string; displayName: string; email?: string; raw?: unknown }>> {
  let dbQuery = db('demo_students').where({ provider_profile: providerProfile });
  if (query) {
    dbQuery = dbQuery.where(function () {
      this.whereILike('display_name', `%${query}%`)
        .orWhereILike('external_student_id', `%${query}%`)
        .orWhereILike('email', `%${query}%`);
    });
  }
  const rows = await dbQuery;
  return rows.map((r) => ({
    externalStudentId: r.external_student_id,
    displayName: r.display_name,
    email: r.email,
    raw: parseRaw(r.raw),
  }));
}

export async function getDemoStudent(
  externalStudentId: string,
  providerProfile: string,
): Promise<{ externalStudentId: string; displayName: string; email?: string; raw: unknown }> {
  const row = await db('demo_students')
    .where({ external_student_id: externalStudentId, provider_profile: providerProfile })
    .first();
  if (!row) throw new NotFoundError('Student not found');
  return {
    externalStudentId: row.external_student_id,
    displayName: row.display_name,
    email: row.email,
    raw: parseRaw(row.raw),
  };
}

export async function getDemoStudentAcademicProfile(
  externalStudentId: string,
  providerProfile: string,
): Promise<AcademicProfile> {
  const row = await db('demo_students')
    .where({ external_student_id: externalStudentId })
    .first();
  if (!row) throw new NotFoundError('Student not found');
  const raw = parseRaw(row.raw);
  return buildAcademicProfile(row.external_student_id, providerProfile, raw);
}

export async function getDemoStudentProgramProgress(
  externalStudentId: string,
  providerProfile: string,
): Promise<Record<string, unknown>> {
  const academic = await getDemoStudentAcademicProfile(externalStudentId, providerProfile);
  return {
    externalStudentId,
    approvedCredits: academic.approvedCredits,
    totalCredits: academic.totalCredits,
    approvedSubjects: academic.approvedSubjects,
    totalSubjects: academic.totalSubjects,
    progressPercentage: academic.progressPercentage,
  };
}

export function listDemoPrograms(): Record<string, unknown>[] {
  return DEMO_PROGRAMS;
}
