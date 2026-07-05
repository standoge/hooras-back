import {
  AcademicProfile,
  RuleEvaluationResult,
} from '../../types';

export const NOTIFICATIONS_V1 = 'notifications.v1';
export const RULES_V1 = 'rules.v1';
export const PROJECTS_V1 = 'projects.v1';
export const ASSIGNMENTS_V1 = 'assignments.v1';
export const HOURS_V1 = 'hours.v1';
export const DOCUMENTS_V1 = 'documents.v1';
export const STUDENT_PROFILE_V1 = 'student-profile.v1';

export type NotificationEvent =
  | 'application_submitted'
  | 'application_approved'
  | 'application_rejected'
  | 'application_status_changed'
  | 'missing_document'
  | 'document_requested'
  | 'document_uploaded'
  | 'document_approved'
  | 'document_rejected'
  | 'hours_approved'
  | 'hours_rejected'
  | 'assignment_created'
  | 'rule_blocked'
  | 'project_deadline_approaching'
  | 'final_report_required'
  | 'certificate_generated';

export interface NotificationsServiceV1 {
  send(eventType: NotificationEvent, recipient: string, payload?: Record<string, unknown>): Promise<string>;
  listForStudent(
    studentRef: string,
    options?: { unreadOnly?: boolean; limit?: number; offset?: number },
  ): Promise<unknown[]>;
  markRead(notificationId: string, studentRef: string): Promise<unknown>;
}

export interface RulesServiceV1 {
  listRules(filters: { facultyCode?: string; programCode?: string; degreeLevel?: string }): Promise<unknown[]>;
  createRule(input: Record<string, unknown>): Promise<unknown>;
  evaluateRules(studentRef: string, academicProfile?: AcademicProfile, projectId?: string): Promise<RuleEvaluationResult>;
}

export interface ProjectsServiceV1 {
  getById(projectId: string): Promise<Record<string, unknown> | null>;
  createFromImport(extracted: Record<string, unknown>, sourceUrl: string, confidence?: number): Promise<Record<string, unknown>>;
}

export interface AssignmentsServiceV1 {
  createFromApplication(projectId: string, studentRef: string, trx?: import('knex').Knex.Transaction): Promise<Record<string, unknown>>;
  listByStudent(studentRef: string): Promise<Array<{ id: string }>>;
  completeAssignment(assignmentId: string): Promise<Record<string, unknown> | null>;
}

export interface HoursServiceV1 {
  getStudentHours(studentRef: string): Promise<number>;
}

export interface DocumentsServiceV1 {
  listRequirements(): Promise<unknown[]>;
  listRequirementsForStudent(studentRef: string, context?: { projectId?: string }): Promise<unknown[]>;
  getStudentUploadMatrix(studentRef: string, context?: { projectId?: string }): Promise<unknown[]>;
  validateUpload(requirement: Record<string, unknown>, fileMeta: { mimeType: string; sizeBytes: number }): void;
  createCertificateDocument(studentRef: string, assignmentId?: string, verificationCode?: string): Promise<string>;
}

export interface StudentProfileServiceV1 {
  buildProfile(studentRef: string): Promise<unknown>;
  refreshProfile(studentRef: string): Promise<AcademicProfile>;
  invalidateCache(externalStudentId: string): Promise<void>;
}
