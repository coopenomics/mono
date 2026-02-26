import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { SegmentRepository } from '../../domain/repositories/segment.repository';
import { SegmentDomainEntity } from '../../domain/entities/segment.entity';
import { SegmentTypeormEntity } from '../entities/segment.typeorm-entity';
import { SegmentMapper } from '../mappers/segment.mapper';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';
import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import type { ISegmentBlockchainData } from '../../domain/interfaces/segment-blockchain.interface';
import type { ISegmentDatabaseData } from '../../domain/interfaces/segment-database.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { SegmentFilterInputDTO } from '../../application/dto/segments/segment-filter.input';
import { PaginationUtils } from '~/shared/utils/pagination.utils';
import { ResultTypeormEntity } from '../entities/result.typeorm-entity';
import { ProjectTypeormEntity } from '../entities/project.typeorm-entity';
import { AssetUtils } from '~/shared/utils/asset.utils';
import { SegmentStatus } from '../../domain/enums/segment-status.enum';

/**
 * TypeORM реализация репозитория сегментов
 */
@Injectable()
export class SegmentTypeormRepository
  extends BaseBlockchainRepository<SegmentDomainEntity, SegmentTypeormEntity>
  implements SegmentRepository, IBlockchainSyncRepository<SegmentDomainEntity>
{
  constructor(
    @InjectRepository(SegmentTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    repository: Repository<SegmentTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
  }

  protected getMapper() {
    return {
      toDomain: SegmentMapper.toDomain,
      toEntity: SegmentMapper.toEntity,
    };
  }

  protected createDomainEntity(
    databaseData: ISegmentDatabaseData,
    blockchainData: ISegmentBlockchainData
  ): SegmentDomainEntity {
    return new SegmentDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return SegmentDomainEntity.getSyncKey();
  }

  /**
   * Применяет фильтры к QueryBuilder
   */
  private applyFiltersToQueryBuilder(
    queryBuilder: SelectQueryBuilder<SegmentTypeormEntity>,
    filter?: SegmentFilterInputDTO
  ): SelectQueryBuilder<SegmentTypeormEntity> {
    if (!filter) {
      return queryBuilder;
    }

    // Применяем базовые фильтры
    if (filter.coopname) {
      queryBuilder = queryBuilder.andWhere('s.coopname = :coopname', { coopname: filter.coopname });
    }
    if (filter.username) {
      queryBuilder = queryBuilder.andWhere('s.username = :username', { username: filter.username });
    }
    if (filter.project_hash) {
      queryBuilder = queryBuilder.andWhere('s.project_hash = :project_hash', { project_hash: filter.project_hash });
    }
    if (filter.status) {
      queryBuilder = queryBuilder.andWhere('s.status = :status', { status: filter.status });
    }
    if (filter.is_author !== undefined) {
      queryBuilder = queryBuilder.andWhere('s.is_author = :is_author', { is_author: filter.is_author });
    }
    if (filter.is_creator !== undefined) {
      queryBuilder = queryBuilder.andWhere('s.is_creator = :is_creator', { is_creator: filter.is_creator });
    }
    if (filter.is_coordinator !== undefined) {
      queryBuilder = queryBuilder.andWhere('s.is_coordinator = :is_coordinator', { is_coordinator: filter.is_coordinator });
    }
    if (filter.is_investor !== undefined) {
      queryBuilder = queryBuilder.andWhere('s.is_investor = :is_investor', { is_investor: filter.is_investor });
    }
    if (filter.is_propertor !== undefined) {
      queryBuilder = queryBuilder.andWhere('s.is_propertor = :is_propertor', { is_propertor: filter.is_propertor });
    }
    if (filter.is_contributor !== undefined) {
      queryBuilder = queryBuilder.andWhere('s.is_contributor = :is_contributor', { is_contributor: filter.is_contributor });
    }
    if (filter.has_vote !== undefined) {
      queryBuilder = queryBuilder.andWhere('s.has_vote = :has_vote', { has_vote: filter.has_vote });
    }
    if (filter.parent_hash !== undefined) {
      queryBuilder = queryBuilder.andWhere('project.parent_hash = :parent_hash', { parent_hash: filter.parent_hash });
    }

    return queryBuilder;
  }

  /**
   * Заполняет результаты для массива сегментов
   * Результаты связываются по username и project_hash, выбирается с максимальным id
   */
  private async populateResultsForSegments(segments: SegmentTypeormEntity[]): Promise<void> {
    if (segments.length === 0) {
      return;
    }

    // Собираем уникальные комбинации username + project_hash
    const segmentKeys = segments.map((segment) => ({
      username: segment.username,
      project_hash: segment.project_hash,
    }));

    // Группируем по username и project_hash для пакетного запроса
    const groupedKeys = segmentKeys.reduce((acc, key) => {
      const keyStr = `${key.username}_${key.project_hash}`;
      if (!acc[keyStr]) {
        acc[keyStr] = key;
      }
      return acc;
    }, {} as Record<string, { username: string; project_hash: string }>);

    // Получаем результаты с максимальным id для каждой комбинации
    const resultPromises = Object.values(groupedKeys).map(async ({ username, project_hash }) => {
      const result = await this.repository.manager
        .createQueryBuilder(ResultTypeormEntity, 'r')
        .where('r.username = :username AND r.project_hash = :project_hash', { username, project_hash })
        .orderBy('r.id', 'DESC')
        .limit(1)
        .getOne();

      return result ? { username, project_hash, result } : null;
    });

    const results = await Promise.all(resultPromises);
    const resultMap = new Map<string, ResultTypeormEntity>();

    results.forEach((item) => {
      if (item) {
        const key = `${item.username}_${item.project_hash}`;
        resultMap.set(key, item.result);
      }
    });

    // Заполняем результаты в сегментах
    segments.forEach((segment) => {
      const key = `${segment.username}_${segment.project_hash}`;
      segment.result = resultMap.get(key) || undefined;
    });
  }

  /**
   * Определяет, является ли проект компонентом
   * Компонент - это проект с непустым parent_hash, отличным от нулевого хэша
   */
  private isProjectComponent(project: ProjectTypeormEntity | undefined): boolean {
    if (!project || !project.parent_hash) {
      return false;
    }
    const NULL_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
    return project.parent_hash !== NULL_HASH;
  }

  /**
   * Получает все дочерние проекты для заданного родительского проекта
   * @param parentHash Хэш родительского проекта
   * @param coopname Имя кооператива для фильтрации
   */
  private async getChildProjects(parentHash: string, coopname: string): Promise<ProjectTypeormEntity[]> {
    return await this.repository.manager
      .createQueryBuilder(ProjectTypeormEntity, 'p')
      .where('p.parent_hash = :parentHash', { parentHash })
      .andWhere('p.coopname = :coopname', { coopname })
      .getMany();
  }

  /**
   * Агрегирует сегменты по username, складывая все денежные поля
   * @param segments Массив сегментов для агрегации
   * @param parentProjectHash Хэш родительского проекта (для правильной установки project_hash в агрегированном сегменте)
   * @returns Массив агрегированных сегментов
   */
  private aggregateSegmentsByUsername(
    segments: SegmentTypeormEntity[],
    parentProjectHash?: string
  ): SegmentTypeormEntity[] {
    // Группируем по username
    const groupedByUsername = segments.reduce((acc, segment) => {
      const username = segment.username;
      if (!acc[username]) {
        acc[username] = [];
      }
      acc[username].push(segment);
      return acc;
    }, {} as Record<string, SegmentTypeormEntity[]>);

    // Агрегируем каждую группу
    return Object.entries(groupedByUsername).map(([username, userSegments]) => {
      // Ищем сегмент родительского проекта как базу (если указан parentProjectHash)
      // Иначе берем первый сегмент
      let baseSegment = userSegments[0];
      if (parentProjectHash) {
        const parentSegment = userSegments.find(s => s.project_hash === parentProjectHash);
        if (parentSegment) {
          baseSegment = parentSegment;
        }
      }

      // Создаем агрегированный сегмент
      const aggregated: SegmentTypeormEntity = {
        ...baseSegment,
        // project_hash должен быть родительским проектом (если указан)
        project_hash: parentProjectHash || baseSegment.project_hash,
        // Агрегируем булевые поля (OR логика - если хотя бы в одном true, то true)
        is_author: userSegments.some(s => s.is_author),
        is_creator: userSegments.some(s => s.is_creator),
        is_coordinator: userSegments.some(s => s.is_coordinator),
        is_investor: userSegments.some(s => s.is_investor),
        is_propertor: userSegments.some(s => s.is_propertor),
        is_contributor: userSegments.some(s => s.is_contributor),
        has_vote: userSegments.some(s => s.has_vote),
        is_votes_calculated: userSegments.some(s => s.is_votes_calculated),
      };

      // Складываем все денежные поля
      try {
        aggregated.investor_amount = AssetUtils.sumAssets(userSegments.map(s => s.investor_amount));
        aggregated.investor_base = AssetUtils.sumAssets(userSegments.map(s => s.investor_base));
        aggregated.creator_base = AssetUtils.sumAssets(userSegments.map(s => s.creator_base));
        aggregated.creator_bonus = AssetUtils.sumAssets(userSegments.map(s => s.creator_bonus));
        aggregated.author_base = AssetUtils.sumAssets(userSegments.map(s => s.author_base));
        aggregated.author_bonus = AssetUtils.sumAssets(userSegments.map(s => s.author_bonus));
        aggregated.coordinator_investments = AssetUtils.sumAssets(userSegments.map(s => s.coordinator_investments));
        aggregated.coordinator_base = AssetUtils.sumAssets(userSegments.map(s => s.coordinator_base));
        aggregated.contributor_bonus = AssetUtils.sumAssets(userSegments.map(s => s.contributor_bonus));
        aggregated.property_base = AssetUtils.sumAssets(userSegments.map(s => s.property_base));
        aggregated.capital_contributor_shares = AssetUtils.sumAssets(userSegments.map(s => s.capital_contributor_shares));
        aggregated.last_known_invest_pool = AssetUtils.sumAssets(userSegments.map(s => s.last_known_invest_pool));
        aggregated.last_known_creators_base_pool = AssetUtils.sumAssets(userSegments.map(s => s.last_known_creators_base_pool));
        aggregated.last_known_coordinators_investment_pool = AssetUtils.sumAssets(userSegments.map(s => s.last_known_coordinators_investment_pool));
        aggregated.provisional_amount = AssetUtils.sumAssets(userSegments.map(s => s.provisional_amount));
        aggregated.debt_amount = AssetUtils.sumAssets(userSegments.map(s => s.debt_amount));
        aggregated.debt_settled = AssetUtils.sumAssets(userSegments.map(s => s.debt_settled));
        aggregated.equal_author_bonus = AssetUtils.sumAssets(userSegments.map(s => s.equal_author_bonus));
        aggregated.direct_creator_bonus = AssetUtils.sumAssets(userSegments.map(s => s.direct_creator_bonus));
        aggregated.voting_bonus = AssetUtils.sumAssets(userSegments.map(s => s.voting_bonus));
        aggregated.total_segment_base_cost = AssetUtils.sumAssets(userSegments.map(s => s.total_segment_base_cost));
        aggregated.total_segment_bonus_cost = AssetUtils.sumAssets(userSegments.map(s => s.total_segment_bonus_cost));
        aggregated.total_segment_cost = AssetUtils.sumAssets(userSegments.map(s => s.total_segment_cost));
      } catch (error: any) {
        console.error(`Ошибка при агрегации ассетов для пользователя ${username}:`, error.message);
        // В случае ошибки оставляем значения из базового сегмента
      }

      // Для CRPS полей берем среднее значение
      aggregated.last_author_base_reward_per_share =
        userSegments.reduce((sum, s) => sum + s.last_author_base_reward_per_share, 0) / userSegments.length;
      aggregated.last_author_bonus_reward_per_share =
        userSegments.reduce((sum, s) => sum + s.last_author_bonus_reward_per_share, 0) / userSegments.length;
      aggregated.last_contributor_reward_per_share =
        userSegments.reduce((sum, s) => sum + s.last_contributor_reward_per_share, 0) / userSegments.length;

      return aggregated;
    });
  }

  /**
   * Найти все сегменты с пагинацией и фильтрацией
   * Автоматически определяет тип проекта (компонент/родитель) и применяет соответствующую логику:
   * - Для компонента: возвращает сегменты только этого проекта
   * - Для родительского проекта: агрегирует сегменты всех дочерних компонентов + самого проекта по username
   */
  async findAllPaginated(
    filter?: SegmentFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<SegmentDomainEntity>> {
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

    // Если указан project_hash, определяем тип проекта
    let shouldAggregate = false;
    let projectHashes: string[] = [];

    if (filter?.project_hash) {
      // Получаем проект
      const project = await this.repository.manager
        .createQueryBuilder(ProjectTypeormEntity, 'p')
        .where('p.project_hash = :project_hash', { project_hash: filter.project_hash })
        .getOne();

      if (project) {
        const isComponent = this.isProjectComponent(project);

        if (isComponent) {
          // Это компонент - возвращаем сегменты только этого проекта
          projectHashes = [filter.project_hash];
        } else {
          // Это родительский проект - нужно агрегировать
          shouldAggregate = true;
          // Получаем все дочерние проекты
          const childProjects = await this.getChildProjects(
            filter.project_hash,
            filter.coopname || project.coopname
          );
          // Включаем сам родительский проект и все дочерние
          projectHashes = [filter.project_hash, ...childProjects.map(p => p.project_hash)];
        }
      } else {
        // Проект не найден в таблице проектов - извлекаем сегменты напрямую
        projectHashes = [filter.project_hash];
        shouldAggregate = false;
      }
    }

    // Создаем query builder для гибкого построения запроса
    let queryBuilder = this.repository.createQueryBuilder('s').select('s').where('1=1');

    // Добавляем join с contributor для получения display_name
    queryBuilder = queryBuilder.leftJoinAndSelect(
      's.contributor',
      'contributor',
      'contributor.coopname = s.coopname AND contributor.username = s.username'
    );

    // Добавляем join с проектами для получения статуса проекта
    queryBuilder = queryBuilder.leftJoinAndSelect('s.project', 'project');

    // Если нужно агрегировать, заменяем фильтр по project_hash на фильтр по массиву хэшей
    if (shouldAggregate && projectHashes.length > 0) {
      // Создаем новый фильтр без project_hash
      const modifiedFilter = { ...filter };
      delete modifiedFilter.project_hash;

      // Применяем фильтры без project_hash
      queryBuilder = this.applyFiltersToQueryBuilder(queryBuilder, modifiedFilter);

      // Добавляем фильтр по массиву project_hash
      queryBuilder = queryBuilder.andWhere('s.project_hash IN (:...projectHashes)', { projectHashes });
    } else {
      // Применяем обычные фильтры
      queryBuilder = this.applyFiltersToQueryBuilder(queryBuilder, filter);
    }
    // Получаем все сегменты без пагинации для агрегации
    let entities: SegmentTypeormEntity[];

    if (shouldAggregate) {
      // Для агрегации получаем все записи
      entities = await queryBuilder.orderBy('s._created_at', 'DESC').getMany();

      // Агрегируем сегменты по username (передаем хэш родительского проекта)
      entities = this.aggregateSegmentsByUsername(entities, filter?.project_hash);

      // Применяем сортировку после агрегации
      if (validatedOptions.sortBy) {
        entities = entities.sort((a, b) => {
          const aValue = a[validatedOptions.sortBy as keyof SegmentTypeormEntity];
          const bValue = b[validatedOptions.sortBy as keyof SegmentTypeormEntity];

          // Обработка undefined значений
          if (aValue === undefined && bValue === undefined) return 0;
          if (aValue === undefined) return 1;
          if (bValue === undefined) return -1;

          if (validatedOptions.sortOrder === 'ASC') {
            return aValue > bValue ? 1 : -1;
          } else {
            return aValue < bValue ? 1 : -1;
          }
        });
      }

      // Применяем пагинацию вручную
      const totalCount = entities.length;
      entities = entities.slice(offset, offset + limit);

      // Заполняем результаты для сегментов
      await this.populateResultsForSegments(entities);

      // Преобразуем в доменные сущности
      const items = entities.map((entity) => SegmentMapper.toDomain(entity));

      // Возвращаем результат с пагинацией
      return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
    } else {
      // Для обычного режима применяем пагинацию в запросе
      // Применяем сортировку
      if (validatedOptions.sortBy) {
        queryBuilder = queryBuilder.orderBy(`s.${validatedOptions.sortBy}`, validatedOptions.sortOrder);
      } else {
        queryBuilder = queryBuilder.orderBy('s._created_at', 'DESC');
      }

      // Получаем общее количество записей
      const totalCount = await queryBuilder.getCount();

      // Применяем пагинацию
      queryBuilder = queryBuilder.skip(offset).take(limit);

      // Получаем записи
      entities = await queryBuilder.getMany();

      // Заполняем результаты для сегментов
      await this.populateResultsForSegments(entities);

      // Преобразуем в доменные сущности
      const items = entities.map((entity) => SegmentMapper.toDomain(entity));

      // Возвращаем результат с пагинацией
      return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
    }
  }

  /**
   * Найти один сегмент по фильтрам
   * Автоматически определяет тип проекта (компонент/родитель) и применяет соответствующую логику:
   * - Для компонента: возвращает один сегмент этого проекта
   * - Для родительского проекта: агрегирует сегменты всех дочерних компонентов + самого проекта по username
   *   и возвращает первый агрегированный сегмент
   */
  async findOne(filter?: SegmentFilterInputDTO): Promise<SegmentDomainEntity | null> {

    // Если указан project_hash и username, определяем тип проекта
    let shouldAggregate = false;
    let projectHashes: string[] = [];

    if (filter?.project_hash) {
      // Получаем проект
      const project = await this.repository.manager
        .createQueryBuilder(ProjectTypeormEntity, 'p')
        .where('p.project_hash = :project_hash', { project_hash: filter.project_hash })
        .getOne();

      if (project) {
        const isComponent = this.isProjectComponent(project);

        if (isComponent) {
          // Это компонент - возвращаем сегмент только этого проекта
          projectHashes = [filter.project_hash];
        } else {
          // Это родительский проект - нужно агрегировать
          shouldAggregate = true;
          // Получаем все дочерние проекты
          const childProjects = await this.getChildProjects(
            filter.project_hash,
            filter.coopname || project.coopname
          );
          // Включаем сам родительский проект и все дочерние
          projectHashes = [filter.project_hash, ...childProjects.map(p => p.project_hash)];
        }
      } else {
        // Проект не найден в таблице проектов - извлекаем сегменты напрямую
        projectHashes = [filter.project_hash];
        shouldAggregate = false;
      }
    }

    // Создаем query builder для гибкого построения запроса
    let queryBuilder = this.repository.createQueryBuilder('s').select('s').where('1=1');

    // Добавляем join с contributor для получения display_name
    queryBuilder = queryBuilder.leftJoinAndSelect(
      's.contributor',
      'contributor',
      'contributor.coopname = s.coopname AND contributor.username = s.username'
    );

    // Добавляем join с проектами для получения статуса проекта
    queryBuilder = queryBuilder.leftJoinAndSelect('s.project', 'project');

    // Если нужно агрегировать, заменяем фильтр по project_hash на фильтр по массиву хэшей
    if (shouldAggregate && projectHashes.length > 0 && filter?.username) {
      // Создаем новый фильтр без project_hash
      const modifiedFilter = { ...filter };
      delete modifiedFilter.project_hash;

      // Применяем фильтры без project_hash
      queryBuilder = this.applyFiltersToQueryBuilder(queryBuilder, modifiedFilter);

      // Добавляем фильтр по массиву project_hash
      queryBuilder = queryBuilder.andWhere('s.project_hash IN (:...projectHashes)', { projectHashes });

      // Получаем все сегменты для агрегации
      const entities = await queryBuilder.orderBy('s._created_at', 'DESC').getMany();

      if (entities.length === 0) {
        return null;
      }

      // Агрегируем сегменты по username (передаем хэш родительского проекта)
      const aggregatedEntities = this.aggregateSegmentsByUsername(entities, filter?.project_hash);

      if (aggregatedEntities.length === 0) {
        return null;
      }

      // Берем первый агрегированный сегмент
      const entity = aggregatedEntities[0];

      // Заполняем результат для сегмента
      await this.populateResultsForSegments([entity]);

      // Преобразуем в доменную сущность
      return SegmentMapper.toDomain(entity);
    } else {
      // Применяем обычные фильтры
      queryBuilder = this.applyFiltersToQueryBuilder(queryBuilder, filter);

      // Получаем первую запись с сортировкой по дате создания (новые сначала)
      const entity = await queryBuilder.orderBy('s._created_at', 'DESC').getOne();

      // Возвращаем null, если запись не найдена
      if (!entity) {
        return null;
      }

      // Заполняем результат для сегмента
      await this.populateResultsForSegments([entity]);

      // Преобразуем в доменную сущность
      return SegmentMapper.toDomain(entity);
    }
  }

  /**
   * Установить флаг завершения конвертации для сегмента
   */
  async markAsCompleted(coopname: string, project_hash: string, username: string): Promise<SegmentDomainEntity | null> {
    // Найдем сегмент для обновления
    const entity = await this.repository.findOne({
      where: {
        coopname,
        project_hash,
        username,
      },
    });

    if (!entity) {
      throw new NotFoundException(`Сегмент ${project_hash}:${username} не найден`);
    }

    // Установим флаг завершения, статус FINALIZED и present = false (сегмент удален из блокчейна)
    entity.is_completed = true;
    entity.status = SegmentStatus.FINALIZED;
    entity.present = false;
    entity._updated_at = new Date();

    // Сохраним изменения
    await this.repository.save(entity);

    // Преобразуем в доменную сущность и вернем
    return SegmentMapper.toDomain(entity);
  }
}
