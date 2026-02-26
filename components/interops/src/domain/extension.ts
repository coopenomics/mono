/**
 * Интерфейсы системы расширений
 */

export interface IExtensionDomain {
  name: string;
  enabled: boolean;
  installed: boolean;
  config?: Record<string, any>;
  version?: string;
}

export interface IExtensionDomainRepository {
  findByName(name: string): Promise<IExtensionDomain | null>;
  findAll(): Promise<IExtensionDomain[]>;
  save(extension: IExtensionDomain): Promise<void>;
}

export const EXTENSION_DOMAIN_REPOSITORY = Symbol('ExtensionDomainRepository');
