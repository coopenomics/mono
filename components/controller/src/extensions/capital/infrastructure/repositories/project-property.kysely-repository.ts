import { CAPITAL_PROJECT_PROPERTY_STORE } from '../database/capital-stores';
import { type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { ProjectPropertyDomainEntity } from '../../domain/entities/project-property.entity';
import { ProjectPropertyRecord } from '../entities/project-property.record';
import { ProjectPropertyMapper } from '../mappers/project-property.mapper';
import type { ProjectPropertyRepository } from '../../domain/repositories/project-property.repository';
import { BaseChainRepository, ChainVersioningService } from '@coopenomics/extension-kit/sync';
import type { IProjectPropertyBlockchainData } from '../../domain/interfaces/project-property-blockchain.interface';
import type { IProjectPropertyDatabaseData } from '../../domain/interfaces/project-property-database.interface';
/**
 * Хранилище проектных имущественных взносов
 */
@Injectable()
export class ProjectPropertyKyselyRepository
  extends BaseChainRepository<ProjectPropertyDomainEntity, ProjectPropertyRecord>
  implements ProjectPropertyRepository
{
  constructor(
    @Inject(CAPITAL_PROJECT_PROPERTY_STORE) repository: TableStore<ProjectPropertyRecord>,
    @Inject(ChainVersioningService) versioning: ChainVersioningService
  ) {
    super(repository, versioning);
  }

  protected getMapper() {
    return {
      toDomain: ProjectPropertyMapper.toDomain,
      toEntity: ProjectPropertyMapper.toEntity,
    };
  }


  protected getSyncKey(): string {
    return ProjectPropertyDomainEntity.getSyncKey();
  }

  protected createDomainEntity(
    databaseData: IProjectPropertyDatabaseData,
    blockchainData: IProjectPropertyBlockchainData
  ): ProjectPropertyDomainEntity {
    return new ProjectPropertyDomainEntity(databaseData, blockchainData);
  }
}
