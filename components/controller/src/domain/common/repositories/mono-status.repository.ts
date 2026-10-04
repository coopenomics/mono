import type { SystemStatusDomainType } from '~/domain/system/interfaces/system-status-domain.types';

export const MONO_STATUS_REPOSITORY = 'MONO_STATUS_REPOSITORY';

export interface MonoStatusRepository {
  getStatus(): Promise<SystemStatusDomainType>;
  setStatus(status: SystemStatusDomainType): Promise<void>;
  createInstallStatus(): Promise<void>;
  setInstallCode(code: string, expiresAt: Date): Promise<void>;
  validateInstallCode(code: string): Promise<boolean>;
  getMonoDocument(): Promise<any>;
  setInitByServer(initByServer: boolean): Promise<void>;
}
