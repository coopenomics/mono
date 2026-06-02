import type { KuDetailsDomainEntity, GeocodeStatus, KuDetailsStatus } from '../entities/ku-details-domain.entity';

/**
 * Доменный репозиторий marketplace-детализации существующих в core КУ (Story 2.1).
 *
 * Реализация — `KuDetailsRepositoryAdapter` (TypeORM, marketplace connection).
 */
export interface KuDetailsDomainRepository {
  findByCoreBraname(coopname: string, coreBraname: string): Promise<KuDetailsDomainEntity | null>;

  findByCoopname(coopname: string, options?: { onlyActive?: boolean }): Promise<KuDetailsDomainEntity[]>;

  save(entity: KuDetailsDomainEntity): Promise<KuDetailsDomainEntity>;

  /**
   * Записывает результат геокодинга. `geocodedAddress` — адрес организации
   * участка, по которому посчитаны координаты; сохраняется как кэш-ключ для
   * ленивого reconcile (при следующем чтении сверяем его с актуальным адресом
   * организации и при расхождении перегеокодируем).
   */
  updateGeocode(
    coopname: string,
    coreBraname: string,
    payload: {
      status: GeocodeStatus;
      lat?: number;
      lng?: number;
      errorMessage?: string;
      geocodedAt: Date;
      geocodedAddress?: string;
    }
  ): Promise<KuDetailsDomainEntity | null>;

  setStatus(
    coopname: string,
    coreBraname: string,
    status: KuDetailsStatus
  ): Promise<KuDetailsDomainEntity | null>;
}

export const KU_DETAILS_DOMAIN_REPOSITORY = Symbol('KuDetailsDomainRepository');
