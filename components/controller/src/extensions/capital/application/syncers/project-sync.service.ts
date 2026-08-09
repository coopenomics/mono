import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { AbstractEntitySyncService } from '@coopenomics/extension-kit/sync';
import { ProjectDomainEntity } from '../../domain/entities/project.entity';
import { ProjectRepository, PROJECT_REPOSITORY } from '../../domain/repositories/project.repository';
import { ProjectDeltaMapper } from '../../infrastructure/blockchain/mappers/project-delta.mapper';
import type { IProjectDomainInterfaceBlockchainData } from '../../domain/interfaces/project-blockchain.interface';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import type { TransactResult } from '@wharfkit/session';
import { CapitalContract } from 'cooptypes';
import {
  CAPITAL_PROJECT_CREATED_EVENT,
  type ICapitalProjectCreatedPayload,
} from '~/shared/constants/capital-project-matrix.events';
import type { ISyncResult } from '@coopenomics/extension-kit/sync';
import { ComponentMatrixAnnouncementService } from '../services/component-matrix-announcement.service';
import { waitAfterTransactBeforeChainTableRead, getAppliedBlockNum } from '@coopenomics/extension-kit';

/**
 * Сервис синхронизации проектов с блокчейном
 *
 * Подписывается на дельты таблицы projects контракта capital
 * и синхронизирует данные проектов в локальной базе данных
 */
@Injectable()
export class ProjectSyncService
  extends AbstractEntitySyncService<ProjectDomainEntity, IProjectDomainInterfaceBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'Project';

  constructor(
    @Inject(PROJECT_REPOSITORY)
    projectRepository: ProjectRepository,
    projectDeltaMapper: ProjectDeltaMapper,
    @Inject(LOGGER_PORT) logger: ILoggerPort,
    private readonly eventEmitter: EventEmitter2,
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort,
    private readonly componentMatrixAnnouncement: ComponentMatrixAnnouncementService
  ) {
    super(projectRepository, projectDeltaMapper, logger);
  }

  /**
   * Обработка создания/обновления проекта из дельты парсера + Matrix-анонсы компонентов.
   */
  public override async handleSyncDelta(
    syncKey: string,
    syncValue: string,
    blockchainData: IProjectDomainInterfaceBlockchainData,
    blockNum: number,
    present = true
  ): Promise<ISyncResult> {
    const existingEntity = await this.repository.findBySyncKey(syncKey, syncValue);
    const previousTitle = existingEntity?.title;
    const matrixRefsBeforeSync = existingEntity?.matrix_component_announcement_events ?? [];

    const result = await super.handleSyncDelta(syncKey, syncValue, blockchainData, blockNum, present);

    const entity = await this.repository.findBySyncKey(syncKey, syncValue);
    if (entity) {
      this.componentMatrixAnnouncement.onProjectSyncedFromDelta({
        entity,
        syncResult: result,
        present,
        previousTitle,
        matrixRefsBeforeSync,
      });
    }

    return result;
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации проектов инициализирован. Поддерживаемые контракты: [${supportedVersions.contracts.join(
        ', '
      )}], таблицы: [${supportedVersions.tables.join(', ')}]`
    );

    // Программная подписка на все поддерживаемые паттерны событий
    const allPatterns = this.getAllEventPatterns();
    this.logger.debug(`Подписка на ${allPatterns.length} паттернов событий: ${allPatterns.join(', ')}`);

    // Подписываемся на каждый паттерн программно
    allPatterns.forEach((pattern) => {
      this.eventEmitter.on(pattern, this.processDelta.bind(this));
    });

    this.logger.debug('Сервис синхронизации проектов полностью инициализирован с подписками на паттерны');
  }

  /**
   * Синхронизация проекта между блокчейном и базой данных
   */
  async syncProject(
    coopname: string,
    project_hash: string,
    transactResult: TransactResult
  ): Promise<ProjectDomainEntity | null> {
    await waitAfterTransactBeforeChainTableRead();
    // Извлекаем данные проекта из блокчейна
    const blockchainProject = await this.capitalBlockchainPort.getProject(coopname, project_hash);

    if (!blockchainProject) {
      this.logger.warn(`Не удалось получить данные проекта ${project_hash} из блокчейна после транзакции`);
      return null;
    }

    const processedBlockchainProject: CapitalContract.Tables.Projects.IProject = blockchainProject;

    const hashLower = project_hash.trim().toLowerCase();
    const projectBeforeSync = await this.repository.findBySyncKey(ProjectDomainEntity.getSyncKey(), hashLower);

    const projectEntity = await this.repository.createIfNotExists(
      processedBlockchainProject,
      getAppliedBlockNum(transactResult),
      true
    );

    if (projectEntity.isComponent()) {
      this.componentMatrixAnnouncement.onProjectSyncedFromTransact(projectEntity, projectBeforeSync);
    }

    if (!projectEntity.isComponent() && !projectEntity.matrix_room_id) {
      const title =
        projectEntity.title && projectEntity.title.trim().length > 0
          ? projectEntity.title.trim()
          : projectEntity.project_hash;
      const createdPayload: ICapitalProjectCreatedPayload = {
        project_hash: projectEntity.project_hash,
        title,
      };
      this.eventEmitter.emit(CAPITAL_PROJECT_CREATED_EVENT, createdPayload);
    }

    return projectEntity;
  }

  /**
   * Обработка форков для проектов
   * Теперь подписывается на все форки независимо от контракта
   */
  @OnEvent('fork::*')
  async handleProjectFork(forkData: { block_num: number }): Promise<void> {
    await this.handleFork(forkData.block_num);
  }
}
