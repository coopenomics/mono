import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StoryRepository } from '../../domain/repositories/story.repository';
import { StoryDomainEntity } from '../../domain/entities/story.entity';
import { StoryTypeormEntity } from '../entities/story.typeorm-entity';
import { StoryMapper } from '../mappers/story.mapper';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';
import type { StoryStatus } from '../../domain/enums/story-status.enum';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { StoryFilterInputDTO } from '../../application/dto/generation/story-filter.input';
import { PaginationUtils } from '~/shared/utils/pagination.utils';

@Injectable()
export class StoryTypeormRepository implements StoryRepository {
  constructor(
    @InjectRepository(StoryTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    private readonly storyTypeormRepository: Repository<StoryTypeormEntity>,
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
    const entity = await this.storyTypeormRepository.findOne({ where: { _id } });
    return entity ? StoryMapper.toDomain(entity) : null;
  }

  async findByStoryHash(storyHash: string): Promise<StoryDomainEntity | null> {
    const entity = await this.storyTypeormRepository.findOne({ where: { story_hash: storyHash } });
    return entity ? StoryMapper.toDomain(entity) : null;
  }

  async findAll(): Promise<StoryDomainEntity[]> {
    const entities = await this.storyTypeormRepository.find();
    return entities.map(StoryMapper.toDomain);
  }

  async findByProjectHash(projectHash: string): Promise<StoryDomainEntity[]> {
    // Ищем только проектные истории (без привязки к задачам)
    const entities = await this.storyTypeormRepository.find({
      where: {
        project_hash: projectHash,
        issue_hash: IsNull(), // Только проектные истории
      },
      order: { sort_order: 'ASC' },
    });
    return entities.map(StoryMapper.toDomain);
  }

  /**
   * Найти все истории проекта (проектные + истории всех задач проекта)
   */
  async findAllByProjectHash(projectHash: string): Promise<StoryDomainEntity[]> {
    // Используем query builder для более сложного запроса
    const entities = await this.storyTypeormRepository
      .createQueryBuilder('story')
      .leftJoin('story.issue', 'issue')
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

    const query = this.storyTypeormRepository.createQueryBuilder('story');

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
      where: {
        project_hash: projectHash,
        issue_hash: IsNull(),
      },
      order: { sort_order: 'ASC' },
    });
    return entities.map(StoryMapper.toDomain);
  }

  async findByIssueHash(issueHash: string): Promise<StoryDomainEntity[]> {
    const entities = await this.storyTypeormRepository.find({
      where: { issue_hash: issueHash },
      order: { sort_order: 'ASC' },
    });
    return entities.map(StoryMapper.toDomain);
  }

  async findByCreatedBy(createdBy: string): Promise<StoryDomainEntity[]> {
    const entities = await this.storyTypeormRepository.find({
      where: { created_by: createdBy },
      order: { _created_at: 'DESC' },
    });
    return entities.map(StoryMapper.toDomain);
  }

  async findByStatus(status: StoryStatus): Promise<StoryDomainEntity[]> {
    const entities = await this.storyTypeormRepository.find({
      where: { status },
      order: { sort_order: 'ASC' },
    });
    return entities.map(StoryMapper.toDomain);
  }

  async update(entity: StoryDomainEntity): Promise<StoryDomainEntity> {
    const typeormEntity = StoryMapper.toEntity(entity);
    await this.storyTypeormRepository.update(entity._id, typeormEntity);
    const updatedEntity = await this.storyTypeormRepository.findOne({
      where: { _id: entity._id },
    });
    const updatedStory = updatedEntity ? StoryMapper.toDomain(updatedEntity) : entity;
    
    // Испускаем событие для синхронизации с GitHub
    this.eventEmitter.emit('story.updated', updatedStory);
    
    return updatedStory;
  }

  async delete(_id: string): Promise<void> {
    await this.storyTypeormRepository.delete(_id);
  }

  async findAllPaginated(
    filter?: StoryFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<StoryDomainEntity>> {
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
    if (filter?.title) {
      where.title = filter.title;
    }
    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.project_hash) {
      where.project_hash = filter.project_hash;
    }
    if (filter?.issue_hash) {
      where.issue_hash = filter.issue_hash;
    }
    if (filter?.created_by) {
      where.created_by = filter.created_by;
    }

    // Получаем общее количество записей
    const totalCount = await this.storyTypeormRepository.count({ where });

    // Получаем записи с пагинацией
    const orderBy: any = {};
    if (validatedOptions.sortBy) {
      orderBy[validatedOptions.sortBy] = validatedOptions.sortOrder;
    } else {
      orderBy.sort_order = 'ASC';
    }

    const entities = await this.storyTypeormRepository.find({
      where,
      skip: offset,
      take: limit,
      order: orderBy,
    });

    // Преобразуем в доменные сущности
    const items = entities.map((entity) => StoryMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }
}
