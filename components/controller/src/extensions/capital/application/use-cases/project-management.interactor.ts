import { Injectable, Inject } from '@nestjs/common';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import { PROJECT_REPOSITORY, ProjectRepository } from '../../domain/repositories/project.repository';
import { ProjectDomainEntity } from '../../domain/entities/project.entity';
import type { TransactResult } from '@wharfkit/session';
import type { CreateProjectDomainInput } from '../../domain/actions/create-project-domain-input.interface';
import type { EditProjectDomainInput } from '../../domain/actions/edit-project-domain-input.interface';
import type { AddAuthorDomainInput } from '../../domain/actions/add-author-domain-input.interface';
import type { DeleteProjectDomainInput } from '../../domain/actions/delete-project-domain-input.interface';
import type { OpenProjectDomainInput } from '../../domain/actions/open-project-domain-input.interface';
import type { CloseProjectDomainInput } from '~/extensions/capital/domain/actions/close-project-domain-input.interface';
import type { SetMasterDomainInput } from '../../domain/actions/set-master-domain-input.interface';
import type { SetPlanDomainInput } from '../../domain/actions/set-plan-domain-input.interface';
import type { StartProjectDomainInput } from '../../domain/actions/start-project-domain-input.interface';
import type { StopProjectDomainInput } from '../../domain/actions/stop-project-domain-input.interface';
import type { IFinalizeProjectDomainInput } from '../../domain/actions/finalize-project-domain-input.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { ProjectFilterInputDTO } from '../dto/property_management/project-filter.input';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import { ProjectSyncService } from '../syncers/project-sync.service';
import { SegmentSyncService } from '../syncers/segment-sync.service';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { ComponentMatrixAnnouncementService } from '../services/component-matrix-announcement.service';
import { buildLocalProjectRow } from '../../domain/utils/build-local-project-row';
import { assertBlockchainProject, isLocalProject } from '../../domain/utils/assert-blockchain-project';
import { ProjectOrigin } from '../../domain/enums/project-origin.enum';
import { ProjectStatus } from '../../domain/enums/project-status.enum';
import type { IProjectDomainInterfaceDatabaseData } from '../../domain/interfaces/project-database.interface';
import type { IProjectDomainInterfaceBlockchainData } from '../../domain/interfaces/project-blockchain.interface';

/**
 * Интерактор домена для управления проектами CAPITAL контракта
 * Обрабатывает действия связанные с управлением жизненным циклом проектов
 */
@Injectable()
export class ProjectManagementInteractor {
  constructor(
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly projectSyncService: ProjectSyncService,
    private readonly segmentSyncService: SegmentSyncService,
    private readonly componentMatrixAnnouncement: ComponentMatrixAnnouncementService
  ) {
    this.logger.setContext(ProjectManagementInteractor.name);
  }

  private async requireBlockchainProject(projectHash: string, actionLabel: string): Promise<ProjectDomainEntity> {
    const project = await this.projectRepository.findByHash(projectHash.toLowerCase());
    assertBlockchainProject(project, actionLabel);
    return project;
  }

  /**
   * Создание проекта в CAPITAL контракте
   */
  async createProject(data: CreateProjectDomainInput, _currentUser: IMonoAccount): Promise<TransactResult> {
    // Вызываем блокчейн порт для создания проекта
    const transactResult = await this.capitalBlockchainPort.createProject(data);

    try {
      // Синхронизируем данные проекта с блокчейном
      await this.projectSyncService.syncProject(data.coopname, data.project_hash, transactResult);
    } catch (error: any) {
      // Логируем ошибку, но не прерываем выполнение, так как проект уже создан в блокчейне
      this.logger.error(`Ошибка при сохранении проекта ${data.project_hash} в базу данных: ${error.message}`, error.stack);
    }

    return transactResult;
  }

