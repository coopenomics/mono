import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AppendixDomainEntity } from '../../domain/entities/appendix.entity';
import { AppendixTypeormEntity } from '../entities/appendix.typeorm-entity';
import { AppendixMapper } from '../mappers/appendix.mapper';
import type { AppendixRepository } from '../../domain/repositories/appendix.repository';
import { BaseBlockchainRepository, EntityVersioningService } from '@coopenomics/extension-kit/sync';
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
    @InjectRepository(AppendixTypeormEntity)
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
   * Найти приложение со статусом created (запрос на рассмотрении)
   * по имени пользователя и хэшу проекта
   */
  async findCreatedByUsernameAndProjectHash(username: string, projectHash: string): Promise<AppendixDomainEntity | null> {
    const entity = await this.repository.findOne({
      where: {
        username: username.toLowerCase(),
        project_hash: projectHash.toLowerCase(),
        status: AppendixStatus.CREATED,
      },
    });

    return entity ? this.getMapper().toDomain(entity) : null;
  }

  async findDistinctUsernamesWithConfirmedClearanceByProjectHash(projectHash: string): Promise<string[]> {
    const rows = await this.repository
      .createQueryBuilder('a')
      .select('a.username', 'username')
      .distinct(true)
      .where('a.project_hash = :ph', { ph: projectHash.toLowerCase() })
      .andWhere('a.status = :st', { st: AppendixStatus.CONFIRMED })
      .andWhere('a.username IS NOT NULL')
      .getRawMany<{ username: string }>();

    return rows.map((r) => r.username).filter((u): u is string => Boolean(u));
  }

  async findDistinctProjectHashesWithConfirmedClearanceByUsername(username: string): Promise<string[]> {
    const rows = await this.repository
      .createQueryBuilder('a')
      .select('a.project_hash', 'project_hash')
      .distinct(true)
      .where('LOWER(a.username) = LOWER(:un)', { un: username })
      .andWhere('a.status = :st', { st: AppendixStatus.CONFIRMED })
      .andWhere('a.project_hash IS NOT NULL')
      .getRawMany<{ project_hash: string }>();

    return rows.map((r) => r.project_hash).filter((h): h is string => Boolean(h));
  }
}
