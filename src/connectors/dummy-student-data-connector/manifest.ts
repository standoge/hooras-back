export const dummyStudentDataManifest = {
  moduleKey: 'dummy-student-data-connector',
  displayName: 'Dummy Student Data Connector',
  version: '0.1.0',
  moduleType: 'student_data_connector' as const,
  description: 'MVP student-data connector with configurable provider profiles',
  author: 'Social Hours Platform',
  license: 'MIT',
  platformVersion: '0.1.0',
  capabilities: [
    'student.search', 'student.profile.read', 'student.progress.read',
    'student.programs.read', 'student.schema.read',
  ],
  providedContracts: ['student_data.v1'],
  requiredSecrets: ['apiBaseUrl'],
  configurationSchema: {
    providerProfile: {
      type: 'string',
      enum: ['progress_percentage', 'credits_based', 'subjects_based', 'status_code_based'],
      default: 'progress_percentage',
    },
  },
  permissions: ['external.student_data.read'],
};
