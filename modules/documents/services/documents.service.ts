import { v4 as uuidv4 } from 'uuid';
import db from '../../../database';
import { DocumentsServiceV1 } from '../../../platform/contracts/services';
import { refreshStudentProfile } from '../../../core/student-cache/studentCache.service';
import { BadRequestError } from '../../../app/utils/errors';
import { AcademicProfile } from '../../../platform/types';

function parseJson<T>(val: string | T): T {
  return typeof val === 'string' ? JSON.parse(val) : val;
}

function mapRequirement(row: Record<string, unknown>) {
  return {
    id: row.id,
    key: row.key,
    name: row.label,
    label: row.label,
    description: row.description ?? null,
    required: row.required,
    active: row.active ?? true,
    scope: row.scope ?? 'global',
    projectId: row.project_id ?? null,
    appliesTo: parseJson(row.applies_to as string),
    allowedFileTypes: parseJson(row.allowed_file_types as string),
    maxFileSizeMb: row.max_file_size_mb,
    requiresApproval: row.requires_approval,
    templateId: row.template_id,
    createdBy: row.created_by ?? null,
  };
}

function requirementApplies(
  requirement: Record<string, unknown>,
  profile: AcademicProfile,
  context?: { projectId?: string },
): boolean {
  if (requirement.active === false) return false;
  const scope = requirement.scope as string;
  if (scope === 'project' && context?.projectId && requirement.project_id !== context.projectId) {
    return false;
  }
  const appliesTo = parseJson<Record<string, string>>(requirement.applies_to as string);
  if (appliesTo.facultyCode && appliesTo.facultyCode !== profile.facultyCode) return false;
  if (appliesTo.programCode && appliesTo.programCode !== profile.programCode) return false;
  if (appliesTo.projectType && context?.projectId) {
  }
  return true;
}

export const documentsService: DocumentsServiceV1 = {
  async listRequirements() {
    const rows = await db('document_requirements').select('*');
    return rows
      .filter((row) => row.active !== false)
      .map(mapRequirement);
  },

  async listRequirementsForStudent(studentRef, context) {
    const profile = await refreshStudentProfile(studentRef);
    const rows = await db('document_requirements').select('*');
    return rows
      .filter((row) => row.active !== false)
      .filter((row) => requirementApplies(row, profile, context))
      .map(mapRequirement);
  },

  async getStudentUploadMatrix(studentRef, context) {
    const requirements = await this.listRequirementsForStudent(studentRef, context);
    const uploads = await db('document_uploads')
      .where({ owner_ref: studentRef })
      .orderBy('uploaded_at', 'desc');
    return requirements.map((req) => {
      const requirement = req as { id: string };
      const latest = uploads.find((u) => u.document_requirement_id === requirement.id);
      return {
        requirement: req,
        upload: latest
          ? {
              id: latest.id,
              status: latest.status,
              fileName: latest.file_name,
              uploadedAt: latest.uploaded_at,
              rejectionReason: latest.rejection_reason,
            }
          : null,
      };
    });
  },

  validateUpload(requirement, fileMeta) {
    const allowed = Array.isArray(requirement.allowedFileTypes)
      ? (requirement.allowedFileTypes as string[])
      : parseJson<string[]>(requirement.allowedFileTypes as string);
    if (allowed.length && !allowed.includes(fileMeta.mimeType)) {
      throw new BadRequestError(`File type ${fileMeta.mimeType} is not allowed`);
    }
    const maxMb = requirement.maxFileSizeMb as number | undefined;
    if (maxMb && fileMeta.sizeBytes > maxMb * 1024 * 1024) {
      throw new BadRequestError(`File exceeds maximum size of ${maxMb}MB`);
    }
  },

  async createCertificateDocument(studentRef, assignmentId?, verificationCode?) {
    const docId = uuidv4();
    const code = verificationCode ?? uuidv4().slice(0, 8).toUpperCase();
    await db('document_uploads').insert({
      id: docId,
      document_requirement_id: null,
      owner_ref: studentRef,
      file_name: `certificate-${code}.pdf`,
      storage_ref: `certificates/${code}.pdf`,
      assignment_id: assignmentId,
      status: 'approved',
      uploaded_at: new Date(),
    });
    return docId;
  },
};

export { mapRequirement };
