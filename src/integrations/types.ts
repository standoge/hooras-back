export interface ProjectInput {
  title: string;
  description: string;
  organizationName: string;
  location?: string;
  modality?: 'onsite' | 'remote' | 'hybrid';
  categories: string[];
  capacity?: number;
  startsAt?: string;
  endsAt?: string;
  applicationDeadline?: string;
  publicSafe?: boolean;
}
