import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '@coopenomics/extension-kit/sync';
import { AgreementDomainEntity } from '~/domain/agreement/entities/agreement.entity';
import { AgreementRepository, AGREEMENT_REPOSITORY } from '~/domain/agreement/repositories/agreement.repository';
import { AgreementDeltaMapper } from '../mappers/agreement-delta.mapper';
import type { IAgreementBlockchainData } from '~/domain/agreement/interfaces/agreement-blockchain.interface';

/**
 * Сервис синхронизации соглашений с блокчейном
 *
 * Подписывается на дельты таблицы agreements3 контракта soviet
 * и синхронизирует данные соглашений в локальной базе данных
 */
@Injectable()
export class AgreementSyncService
  extends AbstractEntitySyncService<AgreementDomainEntity, IAgreementBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'Agreement';

  constructor(
    @Inject(AGREEMENT_REPOSITORY)
    agreementRepository: AgreementRepository,
    agreementDeltaMapper: AgreementDeltaMapper,
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2
  ) {
    super(agreementRepository, agreementDeltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации соглашений инициализирован. Поддерживаемые контракты: [${supportedVersions.contracts.join(
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

    this.logger.debug('Сервис синхронизации соглашений полностью инициализирован с подписками на паттерны');
  }

  /**
   * Обработка форков для соглашений
   * Теперь подписывается на все форки независимо от контракта
   */
  @OnEvent('fork::*')
  async handleAgreementFork(forkData: { block_num: number }): Promise<void> {
    await this.handleFork(forkData.block_num);
  }
}
