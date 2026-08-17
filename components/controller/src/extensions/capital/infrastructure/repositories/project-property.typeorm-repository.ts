import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ProjectPropertyDomainEntity } from '../../domain/entities/project-property.entity';
import { ProjectPropertyTypeormEntity } from '../entities/project-property.typeorm-entity';
import { ProjectPropertyMapper } from '../mappers/project-property.mapper';
import type { ProjectPropertyRepository } from '../../domain/repositories/project-property.repository';
import { BaseBlockchainRepository, EntityVersioningService } from '@coopenomics/extension-kit/sync';
import type { IProjectPropertyBlockchainData } from '../../domain/interfaces/project-property-blockchain.interface';
import type { IProjectPropertyDatabaseData } from '../../domain/interfaces/project-property-database.interface';
/**
 * TypeORM реализация репозитория проектных имущественных взносов
 */
@Injectable()
export class ProjectPropertyTypeormRepository
  extends BaseBlockchainRepository<ProjectPropertyDomainEntity, ProjectPropertyTypeormEntity>
  implements ProjectPropertyRepository
{
  constructor(
    @InjectRepository(ProjectPropertyTypeormEntity)
    repository: Repository<ProjectPropertyTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
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
