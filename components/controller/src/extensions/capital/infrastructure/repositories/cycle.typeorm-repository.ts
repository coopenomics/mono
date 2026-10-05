import { CAPITAL_CYCLE_STORE } from '../database/capital-stores';
import { PaginationInputDTO, PaginationResult, PaginationUtils, type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { CycleRepository } from '../../domain/repositories/cycle.repository';
import { CycleDomainEntity } from '../../domain/entities/cycle.entity';
import { CycleTypeormEntity } from '../entities/cycle.typeorm-entity';
import { CycleMapper } from '../mappers/cycle.mapper';
import { CycleStatus } from '../../domain/enums/cycle-status.enum';
import type { CycleFilterInputDTO } from '../../application/dto/generation/cycle-filter.input';

@Injectable()
export class CycleTypeormRepository implements CycleRepository {
  constructor(
    @Inject(CAPITAL_CYCLE_STORE)
    private readonly cycleTypeormRepository: TableStore<CycleTypeormEntity>
  ) {}

  async create(cycle: CycleDomainEntity): Promise<CycleDomainEntity> {
    const entity = this.cycleTypeormRepository.create(CycleMapper.toEntity(cycle));
    const savedEntity = await this.cycleTypeormRepository.save(entity);
    return CycleMapper.toDomain(savedEntity);
  }

  async findById(_id: string): Promise<CycleDomainEntity | null> {
    const entity = await this.cycleTypeormRepository.findOne({ _id });
    return entity ? CycleMapper.toDomain(entity) : null;
  }

  async findAll(): Promise<CycleDomainEntity[]> {
    const entities = await this.cycleTypeormRepository.find();
    return entities.map(CycleMapper.toDomain);
  }

  async findByStatus(status: CycleStatus): Promise<CycleDomainEntity[]> {
    const entities = await this.cycleTypeormRepository.find({ status });
    return entities.map(CycleMapper.toDomain);
  }

  async findActiveCycles(): Promise<CycleDomainEntity[]> {
    const entities = await this.cycleTypeormRepository.find({ status: CycleStatus.ACTIVE });
    return entities.map(CycleMapper.toDomain);
  }

  async update(entity: CycleDomainEntity): Promise<CycleDomainEntity> {
    const typeormEntity = CycleMapper.toEntity(entity);
    await this.cycleTypeormRepository.update({ _id: entity._id }, typeormEntity);
    const updatedEntity = await this.cycleTypeormRepository.findOne({ _id: entity._id });
    return updatedEntity ? CycleMapper.toDomain(updatedEntity) : entity;
  }

  async delete(_id: string): Promise<void> {
    await this.cycleTypeormRepository.delete({ _id: _id });
  }

  /**
   * Найти цикл с задачами
   */
  async findByIdWithIssues(cycleId: string): Promise<CycleDomainEntity | null> {
    const entity = await this.cycleTypeormRepository.findOne({ _id: cycleId });
    return entity ? CycleMapper.toDomain(entity) : null;
  }

  /**
   * Найти активный цикл с задачами
   */
  async findActiveCycleWithIssues(): Promise<CycleDomainEntity | null> {
    const entity = await this.cycleTypeormRepository.findOne({ status: CycleStatus.ACTIVE }, { order: { _created_at: 'DESC' } });
    return entity ? CycleMapper.toDomain(entity) : null;
  }

  async findAllPaginated(
    filter?: CycleFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<CycleDomainEntity>> {
    // Валидируем параметры пагинации
    const validatedOptions: PaginationInputDTO = options
      ? PaginationUtils.validatePaginationOptions(options)
      : {
          page: 1,
          limit: 10,
          sortBy: undefined,
          sortOrder: 'ASC' as const,
        };

    // Получаем параметры для SQL запроса
    const { limit, offset } = PaginationUtils.getSqlPaginationParams(validatedOptions);

    // Строим условия поиска
    const where: any = {};
    if (filter?.name) {
      where.name = filter.name;
    }
    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.start_date) {
      where.start_date = filter.start_date;
    }
    if (filter?.end_date) {
      where.end_date = filter.end_date;
    }
    if (filter?.is_active) {
      where.status = CycleStatus.ACTIVE;
    }

    // Получаем общее количество записей
    const totalCount = await this.cycleTypeormRepository.count(where);

    // Получаем записи с пагинацией
    const orderBy: any = {};
    // Имя вне колонок — сортировка по умолчанию: до 25.09.2026 оно уходило в
    // ORDER BY и роняло список ошибкой 500 (C28-80).
    const sortColumn = this.cycleTypeormRepository.sortField(validatedOptions.sortBy, 'start_date');
    orderBy[sortColumn] = sortColumn === validatedOptions.sortBy ? validatedOptions.sortOrder : 'DESC';

    const entities = await this.cycleTypeormRepository.find(where, { order: orderBy, limit: limit, offset: offset });

    // Преобразуем в доменные сущности
    const items = entities.map((entity) => CycleMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }
}
