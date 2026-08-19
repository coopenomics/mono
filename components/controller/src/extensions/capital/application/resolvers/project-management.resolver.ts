import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { ProjectManagementService } from '../services/project-management.service';
import { SetMasterInputDTO } from '../dto/project_management/set-master-input.dto';
import { AddAuthorInputDTO } from '../dto/project_management/add-author-input.dto';
import { SetPlanInputDTO } from '../dto/project_management/set-plan-input.dto';
import { StartProjectInputDTO } from '../dto/project_management/start-project-input.dto';
import { OpenProjectInputDTO } from '../dto/project_management/open-project-input.dto';
import { CloseProjectInputDTO } from '../dto/project_management/close-project-input.dto';
import { StopProjectInputDTO } from '../dto/project_management/stop-project-input.dto';
import { DeleteProjectInputDTO } from '../dto/project_management/delete-project-input.dto';
import { CreateProjectInputDTO } from '../dto/project_management/create-project-input.dto';
import { EditProjectInputDTO } from '../dto/project_management/edit-project-input.dto';
import { FinalizeProjectInputDTO } from '../dto/project_management/finalize-project-input.dto';
import { GetProjectInputDTO } from '../dto/project_management/get-project-input.dto';
import { GetProjectWithRelationsInputDTO } from '../dto/project_management/get-project-with-relations-input.dto';
import { SetCapitalProjectDevelopmentRepositoryUrlInputDTO } from '../dto/project_management/set-development-repository-url.input.dto';
import { SetCapitalProjectPriorityInputDTO } from '../dto/project_management/set-project-priority.input.dto';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, CurrentUser, createPaginationResult, PaginationInputDTO, PaginationResult, TransactionDTO } from '@coopenomics/extension-kit';
import { UseGuards } from '@nestjs/common';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { ProjectOutputDTO } from '../dto/project_management/project.dto';
import { ProjectFilterInputDTO } from '../dto/property_management/project-filter.input';
// Пагинированные результаты
const paginatedProjectsResult = createPaginationResult(ProjectOutputDTO, 'PaginatedCapitalProjects');

/**
 * GraphQL резолвер для действий управления проектами CAPITAL контракта
 */