  /**
   * Создание персонального проекта/компонента только в PostgreSQL (без блокчейна).
   */
  async createLocalProject(
    data: CreateProjectDomainInput,
    currentUser: IMonoAccount
  ): Promise<ProjectDomainEntity> {
    if (!currentUser?.username) {
      throw new Error('Требуется авторизация');
    }

    const projectHash = data.project_hash.trim().toLowerCase();
    const existing = await this.projectRepository.findByHash(projectHash);
    if (existing) {
      throw new Error(`Проект с хэшем ${projectHash} уже существует`);
    }

    const emptyHash = DomainToBlockchainUtils.getEmptyHash().toLowerCase();
    const parentRaw = (data.parent_hash || '').trim().toLowerCase();
    const parentHash = !parentRaw || parentRaw === emptyHash ? undefined : parentRaw;

    let inheritedDevUrl: string | null = null;
    if (parentHash) {
      const parent = await this.projectRepository.findByHash(parentHash);
      if (!parent) {
        throw new Error(`Родительский проект ${parentHash} не найден`);
      }
      if (!isLocalProject(parent)) {
        throw new Error('Персональный компонент можно создать только внутри персонального проекта');
      }
      if (parent.master !== currentUser.username && parent.local_owner !== currentUser.username) {
        throw new Error('Недостаточно прав для создания компонента в этом проекте');
      }
      inheritedDevUrl = parent.development_repository_url ?? null;
    }

    const row = buildLocalProjectRow({
      coopname: data.coopname,
      project_hash: projectHash,
      parent_hash: parentHash,
      title: data.title,
      description: data.description,
      invite: data.invite,
      meta: data.meta,
      data: data.data,
      master: currentUser.username,
    });

    const databaseData: IProjectDomainInterfaceDatabaseData = {
      _id: '',
      block_num: 0,
      present: true,
      project_hash: row.project_hash,
      status: ProjectStatus.ACTIVE,
      blockchain_status: ProjectStatus.ACTIVE,
      prefix: row.prefix,
      issue_counter: 0,
      voting_deadline: null,
      matrix_room_id: null,
      development_repository_url: inheritedDevUrl,
      origin: ProjectOrigin.LOCAL,
      local_owner: currentUser.username,
    };

    const blockchainData = {
      ...row,
      id: undefined,
      status: ProjectStatus.ACTIVE,
      development_repository_url: inheritedDevUrl,
    } as unknown as IProjectDomainInterfaceBlockchainData;

    const entity = new ProjectDomainEntity(databaseData, blockchainData);
    return await this.projectRepository.create(entity);
  }

  /**
   * Редактирование проекта в CAPITAL контракте
   */
  async editProject(data: EditProjectDomainInput): Promise<TransactResult> {
    const project = await this.projectRepository.findByHash(data.project_hash.toLowerCase());
    if (isLocalProject(project)) {
      await this.projectRepository.updateLocalContent(data.project_hash, {
        title: data.title,
        description: data.description,
        invite: data.invite,
        meta: data.meta,
        data: data.data,
      });
      return {} as TransactResult;
    }

    assertBlockchainProject(project, 'редактирование');
    const transactResult = await this.capitalBlockchainPort.editProject(data);

    try {
      await this.projectSyncService.syncProject(data.coopname, data.project_hash, transactResult);
    } catch (error: any) {
      this.logger.error(
        `Ошибка при синхронизации проекта ${data.project_hash} в базу после редактирования: ${error.message}`,
        error.stack
      );
    }

    return transactResult;
  }
  /**
   * Установка мастера проекта CAPITAL контракта
   */
  async setMaster(data: SetMasterDomainInput, _currentUser: IMonoAccount): Promise<TransactResult> {
    await this.requireBlockchainProject(data.project_hash, 'назначение мастера');
    // Вызываем блокчейн порт
    const transactResult = await this.capitalBlockchainPort.setMaster(data);

    try {
      // Синхронизируем данные проекта с блокчейном
      await this.projectSyncService.syncProject(data.coopname, data.project_hash, transactResult);
    } catch (error: any) {
      this.logger.error(`Ошибка логирования назначения мастера: ${error.message}`, error.stack);
    }

    return transactResult;
  }

