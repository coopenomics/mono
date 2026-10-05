import { CAPITAL_PROGRAM_PROPERTY_STORE } from '../database/capital-stores';
import { type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { ProgramPropertyDomainEntity } from '../../domain/entities/program-property.entity';
import { ProgramPropertyTypeormEntity } from '../entities/program-property.typeorm-entity';
import { ProgramPropertyMapper } from '../mappers/program-property.mapper';
import type { ProgramPropertyRepository } from '../../domain/repositories/program-property.repository';
import { BaseChainRepository, ChainVersioningService } from '@coopenomics/extension-kit/sync';
import type { IProgramPropertyDatabaseData } from '../../domain/interfaces/program-property-database.interface';
import type { IProgramPropertyBlockchainData } from '../../domain/interfaces/program-property-blockchain.interface';

/**
 * TypeORM реализация репозитория программных имущественных взносов
 */
@Injectable()
export class ProgramPropertyTypeormRepository
  extends BaseChainRepository<ProgramPropertyDomainEntity, ProgramPropertyTypeormEntity>
  implements ProgramPropertyRepository
{
  constructor(
    @Inject(CAPITAL_PROGRAM_PROPERTY_STORE) repository: TableStore<ProgramPropertyTypeormEntity>,
    @Inject(ChainVersioningService) versioning: ChainVersioningService
  ) {
    super(repository, versioning);
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
