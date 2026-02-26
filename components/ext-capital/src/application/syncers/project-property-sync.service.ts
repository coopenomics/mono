import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '../../../../shared/services/abstract-entity-sync.service';
import { ProjectPropertyDomainEntity } from '../../domain/entities/project-property.entity';
import {
  ProjectPropertyRepository,
  PROJECT_PROPERTY_REPOSITORY,
} from '../../domain/repositories/project-property.repository';
import { ProjectPropertyDeltaMapper } from '../../infrastructure/blockchain/mappers/project-property-delta.mapper';
import type { IProjectPropertyBlockchainData } from '../../domain/interfaces/project-property-blockchain.interface';

/**
 * Сервис синхронизации проектных имущественных взносов с блокчейном
 *
 * Подписывается на дельты таблицы pjproperties контракта capital
 * и синхронизирует данные проектных имущественных взносов в локальной базе данных
 */
@Injectable()
export class ProjectPropertySyncService
  extends AbstractEntitySyncService<ProjectPropertyDomainEntity, IProjectPropertyBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'ProjectProperty';

  constructor(
    @Inject(PROJECT_PROPERTY_REPOSITORY)
    projectPropertyRepository: ProjectPropertyRepository,
    projectPropertyDeltaMapper: ProjectPropertyDeltaMapper,
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2
  ) {
    super(projectPropertyRepository, projectPropertyDeltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации проектных имущественных взносов инициализирован. Поддерживаемые контракты: [${supportedVersions.contracts.join(
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
  }

  /**
   * Обработчик форков для проектных имущественных взносов
   */
  @OnEvent('fork::*')
  async handleProjectPropertyFork(forkData: { block_num: number }): Promise<void> {
    await this.handleFork(forkData.block_num);
  }
}
