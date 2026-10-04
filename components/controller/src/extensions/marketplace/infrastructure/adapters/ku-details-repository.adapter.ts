import { TableStore } from '@coopenomics/extension-kit';
import { MARKETPLACE_KU_DETAILS_STORE } from '../../infrastructure/database/marketplace-stores';
import { Inject, Injectable } from '@nestjs/common';
import {
  KuDetailsStatuses,
  type GeocodeStatus,
  type KuDetailsDomainEntity,
  type KuDetailsStatus,
} from '../../domain/entities/ku-details-domain.entity';
import type { KuDetailsDomainRepository } from '../../domain/repositories/ku-details-domain.repository';
import { KuDetailsTypeormEntity } from '../entities/ku-details.entity';
import { KuDetailsMapper } from '../mappers/ku-details.mapper';

@Injectable()
export class KuDetailsRepositoryAdapter implements KuDetailsDomainRepository {
  constructor(
    @Inject(MARKETPLACE_KU_DETAILS_STORE)
private readonly repo: TableStore<KuDetailsTypeormEntity>
  ) {}

  async findByCoreBraname(coopname: string, coreBraname: string): Promise<KuDetailsDomainEntity | null> {
    const found = await this.repo.findOne({ coopname, coreBraname });
    return found ? KuDetailsMapper.toDomain(found) : null;
  }

  async findByCoopname(
    coopname: string,
    options: { onlyActive?: boolean } = {}
  ): Promise<KuDetailsDomainEntity[]> {
    const where: { coopname: string; status?: KuDetailsStatus } = { coopname };
    if (options.onlyActive) where.status = KuDetailsStatuses.ACTIVE;
    const rows = await this.repo.find(where, { order: { createdAt: 'ASC' } });
    return rows.map((row) => KuDetailsMapper.toDomain(row));
  }

  async save(entity: KuDetailsDomainEntity): Promise<KuDetailsDomainEntity> {
    const existing =
      entity.id !== undefined
        ? await this.repo.findOne({ id: entity.id })
        : await this.repo.findOne({ coopname: entity.coopname, coreBraname: entity.coreBraname });

    const toPersist = existing ?? new KuDetailsTypeormEntity();
    toPersist.coopname = entity.coopname;
    toPersist.coreBraname = entity.coreBraname;
    toPersist.geocodedAddress = entity.geocodedAddress;
    toPersist.workingHoursJson = entity.workingHours;
    toPersist.description = entity.description;
    toPersist.status = entity.status;
    if (entity.lat !== undefined) toPersist.lat = entity.lat;
    if (entity.lng !== undefined) toPersist.lng = entity.lng;
    toPersist.geocodeStatus = entity.geocodeStatus;
    toPersist.geocodeErrorMessage = entity.geocodeErrorMessage;
    toPersist.geocodedAt = entity.geocodedAt;

    const saved = await this.repo.save(toPersist);
    return KuDetailsMapper.toDomain(saved);
  }

  async updateGeocode(
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
  ): Promise<KuDetailsDomainEntity | null> {
    const existing = await this.repo.findOne({ coopname, coreBraname });
    if (!existing) return null;

    existing.geocodeStatus = payload.status;
    existing.lat = payload.lat;
    existing.lng = payload.lng;
    existing.geocodeErrorMessage = payload.errorMessage;
    existing.geocodedAt = payload.geocodedAt;
    if (payload.geocodedAddress !== undefined) existing.geocodedAddress = payload.geocodedAddress;

    const saved = await this.repo.save(existing);
    return KuDetailsMapper.toDomain(saved);
  }

  async setStatus(
    coopname: string,
    coreBraname: string,
    status: KuDetailsStatus
  ): Promise<KuDetailsDomainEntity | null> {
    const existing = await this.repo.findOne({ coopname, coreBraname });
    if (!existing) return null;
    existing.status = status;
    const saved = await this.repo.save(existing);
    return KuDetailsMapper.toDomain(saved);
  }
}
