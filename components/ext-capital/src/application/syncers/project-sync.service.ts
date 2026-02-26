import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '../../../../shared/services/abstract-entity-sync.service';
import { ProjectDomainEntity } from '../../domain/entities/project.entity';
import { ProjectRepository, PROJECT_REPOSITORY } from '../../domain/repositories/project.repository';
import { ProjectDeltaMapper } from '../../infrastructure/blockchain/mappers/project-delta.mapper';
import type { IProjectDomainInterfaceBlockchainData } from '../../domain/interfaces/project-blockchain.interface';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import type { TransactResult } from '@wharfkit/session';
import { CapitalContract } from 'cooptypes';

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
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort
  ) {
    super(projectRepository, projectDeltaMapper, logger);
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
    // Извлекаем данные проекта из блокчейна
    const blockchainProject = await this.capitalBlockchainPort.getProject(coopname, project_hash);

    if (!blockchainProject) {
      this.logger.warn(`Не удалось получить данные проекта ${project_hash} из блокчейна после транзакции`);
      return null;
    }

    const processedBlockchainProject: CapitalContract.Tables.Projects.IProject = blockchainProject;

    // Синхронизируем проект (createIfNotExists сам разберется - создать новый или обновить существующий)
    const projectEntity = await this.repository.createIfNotExists(
      processedBlockchainProject,
      Number(transactResult.transaction?.ref_block_num ?? 0),
      true
    );

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
