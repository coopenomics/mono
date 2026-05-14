import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '~/shared/services/abstract-entity-sync.service';
import { UserAgreementDomainEntity } from '~/domain/wallet/entities/user-agreement-domain.entity';
import {
  UserAgreementRepository,
  USER_AGREEMENT_REPOSITORY,
} from '~/domain/wallet/repositories/user-agreement.repository';
import { UserAgreementDeltaMapper } from '../mappers/user-agreement-delta.mapper';
import type { IUserAgreementBlockchainData } from '~/domain/wallet/interfaces/user-agreement-blockchain.interface';

/**
 * Sync-сервис owner'ов программных соглашений (`wallet::users`).
 *
 * Подписывается на дельты таблицы `users` контракта `wallet`. Один upsert
 * на (coopname, username) — содержимое `programs[]` приходит атомарно.
 */
@Injectable()
export class UserAgreementSyncService
  extends AbstractEntitySyncService<UserAgreementDomainEntity, IUserAgreementBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'UserAgreement';

  constructor(
    @Inject(USER_AGREEMENT_REPOSITORY)
    repository: UserAgreementRepository,
    deltaMapper: UserAgreementDeltaMapper,
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2
  ) {
    super(repository, deltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации wallet::users инициализирован. Контракты: [${supportedVersions.contracts.join(
        ', '
      )}], таблицы: [${supportedVersions.tables.join(', ')}]`
    );

    const allPatterns = this.getAllEventPatterns();
    this.logger.debug(`Подписка на ${allPatterns.length} паттернов: ${allPatterns.join(', ')}`);

    allPatterns.forEach((pattern) => {
      this.eventEmitter.on(pattern, this.processDelta.bind(this));
    });
  }

  @OnEvent('fork::*')
  async handleUserAgreementFork(forkData: { block_num: number }): Promise<void> {
    await this.handleFork(forkData.block_num);
  }
}
