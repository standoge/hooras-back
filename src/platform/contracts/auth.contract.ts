import {
  AuthIntrospectionResult,
  AuthTokenResponse,
  CurrentUser,
  ModuleHealth,
  ModuleManifest,
  ModuleTestResult,
  UserRole,
} from '../types';

export interface AuthLoginParams {
  username: string;
  password: string;
  providerProfile?: string;
}

export interface AuthConnectorContract {
  readonly manifest: ModuleManifest;
  configure(values: Record<string, unknown>, secrets: Record<string, string>): Promise<void>;
  testConnection(): Promise<ModuleTestResult>;
  getCapabilities(): Promise<string[]>;
  getHealth(): Promise<ModuleHealth>;
  login(params: AuthLoginParams): Promise<AuthTokenResponse>;
  introspectToken(token: string): Promise<AuthIntrospectionResult>;
  getUserInfo(token: string): Promise<CurrentUser>;
  mapExternalRoles(roles: string[]): UserRole[];
  logout?(token: string): Promise<void>;
}

export interface AuthConnectorModule extends AuthConnectorContract {
  moduleKey: string;
}
