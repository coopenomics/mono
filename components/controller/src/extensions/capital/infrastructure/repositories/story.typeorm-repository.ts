import { CAPITAL_STORY_STORE } from '../database/capital-stores';
import { isNull, PaginationInputDTO, PaginationResult, PaginationUtils, type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StoryRepository } from '../../domain/repositories/story.repository';
import { StoryDomainEntity } from '../../domain/entities/story.entity';
import { StoryTypeormEntity } from '../entities/story.typeorm-entity';
import { StoryMapper } from '../mappers/story.mapper';
import type { StoryStatus } from '../../domain/enums/story-status.enum';
import type { StoryFilterInputDTO } from '../../application/dto/generation/story-filter.input';
import type { ArtifactAccessScope } from '../../domain/repositories/artifact-access-scope';

@Injectable()
export class StoryTypeormRepository implements StoryRepository {
  constructor(
    @Inject(CAPITAL_STORY_STORE)
    private readonly storyTypeormRepository: TableStore<StoryTypeormEntity>,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async create(story: StoryDomainEntity): Promise<StoryDomainEntity> {
    const entity = this.storyTypeormRepository.create(StoryMapper.toEntity(story));
    const savedEntity = await this.storyTypeormRepository.save(entity);
    const createdStory = StoryMapper.toDomain(savedEntity);
    
    // Испускаем событие для синхронизации с GitHub
    this.eventEmitter.emit('story.created', createdStory);
    
    return createdStory;
  }

  async findById(_id: string): Promise<StoryDomainEntity | null> {
    const entity = await this.storyTypeormRepository.findOne({ _id });
    return entity ? StoryMapper.toDomain(entity) : null;
  }

  async findByStoryHash(storyHash: string): Promise<StoryDomainEntity | null> {
    const entity = await this.storyTypeormRepository.findOne({ story_hash: storyHash });
    return entity ? StoryMapper.toDomain(entity) : null;
  }

  async findAll(): Promise<StoryDomainEntity[]> {
    const entities = await this.storyTypeormRepository.find();
    return entities.map(StoryMapper.toDomain);
  }

  async findByProjectHash(projectHash: string): Promise<StoryDomainEntity[]> {
    // Ищем только проектные истории (без привязки к задачам)
    const entities = await this.storyTypeormRepository.find({
        project_hash: projectHash,
        issue_hash: isNull(), // Только проектные истории
      }, { order: { sort_order: 'ASC' } });
    return entities.map(StoryMapper.toDomain);
  }

  /**
   * Найти все истории проекта (проектные + истории всех задач проекта)
   */
  async findAllByProjectHash(projectHash: string): Promise<StoryDomainEntity[]> {
    // Используем query builder для более сложного запроса
    const entities = await this.storyTypeormRepository
      .sqlBuilder('story')
      .leftJoin('capital_issues', 'issue', 'issue.issue_hash = story.issue_hash')
      .where('story.project_hash = :projectHash', { projectHash })
      .andWhere('(story.issue_hash IS NULL OR issue.project_hash = :projectHash)', { projectHash })
      .orderBy('story.sort_order', 'ASC')
      .getMany();

    return entities.map(StoryMapper.toDomain);
  }

  /**
   * Найти все истории по нескольким project_hash и issue_hash
   */
  async findAllByProjectHashesAndIssueHashes(projectHashes: string[], issueHashes: string[]): Promise<StoryDomainEntity[]> {
    if (projectHashes.length === 0 && issueHashes.length === 0) {
      return [];
    }

    const query = this.storyTypeormRepository.sqlBuilder('story');

    const conditions: string[] = [];
    const parameters: any = {};

    // Условие по project_hash (проектные требования)
    if (projectHashes.length > 0) {
      conditions.push('story.project_hash IN (:...projectHashes)');
      parameters.projectHashes = projectHashes;
    }

    // Условие по issue_hash (задачные требования)
    if (issueHashes.length > 0) {
      conditions.push('story.issue_hash IN (:...issueHashes)');
      parameters.issueHashes = issueHashes;
    }

    const entities = await query.where(conditions.join(' OR '), parameters).orderBy('story.sort_order', 'ASC').getMany();

    return entities.map(StoryMapper.toDomain);
  }

  /**
   * Найти только проектные истории (не привязанные к задачам)
   */
  async findProjectStories(projectHash: string): Promise<StoryDomainEntity[]> {
    const entities = await this.storyTypeormRepository.find({
        project_hash: projectHash,
        issue_hash: isNull(),
      }, { order: { sort_order: 'ASC' } });
    return entities.map(StoryMapper.toDomain);
  }

  async findByIssueHash(issueHash: string): Promise<StoryDomainEntity[]> {
    const entities = await this.storyTypeormRepository.find({ issue_hash: issueHash }, { order: { sort_order: 'ASC' } });
    return entities.map(StoryMapper.toDomain);
  }

  async findByCreatedBy(createdBy: string): Promise<StoryDomainEntity[]> {
    const entities = await this.storyTypeormRepository.find({ created_by: createdBy }, { order: { _created_at: 'DESC' } });
    return entities.map(StoryMapper.toDomain);
  }

  async findByStatus(status: StoryStatus): Promise<StoryDomainEntity[]> {
    const entities = await this.storyTypeormRepository.find({ status }, { order: { sort_order: 'ASC' } });
    return entities.map(StoryMapper.toDomain);
  }

  async update(entity: StoryDomainEntity): Promise<StoryDomainEntity> {
    const typeormEntity = StoryMapper.toEntity(entity);
    await this.storyTypeormRepository.update({ _id: entity._id }, typeormEntity);
    const updatedEntity = await this.storyTypeormRepository.findOne({ _id: entity._id });
    const updatedStory = updatedEntity ? StoryMapper.toDomain(updatedEntity) : entity;
    
    // Испускаем событие для синхронизации с GitHub
    this.eventEmitter.emit('story.updated', updatedStory);
    
    return updatedStory;
  }

  async delete(_id: string): Promise<void> {
    await this.storyTypeormRepository.delete({ _id: _id });
  }

  async updateProjectHashByIssueHash(issueHash: string, projectHash: string): Promise<void> {
    await this.storyTypeormRepository.update(
      { issue_hash: issueHash.toLowerCase() },
      { project_hash: projectHash.toLowerCase() }
    );
  }

  async findAllPaginated(
    filter?: StoryFilterInputDTO,
    options?: PaginationInputDTO,
    scope?: ArtifactAccessScope
  ): Promise<PaginationResult<StoryDomainEntity>> {
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

    let queryBuilder = this.storyTypeormRepository.sqlBuilder('s').select('s').where('1=1');

    if (filter?.title) {
      queryBuilder = queryBuilder.andWhere('s.title = :title', { title: filter.title });
    }
    if (filter?.status) {
      queryBuilder = queryBuilder.andWhere('s.status = :status', { status: filter.status });
    }
    if (filter?.project_hash) {
      queryBuilder = queryBuilder.andWhere('s.project_hash = :project_hash', { project_hash: filter.project_hash });
    }
    if (filter?.issue_hash) {
      queryBuilder = queryBuilder.andWhere('s.issue_hash = :issue_hash', { issue_hash: filter.issue_hash });
    }
    if (filter?.created_by) {
      queryBuilder = queryBuilder.andWhere('s.created_by = :created_by', { created_by: filter.created_by });
    }

    // Ограничение правами доступа: требования разрешённых проектов, а также требования задач,
    // лежащих в этих проектах (у таких требований собственный project_hash бывает пустым).
    // Отсев в SQL, иначе totalCount/totalPages считаются по недоступным строкам.
    if (scope) {
      const scopeHashes = scope.projectHashes.map((hash) => hash.toLowerCase());
      queryBuilder = queryBuilder.andWhere(
        `(
          lower(s.project_hash) = ANY(CAST(:scopeHashes AS text[]))
          OR EXISTS (
            SELECT 1 FROM capital_issues i
            WHERE i.issue_hash = s.issue_hash
              AND lower(i.project_hash) = ANY(CAST(:scopeHashes AS text[]))
          )
        )`,
        { scopeHashes }
      );
    }

    // Получаем общее количество записей
    const totalCount = await queryBuilder.getCount();

    // Получаем записи с пагинацией
    const sortColumn = this.storyTypeormRepository.sortField(validatedOptions.sortBy, 'sort_order');
    queryBuilder = queryBuilder.orderBy(
      `s.${sortColumn}`,
      validatedOptions.sortBy ? validatedOptions.sortOrder : 'ASC'
    );

    const entities = await queryBuilder.offset(offset).limit(limit).getMany();

    // Преобразуем в доменные сущности
    const items = entities.map((entity) => StoryMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }
}
