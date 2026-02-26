import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ProgramWithdrawDomainEntity } from '../../domain/entities/program-withdraw.entity';
import { ProgramWithdrawTypeormEntity } from '../entities/program-withdraw.typeorm-entity';
import { ProgramWithdrawMapper } from '../mappers/program-withdraw.mapper';
import type { ProgramWithdrawRepository } from '../../domain/repositories/program-withdraw.repository';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import type { IProgramWithdrawDatabaseData } from '../../domain/interfaces/program-withdraw-database.interface';
import type { IProgramWithdrawBlockchainData } from '../../domain/interfaces/program-withdraw-blockchain.interface';

/**
 * TypeORM реализация репозитория возвратов из программы
 */
@Injectable()
export class ProgramWithdrawTypeormRepository
  extends BaseBlockchainRepository<ProgramWithdrawDomainEntity, ProgramWithdrawTypeormEntity>
  implements ProgramWithdrawRepository
{
  constructor(
    @InjectRepository(ProgramWithdrawTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    repository: Repository<ProgramWithdrawTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
  }

  protected getMapper() {
    return {
      toDomain: ProgramWithdrawMapper.toDomain,
      toEntity: ProgramWithdrawMapper.toEntity,
    };
  }


  protected createDomainEntity(
    databaseData: IProgramWithdrawDatabaseData,
    blockchainData: IProgramWithdrawBlockchainData
  ): ProgramWithdrawDomainEntity {
    return new ProgramWithdrawDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return ProgramWithdrawDomainEntity.getSyncKey();
  }
}
