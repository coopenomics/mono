import { CAPITAL_ISSUE_STORE } from '../database/capital-stores';
import { PaginationInputDTO, PaginationResult, PaginationUtils, type TableStore, type SqlBuilder } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IssueRepository } from '../../domain/repositories/issue.repository';
import { IssueDomainEntity } from '../../domain/entities/issue.entity';
import { IssueRecord } from '../entities/issue.record';
import { IssueMapper } from '../mappers/issue.mapper';
import type { IssuePriority } from '../../domain/enums/issue-priority.enum';
import { IssueStatus } from '../../domain/enums/issue-status.enum';
import type { IssueFilterInputDTO } from '../../application/dto/generation/issue-filter.input';
import type { ArtifactAccessScope } from '../../domain/repositories/artifact-access-scope';

@Injectable()
export class IssueKyselyRepository implements IssueRepository {
  constructor(
    @Inject(CAPITAL_ISSUE_STORE)
    private readonly issueKyselyRepository: TableStore<IssueRecord>,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async create(issue: IssueDomainEntity): Promise<IssueDomainEntity> {
    const entity = this.issueKyselyRepository.create(IssueMapper.toEntity(issue));
    const savedEntity = await this.issueKyselyRepository.save(entity);
    const createdIssue = IssueMapper.toDomain(savedEntity);
    
    // Испускаем событие для синхронизации с GitHub
    this.eventEmitter.emit('issue.created', createdIssue);
    
    return createdIssue;
  }

  async findById(_id: string): Promise<IssueDomainEntity | null> {
    const entity = await this.issueKyselyRepository.findOne({ _id });
    return entity ? IssueMapper.toDomain(entity) : null;
  }

  async findByIssueHash(issueHash: string): Promise<IssueDomainEntity | null> {
    const entity = await this.issueKyselyRepository.findOne({ issue_hash: issueHash.toLowerCase() });
    return entity ? IssueMapper.toDomain(entity) : null;
  }

  async findByCoopnameAndClientId(coopname: string, clientId: string): Promise<IssueDomainEntity | null> {
    const entity = await this.issueKyselyRepository.findOne({ coopname, id: clientId });
    return entity ? IssueMapper.toDomain(entity) : null;
  }

  async getNextFreeIssueId(coopname: string): Promise<string> {
    const raw = await this.issueKyselyRepository
      .sqlBuilder('issue')
      .select(
        `MAX(CAST(SUBSTRING(issue.id FROM 5) AS INTEGER))`,
        'max_num',
      )
      .where('issue.coopname = :coopname', { coopname })
      .andWhere(`issue.id ~ '^000-[0-9]+$'`)
      .getRawOne<{ max_num: string | number | null }>();

    const maxNum = raw?.max_num == null ? 0 : Number(raw.max_num);
    const next = Number.isFinite(maxNum) ? maxNum + 1 : 1;
    return `000-${next}`;
  }

  async findAll(): Promise<IssueDomainEntity[]> {
    const entities = await this.issueKyselyRepository.find();
    return entities.map(IssueMapper.toDomain);
  }

  async findByProjectHash(projectHash: string): Promise<IssueDomainEntity[]> {
    const entities = await this.issueKyselyRepository.find({ project_hash: projectHash });
    return entities.map(IssueMapper.toDomain);
  }

  async findByCreatedBy(createdBy: string): Promise<IssueDomainEntity[]> {
    const entities = await this.issueKyselyRepository.find({ created_by: createdBy });
    return entities.map(IssueMapper.toDomain);
  }

  async findByCreators(creatorsUsernames: string[]): Promise<IssueDomainEntity[]> {
    const entities = await this.issueKyselyRepository
      .sqlBuilder('issue')
      .where('issue.creators && :creatorsUsernames', { creatorsUsernames })
      .getMany();

    return entities.map(IssueMapper.toDomain);
  }

  async findByStatusAndCreators(status: IssueStatus, creatorsUsernames: string[]): Promise<IssueDomainEntity[]> {
    const entities = await this.issueKyselyRepository
      .sqlBuilder('issue')
      .where('issue.status = :status', { status })
      .andWhere('issue.creators && :creatorsUsernames', { creatorsUsernames })
      .getMany();

    return entities.map(IssueMapper.toDomain);
  }

  async findCompletedByProjectAndCreators(projectHash: string, creatorsUsernames: string[]): Promise<IssueDomainEntity[]> {
    const entities = await this.issueKyselyRepository
      .sqlBuilder('issue')
      .where('issue.status = :status', { status: IssueStatus.DONE })
      .andWhere('issue.project_hash = :projectHash', { projectHash })
      .andWhere('issue.creators && :creatorsUsernames', { creatorsUsernames })
      .getMany();

    return entities.map(IssueMapper.toDomain);
  }

  async findBySubmaster(submasterUsername: string): Promise<IssueDomainEntity[]> {
    const entities = await this.issueKyselyRepository.find({ submaster: submasterUsername });
    return entities.map(IssueMapper.toDomain);
  }

  async findByCycleId(cycleId: string): Promise<IssueDomainEntity[]> {
    const entities = await this.issueKyselyRepository.find({ cycle_id: cycleId });
    return entities.map(IssueMapper.toDomain);
  }

  async findByStatus(status: IssueStatus): Promise<IssueDomainEntity[]> {
    const entities = await this.issueKyselyRepository.find({ status });
    return entities.map(IssueMapper.toDomain);
  }

  async findByPriority(priority: IssuePriority): Promise<IssueDomainEntity[]> {
    const entities = await this.issueKyselyRepository.find({ priority });
    return entities.map(IssueMapper.toDomain);
  }

  async findByStatuses(statuses: IssueStatus[]): Promise<IssueDomainEntity[]> {
    const entities = await this.issueKyselyRepository
      .sqlBuilder('issue')
      .where('issue.status = ANY(:statuses)', { statuses })
      .getMany();
    return entities.map(IssueMapper.toDomain);
  }

  async findByPriorities(priorities: IssuePriority[]): Promise<IssueDomainEntity[]> {
    const entities = await this.issueKyselyRepository
      .sqlBuilder('issue')
      .where('issue.priority = ANY(:priorities)', { priorities })
      .getMany();
    return entities.map(IssueMapper.toDomain);
  }

  async update(entity: IssueDomainEntity): Promise<IssueDomainEntity> {
    // Берем полную сущность из БД для корректного обновления complex полей (arrays)
    const existingEntity = await this.issueKyselyRepository.findOne({ _id: entity._id });
    if (!existingEntity) {
      throw new Error(`Issue with _id ${entity._id} not found`);
    }

    // Мерджим изменения
    Object.assign(existingEntity, IssueMapper.toEntity(entity));

    // Сохраняем полную сущность (save вместо update для array/json полей)
    const savedEntity = await this.issueKyselyRepository.save(existingEntity);
    const updatedIssue = IssueMapper.toDomain(savedEntity);
    
    // Испускаем событие для синхронизации с GitHub
    this.eventEmitter.emit('issue.updated', updatedIssue);
    
    return updatedIssue;
  }

  async delete(_id: string): Promise<void> {
    await this.issueKyselyRepository.delete({ _id: _id });
  }

  /**
   * Найти задачу с комментариями
   */
  async findByIdWithComments(issueId: string): Promise<IssueDomainEntity | null> {
    const entity = await this.issueKyselyRepository.findOne({ _id: issueId });
    return entity ? IssueMapper.toDomain(entity) : null;
  }

  /**
   * Найти задачу с историями
   */
  async findByIdWithStories(issueId: string): Promise<IssueDomainEntity | null> {
    const entity = await this.issueKyselyRepository.findOne({ _id: issueId });
    return entity ? IssueMapper.toDomain(entity) : null;
  }

  /**
   * Найти задачу со всеми связанными данными
   */
  async findByIdWithAllRelations(issueId: string): Promise<IssueDomainEntity | null> {
    const entity = await this.issueKyselyRepository.findOne({ _id: issueId });
    return entity ? IssueMapper.toDomain(entity) : null;
  }

  /**
   * Найти задачи проекта с комментариями
   */
  async findByProjectHashWithComments(projectHash: string): Promise<IssueDomainEntity[]> {
    const entities = await this.issueKyselyRepository.find({ project_hash: projectHash }, { order: { sort_order: 'ASC' } });
    return entities.map(IssueMapper.toDomain);
  }

  /**
   * Найти задачи проекта с историями
   */
  async findByProjectHashWithStories(projectHash: string): Promise<IssueDomainEntity[]> {
    const entities = await this.issueKyselyRepository.find({ project_hash: projectHash }, { order: { sort_order: 'ASC' } });
    return entities.map(IssueMapper.toDomain);
  }

  /** Условия списка задач по фильтру; незаданное поле условия не даёт. */
  private applyFilters(queryBuilder: SqlBuilder<IssueRecord>, filter?: IssueFilterInputDTO): void {
    if (!filter) return;
    for (const field of ['title', 'coopname', 'project_hash', 'created_by', 'submaster', 'cycle_id'] as const) {
      if (filter[field]) queryBuilder.andWhere(`i.${field} = :${field}`, { [field]: filter[field] });
    }

    // Фильтрация по массивам статусов
    if (filter.statuses?.length) {
      queryBuilder.andWhere('i.status = ANY(:statuses)', { statuses: filter.statuses });
    }

    // Фильтрация по массивам приоритетов
    if (filter.priorities?.length) {
      queryBuilder.andWhere('i.priority = ANY(:priorities)', { priorities: filter.priorities });
    }

    // Фильтрация по пересечению text[] creators с именами исполнителей
    if (filter.creators?.length) {
      queryBuilder.andWhere('i.creators && :creators', {
        creators: filter.creators,
      });
    }

    // Фильтрация по имени пользователя мастера проекта
    if (filter.master) {
      queryBuilder.andWhere(
        'EXISTS (SELECT 1 FROM capital_projects p WHERE i.project_hash = p.project_hash AND p.master = :master)',
        { master: filter.master }
      );
    }
  }

  /**
   * Ограничение правами доступа.
   */
  private applyScope(queryBuilder: SqlBuilder<IssueRecord>, scope?: ArtifactAccessScope): void {
    // Ограничение правами доступа: задачи разрешённых проектов плюс собственная работа пайщика.
    // Своё видно всегда — постановщик, ответственный и исполнитель не должны терять задачу из
    // списка, даже если допуск к проекту ещё не оформлен или уже снят. Отсев именно здесь, а не
    // после выборки, иначе totalCount/totalPages считаются по недоступным строкам.
    if (!scope) return;
    const scopeHashes = scope.projectHashes.map((hash) => hash.toLowerCase());
    const scopeUser = scope.username ?? null;
    queryBuilder.andWhere(
      `(
        lower(i.project_hash) = ANY(CAST(:scopeHashes AS text[]))
        OR (
          CAST(:scopeUser AS text) IS NOT NULL
          AND (
            i.created_by = CAST(:scopeUser AS text)
            OR i.submaster = CAST(:scopeUser AS text)
            OR CAST(:scopeUser AS text) = ANY(i.creators)
          )
        )
      )`,
      { scopeHashes, scopeUser }
    );
  }

  async findAllPaginated(
    filter?: IssueFilterInputDTO,
    options?: PaginationInputDTO,
    scope?: ArtifactAccessScope
  ): Promise<PaginationResult<IssueDomainEntity>> {
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

    // Создаем query builder для гибкого построения запроса
    const queryBuilder = this.issueKyselyRepository.sqlBuilder('i').select('i').where('1=1'); // Начальное условие для удобства добавления AND

    this.applyFilters(queryBuilder, filter);
    this.applyScope(queryBuilder, scope);

    // Получаем общее количество записей
    const totalCount = await queryBuilder.getCount();

    // Применяем сортировку
    const sortColumn = this.issueKyselyRepository.sortField(validatedOptions.sortBy, '_created_at');
    queryBuilder.orderBy(
      `i.${sortColumn}`,
      validatedOptions.sortBy ? validatedOptions.sortOrder : 'DESC'
    );

    // Применяем пагинацию
    queryBuilder.offset(offset).limit(limit);

    // Получаем записи
    const entities = await queryBuilder.getMany();

    // Преобразуем в доменные сущности
    const items = entities.map((entity) => IssueMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }
}