  /**
   * Добавление автора проекта CAPITAL контракта
   */
  async addAuthor(data: AddAuthorDomainInput, _currentUser: IMonoAccount): Promise<ProjectDomainEntity> {
    await this.requireBlockchainProject(data.project_hash, 'добавление автора');
    // Вызываем блокчейн порт
    const transactResult = await this.capitalBlockchainPort.addAuthor(data);

    // Синхронизируем данные проекта с блокчейном и получаем обновленную сущность
    const projectEntity = await this.projectSyncService.syncProject(data.coopname, data.project_hash, transactResult);

    if (!projectEntity) {
      throw new Error(`Не удалось синхронизировать проект ${data.project_hash} после добавления автора`);
    }

    // Добавление автора заводит его долю в проекте, а синхронизация проекта её не
    // затрагивает. Без явной синхронизации доля попадала бы в базу только следующим
    // сообщением от парсера, и список участников какое-то время оставался бы без
    // нового соавтора.
    await this.segmentSyncService.syncSegment(data.coopname, data.project_hash, data.author, transactResult);

    return projectEntity;
  }

  /**
   * Установка плана проекта CAPITAL контракта
   */
  async setPlan(data: SetPlanDomainInput): Promise<TransactResult> {
    await this.requireBlockchainProject(data.project_hash, 'установку плана');
    // Вызываем блокчейн порт
    const transactResult = await this.capitalBlockchainPort.setPlan(data);

    // Синхронизируем данные проекта с блокчейном и получаем обновленную сущность
    await this.projectSyncService.syncProject(data.coopname, data.project_hash, transactResult);

    return transactResult;
  }

  /**
   * Запуск проекта CAPITAL контракта
   */
  async startProject(data: StartProjectDomainInput): Promise<ProjectDomainEntity> {
    await this.requireBlockchainProject(data.project_hash, 'запуск');
    // Вызываем блокчейн порт
    const transactResult = await this.capitalBlockchainPort.startProject(data);

    // Синхронизируем данные проекта с блокчейном и получаем обновленную сущность
    const projectEntity = await this.projectSyncService.syncProject(data.coopname, data.project_hash, transactResult);

    if (!projectEntity) {
      throw new Error(`Не удалось синхронизировать проект ${data.project_hash} после запуска`);
    }

    return projectEntity;
  }

  /**
   * Открытие проекта для инвестиций CAPITAL контракта
   */
  async openProject(data: OpenProjectDomainInput): Promise<ProjectDomainEntity> {
    await this.requireBlockchainProject(data.project_hash, 'открытие для инвестиций');
    // Вызываем блокчейн порт
    const transactResult = await this.capitalBlockchainPort.openProject(data);

    // Синхронизируем данные проекта с блокчейном и получаем обновленную сущность
    const projectEntity = await this.projectSyncService.syncProject(data.coopname, data.project_hash, transactResult);

    if (!projectEntity) {
      throw new Error(`Не удалось синхронизировать проект ${data.project_hash} после открытия`);
    }

    return projectEntity;
  }

  /**
   * Закрытие проекта от инвестиций CAPITAL контракта
   */
  async closeProject(data: CloseProjectDomainInput): Promise<ProjectDomainEntity> {
    await this.requireBlockchainProject(data.project_hash, 'закрытие от инвестиций');
    // Вызываем блокчейн порт
    const transactResult = await this.capitalBlockchainPort.closeProject(data);

    // Синхронизируем данные проекта с блокчейном и получаем обновленную сущность
    const projectEntity = await this.projectSyncService.syncProject(data.coopname, data.project_hash, transactResult);

    if (!projectEntity) {
      throw new Error(`Не удалось синхронизировать проект ${data.project_hash} после закрытия`);
    }

    return projectEntity;
  }

  /**
   * Остановка проекта CAPITAL контракта
   */
  async stopProject(data: StopProjectDomainInput): Promise<ProjectDomainEntity> {
    await this.requireBlockchainProject(data.project_hash, 'остановку');
    // Вызываем блокчейн порт
    const transactResult = await this.capitalBlockchainPort.stopProject(data);

    // Синхронизируем данные проекта с блокчейном и получаем обновленную сущность
    const projectEntity = await this.projectSyncService.syncProject(data.coopname, data.project_hash, transactResult);

    if (!projectEntity) {
      throw new Error(`Не удалось синхронизировать проект ${data.project_hash} после остановки`);
    }

    return projectEntity;
  }

