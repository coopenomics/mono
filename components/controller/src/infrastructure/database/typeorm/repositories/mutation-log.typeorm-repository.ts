import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { MutationLogEntity } from '../entities/mutation-log.entity';
import type { MutationLogRepository } from '~/domain/mutation-log/repositories/mutation-log.repository';
import type { MutationLogDomainEntity } from '~/domain/mutation-log/entities/mutation-log-domain.entity';
import type {
  IMutationLogFilterDomainInterface,
  ICreateMutationLogDomainInterface,
} from '~/domain/mutation-log/interfaces/mutation-log-domain.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { PaginationUtils } from '@coopenomics/extension-kit';

/**
 * TypeORM реализация репозитория логов мутаций
 */
@Injectable()
export class MutationLogTypeormRepository implements MutationLogRepository {
  constructor(
    @InjectRepository(MutationLogEntity)
    private readonly repository: Repository<MutationLogEntity>
  ) {}

  /**
   * Создание новой записи лога мутации
   */
  async create(log: ICreateMutationLogDomainInterface): Promise<MutationLogDomainEntity> {
    const entity = this.repository.create(log);
    const savedEntity = await this.repository.save(entity);
    return this.toDomain(savedEntity);
  }

  /**
   * Поиск лога по ID
   */
  async findById(id: string): Promise<MutationLogDomainEntity | null> {
    const entity = await this.repository.findOne({ where: { _id: id } });
    return entity ? this.toDomain(entity) : null;
  }

  /**
   * Получение всех логов с фильтрацией и пагинацией
   */
  async findAll(
    filter?: IMutationLogFilterDomainInterface,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<MutationLogDomainEntity>> {
    const where: any = {};

    if (filter) {
      if (filter.coopname) {
        where.coopname = filter.coopname;
      }
      if (filter.mutation_name) {
        where.mutation_name = filter.mutation_name;
      }
      if (filter.mutation_names && filter.mutation_names.length > 0) {
        where.mutation_name = In(filter.mutation_names);
      }
      if (filter.username) {
        where.username = filter.username;
      }
      if (filter.status) {
        where.status = filter.status;
      }
      if (filter.date_from || filter.date_to) {
        where.created_at = Between(filter.date_from || new Date(0), filter.date_to || new Date());
      }
    }

    const { page = 1, limit = 10 } = options || {};
    const skip = (page - 1) * limit;

    const [entities, totalCount] = await this.repository.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    const items = entities.map((entity) => this.toDomain(entity));

    return PaginationUtils.createPaginationResult(items, totalCount, { page, limit, sortOrder: 'DESC' });
  }

  /**
   * Получение логов по имени мутации
   */
  async findByMutationName(
    mutationName: string,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<MutationLogDomainEntity>> {
    return this.findAll({ mutation_name: mutationName }, options);
  }

  /**
   * Получение логов по пользователю
   */
  async findByUsername(
    username: string,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<MutationLogDomainEntity>> {
    return this.findAll({ username }, options);
  }

  /**
   * Удаление лога
   */
  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  /**
   * Преобразование TypeORM сущности в доменную
   */
  private toDomain(entity: MutationLogEntity): MutationLogDomainEntity {
    return {
      _id: entity._id,
      coopname: entity.coopname,
      mutation_name: entity.mutation_name,
      username: entity.username,
      arguments: entity.arguments,
      duration_ms: entity.duration_ms,
      status: entity.status,
      error_message: entity.error_message,
      created_at: entity.created_at,
    } as MutationLogDomainEntity;
  }
}
