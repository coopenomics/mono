import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectRepository } from '../../domain/repositories/project.repository';
import { ProjectDomainEntity } from '../../domain/entities/project.entity';
import { ProjectTypeormEntity } from '../entities/project.typeorm-entity';
import { ProjectMapper } from '../mappers/project.mapper';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';
import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import type { IProjectDomainInterfaceBlockchainData } from '../../domain/interfaces/project-blockchain.interface';
import type { IProjectDomainInterfaceDatabaseData } from '../../domain/interfaces/project-database.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { ProjectFilterInputDTO } from '../../application/dto/property_management/project-filter.input';
import { PaginationUtils } from '~/shared/utils/pagination.utils';
import { IssueIdGenerationService } from '../../domain/services/issue-id-generation.service';
import { AssetUtils } from '~/shared/utils/asset.utils';

@Injectable()
export class ProjectTypeormRepository
  extends BaseBlockchainRepository<ProjectDomainEntity, ProjectTypeormEntity>
  implements ProjectRepository, IBlockchainSyncRepository<ProjectDomainEntity>
{
  constructor(
    @InjectRepository(ProjectTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    repository: Repository<ProjectTypeormEntity>,
    entityVersioningService: EntityVersioningService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(repository, entityVersioningService);
  }

  protected getMapper() {
    return {
      toDomain: ProjectMapper.toDomain,
      toEntity: ProjectMapper.toEntity,
    };
  }

  protected createDomainEntity(
    databaseData: IProjectDomainInterfaceDatabaseData,
    blockchainData: IProjectDomainInterfaceBlockchainData
  ): ProjectDomainEntity {
    return new ProjectDomainEntity(databaseData, blockchainData);
  }

  /**
   * Переопределяем метод создания сущности для проектов,
   * чтобы правильно инициализировать поля для генерации ID задач
   */
  async createIfNotExists(
    blockchainData: IProjectDomainInterfaceBlockchainData,
    blockNum: number,
    present = true
  ): Promise<ProjectDomainEntity> {
    // Получаем ключ синхронизации из доменной сущности
    const syncKey = this.getSyncKey();
    const syncValue = this.extractSyncValueFromBlockchainData(blockchainData, syncKey);

    // Проверяем, существует ли уже по кастомному ключу
    const existing = await this.findBySyncKey(syncKey, syncValue);
    if (existing) {
      // Обновляем существующую сущность
      existing.updateFromBlockchain(blockchainData, blockNum, present);
      return await this.save(existing);
    } else {
      // Создаем полную структуру databaseData для проекта
      const databaseData: IProjectDomainInterfaceDatabaseData = {
        _id: '',
        block_num: blockNum,
        present: present,
        project_hash: syncValue.toLowerCase(),
        prefix: IssueIdGenerationService.generateProjectPrefix(syncValue),
        issue_counter: 0,
        voting_deadline: null,
      };

      const newEntity = this.createDomainEntity(databaseData, blockchainData);
      return await this.save(newEntity);
    }
  }

  protected getSyncKey(): string {
    return ProjectDomainEntity.getSyncKey();
  }

  async create(project: ProjectDomainEntity): Promise<ProjectDomainEntity> {
    const entity = this.repository.create(ProjectMapper.toEntity(project));
    const savedEntity = await this.repository.save(entity);

    // Проверяем, является ли проект компонентом
    const isComponent = this.isProjectComponent(savedEntity);

    // Если это родительский проект, агрегируем данные из компонентов
    if (!isComponent) {
      const childComponents = await this.getChildProjectEntities(savedEntity.project_hash);
      if (childComponents.length > 0) {
        this.aggregateProjectData(savedEntity, childComponents);
      }
    }

    const createdProject = ProjectMapper.toDomain(savedEntity);
    await this.populateParentTitles([createdProject]);

    // Испускаем событие для синхронизации с GitHub
    this.eventEmitter.emit('project.created', createdProject);

    return createdProject;
  }

  async update(entity: ProjectDomainEntity): Promise<ProjectDomainEntity> {
    const updatedProject = await super.update(entity);

    // Испускаем событие для синхронизации с GitHub
    this.eventEmitter.emit('project.updated', updatedProject);

    return updatedProject;
  }

  async findByHash(hash: string): Promise<ProjectDomainEntity | null> {
    const entity = await this.repository.findOneBy({ project_hash: hash });
    if (!entity) {
      return null;
    }

    // Проверяем, является ли проект компонентом
    const isComponent = this.isProjectComponent(entity);

    // Если это родительский проект, агрегируем данные из компонентов
    if (!isComponent) {
      const childComponents = await this.getChildProjectEntities(hash);
      if (childComponents.length > 0) {
        this.aggregateProjectData(entity, childComponents);
      }
    }

    const project = ProjectMapper.toDomain(entity);
    await this.populateParentTitles([project]);
    return project;
  }

  async findByHashes(hashes: string[]): Promise<ProjectDomainEntity[]> {
    if (hashes.length === 0) {
      return [];
    }
    const entities = await this.repository.findBy({ project_hash: In(hashes) });

    // Для каждого родительского проекта агрегируем данные из компонентов
    for (const entity of entities) {
      const isComponent = this.isProjectComponent(entity);
      if (!isComponent) {
        const childComponents = await this.getChildProjectEntities(entity.project_hash);
        if (childComponents.length > 0) {
          this.aggregateProjectData(entity, childComponents);
        }
      }
    }

    const projects = entities.map(ProjectMapper.toDomain);
    await this.populateParentTitles(projects);
    return projects;
  }
  async findByMaster(master: string): Promise<ProjectDomainEntity[]> {
    const entities = await this.repository.find({ where: { master } });

    // Для каждого родительского проекта агрегируем данные из компонентов
    for (const entity of entities) {
      const isComponent = this.isProjectComponent(entity);
      if (!isComponent) {
        const childComponents = await this.getChildProjectEntities(entity.project_hash);
        if (childComponents.length > 0) {
          this.aggregateProjectData(entity, childComponents);
        }
      }
    }

    const projects = entities.map((entity) => ProjectMapper.toDomain(entity));
    await this.populateParentTitles(projects);
    return projects;
  }

  async findByStatus(status: string): Promise<ProjectDomainEntity[]> {
    const entities = await this.repository.find({ where: { status: status as any } });

    // Для каждого родительского проекта агрегируем данные из компонентов
    for (const entity of entities) {
      const isComponent = this.isProjectComponent(entity);
      if (!isComponent) {
        const childComponents = await this.getChildProjectEntities(entity.project_hash);
        if (childComponents.length > 0) {
          this.aggregateProjectData(entity, childComponents);
        }
      }
    }

    const projects = entities.map((entity) => ProjectMapper.toDomain(entity));
    await this.populateParentTitles(projects);
    return projects;
  }

  /**
   * Найти проект с задачами
   */
  async findByIdWithIssues(projectHash: string): Promise<ProjectDomainEntity | null> {
    const entity = await this.repository.findOne({
      where: { project_hash: projectHash },
      relations: ['issues'],
    });
    if (!entity) {
      return null;
    }

    // Проверяем, является ли проект компонентом
    const isComponent = this.isProjectComponent(entity);

    // Если это родительский проект, агрегируем данные из компонентов
    if (!isComponent) {
      const childComponents = await this.getChildProjectEntities(projectHash);
      if (childComponents.length > 0) {
        this.aggregateProjectData(entity, childComponents);
      }
    }

    const project = ProjectMapper.toDomain(entity);
    await this.populateParentTitles([project]);
    return project;
  }

  /**
   * Найти проект с историями
   */
  async findByIdWithStories(projectHash: string): Promise<ProjectDomainEntity | null> {
    const entity = await this.repository.findOne({
      where: { project_hash: projectHash },
      relations: ['stories'],
    });
    if (!entity) {
      return null;
    }

    // Проверяем, является ли проект компонентом
    const isComponent = this.isProjectComponent(entity);

    // Если это родительский проект, агрегируем данные из компонентов
    if (!isComponent) {
      const childComponents = await this.getChildProjectEntities(projectHash);
      if (childComponents.length > 0) {
        this.aggregateProjectData(entity, childComponents);
      }
    }

    const project = ProjectMapper.toDomain(entity);
    await this.populateParentTitles([project]);
    return project;
  }

  /**
   * Найти проект со всеми связанными данными
   */
  async findByIdWithAllRelations(projectHash: string): Promise<ProjectDomainEntity | null> {
    const entity = await this.repository.findOne({
      where: { project_hash: projectHash },
      relations: ['issues', 'stories', 'issues.comments', 'issues.stories'],
    });
    if (!entity) {
      return null;
    }

    // Проверяем, является ли проект компонентом
    const isComponent = this.isProjectComponent(entity);

    // Если это родительский проект, агрегируем данные из компонентов
    if (!isComponent) {
      const childComponents = await this.getChildProjectEntities(projectHash);
      if (childComponents.length > 0) {
        this.aggregateProjectData(entity, childComponents);
      }
    }

    const project = ProjectMapper.toDomain(entity);
    await this.populateParentTitles([project]);
    return project;
  }

  async findAllPaginated(
    filter?: ProjectFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<ProjectDomainEntity>> {
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
    if (filter?.coopname) {
      where.coopname = filter.coopname;
    }
    if (filter?.master) {
      where.master = filter.master;
    }
    if (filter?.statuses?.length) {
      where.status = In(filter.statuses);
    }
    if (filter?.project_hash) {
      where.project_hash = filter.project_hash;
    }
    if (filter?.parent_hash) {
      where.parent_hash = filter.parent_hash;
    }
    if (filter?.is_opened !== undefined) {
      where.is_opened = filter.is_opened;
    }
    if (filter?.is_planed !== undefined) {
      where.is_planed = filter.is_planed;
    }
    if (filter?.has_voting) {
      where.voting_deadline = Not(IsNull());
    }
    if (filter?.has_invite) {
      where.invite = Not('');
    }

    // Получаем общее количество записей
    const totalCount = await this.repository.count({ where });

    // Получаем записи с пагинацией
    const orderBy: any = {};
    if (validatedOptions.sortBy) {
      orderBy[validatedOptions.sortBy] = validatedOptions.sortOrder;
    } else {
      orderBy.created_at = 'DESC';
    }

    const entities = await this.repository.find({
      where,
      skip: offset,
      take: limit,
      order: orderBy,
    });

    // Для каждого родительского проекта агрегируем данные из компонентов
    for (const entity of entities) {
      const isComponent = this.isProjectComponent(entity);
      if (!isComponent) {
        const childComponents = await this.getChildProjectEntities(entity.project_hash);
        if (childComponents.length > 0) {
          this.aggregateProjectData(entity, childComponents);
        }
      }
    }

    // Преобразуем в доменные сущности
    const items = entities.map((entity) => ProjectMapper.toDomain(entity));

    // Получаем parent_title для проектов, у которых есть parent_hash
    await this.populateParentTitles(items);

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }

  /**
   * Получение проектов с пагинацией и компонентами
   * Если parent_hash не указан - возвращает проекты верхнего уровня
   * Если parent_hash указан - фильтрует по нему
   */
  async findAllPaginatedWithComponents(
    filter?: ProjectFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<ProjectDomainEntity>> {
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

    const emptyHash = DomainToBlockchainUtils.getEmptyHash();

    // Создаем query builder для гибкого построения запроса
    let queryBuilder = this.repository.createQueryBuilder('p').select('p').where('1=1'); // Начальное условие для удобства добавления AND

    // Применяем базовые фильтры
    if (filter?.coopname) {
      queryBuilder = queryBuilder.andWhere('p.coopname = :coopname', { coopname: filter.coopname });
    }
    if (filter?.master) {
      queryBuilder = queryBuilder.andWhere('p.master = :master', { master: filter.master });
    }
    if (filter?.statuses?.length) {
      queryBuilder = queryBuilder.andWhere('p.status IN (:...statuses)', { statuses: filter.statuses });
    }
    if (filter?.project_hash) {
      queryBuilder = queryBuilder.andWhere('p.project_hash = :project_hash', { project_hash: filter.project_hash });
    }
    if (filter?.is_opened !== undefined) {
      queryBuilder = queryBuilder.andWhere('p.is_opened = :is_opened', { is_opened: filter.is_opened });
    }
    if (filter?.is_planed !== undefined) {
      queryBuilder = queryBuilder.andWhere('p.is_planed = :is_planed', { is_planed: filter.is_planed });
    }
    if (filter?.has_voting) {
      queryBuilder = queryBuilder.andWhere('p.voting_deadline IS NOT NULL');
    }
    if (filter?.has_invite) {
      queryBuilder = queryBuilder.andWhere('p.invite != :empty', { empty: '' });
    }

    // Логика для parent_hash и is_component:
    if (filter?.parent_hash !== undefined) {
      // Если parent_hash указан явно - фильтруем по нему
      queryBuilder = queryBuilder.andWhere('p.parent_hash = :parent_hash', { parent_hash: filter.parent_hash });
    } else if (filter?.is_component !== undefined) {
      // Логика для is_component:
      if (filter.is_component) {
        // Компоненты: проекты с parent_hash не null и не пустым хэшем
        queryBuilder = queryBuilder.andWhere('p.parent_hash IS NOT NULL AND p.parent_hash != :emptyHash', { emptyHash });
      } else {
        // Основные проекты: parent_hash = null ИЛИ parent_hash = emptyHash
        queryBuilder = queryBuilder.andWhere('(p.parent_hash IS NULL OR p.parent_hash = :emptyHash)', { emptyHash });
      }
    }

    // Фильтрация по задачам: если есть фильтры по статусам, приоритетам или создателям задач
    if (
      filter?.has_issues_with_statuses?.length ||
      filter?.has_issues_with_priorities?.length ||
      filter?.has_issues_with_creators?.length
    ) {
      // Используем EXISTS подзапрос вместо JOIN для избежания проблем с типами
      let existsQuery =
        'EXISTS (SELECT 1 FROM capital_projects comp INNER JOIN capital_issues i ON i.project_hash = comp.project_hash WHERE comp.parent_hash = p.project_hash AND comp.parent_hash != :emptyHash';

      if (filter.has_issues_with_statuses?.length) {
        existsQuery += ' AND i.status = ANY(:statuses)';
      }

      if (filter.has_issues_with_priorities?.length) {
        existsQuery += ' AND i.priority = ANY(:priorities)';
      }

      if (filter.has_issues_with_creators?.length) {
        existsQuery +=
          ' AND EXISTS (SELECT 1 FROM capital_issue_creators ic INNER JOIN capital_contributors c ON ic.contributor_hash = c.contributor_hash WHERE ic.issue_id = i._id AND c.username = ANY(:creators))';
      }

      existsQuery += ')';

      const params: any = { emptyHash };
      if (filter.has_issues_with_statuses?.length) {
        params.statuses = filter.has_issues_with_statuses;
      }
      if (filter.has_issues_with_priorities?.length) {
        params.priorities = filter.has_issues_with_priorities;
      }
      if (filter.has_issues_with_creators?.length) {
        params.creators = filter.has_issues_with_creators;
      }

      queryBuilder = queryBuilder.andWhere(existsQuery, params);
    }

    // Получаем общее количество записей
    const totalCount = await queryBuilder.getCount();

    // Применяем сортировку
    if (validatedOptions.sortBy) {
      queryBuilder = queryBuilder.orderBy(`p.${validatedOptions.sortBy}`, validatedOptions.sortOrder);
    } else {
      queryBuilder = queryBuilder.orderBy('p._created_at', 'DESC');
    }

    // Применяем пагинацию
    queryBuilder = queryBuilder.skip(offset).take(limit);

    // Получаем записи
    const entities = await queryBuilder.getMany();

    // Для каждого родительского проекта агрегируем данные из компонентов
    for (const entity of entities) {
      const isComponent = this.isProjectComponent(entity);
      if (!isComponent) {
        const childComponents = await this.getChildProjectEntities(entity.project_hash);
        if (childComponents.length > 0) {
          this.aggregateProjectData(entity, childComponents);
        }
      }
    }

    // Преобразуем в доменные сущности
    const items = entities.map((entity) => ProjectMapper.toDomain(entity));

    // Получаем parent_title для проектов, у которых есть parent_hash
    await this.populateParentTitles(items);

    // Для каждого проекта получаем его компоненты
    for (const project of items) {
      const components = await this.findComponentsByParentHash(project.project_hash);
      // Получаем parent_title для компонентов
      await this.populateParentTitles(components);
      // Добавляем компоненты к проекту
      (project as any).components = components;
    }

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }

  /**
   * Получение проекта по хешу с его компонентами
   */
  async findByHashWithComponents(hash: string): Promise<ProjectDomainEntity | null> {
    const entity = await this.repository.findOneBy({ project_hash: hash });
    if (!entity) {
      return null;
    }

    // Проверяем, является ли проект компонентом
    const isComponent = this.isProjectComponent(entity);

    // Если это родительский проект, агрегируем данные из компонентов
    if (!isComponent) {
      const childComponents = await this.getChildProjectEntities(hash);
      if (childComponents.length > 0) {
        this.aggregateProjectData(entity, childComponents);
      }
    }

    const project = ProjectMapper.toDomain(entity);

    // Получаем parent_title для проекта
    await this.populateParentTitles([project]);

    // Получаем компоненты проекта
    const components = await this.findComponentsByParentHash(hash);
    // Получаем parent_title для компонентов
    await this.populateParentTitles(components);
    (project as any).components = components;

    return project;
  }

  /**
   * Получение компонентов проекта по хешу родительского проекта
   */
  async findComponentsByParentHash(parentHash: string): Promise<ProjectDomainEntity[]> {
    const entities = await this.repository.find({
      where: { parent_hash: parentHash },
      order: { created_at: 'DESC' },
    });

    const components = entities.map((entity) => ProjectMapper.toDomain(entity));
    await this.populateParentTitles(components);
    return components;
  }

  /**
   * Заполняет поле parent_title для массива проектов на основе их parent_hash
   */
  private async populateParentTitles(projects: ProjectDomainEntity[]): Promise<void> {
    // Собираем все уникальные parent_hash из проектов
    const parentHashes = projects
      .map((project) => project.parent_hash)
      .filter(
        (hash) => hash && hash.trim() !== '' && hash !== '0000000000000000000000000000000000000000000000000000000000000000'
      )
      .filter((hash, index, arr) => arr.indexOf(hash) === index); // Убираем дубликаты

    if (parentHashes.length === 0) {
      return; // Нет родительских проектов для обработки
    }

    // Получаем родительские проекты по их хешам
    const parentEntities = await this.repository.find({
      where: parentHashes.map((hash) => ({ project_hash: hash })),
      select: ['project_hash', 'title'],
    });

    // Создаем карту хеш -> название для быстрого поиска
    const parentTitleMap = new Map<string, string>();
    parentEntities.forEach((entity) => {
      if (entity.title) {
        parentTitleMap.set(entity.project_hash, entity.title);
      }
    });

    // Присваиваем parent_title каждому проекту
    projects.forEach((project) => {
      if (project.parent_hash && parentTitleMap.has(project.parent_hash)) {
        (project as any).parent_title = parentTitleMap.get(project.parent_hash);
      }
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
    const NULL_HASH = DomainToBlockchainUtils.getEmptyHash();
    return project.parent_hash !== NULL_HASH;
  }

  /**
   * Получает все дочерние проекты (компоненты) для заданного родительского проекта
   * @param parentHash Хэш родительского проекта
   */
  private async getChildProjectEntities(parentHash: string): Promise<ProjectTypeormEntity[]> {
    return await this.repository.find({
      where: { parent_hash: parentHash },
    });
  }

  /**
   * Агрегирует данные plan и fact от всех компонентов проекта
   * Суммирует все денежные поля (asset) и усредняет процентные поля
   * @param project Родительский проект
   * @param components Массив компонентов проекта
   */
  private aggregateProjectData(project: ProjectTypeormEntity, components: ProjectTypeormEntity[]): void {
    if (components.length === 0) {
      return;
    }

    // Если у проекта нет собственных данных plan/fact, инициализируем их
    if (!project.plan) {
      project.plan = {
        hour_cost: '0.0000 AXON',
        creators_hours: 0,
        return_base_percent: 0,
        use_invest_percent: 0,
        creators_base_pool: '0.0000 AXON',
        authors_base_pool: '0.0000 AXON',
        coordinators_base_pool: '0.0000 AXON',
        creators_bonus_pool: '0.0000 AXON',
        authors_bonus_pool: '0.0000 AXON',
        contributors_bonus_pool: '0.0000 AXON',
        target_expense_pool: '0.0000 AXON',
        invest_pool: '0.0000 AXON',
        coordinators_investment_pool: '0.0000 AXON',
        program_invest_pool: '0.0000 AXON',
        total_received_investments: '0.0000 AXON',
        total_generation_pool: '0.0000 AXON',
        total: '0.0000 AXON',
        total_with_investments: '0.0000 AXON',
      };
    }

    if (!project.fact) {
      project.fact = {
        hour_cost: '0.0000 AXON',
        creators_hours: 0,
        return_base_percent: 0,
        use_invest_percent: 0,
        creators_base_pool: '0.0000 AXON',
        authors_base_pool: '0.0000 AXON',
        coordinators_base_pool: '0.0000 AXON',
        property_base_pool: '0.0000 AXON',
        creators_bonus_pool: '0.0000 AXON',
        authors_bonus_pool: '0.0000 AXON',
        contributors_bonus_pool: '0.0000 AXON',
        target_expense_pool: '0.0000 AXON',
        accumulated_expense_pool: '0.0000 AXON',
        total_used_investments: '0.0000 AXON',
        used_expense_pool: '0.0000 AXON',
        invest_pool: '0.0000 AXON',
        coordinators_investment_pool: '0.0000 AXON',
        program_invest_pool: '0.0000 AXON',
        total_received_investments: '0.0000 AXON',
        total_returned_investments: '0.0000 AXON',
        total_generation_pool: '0.0000 AXON',
        total_contribution: '0.0000 AXON',
        total_used_for_compensation: '0.0000 AXON',
        total: '0.0000 AXON',
        total_with_investments: '0.0000 AXON',
      };
    }

    try {
      // Агрегация plan данных
      const planAssets = [project.plan, ...components.filter(c => c.plan).map(c => c.plan)];

      project.plan.hour_cost = AssetUtils.sumAssets(planAssets.map(p => p?.hour_cost || '0.0000 AXON'));
      project.plan.creators_hours = planAssets.reduce((sum, p) => sum + (typeof p?.creators_hours === 'number' ? p.creators_hours : Number(p?.creators_hours) || 0), 0);
      project.plan.creators_base_pool = AssetUtils.sumAssets(planAssets.map(p => p?.creators_base_pool || '0.0000 AXON'));
      project.plan.authors_base_pool = AssetUtils.sumAssets(planAssets.map(p => p?.authors_base_pool || '0.0000 AXON'));
      project.plan.coordinators_base_pool = AssetUtils.sumAssets(planAssets.map(p => p?.coordinators_base_pool || '0.0000 AXON'));
      project.plan.creators_bonus_pool = AssetUtils.sumAssets(planAssets.map(p => p?.creators_bonus_pool || '0.0000 AXON'));
      project.plan.authors_bonus_pool = AssetUtils.sumAssets(planAssets.map(p => p?.authors_bonus_pool || '0.0000 AXON'));
      project.plan.contributors_bonus_pool = AssetUtils.sumAssets(planAssets.map(p => p?.contributors_bonus_pool || '0.0000 AXON'));
      project.plan.target_expense_pool = AssetUtils.sumAssets(planAssets.map(p => p?.target_expense_pool || '0.0000 AXON'));
      project.plan.invest_pool = AssetUtils.sumAssets(planAssets.map(p => p?.invest_pool || '0.0000 AXON'));
      project.plan.coordinators_investment_pool = AssetUtils.sumAssets(planAssets.map(p => p?.coordinators_investment_pool || '0.0000 AXON'));
      project.plan.program_invest_pool = AssetUtils.sumAssets(planAssets.map(p => p?.program_invest_pool || '0.0000 AXON'));
      project.plan.total_received_investments = AssetUtils.sumAssets(planAssets.map(p => p?.total_received_investments || '0.0000 AXON'));
      project.plan.total_generation_pool = AssetUtils.sumAssets(planAssets.map(p => p?.total_generation_pool || '0.0000 AXON'));
      project.plan.total = AssetUtils.sumAssets(planAssets.map(p => p?.total || '0.0000 AXON'));
      project.plan.total_with_investments = AssetUtils.sumAssets(planAssets.map(p => p?.total_with_investments || '0.0000 AXON'));

      // Для процентных полей берем среднее значение
      const planWithPercents = [project, ...components].filter(c => c.plan);
      project.plan.return_base_percent =
        planWithPercents.reduce((sum, c) => sum + (c.plan?.return_base_percent || 0), 0) / planWithPercents.length;
      project.plan.use_invest_percent =
        planWithPercents.reduce((sum, c) => sum + (c.plan?.use_invest_percent || 0), 0) / planWithPercents.length;

      // Агрегация fact данных
      const factAssets = [project.fact, ...components.filter(c => c.fact).map(c => c.fact)];

      project.fact.hour_cost = AssetUtils.sumAssets(factAssets.map(f => f?.hour_cost || '0.0000 AXON'));
      project.fact.creators_hours = factAssets.reduce((sum, f) => sum + (typeof f?.creators_hours === 'number' ? f.creators_hours : Number(f?.creators_hours) || 0), 0);
      project.fact.creators_base_pool = AssetUtils.sumAssets(factAssets.map(f => f?.creators_base_pool || '0.0000 AXON'));
      project.fact.authors_base_pool = AssetUtils.sumAssets(factAssets.map(f => f?.authors_base_pool || '0.0000 AXON'));
      project.fact.coordinators_base_pool = AssetUtils.sumAssets(factAssets.map(f => f?.coordinators_base_pool || '0.0000 AXON'));
      project.fact.property_base_pool = AssetUtils.sumAssets(factAssets.map(f => f?.property_base_pool || '0.0000 AXON'));
      project.fact.creators_bonus_pool = AssetUtils.sumAssets(factAssets.map(f => f?.creators_bonus_pool || '0.0000 AXON'));
      project.fact.authors_bonus_pool = AssetUtils.sumAssets(factAssets.map(f => f?.authors_bonus_pool || '0.0000 AXON'));
      project.fact.contributors_bonus_pool = AssetUtils.sumAssets(factAssets.map(f => f?.contributors_bonus_pool || '0.0000 AXON'));
      project.fact.target_expense_pool = AssetUtils.sumAssets(factAssets.map(f => f?.target_expense_pool || '0.0000 AXON'));
      project.fact.accumulated_expense_pool = AssetUtils.sumAssets(factAssets.map(f => f?.accumulated_expense_pool || '0.0000 AXON'));
      project.fact.used_expense_pool = AssetUtils.sumAssets(factAssets.map(f => f?.used_expense_pool || '0.0000 AXON'));
      project.fact.invest_pool = AssetUtils.sumAssets(factAssets.map(f => f?.invest_pool || '0.0000 AXON'));
      project.fact.total_used_investments = AssetUtils.sumAssets(factAssets.map(f => f?.total_used_investments || '0.0000 AXON'));
      project.fact.coordinators_investment_pool = AssetUtils.sumAssets(factAssets.map(f => f?.coordinators_investment_pool || '0.0000 AXON'));
      project.fact.program_invest_pool = AssetUtils.sumAssets(factAssets.map(f => f?.program_invest_pool || '0.0000 AXON'));
      project.fact.total_received_investments = AssetUtils.sumAssets(factAssets.map(f => f?.total_received_investments || '0.0000 AXON'));
      project.fact.total_returned_investments = AssetUtils.sumAssets(factAssets.map(f => f?.total_returned_investments || '0.0000 AXON'));
      project.fact.total_generation_pool = AssetUtils.sumAssets(factAssets.map(f => f?.total_generation_pool || '0.0000 AXON'));
      project.fact.total_contribution = AssetUtils.sumAssets(factAssets.map(f => f?.total_contribution || '0.0000 AXON'));
      project.fact.total_used_for_compensation = AssetUtils.sumAssets(factAssets.map(f => f?.total_used_for_compensation || '0.0000 AXON'));
      project.fact.total = AssetUtils.sumAssets(factAssets.map(f => f?.total || '0.0000 AXON'));
      project.fact.total_with_investments = AssetUtils.sumAssets(factAssets.map(f => f?.total_with_investments || '0.0000 AXON'));

      // Для процентных полей берем среднее значение
      const factWithPercents = [project, ...components].filter(c => c.fact);
      project.fact.return_base_percent =
        factWithPercents.reduce((sum, c) => sum + (c.fact?.return_base_percent || 0), 0) / factWithPercents.length;
      project.fact.use_invest_percent =
        factWithPercents.reduce((sum, c) => sum + (c.fact?.use_invest_percent || 0), 0) / factWithPercents.length;

    } catch (error: any) {
      console.error(`Ошибка при агрегации данных проекта ${project.project_hash}:`, error.message);
      // В случае ошибки оставляем исходные значения проекта
    }
  }
}
