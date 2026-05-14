import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAgreementDomainEntity } from '~/domain/wallet/entities/user-agreement-domain.entity';
import { UserAgreementTypeormEntity } from '../entities/user-agreement.typeorm-entity';
import { UserAgreementMapper } from '../mappers/user-agreement.mapper';
import type { UserAgreementRepository } from '~/domain/wallet/repositories/user-agreement.repository';
import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
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
  extends BaseBlockchainRepository<UserAgreementDomainEntity, UserAgreementTypeormEntity>
  implements UserAgreementRepository, IBlockchainSyncRepository<UserAgreementDomainEntity>
{
  constructor(
    @InjectRepository(UserAgreementTypeormEntity)
    repository: Repository<UserAgreementTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
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
    const entity = await this.repository.findOne({
      where: { coopname, username },
    });
    return entity ? UserAgreementMapper.toDomain(entity) : null;
  }

  async findByCoopname(coopname: string): Promise<UserAgreementDomainEntity[]> {
    const entities = await this.repository.find({
      where: { coopname },
      order: { username: 'ASC' },
    });
    return entities.map(UserAgreementMapper.toDomain);
  }

  async findByProgramId(coopname: string, program_id: number): Promise<UserAgreementDomainEntity[]> {
    const entities = await this.repository
      .createQueryBuilder('ua')
      .where('ua.coopname = :coopname', { coopname })
      .andWhere(`ua.programs @> :program::jsonb`, { program: JSON.stringify([{ program_id }]) })
      .orderBy('ua.username', 'ASC')
      .getMany();
    return entities.map(UserAgreementMapper.toDomain);
  }
}
