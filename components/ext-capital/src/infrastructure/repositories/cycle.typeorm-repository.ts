import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CycleRepository } from '../../domain/repositories/cycle.repository';
import { CycleDomainEntity } from '../../domain/entities/cycle.entity';
import { CycleTypeormEntity } from '../entities/cycle.typeorm-entity';
import { CycleMapper } from '../mappers/cycle.mapper';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';
import { CycleStatus } from '../../domain/enums/cycle-status.enum';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { CycleFilterInputDTO } from '../../application/dto/generation/cycle-filter.input';
import { PaginationUtils } from '~/shared/utils/pagination.utils';

@Injectable()
export class CycleTypeormRepository implements CycleRepository {
  constructor(
    @InjectRepository(CycleTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    private readonly cycleTypeormRepository: Repository<CycleTypeormEntity>
  ) {}

  async create(cycle: CycleDomainEntity): Promise<CycleDomainEntity> {
    const entity = this.cycleTypeormRepository.create(CycleMapper.toEntity(cycle));
    const savedEntity = await this.cycleTypeormRepository.save(entity);
    return CycleMapper.toDomain(savedEntity);
  }

  async findById(_id: string): Promise<CycleDomainEntity | null> {
    const entity = await this.cycleTypeormRepository.findOne({ where: { _id } });
    return entity ? CycleMapper.toDomain(entity) : null;
  }

  async findAll(): Promise<CycleDomainEntity[]> {
    const entities = await this.cycleTypeormRepository.find();
    return entities.map(CycleMapper.toDomain);
  }

  async findByStatus(status: CycleStatus): Promise<CycleDomainEntity[]> {
    const entities = await this.cycleTypeormRepository.find({ where: { status } });
    return entities.map(CycleMapper.toDomain);
  }

  async findActiveCycles(): Promise<CycleDomainEntity[]> {
    const entities = await this.cycleTypeormRepository.find({
      where: { status: CycleStatus.ACTIVE },
    });
    return entities.map(CycleMapper.toDomain);
  }

  async update(entity: CycleDomainEntity): Promise<CycleDomainEntity> {
    const typeormEntity = CycleMapper.toEntity(entity);
    await this.cycleTypeormRepository.update(entity._id, typeormEntity);
    const updatedEntity = await this.cycleTypeormRepository.findOne({
      where: { _id: entity._id },
    });
    return updatedEntity ? CycleMapper.toDomain(updatedEntity) : entity;
  }

  async delete(_id: string): Promise<void> {
    await this.cycleTypeormRepository.delete(_id);
  }

  /**
   * Найти цикл с задачами
   */
  async findByIdWithIssues(cycleId: string): Promise<CycleDomainEntity | null> {
    const entity = await this.cycleTypeormRepository.findOne({
      where: { _id: cycleId },
      relations: ['issues'],
    });
    return entity ? CycleMapper.toDomain(entity) : null;
  }

  /**
   * Найти активный цикл с задачами
   */
  async findActiveCycleWithIssues(): Promise<CycleDomainEntity | null> {
    const entity = await this.cycleTypeormRepository.findOne({
      where: { status: CycleStatus.ACTIVE },
      relations: ['issues'],
      order: { _created_at: 'DESC' },
    });
    return entity ? CycleMapper.toDomain(entity) : null;
  }

  async findAllPaginated(
    filter?: CycleFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<CycleDomainEntity>> {
    // Валидируем параметры пагинации
    const validatedOptions: PaginationInputDomainInterface = options
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
    const totalCount = await this.cycleTypeormRepository.count({ where });

    // Получаем записи с пагинацией
    const orderBy: any = {};
    if (validatedOptions.sortBy) {
      orderBy[validatedOptions.sortBy] = validatedOptions.sortOrder;
    } else {
      orderBy.start_date = 'DESC';
    }

    const entities = await this.cycleTypeormRepository.find({
      where,
      skip: offset,
      take: limit,
      order: orderBy,
    });

    // Преобразуем в доменные сущности
    const items = entities.map((entity) => CycleMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }
}
