import { Injectable, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { PUB_SUB } from '~/infrastructure/pubsub/pubsub.module';
import { CAPITAL_EVENTS } from '../resolvers/capital-subscription.resolver';
import { generateUniqueHash } from '~/utils/generate-hash.util';
import { GenerationInteractor } from '../use-cases/generation.interactor';
import type { CreateCommitInputDTO } from '../dto/generation/create-commit-input.dto';
import type { CommitApproveInputDTO } from '../dto/generation/commit-approve-input.dto';
import type { CommitDeclineInputDTO } from '../dto/generation/commit-decline-input.dto';
import type { CommitApproveDomainInput } from '../../domain/actions/commit-approve-domain-input.interface';
import type { CommitDeclineDomainInput } from '../../domain/actions/commit-decline-domain-input.interface';
import type { CreateStoryInputDTO } from '../dto/generation/create-story-input.dto';
import type { CreateIssueInputDTO } from '../dto/generation/create-issue-input.dto';
import type { CreateCycleInputDTO } from '../dto/generation/create-cycle-input.dto';
import type { UpdateStoryInputDTO } from '../dto/generation/update-story-input.dto';
import type { UpdateIssueInputDTO } from '../dto/generation/update-issue-input.dto';
import type { StoryFilterInputDTO } from '../dto/generation/story-filter.input';
import type { IssueFilterInputDTO } from '../dto/generation/issue-filter.input';
import type { CommitFilterInputDTO } from '../dto/generation/commit-filter.input';
import type { CycleFilterInputDTO } from '../dto/generation/cycle-filter.input';
import type { GetIssueByIdInputDTO } from '../dto/generation/get-issue-by-id.input';
import type { GetCommitByIdInputDTO } from '../dto/generation/get-commit-by-id.input';
import { STORY_REPOSITORY, StoryRepository } from '../../domain/repositories/story.repository';
import { ISSUE_REPOSITORY, IssueRepository } from '../../domain/repositories/issue.repository';
import { PROJECT_REPOSITORY, ProjectRepository } from '../../domain/repositories/project.repository';
import { COMMIT_REPOSITORY, CommitRepository } from '../../domain/repositories/commit.repository';
import { CYCLE_REPOSITORY, CycleRepository } from '../../domain/repositories/cycle.repository';
import { IssueIdGenerationService } from '../../domain/services/issue-id-generation.service';
import { StoryOutputDTO } from '../dto/generation/story.dto';
import { IssueOutputDTO } from '../dto/generation/issue.dto';
import { CommitOutputDTO } from '../dto/generation/commit.dto';
import { CycleOutputDTO } from '../dto/generation/cycle.dto';
import { PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import { StoryStatus } from '../../domain/enums/story-status.enum';
import { IssuePriority } from '../../domain/enums/issue-priority.enum';
import { IssueStatus } from '../../domain/enums/issue-status.enum';
import { CycleStatus } from '../../domain/enums/cycle-status.enum';
import { StoryDomainEntity } from '../../domain/entities/story.entity';
import { IssueDomainEntity } from '../../domain/entities/issue.entity';
import { CycleDomainEntity } from '../../domain/entities/cycle.entity';
import type { IStoryDatabaseData } from '../../domain/interfaces/story-database.interface';
import type { IIssueDatabaseData } from '../../domain/interfaces/issue-database.interface';
import type { ICycleDatabaseData } from '../../domain/interfaces/cycle-database.interface';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { GenerationMoneyInvestStatementGenerateDocumentInputDTO } from '~/application/document/documents-dto/generation-money-invest-statement-document.dto';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import { Cooperative } from 'cooptypes';
import { InvestsManagementInteractor } from '../use-cases/invests-management.interactor';
import { IssuePermissionsService } from './issue-permissions.service';
import { PermissionsService } from './permissions.service';
import { ProjectMapperService } from './project-mapper.service';
import { CommitMapperService } from './commit-mapper.service';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';

/**
 * Сервис уровня приложения для генерации в CAPITAL
 * Обрабатывает запросы от GenerationResolver
 */
@Injectable()
export class GenerationService {
  constructor(
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
    private readonly generationInteractor: GenerationInteractor,
    @Inject(STORY_REPOSITORY)
    private readonly storyRepository: StoryRepository,
    @Inject(ISSUE_REPOSITORY)
    private readonly issueRepository: IssueRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(COMMIT_REPOSITORY)
    private readonly commitRepository: CommitRepository,
    @Inject(CYCLE_REPOSITORY)
    private readonly cycleRepository: CycleRepository,
    private readonly issueIdGenerationService: IssueIdGenerationService,
    private readonly documentInteractor: DocumentInteractor,
    private readonly investsManagementInteractor: InvestsManagementInteractor,
    private readonly issuePermissionsService: IssuePermissionsService,
    private readonly permissionsService: PermissionsService,
    private readonly projectMapperService: ProjectMapperService,
    private readonly commitMapperService: CommitMapperService
  ) {}


  /**
   * Создание коммита в CAPITAL контракте
   * Возвращает полный объект коммита с обогащенными данными
   */
  async createCommit(data: CreateCommitInputDTO, currentUser: MonoAccountDomainInterface): Promise<CommitOutputDTO> {
    const commitEntity = await this.generationInteractor.createCommit(data, currentUser);
    return await this.commitMapperService.toDTO(commitEntity, currentUser);
  }

  /**
   * Одобрение коммита в CAPITAL контракте
   */
  async approveCommit(data: CommitApproveInputDTO, currentUser: MonoAccountDomainInterface): Promise<CommitOutputDTO> {
    const domainInput: CommitApproveDomainInput = {
      ...data,
      master: currentUser.username,
    };

    const commitEntity = await this.generationInteractor.approveCommit(domainInput);
    return await this.commitMapperService.toDTO(commitEntity, currentUser);
  }

  /**
   * Отклонение коммита в CAPITAL контракте
   */
  async declineCommit(data: CommitDeclineInputDTO, currentUser: MonoAccountDomainInterface): Promise<CommitOutputDTO> {
    const domainInput: CommitDeclineDomainInput = {
      ...data,
      master: currentUser.username,
    };

    const commitEntity = await this.generationInteractor.declineCommit(domainInput);
    return await this.commitMapperService.toDTO(commitEntity, currentUser);
  }

  // ============ STORY METHODS ============

  /**
   * Создание истории
   */
  async createStory(data: CreateStoryInputDTO, currentUser: MonoAccountDomainInterface): Promise<StoryOutputDTO> {
    // Проверяем права доступа на создание требования
    if (data.project_hash) {
      // Получаем проект и проверяем права на создание требования
      const project = await this.projectRepository.findByHash(data.project_hash);
      if (!project) {
        throw new Error(`Проект с хешем ${data.project_hash} не найден`);
      }
      const projectPermissions = await this.permissionsService.calculateProjectPermissions(project, currentUser);
      if (!projectPermissions.can_create_requirement) {
        throw new Error(
          'У вас нет прав на создание требований для этого проекта. Только мастер проекта может создавать требования.'
        );
      }
    } else if (data.issue_hash) {
      // Получаем задачу и проверяем права на создание требования
      const issue = await this.issueRepository.findByIssueHash(data.issue_hash);
      if (!issue) {
        throw new Error(`Задача с хешем ${data.issue_hash} не найдена`);
      }
      const issuePermissions = await this.permissionsService.calculateIssuePermissions(issue, currentUser);
      if (!issuePermissions.can_create_requirement) {
        throw new Error(
          'У вас нет прав на создание требований для этой задачи. Только мастер проекта может создавать требования.'
        );
      }
    } else {
      // Если не указан ни проект, ни задача - это ошибка
      throw new Error('Требование должно быть привязано либо к проекту, либо к задаче');
    }

    // Создаем данные для доменной сущности
    const storyDatabaseData: IStoryDatabaseData = {
      _id: '',
      story_hash: data.story_hash,
      coopname: data.coopname,
      title: data.title,
      description: data.description,
      status: data.status || StoryStatus.PENDING,
      project_hash: data.project_hash,
      // Нормализация: пустая строка или undefined преобразуется в undefined
      issue_hash: data.issue_hash && data.issue_hash.trim() !== '' ? data.issue_hash : undefined,
      created_by: currentUser.username, // Сохраняем username пользователя
      sort_order: data.sort_order || 0,
      block_num: 0,
      present: false,
    };

    // Создаем доменную сущность
    const storyEntity = new StoryDomainEntity(storyDatabaseData);

    // Сохраняем через репозиторий
    const savedStory = await this.storyRepository.create(storyEntity);
    return savedStory;
  }

  /**
   * Обновление истории
   */
  async updateStory(data: UpdateStoryInputDTO, username: string, currentUser?: MonoAccountDomainInterface): Promise<StoryOutputDTO> {
    // Получаем существующую историю
    const existingStory = await this.storyRepository.findByStoryHash(data.story_hash);

    if (!existingStory) {
      throw new Error(`История с хэшем ${data.story_hash} не найдена`);
    }

    // Проверяем права на управление требованиями
    const projectHash = data.project_hash ?? existingStory.project_hash;
    if (projectHash) {
      const project = await this.projectRepository.findByHash(projectHash);
      if (!project) {
        throw new Error(`Проект с хэшем ${projectHash} не найден`);
      }
      const projectPermissions = await this.permissionsService.calculateProjectPermissions(project, currentUser);
      if (!projectPermissions.can_create_requirement) {
        throw new Error('У вас нет прав на управление требованиями в этом проекте. Только мастер проекта может управлять требованиями.');
      }
    }

    // Определяем issue_hash с нормализацией
    const issueHash = data.issue_hash ?? existingStory.issue_hash;

    // Создаем обновленные данные для доменной сущности
    const updatedStoryDatabaseData: IStoryDatabaseData = {
      _id: existingStory._id,
      story_hash: existingStory.story_hash,
      coopname: existingStory.coopname,
      title: data.title ?? existingStory.title,
      description: data.description ?? existingStory.description,
      status: data.status ?? existingStory.status,
      project_hash: data.project_hash ?? existingStory.project_hash,
      // Нормализация: пустая строка или undefined преобразуется в undefined
      issue_hash: issueHash && issueHash.trim() !== '' ? issueHash : undefined,
      created_by: existingStory.created_by,
      sort_order: data.sort_order ?? existingStory.sort_order,
      block_num: existingStory.block_num,
      present: existingStory.present,
    };

    // Создаем доменную сущность с обновленными данными
    const storyEntity = new StoryDomainEntity(updatedStoryDatabaseData);

    // Сохраняем через репозиторий
    const updatedStory = await this.storyRepository.update(storyEntity);
    return updatedStory;
  }

  /**
   * Получение историй с фильтрацией
   */
  async getStories(filter?: StoryFilterInputDTO, options?: PaginationInputDTO): Promise<PaginationResult<StoryOutputDTO>> {
    // Если указан issue_hash, ищем только по конкретной задаче
    if (filter?.issue_hash) {
      const result = await this.storyRepository.findAllPaginated(filter, options);
      return {
        items: result.items as StoryOutputDTO[],
        totalCount: result.totalCount,
        currentPage: result.currentPage,
        totalPages: result.totalPages,
      };
    }

    // Если указан project_hash, применяем агрегацию
    if (filter?.project_hash) {
      // Определяем, нужно ли включать требования дочерних компонентов
      const showComponentsRequirements = filter.show_components_requirements !== false; // По умолчанию true

      // Определяем, нужно ли включать требования задач
      const showIssuesRequirements = filter.show_issues_requirements !== false; // По умолчанию true

      // Собираем все project_hash для фильтрации
      let projectHashesToFilter: string[] = [filter.project_hash];

      if (showComponentsRequirements) {
        // Получаем дочерние компоненты проекта
        try {
          const components = await this.projectRepository.findComponentsByParentHash(filter.project_hash);
          const componentHashes = components.map((component) => component.project_hash);
          projectHashesToFilter = projectHashesToFilter.concat(componentHashes);
        } catch (error) {
          console.warn(`Failed to fetch components for project ${filter.project_hash}`, { error });
          // Продолжаем с только родительским проектом
        }
      }

      // Собираем все issue_hash для фильтрации задач
      let issueHashesToFilter: string[] = [];

      if (showIssuesRequirements) {
        // Получаем все задачи для собранных проектов
        try {
          for (const projectHash of projectHashesToFilter) {
            const issues = await this.issueRepository.findByProjectHash(projectHash);
            const issueHashes = issues.map((issue) => issue.issue_hash);
            issueHashesToFilter = issueHashesToFilter.concat(issueHashes);
          }
        } catch (error) {
          console.warn(`Failed to fetch issues for projects ${projectHashesToFilter.join(', ')}`, { error });
          // Продолжаем без задач
        }
      }

      // Получаем все stories одним запросом
      const allStories = await this.storyRepository.findAllByProjectHashesAndIssueHashes(
        projectHashesToFilter,
        issueHashesToFilter
      );

      // Убираем дубликаты (на случай если одна история относится к нескольким проектам)
      const uniqueStories = allStories.filter(
        (story, index, self) => index === self.findIndex((s) => s.story_hash === story.story_hash)
      );

      // Сортируем по sort_order, затем по _created_at
      uniqueStories.sort((a, b) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return 0; // _created_at уже отсортирован в findAll
      });

      // Применяем пагинацию
      const page = options?.page || 1;
      const limit = options?.limit || 10;
      const offset = (page - 1) * limit;
      const paginatedItems = uniqueStories.slice(offset, offset + limit);

      return {
        items: paginatedItems as StoryOutputDTO[],
        totalCount: uniqueStories.length,
        currentPage: page,
        totalPages: Math.ceil(uniqueStories.length / limit),
      };
    }

    // Для остальных случаев используем стандартную пагинацию
    const result = await this.storyRepository.findAllPaginated(filter, options);
    return {
      items: result.items as StoryOutputDTO[],
      totalCount: result.totalCount,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
    };
  }

  /**
   * Получение истории по хэшу
   */
  async getStoryByHash(storyHash: string): Promise<StoryOutputDTO | null> {
    const storyEntity = await this.storyRepository.findByStoryHash(storyHash);
    return storyEntity ? (storyEntity as StoryOutputDTO) : null;
  }

  /**
   * Удаление истории по хэшу
   */
  async deleteStoryByHash(storyHash: string): Promise<boolean> {
    const storyEntity = await this.storyRepository.findByStoryHash(storyHash);
    if (!storyEntity) {
      throw new Error(`История с хэшем ${storyHash} не найдена`);
    }
    await this.storyRepository.delete(storyEntity._id);
    return true;
  }

  // ============ ISSUE METHODS ============

  /**
   * Создание задачи
   */
  async createIssue(
    data: CreateIssueInputDTO,
    username: string,
    currentUser?: MonoAccountDomainInterface
  ): Promise<IssueOutputDTO> {
    // Проверяем права на управление задачами
    const project = await this.projectRepository.findByHash(data.project_hash);
    if (!project) {
      throw new Error(`Проект с хэшем ${data.project_hash} не найден`);
    }
    const projectPermissions = await this.permissionsService.calculateProjectPermissions(project, currentUser);
    if (!projectPermissions.can_manage_issues) {
      throw new Error('У вас нет прав на управление задачами в этом проекте. Только мастер проекта может управлять задачами.');
    }

    // Проверяем права на установку статуса задачи
    if (data.status) {
      await this.issuePermissionsService.validateIssueStatusPermission(
        username,
        data.coopname,
        data.project_hash,
        data.submaster,
        data.creators || [], // Для новой задачи creators может быть пустым
        data.status,
        IssueStatus.BACKLOG, // Для новой задачи текущий статус - BACKLOG
        currentUser?.role
      );
    }

    // Генерируем уникальный хэш для задачи
    const issueHash = generateUniqueHash();

    // Подготавливаем данные задачи без ID
    const issueDataWithoutId: Omit<IIssueDatabaseData, 'id'> = {
      _id: '',
      issue_hash: issueHash,
      coopname: data.coopname,
      title: data.title,
      description: data.description,
      priority: data.priority || IssuePriority.MEDIUM,
      status: data.status || IssueStatus.BACKLOG,
      estimate: data.estimate || 0,
      sort_order: data.sort_order || 0,
      created_by: username, // Сохраняем имя пользователя
      submaster: data.submaster || (data.creators && data.creators.length > 0 ? data.creators[0] : undefined),
      creators: data.creators || [],
      project_hash: data.project_hash,
      cycle_id: data.cycle_id,
      metadata: {
        labels: data.labels || [],
        attachments: data.attachments || [],
      },
      present: false,
    };

    // Генерируем ID + увеличиваем счетчик атомарно в проекте
    const { issueData, updatedProject } = this.issueIdGenerationService.generateIssueId(project, issueDataWithoutId);

    // Сохраняем обновленный проект с новым счетчиком
    await this.projectRepository.update(updatedProject);

    // Создаем доменную сущность с готовым ID
    const issueEntity = new IssueDomainEntity(issueData);

    // Если указан ответственный, используем метод доменной сущности для правильного назначения
    if (data.submaster) {
      issueEntity.setSubmaster(data.submaster);
    }

    // Сохраняем задачу через репозиторий
    const savedIssue = await this.issueRepository.create(issueEntity);

    // Рассчитываем права доступа для задачи
    const permissions = await this.permissionsService.calculateIssuePermissions(savedIssue, currentUser);

    const issueResult = { ...savedIssue, permissions } as IssueOutputDTO;

    // Публикуем событие для подписчиков
    this.pubSub.publish(CAPITAL_EVENTS.ISSUE_CREATED, {
      [CAPITAL_EVENTS.ISSUE_CREATED]: issueResult,
    });

    return issueResult;
  }

  /**
   * Обновление задачи
   */
  async updateIssue(
    data: UpdateIssueInputDTO,
    username: string,
    currentUser?: MonoAccountDomainInterface
  ): Promise<IssueOutputDTO> {
    // Получаем существующую задачу
    const existingIssue = await this.issueRepository.findByIssueHash(data.issue_hash);

    if (!existingIssue) {
      throw new Error(`Задача с хэшем ${data.issue_hash} не найдена`);
    }

    // Проверяем права на управление задачами
    const project = await this.projectRepository.findByHash(existingIssue.project_hash);
    if (!project) {
      throw new Error(`Проект с хэшем ${existingIssue.project_hash} не найден`);
    }
    const projectPermissions = await this.permissionsService.calculateProjectPermissions(project, currentUser);

    // Рассчитываем права доступа для конкретной задачи
    const issuePermissions = await this.permissionsService.calculateIssuePermissions(existingIssue, currentUser);

    // Проверяем права на управление задачами в проекте (мастер проекта) или на редактирование конкретной задачи (исполнитель)
    if (!projectPermissions.can_manage_issues && !issuePermissions.can_edit_issue) {
      throw new Error('У вас нет прав на редактирование этой задачи. Только мастер проекта или исполнитель задачи могут изменять её.');
    }

    // Проверяем права на назначение ответственного
    if (data.submaster !== undefined && data.submaster !== existingIssue.submaster) {
      await this.issuePermissionsService.validateSubmasterAssignmentPermission(
        username,
        existingIssue.coopname,
        existingIssue.project_hash
      );
    }

    // Проверяем права на изменение статуса задачи
    if (data.status !== undefined) {
      await this.issuePermissionsService.validateIssueStatusPermission(
        username,
        existingIssue.coopname,
        existingIssue.project_hash,
        existingIssue.submaster,
        existingIssue.creators,
        data.status,
        existingIssue.status,
        currentUser?.role
      );
    }

    // Проверяем права на установку оценки (estimate)
    if (data.estimate !== undefined && data.estimate !== existingIssue.estimate) {
      await this.issuePermissionsService.validateEstimateSettingPermission(
        username,
        existingIssue.coopname,
        existingIssue.project_hash,
        existingIssue.submaster,
        existingIssue.creators,
        currentUser?.role
      );
    }

    // Проверяем права на установку приоритета
    if (data.priority !== undefined && data.priority !== existingIssue.priority) {
      await this.issuePermissionsService.validatePrioritySettingPermission(
        username,
        existingIssue.coopname,
        existingIssue.project_hash,
        existingIssue.submaster,
        existingIssue.creators,
        currentUser?.role
      );
    }
    console.log('inputData', data)
    // Создаем обновленные данные для доменной сущности
    const updatedIssueDatabaseData: IIssueDatabaseData = {
      _id: existingIssue._id,
      id: existingIssue.id,
      issue_hash: existingIssue.issue_hash,
      coopname: existingIssue.coopname,
      title: data.title ?? existingIssue.title,
      description: data.description ?? existingIssue.description,
      priority: data.priority ?? existingIssue.priority,
      status: data.status ?? existingIssue.status,
      estimate: data.estimate ?? existingIssue.estimate,
      sort_order: data.sort_order ?? existingIssue.sort_order,
      created_by: existingIssue.created_by, // Сохраняем существующее значение created_by (username)
      submaster: data.submaster ?? (data.creators && data.creators.length > 0 ? data.creators[0] : existingIssue.submaster),
      creators: data.creators ?? existingIssue.creators,
      project_hash: existingIssue.project_hash,
      cycle_id: data.cycle_id ?? existingIssue.cycle_id,
      metadata: {
        labels: data.labels ?? existingIssue.metadata.labels,
        attachments: data.attachments ?? existingIssue.metadata.attachments,
      },
      present: existingIssue.present,
    };
    console.log('updatedIssueDatabaseData', updatedIssueDatabaseData)

    // Создаем доменную сущность с обновленными данными
    const issueEntity = new IssueDomainEntity(updatedIssueDatabaseData);

    // Если изменился ответственный, используем метод доменной сущности для правильного обновления
    if (data.submaster !== undefined && data.submaster !== existingIssue.submaster) {
      issueEntity.setSubmaster(data.submaster);
    }

    // Если переданы creators, обновляем их через доменный метод
    if (data.creators !== undefined) {
      issueEntity.setCreators(data.creators);
    }

    // Сохраняем через репозиторий
    const updatedIssue = await this.issueRepository.update(issueEntity);
    console.log('updatedIssue', updatedIssue)
    // Рассчитываем права доступа для задачи
    const permissions = await this.permissionsService.calculateIssuePermissions(updatedIssue, currentUser);

    const issueResult = { ...updatedIssue, permissions } as IssueOutputDTO;

    // Публикуем событие для подписчиков
    this.pubSub.publish(CAPITAL_EVENTS.ISSUE_UPDATED, {
      [CAPITAL_EVENTS.ISSUE_UPDATED]: issueResult,
    });

    return issueResult;
  }

  /**
   * Получение задач с фильтрацией
   */
  async getIssues(
    filter?: IssueFilterInputDTO,
    options?: PaginationInputDTO,
    currentUser?: MonoAccountDomainInterface
  ): Promise<PaginationResult<IssueOutputDTO>> {
    // Получаем результат с пагинацией из домена
    const result = await this.issueRepository.findAllPaginated(filter, options);

    // Рассчитываем права доступа для всех задач пакетно
    const permissionsMap = await this.permissionsService.calculateBatchIssuePermissions(result.items, currentUser);

    // Обогащаем задачи правами доступа
    const itemsWithPermissions = result.items.map((issue) => {
      const permissions = permissionsMap.get(issue.issue_hash);
      return {
        ...issue,
        permissions,
      } as IssueOutputDTO;
    });

    // Конвертируем результат в DTO
    return {
      items: itemsWithPermissions,
      totalCount: result.totalCount,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
    };
  }

  /**
   * Получение задачи по ID
   */
  async getIssueById(data: GetIssueByIdInputDTO, currentUser?: MonoAccountDomainInterface): Promise<IssueOutputDTO | null> {
    const issueEntity = await this.issueRepository.findById(data.id);

    if (!issueEntity) {
      return null;
    }

    // Рассчитываем права доступа для задачи
    const permissions = await this.permissionsService.calculateIssuePermissions(issueEntity, currentUser);

    // Возвращаем задачу с правами доступа
    return {
      ...issueEntity,
      permissions,
    } as IssueOutputDTO;
  }

  /**
   * Получение задачи по хэшу
   */
  async getIssueByHash(issueHash: string, currentUser?: MonoAccountDomainInterface): Promise<IssueOutputDTO | null> {
    const issueEntity = await this.issueRepository.findByIssueHash(issueHash);

    if (!issueEntity) {
      return null;
    }

    // Рассчитываем права доступа для задачи
    const permissions = await this.permissionsService.calculateIssuePermissions(issueEntity, currentUser);

    // Возвращаем задачу с правами доступа
    return {
      ...issueEntity,
      permissions,
    } as IssueOutputDTO;
  }

  /**
   * Удаление задачи по хэшу
   */
  async deleteIssueByHash(issueHash: string): Promise<boolean> {
    const issueEntity = await this.issueRepository.findByIssueHash(issueHash);
    if (!issueEntity) {
      throw new Error(`Задача с хэшем ${issueHash} не найдена`);
    }
    await this.issueRepository.delete(issueEntity._id);
    return true;
  }

  // ============ COMMIT METHODS ============

  /**
   * Получение коммитов с фильтрацией
   */
  async getCommits(
    filter?: CommitFilterInputDTO,
    options?: PaginationInputDTO,
    currentUser?: MonoAccountDomainInterface
  ): Promise<PaginationResult<CommitOutputDTO>> {
    // Получаем результат с пагинацией из домена
    const result = await this.commitRepository.findAllPaginated(filter, options);

    // Обогащаем коммиты через mapper
    const itemsWithProjects = await this.commitMapperService.toDTOBatch(result.items, currentUser);

    // Конвертируем результат в DTO
    return {
      items: itemsWithProjects,
      totalCount: result.totalCount,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
    };
  }

  /**
   * Получение коммита по ID
   */
  async getCommitById(
    data: GetCommitByIdInputDTO,
    currentUser?: MonoAccountDomainInterface
  ): Promise<CommitOutputDTO | null> {
    const commitEntity = await this.commitRepository.findById(data.id);
    return commitEntity ? await this.commitMapperService.toDTO(commitEntity, currentUser) : null;
  }

  /**
   * Получение коммита по хэшу
   */
  async getCommitByHash(commitHash: string, currentUser?: MonoAccountDomainInterface): Promise<CommitOutputDTO | null> {
    const commitEntity = await this.commitRepository.findByCommitHash(commitHash);
    return commitEntity ? await this.commitMapperService.toDTO(commitEntity, currentUser) : null;
  }

  // ============ CYCLE METHODS ============

  /**
   * Создание цикла
   */
  async createCycle(data: CreateCycleInputDTO): Promise<CycleOutputDTO> {
    // Создаем данные для доменной сущности
    const cycleDatabaseData: ICycleDatabaseData = {
      _id: '',
      name: data.name,
      start_date: new Date(data.start_date),
      end_date: new Date(data.end_date),
      status: data.status || CycleStatus.FUTURE,
      present: false,
    };

    // Создаем доменную сущность
    const cycleEntity = new CycleDomainEntity(cycleDatabaseData);

    // Сохраняем через репозиторий
    const savedCycle = await this.cycleRepository.create(cycleEntity);
    return savedCycle;
  }

  /**
   * Получение циклов с фильтрацией
   */
  async getCycles(filter?: CycleFilterInputDTO, options?: PaginationInputDTO): Promise<PaginationResult<CycleOutputDTO>> {
    // Получаем результат с пагинацией из домена
    const result = await this.cycleRepository.findAllPaginated(filter, options);

    // Конвертируем результат в DTO
    return {
      items: result.items as CycleOutputDTO[],
      totalCount: result.totalCount,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
    };
  }

  // ============ МЕТОДЫ ГЕНЕРАЦИИ ДОКУМЕНТОВ ============

  /**
   * Генерация заявления об инвестировании в генерацию
   */
  async generateGenerationMoneyInvestStatement(
    data: GenerationMoneyInvestStatementGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO,
    currentUser: MonoAccountDomainInterface
  ): Promise<GeneratedDocumentDTO> {
    // Подготавливаем данные через интерактор
    const enrichedData = await this.investsManagementInteractor.prepareGenerationMoneyInvestStatementData(data, currentUser);

    const document = await this.documentInteractor.generateDocument({
      data: {
        ...enrichedData,
        registry_id: Cooperative.Registry.GenerationMoneyInvestStatement.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

}
