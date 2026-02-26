import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AppendixDomainEntity } from '../../domain/entities/appendix.entity';
import { AppendixTypeormEntity } from '../entities/appendix.typeorm-entity';
import { AppendixMapper } from '../mappers/appendix.mapper';
import type { AppendixRepository } from '../../domain/repositories/appendix.repository';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import type { IAppendixDatabaseData } from '../../domain/interfaces/appendix-database.interface';
import type { IAppendixBlockchainData } from '../../domain/interfaces/appendix-blockchain.interface';
import { AppendixStatus } from '../../domain/enums/appendix-status.enum';

/**
 * TypeORM реализация репозитория приложений
 */
@Injectable()
export class AppendixTypeormRepository
  extends BaseBlockchainRepository<AppendixDomainEntity, AppendixTypeormEntity>
  implements AppendixRepository
{
  constructor(
    @InjectRepository(AppendixTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    repository: Repository<AppendixTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
  }

  protected getMapper() {
    return {
      toDomain: AppendixMapper.toDomain,
      toEntity: AppendixMapper.toEntity,
    };
  }

  protected createDomainEntity(
    databaseData: IAppendixDatabaseData,
    blockchainData: IAppendixBlockchainData
  ): AppendixDomainEntity {
    return new AppendixDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return AppendixDomainEntity.getSyncKey();
  }
  // Специфичные методы для AppendixRepository
  // Все типовые CRUD методы наследуются от BaseBlockchainRepository

  /**
   * Найти приложение по appendix_hash
   */
  async findByAppendixHash(appendixHash: string): Promise<AppendixDomainEntity | null> {
    const entities = await this.repository.find({ where: { appendix_hash: appendixHash.toLowerCase() } });

    return entities.length > 0 ? this.getMapper().toDomain(entities[0]) : null;
  }

  /**
   * Найти подтвержденное приложение по имени пользователя и хэшу проекта
   */
  async findConfirmedByUsernameAndProjectHash(username: string, projectHash: string): Promise<AppendixDomainEntity | null> {
    const entity = await this.repository.findOne({
      where: {
        username: username.toLowerCase(),
        project_hash: projectHash.toLowerCase(),
        status: AppendixStatus.CONFIRMED,
      },
    });

    return entity ? this.getMapper().toDomain(entity) : null;
  }

  /**
   * Найти созданное приложение по имени пользователя и хэшу проекта
   */
  async findCreatedByUsernameAndProjectHash(username: string, projectHash: string): Promise<AppendixDomainEntity | null> {
    const entity = await this.repository.findOne({
      where: {
        username,
        project_hash: projectHash.toLowerCase(),
      },
    });

    return entity ? this.getMapper().toDomain(entity) : null;
  }
}
