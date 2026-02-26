import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ProgramPropertyDomainEntity } from '../../domain/entities/program-property.entity';
import { ProgramPropertyTypeormEntity } from '../entities/program-property.typeorm-entity';
import { ProgramPropertyMapper } from '../mappers/program-property.mapper';
import type { ProgramPropertyRepository } from '../../domain/repositories/program-property.repository';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import type { IProgramPropertyDatabaseData } from '../../domain/interfaces/program-property-database.interface';
import type { IProgramPropertyBlockchainData } from '../../domain/interfaces/program-property-blockchain.interface';

/**
 * TypeORM реализация репозитория программных имущественных взносов
 */
@Injectable()
export class ProgramPropertyTypeormRepository
  extends BaseBlockchainRepository<ProgramPropertyDomainEntity, ProgramPropertyTypeormEntity>
  implements ProgramPropertyRepository
{
  constructor(
    @InjectRepository(ProgramPropertyTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    repository: Repository<ProgramPropertyTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
  }

  protected getMapper() {
    return {
      toDomain: ProgramPropertyMapper.toDomain,
      toEntity: ProgramPropertyMapper.toEntity,
    };
  }


  protected createDomainEntity(
    databaseData: IProgramPropertyDatabaseData,
    blockchainData: IProgramPropertyBlockchainData
  ): ProgramPropertyDomainEntity {
    return new ProgramPropertyDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return ProgramPropertyDomainEntity.getSyncKey();
  }
}
