import { CAPITAL_PROGRAM_PROPERTY_STORE } from '../database/capital-stores';
import { type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { ProgramPropertyDomainEntity } from '../../domain/entities/program-property.entity';
import { ProgramPropertyRecord } from '../entities/program-property.record';
import { ProgramPropertyMapper } from '../mappers/program-property.mapper';
import type { ProgramPropertyRepository } from '../../domain/repositories/program-property.repository';
import { BaseChainRepository, ChainVersioningService } from '@coopenomics/extension-kit/sync';
import type { IProgramPropertyDatabaseData } from '../../domain/interfaces/program-property-database.interface';
import type { IProgramPropertyBlockchainData } from '../../domain/interfaces/program-property-blockchain.interface';

/**
 * Хранилище программных имущественных взносов
 */
@Injectable()
export class ProgramPropertyKyselyRepository
  extends BaseChainRepository<ProgramPropertyDomainEntity, ProgramPropertyRecord>
  implements ProgramPropertyRepository
{
  constructor(
    @Inject(CAPITAL_PROGRAM_PROPERTY_STORE) repository: TableStore<ProgramPropertyRecord>,
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