@Resolver()
export class ProjectManagementResolver {
  constructor(private readonly projectManagementService: ProjectManagementService) {}
  /**
   * Мутация для создания проекта в CAPITAL контракте
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalCreateProject',
    description: 'Создание проекта в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async createCapitalProject(
    @Args('data', { type: () => CreateProjectInputDTO }) data: CreateProjectInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    const result = await this.projectManagementService.createProject(data, currentUser);
    return result;
  }

  /**
   * Персональный проект/компонент — только в базе, без публикации в блокчейн
   */
  @Mutation(() => ProjectOutputDTO, {
    name: 'capitalCreateLocalProject',
    description: 'Создание персонального проекта или компонента без публикации в блокчейн',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async createCapitalLocalProject(
    @Args('data', { type: () => CreateProjectInputDTO }) data: CreateProjectInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<ProjectOutputDTO> {
    return await this.projectManagementService.createLocalProject(data, currentUser);
  }

  /**
   * Мутация для редактирования проекта в CAPITAL контракте
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalEditProject',
    description: 'Редактирование проекта в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async editCapitalProject(
    @Args('data', { type: () => EditProjectInputDTO }) data: EditProjectInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    const result = await this.projectManagementService.editProject(data, currentUser);
    return result;
  }
  /**
   * Мутация для установки мастера проекта CAPITAL контракта
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalSetMaster',
    description: 'Установка мастера проекта в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async setCapitalMaster(
    @Args('data', { type: () => SetMasterInputDTO }) data: SetMasterInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    const result = await this.projectManagementService.setMaster(data, currentUser);
    return result;
  }

  /**
   * Мутация для добавления автора проекта CAPITAL контракта
   */
  @Mutation(() => ProjectOutputDTO, {
    name: 'capitalAddAuthor',
    description: 'Добавление автора проекта в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async addCapitalAuthor(
    @Args('data', { type: () => AddAuthorInputDTO }) data: AddAuthorInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<ProjectOutputDTO> {
    const result = await this.projectManagementService.addAuthor(data, currentUser);
    return result;
  }

  /**
   * Мутация для установки плана проекта CAPITAL контракта
   */
  @Mutation(() => ProjectOutputDTO, {
    name: 'capitalSetPlan',
    description: 'Установка плана проекта в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard)
  async setCapitalPlan(
    @Args('data', { type: () => SetPlanInputDTO }) data: SetPlanInputDTO,
    @CurrentUser() currentUser?: IMonoAccount
  ): Promise<ProjectOutputDTO> {
    const result = await this.projectManagementService.setPlan(data, currentUser);
    return result;
  }

  /**
   * Установка приоритета проекта/компонента (только БД, без блокчейна).
   */
  @Mutation(() => ProjectOutputDTO, {
    name: 'capitalSetProjectPriority',
    description: 'Установка приоритета проекта или компонента (хранится только в базе данных)',
  })
  @UseGuards(GqlJwtAuthGuard)
  async setCapitalProjectPriority(
    @Args('data', { type: () => SetCapitalProjectPriorityInputDTO }) data: SetCapitalProjectPriorityInputDTO,
    @CurrentUser() currentUser?: IMonoAccount
  ): Promise<ProjectOutputDTO> {
    return await this.projectManagementService.setProjectPriority(data, currentUser);
  }

  /**
   * Локальное сохранение URL репозитория разработки (GitHub) для опроса маркеров коммитов (PRD §6.2.1).
   */
  @Mutation(() => ProjectOutputDTO, {
    name: 'capitalSetProjectDevelopmentRepositoryUrl',
    description: 'Сохранение URL репозитория разработки проекта/компонента (только БД)',
  })
  @UseGuards(GqlJwtAuthGuard)
  async setCapitalProjectDevelopmentRepositoryUrl(
    @Args('data', { type: () => SetCapitalProjectDevelopmentRepositoryUrlInputDTO }) data: SetCapitalProjectDevelopmentRepositoryUrlInputDTO,
    @CurrentUser() currentUser?: IMonoAccount
  ): Promise<ProjectOutputDTO> {
    return await this.projectManagementService.setDevelopmentRepositoryUrl(data, currentUser);
  }

  /**
   * Мутация для запуска проекта CAPITAL контракта
   */
  @Mutation(() => ProjectOutputDTO, {
    name: 'capitalStartProject',
    description: 'Запуск проекта в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async startCapitalProject(
    @Args('data', { type: () => StartProjectInputDTO }) data: StartProjectInputDTO,
    @CurrentUser() currentUser?: IMonoAccount
  ): Promise<ProjectOutputDTO> {
    const result = await this.projectManagementService.startProject(data, currentUser);
    return result;
  }

  /**
   * Мутация для открытия проекта для инвестиций CAPITAL контракта
   */
  @Mutation(() => ProjectOutputDTO, {
    name: 'capitalOpenProject',
    description: 'Открытие проекта для инвестиций в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async openCapitalProject(
    @Args('data', { type: () => OpenProjectInputDTO }) data: OpenProjectInputDTO,
    @CurrentUser() currentUser?: IMonoAccount
  ): Promise<ProjectOutputDTO> {
    const result = await this.projectManagementService.openProject(data, currentUser);
    return result;
  }

  /**
   * Мутация для закрытия проекта от инвестиций CAPITAL контракта
   */
  @Mutation(() => ProjectOutputDTO, {
    name: 'capitalCloseProject',
    description: 'Закрытие проекта от инвестиций в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async closeCapitalProject(
    @Args('data', { type: () => CloseProjectInputDTO }) data: CloseProjectInputDTO,
    @CurrentUser() currentUser?: IMonoAccount
  ): Promise<ProjectOutputDTO> {
    const result = await this.projectManagementService.closeProject(data, currentUser);
    return result;
  }

  /**
   * Мутация для остановки проекта CAPITAL контракта
   */
  @Mutation(() => ProjectOutputDTO, {
    name: 'capitalStopProject',
    description: 'Остановка проекта в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async stopCapitalProject(
    @Args('data', { type: () => StopProjectInputDTO }) data: StopProjectInputDTO,
    @CurrentUser() currentUser?: IMonoAccount
  ): Promise<ProjectOutputDTO> {
    const result = await this.projectManagementService.stopProject(data, currentUser);
    return result;
  }

  /**
   * Мутация для финализации проекта CAPITAL контракта
   * Финализация проекта после завершения всех конвертаций участников
   */
  @Mutation(() => ProjectOutputDTO, {
    name: 'capitalFinalizeProject',
    description: 'Финализация проекта в CAPITAL контракте после завершения всех конвертаций участников',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async finalizeCapitalProject(
    @Args('data', { type: () => FinalizeProjectInputDTO }) data: FinalizeProjectInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<ProjectOutputDTO> {
    const result = await this.projectManagementService.finalizeProject(data, currentUser);
    return result;
  }

  /**
   * Мутация для удаления проекта CAPITAL контракта
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalDeleteProject',
    description: 'Удаление проекта в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async deleteCapitalProject(
    @Args('data', { type: () => DeleteProjectInputDTO }) data: DeleteProjectInputDTO
  ): Promise<TransactionDTO> {
    const result = await this.projectManagementService.deleteProject(data);
    return result;
  }

  // ============ ЗАПРОСЫ ПРОЕКТОВ ============

  /**
   * Получение всех проектов с фильтрацией и компонентами
   */
  @Query(() => paginatedProjectsResult, {
    name: 'capitalProjects',
    description: 'Получение списка проектов кооператива с фильтрацией и компонентами',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getProjects(
    @Args('filter', { nullable: true }) filter?: ProjectFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO,
    @CurrentUser() currentUser?: IMonoAccount
  ): Promise<PaginationResult<ProjectOutputDTO>> {
    return await this.projectManagementService.getProjectsWithComponents(filter, options, currentUser);
  }

  /**
   * Получение проекта по хешу с компонентами
   */
  @Query(() => ProjectOutputDTO, {
    name: 'capitalProject',
    description: 'Получение проекта по хешу с компонентами',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard)
  async getProject(
    @Args('data') data: GetProjectInputDTO,
    @CurrentUser() currentUser?: IMonoAccount
  ): Promise<ProjectOutputDTO | null> {
    return await this.projectManagementService.getProjectByHashWithComponents(data.hash, currentUser);
  }

  /**
   * Получение проекта с отношениями
   */
  @Query(() => ProjectOutputDTO, {
    name: 'capitalProjectWithRelations',
    description: 'Получение проекта с полными отношениями по хешу проекта',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard)
  async getProjectWithRelations(
    @Args('data') data: GetProjectWithRelationsInputDTO,
    @CurrentUser() currentUser?: IMonoAccount
  ): Promise<ProjectOutputDTO | null> {
    return await this.projectManagementService.getProjectWithRelations(data.projectHash, currentUser);
  }
}
