// infrastructure/database/typeorm/repositories/typeorm-app.repository.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LogExtensionEntity } from '../entities/log-extension.entity';
import { LogExtensionDomainRepository, LogExtensionDomainEntity } from '@coopenomics/extension-kit';
import type {
  LogExtensionFilter,
  LogExtensionPaginationOptions,
  LogExtensionPaginationResult,
} from '@coopenomics/extension-kit';
@Injectable()
export class TypeOrmLogExtensionDomainRepository<TLog = any> implements LogExtensionDomainRepository<TLog> {
  constructor(
    @InjectRepository(LogExtensionEntity)
    private readonly ormRepo: Repository<LogExtensionEntity<TLog>>
  ) {}

  async push(name: string, data: TLog): Promise<LogExtensionDomainEntity<TLog>> {
    // Находим максимальный extension_local_id для данного расширения
    const maxLocalIdResult = await this.ormRepo
      .createQueryBuilder('log')
      .select('MAX(log.extension_local_id)', 'max')
      .where('log.name = :name', { name })
      .getRawOne();

    const maxLocalId = maxLocalIdResult?.max || 0;
    const nextLocalId = maxLocalId + 1;

    // Создание сущности напрямую, без использования fromDomainEntity
    const ormEntity = this.ormRepo.create({
      name,
      extension_local_id: nextLocalId,
      data,
    });

    const savedEntity = await this.ormRepo.save(ormEntity);
    return savedEntity.toDomainEntity();
  }

  async get(): Promise<LogExtensionDomainEntity<TLog>[]> {
    const ormEntities = await this.ormRepo.find();
    return ormEntities.map((ormEntity) => ormEntity.toDomainEntity());
  }

  async getWithFilter(
    filter?: LogExtensionFilter,
    options?: LogExtensionPaginationOptions
  ): Promise<LogExtensionPaginationResult<TLog>> {
    const queryBuilder = this.ormRepo.createQueryBuilder('log');

    // Применяем фильтры
    if (filter?.name) {
      queryBuilder.andWhere('log.name = :name', { name: filter.name });
    }

    if (filter?.createdFrom) {
      queryBuilder.andWhere('log.created_at >= :createdFrom', { createdFrom: filter.createdFrom });
    }

    if (filter?.createdTo) {
      queryBuilder.andWhere('log.created_at <= :createdTo', { createdTo: filter.createdTo });
    }

    // Получаем общее количество для пагинации
    const totalCount = await queryBuilder.getCount();

    // Применяем сортировку
    const sortBy = options?.sortBy || 'created_at';
    const sortOrder = options?.sortOrder || 'DESC';
    queryBuilder.orderBy(`log.${sortBy}`, sortOrder);

    // Применяем пагинацию
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // Получаем результаты
    const ormEntities = await queryBuilder.getMany();
    const items = ormEntities.map((ormEntity) => ormEntity.toDomainEntity());

    const totalPages = Math.ceil(totalCount / limit);

    return {
      items,
      totalCount,
      totalPages,
      currentPage: page,
    };
  }
}
