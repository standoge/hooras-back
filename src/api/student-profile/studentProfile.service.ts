import db from '../../database';
import { env } from '../../config/env';
import { ModuleRegistry } from '../../platform/registry/ModuleRegistry';
import { AcademicProfile, RuleEvaluationResult, StudentProfile } from '../../platform/types';
import { NotFoundError } from '../../app/utils/errors';

export async function cacheStudentProfile(studentRef: string, profile: AcademicProfile): Promise<void> {
  const externalStudentId = studentRef.replace(/^student:/, '');
  const connector = await ModuleRegistry.getActiveStudentDataConnector();
  const existing = await db('student_refs').where({ student_ref: studentRef }).first();
  if (existing) {
    await db('student_refs').where({ student_ref: studentRef }).update({
      cached_profile: JSON.stringify(profile),
      profile_cached_at: new Date(),
      updated_at: new Date(),
    });
  } else {
    await db('student_refs').insert({
      student_ref: studentRef,
      external_student_id: externalStudentId,
      module_key: connector.moduleKey,
      provider_key: 'dummy-student-data',
      cached_profile: JSON.stringify(profile),
      profile_cached_at: new Date(),
    });
  }
}

export async function getCachedProfile(studentRef: string): Promise<AcademicProfile | null> {
  const row = await db('student_refs').where({ student_ref: studentRef }).first();
  if (!row?.cached_profile) return null;
  const cachedAt = row.profile_cached_at ? new Date(row.profile_cached_at) : null;
  if (cachedAt) {
    const ttlMs = env.STUDENT_PROFILE_CACHE_TTL_MINUTES * 60 * 1000;
    if (Date.now() - cachedAt.getTime() > ttlMs) return null;
  }
  const profile = typeof row.cached_profile === 'string'
    ? JSON.parse(row.cached_profile)
    : row.cached_profile;
  return profile as AcademicProfile;
}

export async function refreshStudentProfile(studentRef: string): Promise<AcademicProfile> {
  const connector = await ModuleRegistry.getActiveStudentDataConnector();
  const profile = await connector.getStudentProfile(studentRef);
  await cacheStudentProfile(studentRef, profile);
  return profile;
}

export async function getStudentHours(studentRef: string): Promise<number> {
  const assignments = await db('assignments').where({ student_ref: studentRef }).select('id');
  if (!assignments.length) return 0;
  const ids = assignments.map((a) => a.id);
  const result = await db('hour_logs')
    .whereIn('assignment_id', ids)
    .where({ status: 'approved' })
    .sum('duration_hours as total')
    .first();
  return Number(result?.total ?? 0);
}

export async function buildStudentProfile(
  studentRef: string,
  eligibility: RuleEvaluationResult
): Promise<StudentProfile> {
  let academicProfile = await getCachedProfile(studentRef);
  if (!academicProfile) {
    academicProfile = await refreshStudentProfile(studentRef);
  }
  const completedHours = await getStudentHours(studentRef);
  const remainingHours = Math.max(0, eligibility.requiredHours - completedHours);
  const docReqs = await db('document_requirements').select('*');

  return {
    studentRef,
    academicProfile,
    eligibility,
    completedHours,
    remainingHours,
    requiredDocuments: docReqs.map(mapDocumentRequirement),
    recommendedProjectCategories: Object.keys(eligibility.requiredCategoryHours ?? {}),
  };
}

function mapDocumentRequirement(row: Record<string, unknown>) {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    required: row.required,
    appliesTo: typeof row.applies_to === 'string' ? JSON.parse(row.applies_to) : row.applies_to,
    allowedFileTypes: typeof row.allowed_file_types === 'string'
      ? JSON.parse(row.allowed_file_types)
      : row.allowed_file_types,
    maxFileSizeMb: row.max_file_size_mb,
    requiresApproval: row.requires_approval,
    templateId: row.template_id,
  };
}

export async function invalidateStudentCache(externalStudentId: string): Promise<void> {
  await db('student_refs')
    .where({ external_student_id: externalStudentId })
    .update({ cached_profile: null, profile_cached_at: null });
}
