import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, In } from 'typeorm';
import { ProjectRepository } from '../../domain/repositories/project.repository';
import { ProjectDomainEntity } from '../../domain/entities/project.entity';
import { ProjectTypeormEntity } from '../entities/project.typeorm-entity';
import { ProjectMapper } from '../mappers/project.mapper';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { BaseBlockchainRepository, EntityVersioningService } from '@coopenomics/extension-kit/sync';
import type { IProjectDomainInterfaceBlockchainData } from '../../domain/interfaces/project-blockchain.interface';
import type { IProjectDomainInterfaceDatabaseData } from '../../domain/interfaces/project-database.interface';
import type { ProjectFilterInputDTO } from '../../application/dto/property_management/project-filter.input';
import type { ArtifactAccessScope } from '../../domain/repositories/artifact-access-scope';
import { IssueIdGenerationService } from '../../domain/services/issue-id-generation.service';
import { ProjectOrigin } from '../../domain/enums/project-origin.enum';
import { PaginationInputDTO, PaginationResult, PaginationUtils, DomainToBlockchainUtils, AssetUtils } from '@coopenomics/extension-kit';

/**
 * Среднее по процентным полям проекта и его компонентов.
 *
 * WHY: каждое значение приводится к числу явно. Проценты синхронизировались двумя путями и
 * до нормализации в RPC-транспорте могли лечь в БД строкой — тогда `sum + value` склеивал
 * строки, среднее выходило NaN и роняло сериализацию GraphQL Float на всём списке проектов.
 * Записи, сохранённые до фикса, живут в БД до следующей дельты, поэтому усреднение обязано
 * оставаться устойчивым к ним.
 */