  /**
   * Финализация проекта CAPITAL контракта
   * Финализация проекта после завершения всех конвертаций участников
   */
  async finalizeProject(
    data: IFinalizeProjectDomainInput,
    _currentUser: IMonoAccount
  ): Promise<ProjectDomainEntity> {
    await this.requireBlockchainProject(data.project_hash, 'финализацию');
    // Вызываем блокчейн порт
    const transactResult = await this.capitalBlockchainPort.finalizeProject(data);

    // Синхронизируем данные проекта с блокчейном и получаем обновленную сущность
    const projectEntity = await this.projectSyncService.syncProject(data.coopname, data.project_hash, transactResult);

    if (!projectEntity) {
      throw new Error(`Не удалось синхронизировать проект ${data.project_hash} после финализации`);
    }

    return projectEntity;
  }

  /**
   * Удаление проекта CAPITAL контракта
   */
  async deleteProject(data: DeleteProjectDomainInput): Promise<TransactResult> {
    const projectEntity = await this.projectRepository.findByHash(data.project_hash);
    if (isLocalProject(projectEntity)) {
      if (projectEntity?.isComponent()) {
        this.componentMatrixAnnouncement.removePinnedForDeletedComponent(projectEntity);
      }
      await this.projectRepository.softDeleteLocal(data.project_hash);
      return {} as TransactResult;
    }

    assertBlockchainProject(projectEntity, 'удаление');
    if (projectEntity?.isComponent()) {
      this.componentMatrixAnnouncement.removePinnedForDeletedComponent(projectEntity);
    }
    const transactResult = await this.capitalBlockchainPort.deleteProject(data);
    return transactResult;
  }

  // ============ МЕТОДЫ ЧТЕНИЯ ДАННЫХ ============

  /**
   * Получение всех проектов с фильтрацией и пагинацией
   */
  async getProjects(
    filter?: ProjectFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<ProjectDomainEntity>> {
    return await this.projectRepository.findAllPaginated(filter, options);
  }

  /**
   * Получение проектов с компонентами с фильтрацией и пагинацией
   */
  async getProjectsWithComponents(
    filter?: ProjectFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<ProjectDomainEntity>> {
    if (filter?.parent_hash === '') {
      filter.parent_hash = DomainToBlockchainUtils.getEmptyHash();
    }
    return await this.projectRepository.findAllPaginatedWithComponents(filter, options);
  }

  /**
   * Получение проекта по внутреннему ID базы данных
   */
  async getProjectById(_id: string): Promise<ProjectDomainEntity | null> {
    const project = await this.projectRepository.findById(_id);
    if (!project?.present) {
      return null;
    }
    return project;
  }

  /**
   * Получение проекта по хешу проекта
   */
  async getProjectByHash(hash: string): Promise<ProjectDomainEntity | null> {
    const project = await this.projectRepository.findByHash(hash);
    if (!project?.present) {
      return null;
    }
    return project;
  }

  /**
   * Получение проекта по хешу с компонентами
   */
  async getProjectByHashWithComponents(hash: string): Promise<ProjectDomainEntity | null> {
    return await this.projectRepository.findByHashWithComponents(hash);
  }

  /**
   * Получение проекта со всеми связанными данными по хешу проекта
   */
  async getProjectWithRelations(projectHash: string): Promise<ProjectDomainEntity | null> {
    return await this.projectRepository.findByIdWithAllRelations(projectHash);
  }

  /**
   * Локальное поле URL репозитория разработки (не блокчейн), PRD §6.2.1.
   */
  async setDevelopmentRepositoryUrl(projectHash: string, url: string | null): Promise<ProjectDomainEntity> {
    const h = projectHash.trim().toLowerCase();
    const existing = await this.projectRepository.findByHash(h);
    if (!existing) {
      throw new Error(`Проект с хэшем ${h} не найден`);
    }
    await this.projectRepository.setDevelopmentRepositoryUrl(h, url);
    const updated = await this.projectRepository.findByHash(h);
    if (!updated) {
      throw new Error(`Не удалось перечитать проект ${h} после сохранения URL репозитория`);
    }
    return updated;
  }
}
