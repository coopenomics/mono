import type { CppRegistryEntryDomainEntity } from '../entities/cpp-registry-entry.entity';

export const CPP_REGISTRY_REPOSITORY = Symbol('CPP_REGISTRY_REPOSITORY');

/**
 * Репозиторий реестра ЦПП-шаблонов кооператива (Story 1.2).
 *
 * Контракт идемпотентного upsert по `required_for_extension` — повторная
 * установка расширения не должна дублировать запись (AC Story 1.2).
 */
export interface CppRegistryRepository {
  upsertByExtension(entry: CppRegistryEntryDomainEntity): Promise<CppRegistryEntryDomainEntity>;
  findByExtension(extensionName: string): Promise<CppRegistryEntryDomainEntity | null>;
  findAll(): Promise<CppRegistryEntryDomainEntity[]>;
  deleteByExtension(extensionName: string): Promise<boolean>;
}