function averagePercent(values: Array<number | string | null | undefined>): number {
  if (values.length === 0) return 0;

  const sum = values.reduce<number>((accumulator, value) => {
    const parsed = Number(value ?? 0);
    return accumulator + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);

  return sum / values.length;
}

@Injectable()
export class ProjectTypeormRepository
  extends BaseBlockchainRepository<ProjectDomainEntity, ProjectTypeormEntity>
  implements ProjectRepository, IBlockchainSyncRepository<ProjectDomainEntity>
{
  constructor(
    @InjectRepository(ProjectTypeormEntity)
    repository: Repository<ProjectTypeormEntity>,
    entityVersioningService: EntityVersioningService
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
      let inheritedDevUrl: string | null = null;
      const parentHashRaw = (blockchainData.parent_hash || '').toLowerCase();
      const emptyParent = DomainToBlockchainUtils.getEmptyHash().toLowerCase();
      if (parentHashRaw && parentHashRaw !== emptyParent) {
        const parentRow = await this.repository.findOneBy({ project_hash: parentHashRaw });
        const fromParent = parentRow?.development_repository_url?.trim();
        inheritedDevUrl = fromParent && fromParent.length > 0 ? fromParent : null;
      }

      // Создаем полную структуру databaseData для проекта
      const databaseData: IProjectDomainInterfaceDatabaseData = {
        _id: '',
        block_num: blockNum,
        present: present,
        project_hash: syncValue.toLowerCase(),
        prefix: IssueIdGenerationService.generateProjectPrefix(syncValue),
        issue_counter: 0,
        voting_deadline: null,
        matrix_room_id: null,
        development_repository_url: inheritedDevUrl,
        origin: ProjectOrigin.BLOCKCHAIN,
        local_owner: null,
      };

      const newEntity = this.createDomainEntity(databaseData, blockchainData);
      const saved = await this.save(newEntity);
      await this.populateParentTitles([saved]);
      return saved;
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

    return createdProject;
  }

  async update(entity: ProjectDomainEntity): Promise<ProjectDomainEntity> {
    return await super.update(entity);
  }

  async setMatrixRoomId(projectHash: string, matrixRoomId: string): Promise<void> {
    const h = projectHash.toLowerCase();
    await this.repository.update({ project_hash: h }, { matrix_room_id: matrixRoomId });
  }

  async setDevelopmentRepositoryUrl(projectHash: string, url: string | null): Promise<void> {
    const h = projectHash.toLowerCase();
    await this.repository.update({ project_hash: h }, { development_repository_url: url });
  }

  async updateLocalContent(
    projectHash: string,
    fields: {
      title?: string;
      description?: string;
      invite?: string;
      meta?: string;
      data?: string;
    }
  ): Promise<ProjectDomainEntity> {
    const h = projectHash.toLowerCase();
    const existing = await this.repository.findOneBy({ project_hash: h });
    if (!existing) {
      throw new Error(`Проект с хэшем ${h} не найден`);
    }
    if (existing.origin !== ProjectOrigin.LOCAL) {
      throw new Error('Обновление локальных полей доступно только для персональных проектов');
    }
    const patch: Partial<ProjectTypeormEntity> = {};
    if (fields.title !== undefined) patch.title = fields.title;
    if (fields.description !== undefined) patch.description = fields.description;
    if (fields.invite !== undefined) patch.invite = fields.invite;
    if (fields.meta !== undefined) patch.meta = fields.meta;
    if (fields.data !== undefined) patch.data = fields.data;
    await this.repository.update({ project_hash: h }, patch);
    const updated = await this.findByHash(h);
    if (!updated) {
      throw new Error(`Не удалось перечитать проект ${h} после локального обновления`);
    }
    return updated;
  }

  async softDeleteLocal(projectHash: string): Promise<void> {
    const h = projectHash.toLowerCase();
    const existing = await this.repository.findOneBy({ project_hash: h });
    if (!existing) {
      throw new Error(`Проект с хэшем ${h} не найден`);
    }
    if (existing.origin !== ProjectOrigin.LOCAL) {
      throw new Error('Мягкое удаление без блокчейна доступно только для персональных проектов');
    }
    await this.repository.update({ project_hash: h }, { present: false });
  }

  async findDistinctDevelopmentRepositoryUrls(coopname: string): Promise<string[]> {
    const rows = await this.repository
      .createQueryBuilder('p')
      .select('DISTINCT p.development_repository_url', 'url')
      .where('p.coopname = :coopname', { coopname })
      .andWhere('p.present = :present', { present: true })
      .andWhere('p.development_repository_url IS NOT NULL')
      .andWhere("btrim(p.development_repository_url) <> ''")
      .getRawMany<{ url: string }>();
    const urls = rows.map((r) => (typeof r.url === 'string' ? r.url.trim() : '')).filter((u) => u.length > 0);
    return [...new Set(urls)];
  }

  async countByCoopnameAndDevelopmentRepositoryUrl(coopname: string, normalizedRepositoryUrl: string): Promise<number> {
    return this.repository.count({
      where: { coopname, development_repository_url: normalizedRepositoryUrl, present: true },
    });
  }

  /** Только строки, актуально присутствующие в блокчейне (см. поле present). */
  override async findAll(): Promise<ProjectDomainEntity[]> {
    const entities = await this.repository.find({ where: { present: true } });
    return entities.map((entity) => ProjectMapper.toDomain(entity));
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
    const entities = await this.repository.findBy({ project_hash: In(hashes), present: true });

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
    const entities = await this.repository.find({ where: { master, present: true } });

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
    const entities = await this.repository.find({ where: { status: status as any, present: true } });

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
      where: { project_hash: projectHash, present: true },
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
      where: { project_hash: projectHash, present: true },
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
      where: { project_hash: projectHash, present: true },
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
    options?: PaginationInputDTO
  ): Promise<PaginationResult<ProjectDomainEntity>> {
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
    if (filter?.origin && filter.origin !== 'any' && filter.origin !== 'all') {
      where.origin = filter.origin;
    } else if (!filter?.origin) {
      where.origin = ProjectOrigin.BLOCKCHAIN;
    }
    // origin=any|all — без ограничения (список «мои проекты» по master)

    where.present = true;

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
    options?: PaginationInputDTO,
    scope?: ArtifactAccessScope
  ): Promise<PaginationResult<ProjectDomainEntity>> {
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

    const emptyHash = DomainToBlockchainUtils.getEmptyHash();

    // Создаем query builder для гибкого построения запроса
    let queryBuilder = this.repository
      .createQueryBuilder('p')
      .select('p')
      .where('1=1')
      .andWhere('p.present = :present', { present: true });

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
    if (filter?.origin && filter.origin !== 'any' && filter.origin !== 'all') {
      queryBuilder = queryBuilder.andWhere('p.origin = :origin', { origin: filter.origin });
    } else if (!filter?.origin) {
      queryBuilder = queryBuilder.andWhere('p.origin = :origin', { origin: ProjectOrigin.BLOCKCHAIN });
    }
    // origin=any|all — без ограничения (список «мои проекты» по master)

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
        'EXISTS (SELECT 1 FROM capital_projects comp INNER JOIN capital_issues i ON i.project_hash = comp.project_hash WHERE comp.parent_hash = p.project_hash AND comp.parent_hash != :emptyHash AND comp.present = true';

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

    // Ограничение правами доступа к артефактам. Отсев в SQL, иначе постраничные
    // totalCount/totalPages считаются по недоступным проектам.
    if (scope) {
      const scopeHashes = scope.projectHashes.map((hash) => hash.toLowerCase());
      queryBuilder = queryBuilder.andWhere('lower(p.project_hash) = ANY(CAST(:scopeHashes AS text[]))', {
        scopeHashes,
      });
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
    if (!entity || !entity.present) {
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
      where: { parent_hash: parentHash, present: true },
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
      where: { parent_hash: parentHash, present: true },
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
      project.plan.return_base_percent = averagePercent(planWithPercents.map(c => c.plan?.return_base_percent));
      project.plan.use_invest_percent = averagePercent(planWithPercents.map(c => c.plan?.use_invest_percent));

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
      project.fact.return_base_percent = averagePercent(factWithPercents.map(c => c.fact?.return_base_percent));
      project.fact.use_invest_percent = averagePercent(factWithPercents.map(c => c.fact?.use_invest_percent));

    } catch (error: any) {
      console.error(`Ошибка при агрегации данных проекта ${project.project_hash}:`, error.message);
      // В случае ошибки оставляем исходные значения проекта
    }
  }
}
