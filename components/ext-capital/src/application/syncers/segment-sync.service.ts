import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '../../../../shared/services/abstract-entity-sync.service';
import { SegmentDomainEntity } from '../../domain/entities/segment.entity';
import { SegmentRepository, SEGMENT_REPOSITORY } from '../../domain/repositories/segment.repository';
import { SegmentDeltaMapper } from '../../infrastructure/blockchain/mappers/segment-delta.mapper';
import type { ISegmentBlockchainData } from '../../domain/interfaces/segment-blockchain.interface';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import type { TransactResult } from '@wharfkit/session';

/**
 * Сервис синхронизации сегментов с блокчейном
 *
 * Подписывается на дельты таблицы segments контракта capital
 * и синхронизирует данные сегментов в локальной базе данных
 */
@Injectable()
export class SegmentSyncService
  extends AbstractEntitySyncService<SegmentDomainEntity, ISegmentBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'Segment';

  constructor(
    @Inject(SEGMENT_REPOSITORY)
    segmentRepository: SegmentRepository,
    segmentDeltaMapper: SegmentDeltaMapper,
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort
  ) {
    super(segmentRepository, segmentDeltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации сегментов инициализирован. Поддерживаемые контракты: [${supportedVersions.contracts.join(
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

    this.logger.debug('Сервис синхронизации сегментов полностью инициализирован с подписками на паттерны');
  }

  /**
   * Обработка форков для сегментов
   * Теперь подписывается на все форки независимо от контракта
   */
  @OnEvent('fork::*')
  async handleSegmentFork(forkData: { block_num: number }): Promise<void> {
    await this.handleFork(forkData.block_num);
  }

  /**
   * Синхронизация сегмента между блокчейном и базой данных
   */
  async syncSegment(
    coopname: string,
    projectHash: string,
    username: string,
    transactResult: TransactResult
  ): Promise<SegmentDomainEntity | null> {
    // Извлекаем данные сегмента из блокчейна по комбинированному индексу
    const blockchainSegment = await this.capitalBlockchainPort.getSegmentByProjectUser(coopname, projectHash, username);

    if (!blockchainSegment) {
      this.logger.warn(`Не удалось получить данные сегмента ${projectHash}:${username} из блокчейна после транзакции`);
      return null;
    }

    // Синхронизируем сегмент (createIfNotExists сам разберется - создать новый или обновить существующий)
    const segmentEntity = await this.repository.createIfNotExists(
      blockchainSegment,
      Number(transactResult.transaction?.ref_block_num ?? 0),
      true
    );

    return segmentEntity;
  }

  /**
   * Получение поддерживаемых версий контрактов и таблиц
   */
  public getSupportedVersions(): { contracts: string[]; tables: string[] } {
    return {
      contracts: this.mapper.getSupportedContractNames(),
      tables: this.mapper.getSupportedTableNames(),
    };
  }
}
