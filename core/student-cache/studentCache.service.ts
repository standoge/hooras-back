import db from '../../database';
import { env } from '../../config/env';
import { ModuleRegistry } from '../../platform/registry/ModuleRegistry';
import { AcademicProfile } from '../../platform/types';

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

export async function invalidateStudentCache(externalStudentId: string): Promise<void> {
  await db('student_refs')
    .where({ external_student_id: externalStudentId })
    .update({ cached_profile: null, profile_cached_at: null });
}
