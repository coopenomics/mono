import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IssueRepository } from '../../domain/repositories/issue.repository';
import { IssueDomainEntity } from '../../domain/entities/issue.entity';
import { IssueTypeormEntity } from '../entities/issue.typeorm-entity';
import { IssueMapper } from '../mappers/issue.mapper';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';
import type { IssuePriority } from '../../domain/enums/issue-priority.enum';
import { IssueStatus } from '../../domain/enums/issue-status.enum';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { IssueFilterInputDTO } from '../../application/dto/generation/issue-filter.input';
import { PaginationUtils } from '~/shared/utils/pagination.utils';

@Injectable()
export class IssueTypeormRepository implements IssueRepository {
  constructor(
    @InjectRepository(IssueTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    private readonly issueTypeormRepository: Repository<IssueTypeormEntity>,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async create(issue: IssueDomainEntity): Promise<IssueDomainEntity> {
    const entity = this.issueTypeormRepository.create(IssueMapper.toEntity(issue));
    const savedEntity = await this.issueTypeormRepository.save(entity);
    const createdIssue = IssueMapper.toDomain(savedEntity);
    
    // Испускаем событие для синхронизации с GitHub
    this.eventEmitter.emit('issue.created', createdIssue);
    
    return createdIssue;
  }

  async findById(_id: string): Promise<IssueDomainEntity | null> {
    const entity = await this.issueTypeormRepository.findOne({ where: { _id } });
    return entity ? IssueMapper.toDomain(entity) : null;
  }

  async findByIssueHash(issueHash: string): Promise<IssueDomainEntity | null> {
    const entity = await this.issueTypeormRepository.findOne({ where: { issue_hash: issueHash } });
    return entity ? IssueMapper.toDomain(entity) : null;
  }

  async findAll(): Promise<IssueDomainEntity[]> {
    const entities = await this.issueTypeormRepository.find();
    return entities.map(IssueMapper.toDomain);
  }

  async findByProjectHash(projectHash: string): Promise<IssueDomainEntity[]> {
    const entities = await this.issueTypeormRepository.find({
      where: { project_hash: projectHash },
    });
    return entities.map(IssueMapper.toDomain);
  }

  async findByCreatedBy(createdBy: string): Promise<IssueDomainEntity[]> {
    const entities = await this.issueTypeormRepository.find({
      where: { created_by: createdBy },
    });
    return entities.map(IssueMapper.toDomain);
  }

  async findByCreators(creatorsUsernames: string[]): Promise<IssueDomainEntity[]> {
    const entities = await this.issueTypeormRepository
      .createQueryBuilder('issue')
      .where('issue.creators && :creatorsUsernames', { creatorsUsernames })
      .getMany();

    return entities.map(IssueMapper.toDomain);
  }

  async findByStatusAndCreators(status: IssueStatus, creatorsUsernames: string[]): Promise<IssueDomainEntity[]> {
    const entities = await this.issueTypeormRepository
      .createQueryBuilder('issue')
      .where('issue.status = :status', { status })
      .andWhere('issue.creators && :creatorsUsernames', { creatorsUsernames })
      .getMany();

    return entities.map(IssueMapper.toDomain);
  }

  async findCompletedByProjectAndCreators(projectHash: string, creatorsUsernames: string[]): Promise<IssueDomainEntity[]> {
    const entities = await this.issueTypeormRepository
      .createQueryBuilder('issue')
      .where('issue.status = :status', { status: IssueStatus.DONE })
      .andWhere('issue.project_hash = :projectHash', { projectHash })
      .andWhere('issue.creators && :creatorsUsernames', { creatorsUsernames })
      .getMany();

    return entities.map(IssueMapper.toDomain);
  }

  async findBySubmaster(submasterUsername: string): Promise<IssueDomainEntity[]> {
    const entities = await this.issueTypeormRepository.find({
      where: { submaster: submasterUsername },
    });
    return entities.map(IssueMapper.toDomain);
  }

  async findByCycleId(cycleId: string): Promise<IssueDomainEntity[]> {
    const entities = await this.issueTypeormRepository.find({
      where: { cycle_id: cycleId },
    });
    return entities.map(IssueMapper.toDomain);
  }

  async findByStatus(status: IssueStatus): Promise<IssueDomainEntity[]> {
    const entities = await this.issueTypeormRepository.find({
      where: { status },
    });
    return entities.map(IssueMapper.toDomain);
  }

  async findByPriority(priority: IssuePriority): Promise<IssueDomainEntity[]> {
    const entities = await this.issueTypeormRepository.find({
      where: { priority },
    });
    return entities.map(IssueMapper.toDomain);
  }

  async findByStatuses(statuses: IssueStatus[]): Promise<IssueDomainEntity[]> {
    const entities = await this.issueTypeormRepository
      .createQueryBuilder('issue')
      .where('issue.status = ANY(:statuses)', { statuses })
      .getMany();
    return entities.map(IssueMapper.toDomain);
  }

  async findByPriorities(priorities: IssuePriority[]): Promise<IssueDomainEntity[]> {
    const entities = await this.issueTypeormRepository
      .createQueryBuilder('issue')
      .where('issue.priority = ANY(:priorities)', { priorities })
      .getMany();
    return entities.map(IssueMapper.toDomain);
  }

  async update(entity: IssueDomainEntity): Promise<IssueDomainEntity> {
    // Берем полную сущность из БД для корректного обновления complex полей (arrays)
    const existingEntity = await this.issueTypeormRepository.findOne({ where: { _id: entity._id } });
    if (!existingEntity) {
      throw new Error(`Issue with _id ${entity._id} not found`);
    }

    // Мерджим изменения
    Object.assign(existingEntity, IssueMapper.toEntity(entity));

    // Сохраняем полную сущность (save вместо update для array/json полей)
    const savedEntity = await this.issueTypeormRepository.save(existingEntity);
    const updatedIssue = IssueMapper.toDomain(savedEntity);
    
    // Испускаем событие для синхронизации с GitHub
    this.eventEmitter.emit('issue.updated', updatedIssue);
    
    return updatedIssue;
  }

  async delete(_id: string): Promise<void> {
    await this.issueTypeormRepository.delete(_id);
  }

  /**
   * Найти задачу с комментариями
   */
  async findByIdWithComments(issueId: string): Promise<IssueDomainEntity | null> {
    const entity = await this.issueTypeormRepository.findOne({
      where: { _id: issueId },
      relations: ['comments'],
    });
    return entity ? IssueMapper.toDomain(entity) : null;
  }

  /**
   * Найти задачу с историями
   */
  async findByIdWithStories(issueId: string): Promise<IssueDomainEntity | null> {
    const entity = await this.issueTypeormRepository.findOne({
      where: { _id: issueId },
      relations: ['stories'],
    });
    return entity ? IssueMapper.toDomain(entity) : null;
  }

  /**
   * Найти задачу со всеми связанными данными
   */
  async findByIdWithAllRelations(issueId: string): Promise<IssueDomainEntity | null> {
    const entity = await this.issueTypeormRepository.findOne({
      where: { _id: issueId },
      relations: ['comments', 'stories', 'project', 'cycle'],
    });
    return entity ? IssueMapper.toDomain(entity) : null;
  }

  /**
   * Найти задачи проекта с комментариями
   */
  async findByProjectHashWithComments(projectHash: string): Promise<IssueDomainEntity[]> {
    const entities = await this.issueTypeormRepository.find({
      where: { project_hash: projectHash },
      relations: ['comments'],
      order: { sort_order: 'ASC' },
    });
    return entities.map(IssueMapper.toDomain);
  }

  /**
   * Найти задачи проекта с историями
   */
  async findByProjectHashWithStories(projectHash: string): Promise<IssueDomainEntity[]> {
    const entities = await this.issueTypeormRepository.find({
      where: { project_hash: projectHash },
      relations: ['stories'],
      order: { sort_order: 'ASC' },
    });
    return entities.map(IssueMapper.toDomain);
  }

  async findAllPaginated(
    filter?: IssueFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<IssueDomainEntity>> {
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

    // Создаем query builder для гибкого построения запроса
    let queryBuilder = this.issueTypeormRepository.createQueryBuilder('i').select('i').where('1=1'); // Начальное условие для удобства добавления AND

    // Применяем базовые фильтры
    if (filter?.title) {
      queryBuilder = queryBuilder.andWhere('i.title = :title', { title: filter.title });
    }
    if (filter?.coopname) {
      queryBuilder = queryBuilder.andWhere('i.coopname = :coopname', { coopname: filter.coopname });
    }
    if (filter?.project_hash) {
      queryBuilder = queryBuilder.andWhere('i.project_hash = :project_hash', { project_hash: filter.project_hash });
    }
    if (filter?.created_by) {
      queryBuilder = queryBuilder.andWhere('i.created_by = :created_by', { created_by: filter.created_by });
    }
    if (filter?.submaster) {
      queryBuilder = queryBuilder.andWhere('i.submaster = :submaster', { submaster: filter.submaster });
    }
    if (filter?.cycle_id) {
      queryBuilder = queryBuilder.andWhere('i.cycle_id = :cycle_id', { cycle_id: filter.cycle_id });
    }

    // Фильтрация по массивам статусов
    if (filter?.statuses?.length) {
      queryBuilder = queryBuilder.andWhere('i.status = ANY(:statuses)', { statuses: filter.statuses });
    }

    // Фильтрация по массивам приоритетов
    if (filter?.priorities?.length) {
      queryBuilder = queryBuilder.andWhere('i.priority = ANY(:priorities)', { priorities: filter.priorities });
    }

    // Фильтрация по массиву имен пользователей создателей
    if (filter?.creators?.length) {
      queryBuilder = queryBuilder.andWhere('i.creators IN (:...creators)', {
        creators: filter.creators,
      });
    }

    // Фильтрация по имени пользователя мастера проекта
    if (filter?.master) {
      queryBuilder = queryBuilder.andWhere(
        'EXISTS (SELECT 1 FROM capital_projects p WHERE i.project_hash = p.project_hash AND p.master = :master)',
        { master: filter.master }
      );
    }

    // Получаем общее количество записей
    const totalCount = await queryBuilder.getCount();

    // Применяем сортировку
    if (validatedOptions.sortBy) {
      queryBuilder = queryBuilder.orderBy(`i.${validatedOptions.sortBy}`, validatedOptions.sortOrder);
    } else {
      queryBuilder = queryBuilder.orderBy('i._created_at', 'DESC');
    }

    // Применяем пагинацию
    queryBuilder = queryBuilder.skip(offset).take(limit);

    // Получаем записи
    const entities = await queryBuilder.getMany();

    // Преобразуем в доменные сущности
    const items = entities.map((entity) => IssueMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }
}
