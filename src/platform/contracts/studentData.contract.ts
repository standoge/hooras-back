import {
  AcademicProfile,
  ModuleHealth,
  ModuleManifest,
  ModuleTestResult,
  ProviderSchema,
  StudentSearchResult,
} from '../types';

export interface StudentDataConnectorContract {
  readonly manifest: ModuleManifest;
  configure(values: Record<string, unknown>, secrets: Record<string, string>): Promise<void>;
  testConnection(): Promise<ModuleTestResult>;
  getCapabilities(): Promise<string[]>;
  getHealth(): Promise<ModuleHealth>;
  searchStudents(query: string): Promise<StudentSearchResult[]>;
  getStudentProfile(studentRef: string): Promise<AcademicProfile>;
  getProgramProgress(externalStudentId: string): Promise<Record<string, unknown>>;
  getCompletedCourses(externalStudentId: string): Promise<string[]>;
  getPrograms(): Promise<Record<string, unknown>[]>;
  getSchema(): Promise<ProviderSchema>;
  normalizeStudentData(raw: unknown): AcademicProfile;
}

export interface StudentDataConnectorModule extends StudentDataConnectorContract {
  moduleKey: string;
}
