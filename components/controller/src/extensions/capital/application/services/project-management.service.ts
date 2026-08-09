import { Injectable, Logger } from '@nestjs/common';
import { config as appConfig } from '~/config';
import { ProjectManagementInteractor } from '../use-cases/project-management.interactor';
import type { CreateProjectInputDTO } from '../dto/project_management';
import type { TransactResult } from '@wharfkit/session';
import type {
  SetMasterInputDTO,
  AddAuthorInputDTO,
  SetPlanInputDTO,
  StartProjectInputDTO,
  OpenProjectInputDTO,
  CloseProjectInputDTO,
  StopProjectInputDTO,
  DeleteProjectInputDTO,
  EditProjectInputDTO,
  FinalizeProjectInputDTO,
} from '../dto/project_management';
import { ProjectOutputDTO } from '../dto/project_management/project.dto';
import { ProjectFilterInputDTO } from '../dto/property_management/project-filter.input';
import { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import { ProjectMapperService } from './project-mapper.service';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { SetCapitalProjectDevelopmentRepositoryUrlInputDTO } from '../dto/project_management/set-development-repository-url.input.dto';
import { normalizeDevelopmentRepositoryUrl } from '../utils/parse-github-development-repository-url';
import { CapitalDevelopmentRepositoryGitSyncService } from './capital-development-repository-git-sync.service';
import type { ProjectDomainEntity } from '../../domain/entities/project.entity';
import { canViewLocalProject } from '../../domain/utils/private-project-access';

/**
 * Сервис уровня приложения для управления проектами CAPITAL
 * Обрабатывает запросы от ProjectManagementResolver
 */
@Injectable()
export class ProjectManagementService {
  private readonly logger = new Logger(ProjectManagementService.name);

  constructor(
    private readonly projectManagementInteractor: ProjectManagementInteractor,
    private readonly projectMapperService: ProjectMapperService,
    private readonly capitalDevelopmentRepositoryGitSync: CapitalDevelopmentRepositoryGitSyncService
  ) {}

  /**
   * Создание проекта в CAPITAL контракте
   */
  async createProject(data: CreateProjectInputDTO, currentUser: IMonoAccount): Promise<TransactResult> {
    return await this.projectManagementInteractor.createProject(data, currentUser);
  }

  /**
   * Создание персонального проекта/компонента (только PostgreSQL)
   */
  async createLocalProject(
    data: CreateProjectInputDTO,
    currentUser: IMonoAccount
  ): Promise<ProjectOutputDTO> {
    const project = await this.projectManagementInteractor.createLocalProject(data, currentUser);
    return await this.projectMapperService.mapToDTO(project, currentUser);
  }

  /**
   * Редактирование проекта в CAPITAL контракте
   */
  async editProject(data: EditProjectInputDTO, currentUser: IMonoAccount): Promise<TransactResult> {
    if (currentUser.role === 'user') {
      const project = await this.projectManagementInteractor.getProjectByHash(data.project_hash);
      if (!project) {
        throw new Error(`Проект с хешем ${data.project_hash} не найден`);
      }
      const projectDTO = await this.projectMapperService.mapToDTO(project, currentUser);
      if (!projectDTO.permissions.can_edit_project) {
        throw new Error('Недостаточно прав для редактирования проекта');
      }
    }

    return await this.projectManagementInteractor.editProject(data);
  }

  /**
   * Установка мастера проекта CAPITAL контракта
   */
  async setMaster(data: SetMasterInputDTO, currentUser: IMonoAccount): Promise<TransactResult> {
    return await this.projectManagementInteractor.setMaster(data, currentUser);
  }

  /**
   * Добавление автора проекта CAPITAL контракта
   */
  async addAuthor(data: AddAuthorInputDTO, currentUser: IMonoAccount): Promise<ProjectOutputDTO> {
    const project = await this.projectManagementInteractor.addAuthor(data, currentUser);
    return await this.projectMapperService.mapToDTO(project, currentUser);
  }

  /**
   * Установка плана проекта CAPITAL контракта
   */
  async setPlan(data: SetPlanInputDTO, currentUser?: IMonoAccount): Promise<ProjectOutputDTO> {
    // Находим проект для проверки прав
    const project = await this.projectManagementInteractor.getProjectByHash(data.project_hash);
    if (!project) {
      throw new Error(`Проект с хешем ${data.project_hash} не найден`);
    }

    // Проверяем права доступа
    const projectDTO = await this.projectMapperService.mapToDTO(project, currentUser);
    if (!projectDTO.permissions.can_set_plan) {
      throw new Error('Недостаточно прав для установки плана проекта');
    }

    // Выполняем операцию установки плана
    await this.projectManagementInteractor.setPlan(data);

    // Получаем обновленный проект после установки плана
    const updatedProject = await this.projectManagementInteractor.getProjectByHash(data.project_hash);
    if (!updatedProject) {
      throw new Error(`Не удалось получить обновленный проект после установки плана`);
    }

    return await this.projectMapperService.mapToDTO(updatedProject, currentUser);
  }

  /**
   * Запуск проекта CAPITAL контракта
   */
  async startProject(data: StartProjectInputDTO, currentUser?: IMonoAccount): Promise<ProjectOutputDTO> {
    const project = await this.projectManagementInteractor.startProject(data);
    return await this.projectMapperService.mapToDTO(project, currentUser);
  }

  /**
   * Открытие проекта для инвестиций CAPITAL контракта
   */
  async openProject(data: OpenProjectInputDTO, currentUser?: IMonoAccount): Promise<ProjectOutputDTO> {
    const project = await this.projectManagementInteractor.openProject(data);
    return await this.projectMapperService.mapToDTO(project, currentUser);
  }

  /**
   * Закрытие проекта от инвестиций CAPITAL контракта
   */
  async closeProject(data: CloseProjectInputDTO, currentUser?: IMonoAccount): Promise<ProjectOutputDTO> {
    const project = await this.projectManagementInteractor.closeProject(data);
    return await this.projectMapperService.mapToDTO(project, currentUser);
  }

  /**
   * Остановка проекта CAPITAL контракта
   */
  async stopProject(data: StopProjectInputDTO, currentUser?: IMonoAccount): Promise<ProjectOutputDTO> {
    const project = await this.projectManagementInteractor.stopProject(data);
    return await this.projectMapperService.mapToDTO(project, currentUser);
  }

  /**
   * Финализация проекта CAPITAL контракта
   * Финализация проекта после завершения всех конвертаций участников
   */
  async finalizeProject(data: FinalizeProjectInputDTO, currentUser: IMonoAccount): Promise<ProjectOutputDTO> {
    const project = await this.projectManagementInteractor.finalizeProject(data, currentUser);
    return await this.projectMapperService.mapToDTO(project, currentUser);
  }

  /**
   * Удаление проекта CAPITAL контракта
   */
  async deleteProject(data: DeleteProjectInputDTO): Promise<TransactResult> {
    return await this.projectManagementInteractor.deleteProject(data);
  }

  /**
   * Сохранение URL репозитория разработки (локально в БД), PRD §6.2.1.
   */
  async setDevelopmentRepositoryUrl(
    data: SetCapitalProjectDevelopmentRepositoryUrlInputDTO,
    currentUser?: IMonoAccount
  ): Promise<ProjectOutputDTO> {
    const project = await this.projectManagementInteractor.getProjectByHash(data.project_hash.trim().toLowerCase());
    if (!project) {
      throw new Error(`Проект с хэшем ${data.project_hash} не найден`);
    }
    const preview = await this.projectMapperService.mapToDTO(project, currentUser);
    if (!preview.permissions.can_edit_project) {
      throw new Error('Недостаточно прав для изменения URL репозитория проекта');
    }

    const raw =
      data.development_repository_url === undefined || data.development_repository_url === null
        ? ''
        : String(data.development_repository_url).trim();

    const oldUrlTrimmed = project.development_repository_url?.trim() ?? '';
    const previousNormalizedKey = oldUrlTrimmed ? normalizeDevelopmentRepositoryUrl(oldUrlTrimmed) : null;

    let nextNormalizedKey: string | null = null;

    if (!raw) {
      await this.projectManagementInteractor.setDevelopmentRepositoryUrl(project.project_hash, null);
    } else {
      const normalized = normalizeDevelopmentRepositoryUrl(raw);
      if (!normalized) {
        throw new Error('Укажите ссылку на репозиторий github.com (https://github.com/владелец/репозиторий) или формат owner/repo');
      }
      nextNormalizedKey = normalized;
      await this.projectManagementInteractor.setDevelopmentRepositoryUrl(project.project_hash, normalized);
    }

    const coopname = project.coopname?.trim() || appConfig.coopname;
    if (previousNormalizedKey !== nextNormalizedKey) {
      void this.capitalDevelopmentRepositoryGitSync
        .runAfterDevelopmentRepositoryUrlChange({
          coopname,
          previousNormalizedKey,
          nextNormalizedKey,
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`Фоновая синхронизация Git после смены URL репозитория: ${msg}`, err instanceof Error ? err.stack : undefined);
        });
    }

    const updated = await this.projectManagementInteractor.getProjectByHash(project.project_hash);
    if (!updated) {
      throw new Error('Не удалось перечитать проект после сохранения URL репозитория');
    }
    return await this.projectMapperService.mapToDTO(updated, currentUser);
  }

  // ============ МЕТОДЫ ЧТЕНИЯ ДАННЫХ ============

  /**
   * Получение всех проектов с фильтрацией
   */
  async getProjects(
    filter?: ProjectFilterInputDTO,
    options?: PaginationInputDTO,
    currentUser?: IMonoAccount
  ): Promise<PaginationResult<ProjectOutputDTO>> {
    // Конвертируем параметры пагинации в доменные
    const domainOptions: PaginationInputDTO | undefined = options;

    // Получаем результат с пагинацией из домена
    const result = await this.projectManagementInteractor.getProjects(filter, domainOptions);
    const visible = this.filterAccessibleProjects(result.items, currentUser?.username);

    // Маппим проекты в DTO с правами доступа
    const items = await this.projectMapperService.mapBatchToDTO(visible, currentUser);

    return {
      items,
      totalCount: visible.length === result.items.length ? result.totalCount : visible.length,
      totalPages:
        visible.length === result.items.length
          ? result.totalPages
          : Math.ceil(visible.length / (options?.limit || 10)),
      currentPage: result.currentPage,
    };
  }

  /**
   * Получение проектов с компонентами с фильтрацией
   */
  async getProjectsWithComponents(
    filter?: ProjectFilterInputDTO,
    options?: PaginationInputDTO,
    currentUser?: IMonoAccount
  ): Promise<PaginationResult<ProjectOutputDTO>> {
    // Конвертируем параметры пагинации в доменные
    const domainOptions: PaginationInputDTO | undefined = options;

    // Получаем результат с пагинацией из домена
    const result = await this.projectManagementInteractor.getProjectsWithComponents(filter, domainOptions);
    const visible = this.filterAccessibleProjects(result.items, currentUser?.username);

    // Маппим проекты с компонентами в DTO с правами доступа
    const items = await this.projectMapperService.mapBatchToDTOWithComponents(visible, currentUser);

    return {
      items,
      totalCount: visible.length === result.items.length ? result.totalCount : visible.length,
      totalPages:
        visible.length === result.items.length
          ? result.totalPages
          : Math.ceil(visible.length / (options?.limit || 10)),
      currentPage: result.currentPage,
    };
  }

  /**
   * Получение проекта по ID
   */
  async getProjectById(_id: string, currentUser?: IMonoAccount): Promise<ProjectOutputDTO | null> {
    const project = await this.projectManagementInteractor.getProjectById(_id);

    if (!project || !canViewLocalProject(project, currentUser?.username)) {
      return null;
    }

    return await this.projectMapperService.mapToDTO(project, currentUser);
  }

  /**
   * Получение проекта по хешу
   */
  async getProjectByHash(hash: string, currentUser?: IMonoAccount): Promise<ProjectOutputDTO | null> {
    const project = await this.projectManagementInteractor.getProjectByHash(hash);

    if (!project || !canViewLocalProject(project, currentUser?.username)) {
      return null;
    }

    return await this.projectMapperService.mapToDTO(project, currentUser);
  }

  /**
   * Получение проекта по хешу с компонентами
   */
  async getProjectByHashWithComponents(
    hash: string,
    currentUser?: IMonoAccount
  ): Promise<ProjectOutputDTO | null> {
    const project = await this.projectManagementInteractor.getProjectByHashWithComponents(hash);

    if (!project || !canViewLocalProject(project, currentUser?.username)) {
      return null;
    }

    return await this.projectMapperService.mapToDTOWithComponents(project, currentUser);
  }

  /**
   * Получение проекта с отношениями
   */
  async getProjectWithRelations(
    projectHash: string,
    currentUser?: IMonoAccount
  ): Promise<ProjectOutputDTO | null> {
    const project = await this.projectManagementInteractor.getProjectWithRelations(projectHash);

    if (!project || !canViewLocalProject(project, currentUser?.username)) {
      return null;
    }

    return await this.projectMapperService.mapToDTO(project, currentUser);
  }

  /** Чужие LOCAL-проекты не отдаём в списках. */
  private filterAccessibleProjects(
    projects: ProjectDomainEntity[],
    username?: string
  ): ProjectDomainEntity[] {
    return projects.filter((project) => canViewLocalProject(project, username));
  }

}
