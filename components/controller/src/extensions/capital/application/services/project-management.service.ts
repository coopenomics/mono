import { Injectable, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { PUB_SUB } from '~/infrastructure/pubsub/pubsub.module';
import { CAPITAL_EVENTS } from '../resolvers/capital-subscription.resolver';
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
import { PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import type { PaginationInputDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import { ProjectMapperService } from './project-mapper.service';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';

@Injectable()
export class ProjectManagementService {
  constructor(
    private readonly projectManagementInteractor: ProjectManagementInteractor,
    private readonly documentInteractor: DocumentInteractor,
    private readonly projectMapperService: ProjectMapperService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  private notifyDataChanged(entity: string, action: string, id?: string) {
    this.pubSub.publish(CAPITAL_EVENTS.DATA_CHANGED, {
      [CAPITAL_EVENTS.DATA_CHANGED]: { entity, action, id },
    });
  }

  /**
   * Создание проекта в CAPITAL контракте
   */
  async createProject(data: CreateProjectInputDTO, currentUser: MonoAccountDomainInterface): Promise<TransactResult> {
    const result = await this.projectManagementInteractor.createProject(data, currentUser);
    this.notifyDataChanged('project', 'created');
    return result;
  }

  /**
   * Редактирование проекта в CAPITAL контракте
   */
  async editProject(data: EditProjectInputDTO): Promise<TransactResult> {
    const result = await this.projectManagementInteractor.editProject(data);
    this.notifyDataChanged('project', 'updated');
    return result;
  }

  /**
   * Установка мастера проекта CAPITAL контракта
   */
  async setMaster(data: SetMasterInputDTO, currentUser: MonoAccountDomainInterface): Promise<TransactResult> {
    return await this.projectManagementInteractor.setMaster(data, currentUser);
  }

  /**
   * Добавление автора проекта CAPITAL контракта
   */
  async addAuthor(data: AddAuthorInputDTO, currentUser: MonoAccountDomainInterface): Promise<ProjectOutputDTO> {
    const project = await this.projectManagementInteractor.addAuthor(data, currentUser);
    return await this.projectMapperService.mapToDTO(project, currentUser);
  }

  /**
   * Установка плана проекта CAPITAL контракта
   */
  async setPlan(data: SetPlanInputDTO, currentUser?: MonoAccountDomainInterface): Promise<ProjectOutputDTO> {
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
  async startProject(data: StartProjectInputDTO, currentUser?: MonoAccountDomainInterface): Promise<ProjectOutputDTO> {
    const project = await this.projectManagementInteractor.startProject(data);
    return await this.projectMapperService.mapToDTO(project, currentUser);
  }

  /**
   * Открытие проекта для инвестиций CAPITAL контракта
   */
  async openProject(data: OpenProjectInputDTO, currentUser?: MonoAccountDomainInterface): Promise<ProjectOutputDTO> {
    const project = await this.projectManagementInteractor.openProject(data);
    return await this.projectMapperService.mapToDTO(project, currentUser);
  }

  /**
   * Закрытие проекта от инвестиций CAPITAL контракта
   */
  async closeProject(data: CloseProjectInputDTO, currentUser?: MonoAccountDomainInterface): Promise<ProjectOutputDTO> {
    const project = await this.projectManagementInteractor.closeProject(data);
    return await this.projectMapperService.mapToDTO(project, currentUser);
  }

  /**
   * Остановка проекта CAPITAL контракта
   */
  async stopProject(data: StopProjectInputDTO, currentUser?: MonoAccountDomainInterface): Promise<ProjectOutputDTO> {
    const project = await this.projectManagementInteractor.stopProject(data);
    return await this.projectMapperService.mapToDTO(project, currentUser);
  }

  /**
   * Финализация проекта CAPITAL контракта
   * Финализация проекта после завершения всех конвертаций участников
   */
  async finalizeProject(data: FinalizeProjectInputDTO, currentUser: MonoAccountDomainInterface): Promise<ProjectOutputDTO> {
    const project = await this.projectManagementInteractor.finalizeProject(data, currentUser);
    return await this.projectMapperService.mapToDTO(project, currentUser);
  }

  /**
   * Удаление проекта CAPITAL контракта
   */
  async deleteProject(data: DeleteProjectInputDTO): Promise<TransactResult> {
    return await this.projectManagementInteractor.deleteProject(data);
  }

  // ============ МЕТОДЫ ЧТЕНИЯ ДАННЫХ ============

  /**
   * Получение всех проектов с фильтрацией
   */
  async getProjects(
    filter?: ProjectFilterInputDTO,
    options?: PaginationInputDTO,
    currentUser?: MonoAccountDomainInterface
  ): Promise<PaginationResult<ProjectOutputDTO>> {
    // Конвертируем параметры пагинации в доменные
    const domainOptions: PaginationInputDomainInterface | undefined = options;

    // Получаем результат с пагинацией из домена
    const result = await this.projectManagementInteractor.getProjects(filter, domainOptions);

    // Маппим проекты в DTO с правами доступа
    const items = await this.projectMapperService.mapBatchToDTO(result.items, currentUser);

    return {
      items,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  /**
   * Получение проектов с компонентами с фильтрацией
   */
  async getProjectsWithComponents(
    filter?: ProjectFilterInputDTO,
    options?: PaginationInputDTO,
    currentUser?: MonoAccountDomainInterface
  ): Promise<PaginationResult<ProjectOutputDTO>> {
    // Конвертируем параметры пагинации в доменные
    const domainOptions: PaginationInputDomainInterface | undefined = options;

    // Получаем результат с пагинацией из домена
    const result = await this.projectManagementInteractor.getProjectsWithComponents(filter, domainOptions);

    // Маппим проекты с компонентами в DTO с правами доступа
    const items = await this.projectMapperService.mapBatchToDTOWithComponents(result.items, currentUser);

    return {
      items,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  /**
   * Получение проекта по ID
   */
  async getProjectById(_id: string, currentUser?: MonoAccountDomainInterface): Promise<ProjectOutputDTO | null> {
    const project = await this.projectManagementInteractor.getProjectById(_id);

    if (!project) {
      return null;
    }

    return await this.projectMapperService.mapToDTO(project, currentUser);
  }

  /**
   * Получение проекта по хешу
   */
  async getProjectByHash(hash: string, currentUser?: MonoAccountDomainInterface): Promise<ProjectOutputDTO | null> {
    const project = await this.projectManagementInteractor.getProjectByHash(hash);

    if (!project) {
      return null;
    }

    return await this.projectMapperService.mapToDTO(project, currentUser);
  }

  /**
   * Получение проекта по хешу с компонентами
   */
  async getProjectByHashWithComponents(
    hash: string,
    currentUser?: MonoAccountDomainInterface
  ): Promise<ProjectOutputDTO | null> {
    const project = await this.projectManagementInteractor.getProjectByHashWithComponents(hash);

    if (!project) {
      return null;
    }

    return await this.projectMapperService.mapToDTOWithComponents(project, currentUser);
  }

  /**
   * Получение проекта с отношениями
   */
  async getProjectWithRelations(
    projectHash: string,
    currentUser?: MonoAccountDomainInterface
  ): Promise<ProjectOutputDTO | null> {
    const project = await this.projectManagementInteractor.getProjectWithRelations(projectHash);

    if (!project) {
      return null;
    }

    return await this.projectMapperService.mapToDTO(project, currentUser);
  }

}
