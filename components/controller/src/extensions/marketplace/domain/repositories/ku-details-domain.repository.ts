import type { KuDetailsDomainEntity, GeocodeStatus } from '../entities/ku-details-domain.entity';

/**
 * Доменный репозиторий marketplace-детализации существующих в core КУ (Story 2.1).
 *
 * Реализация — `KuDetailsRepositoryAdapter` (TypeORM, marketplace connection).
 */
export interface KuDetailsDomainRepository {
  findByCoreBraname(coopname: string, coreBraname: string): Promise<KuDetailsDomainEntity | null>;

  findByCoopname(coopname: string, options?: { onlyActive?: boolean }): Promise<KuDetailsDomainEntity[]>;

  save(entity: KuDetailsDomainEntity): Promise<KuDetailsDomainEntity>;

  updateGeocode(
    coopname: string,
    coreBraname: string,
    payload: {
      status: GeocodeStatus;
      lat?: number;
      lng?: number;
      errorMessage?: string;
      geocodedAt: Date;
    }
  ): Promise<KuDetailsDomainEntity | null>;

  setStatus(
    coopname: string,
    coreBraname: string,
    status: 'ACTIVE' | 'INACTIVE'
  ): Promise<KuDetailsDomainEntity | null>;
}

export const KU_DETAILS_DOMAIN_REPOSITORY = Symbol('KuDetailsDomainRepository');
