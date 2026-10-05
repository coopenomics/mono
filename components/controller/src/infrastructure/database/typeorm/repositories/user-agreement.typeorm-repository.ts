import { CORE_USER_AGREEMENT_STORE } from '../../kysely/core-stores';
import { type TableStore, contains } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { UserAgreementDomainEntity } from '~/domain/wallet/entities/user-agreement-domain.entity';
import { UserAgreementTypeormEntity } from '../entities/user-agreement.typeorm-entity';
import { UserAgreementMapper } from '../mappers/user-agreement.mapper';
import type { UserAgreementRepository } from '~/domain/wallet/repositories/user-agreement.repository';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { BaseChainRepository, ChainVersioningService } from '@coopenomics/extension-kit/sync';
import type { IUserAgreementBlockchainData } from '~/domain/wallet/interfaces/user-agreement-blockchain.interface';
import type { IUserAgreementDatabaseData } from '~/domain/wallet/interfaces/user-agreement-database.interface';

/**
 * TypeORM-репозиторий owner'ов программных соглашений (`wallet::users`).
 *
 * `findByProgramId` фильтрует по jsonb-полю `programs` через
 * `programs @> '[{"program_id": N}]'` — индекс GIN на `programs` рекомендуется
 * для prod-нагрузок (создаётся миграцией, не synchronize).
 */
@Injectable()
export class UserAgreementTypeormRepository
  extends BaseChainRepository<UserAgreementDomainEntity, UserAgreementTypeormEntity>
  implements UserAgreementRepository, IBlockchainSyncRepository<UserAgreementDomainEntity>
{
  constructor(
    @Inject(CORE_USER_AGREEMENT_STORE) repository: TableStore<UserAgreementTypeormEntity>,
    @Inject(ChainVersioningService) versioning: ChainVersioningService
  ) {
    super(repository, versioning);
  }

  protected getMapper() {
    return {
      toDomain: UserAgreementMapper.toDomain,
      toEntity: UserAgreementMapper.toEntity,
    };
  }

  protected createDomainEntity(
    databaseData: IUserAgreementDatabaseData,
    blockchainData: IUserAgreementBlockchainData
  ): UserAgreementDomainEntity {
    return new UserAgreementDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return UserAgreementDomainEntity.getSyncKey();
  }

  async findByUsername(coopname: string, username: string): Promise<UserAgreementDomainEntity | null> {
    const entity = await this.repository.findOne({ coopname, username });
    return entity ? UserAgreementMapper.toDomain(entity) : null;
  }

  async findByCoopname(coopname: string): Promise<UserAgreementDomainEntity[]> {
    const entities = await this.repository.find({ coopname }, { order: { username: 'ASC' } });
    return entities.map(UserAgreementMapper.toDomain);
  }

  async findByProgramId(coopname: string, program_id: number): Promise<UserAgreementDomainEntity[]> {
    const entities = await this.repository.find({ coopname, programs: contains([{ program_id }]) }, { order: { username: 'ASC' } });
    return entities.map(UserAgreementMapper.toDomain);
  }
}
