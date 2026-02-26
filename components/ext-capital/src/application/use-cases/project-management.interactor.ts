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
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import { ProjectSyncService } from '../syncers/project-sync.service';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';

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
    private readonly logger: WinstonLoggerService,
    private readonly projectSyncService: ProjectSyncService
  ) {
    this.logger.setContext(ProjectManagementInteractor.name);
  }
  /**
   * Создание проекта в CAPITAL контракте
   */
  async createProject(data: CreateProjectDomainInput, _currentUser: MonoAccountDomainInterface): Promise<TransactResult> {
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
   * Редактирование проекта в CAPITAL контракте
   */
  async editProject(data: EditProjectDomainInput): Promise<TransactResult> {
    // Вызываем блокчейн порт
    return await this.capitalBlockchainPort.editProject(data);
  }
  /**
   * Установка мастера проекта CAPITAL контракта
   */
  async setMaster(data: SetMasterDomainInput, _currentUser: MonoAccountDomainInterface): Promise<TransactResult> {
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
  async addAuthor(data: AddAuthorDomainInput, _currentUser: MonoAccountDomainInterface): Promise<ProjectDomainEntity> {
    // Вызываем блокчейн порт
    const transactResult = await this.capitalBlockchainPort.addAuthor(data);

    // Синхронизируем данные проекта с блокчейном и получаем обновленную сущность
    const projectEntity = await this.projectSyncService.syncProject(data.coopname, data.project_hash, transactResult);

    if (!projectEntity) {
      throw new Error(`Не удалось синхронизировать проект ${data.project_hash} после добавления автора`);
    }

    return projectEntity;
  }

  /**
   * Установка плана проекта CAPITAL контракта
   */
  async setPlan(data: SetPlanDomainInput): Promise<TransactResult> {
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
    _currentUser: MonoAccountDomainInterface
  ): Promise<ProjectDomainEntity> {
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
    // Вызываем блокчейн порт
    return await this.capitalBlockchainPort.deleteProject(data);
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
    return await this.projectRepository.findById(_id);
  }

  /**
   * Получение проекта по хешу проекта
   */
  async getProjectByHash(hash: string): Promise<ProjectDomainEntity | null> {
    return await this.projectRepository.findByHash(hash);
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
}
