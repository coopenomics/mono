import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '~/shared/services/abstract-entity-sync.service';
import { UserWalletDomainEntity } from '~/domain/wallet/entities/user-wallet-domain.entity';
import {
  UserWalletRepository,
  USER_WALLET_REPOSITORY,
} from '~/domain/wallet/repositories/user-wallet.repository';
import { UserWalletDeltaMapper } from '../mappers/user-wallet-delta.mapper';
import type { IUserWalletBlockchainData } from '~/domain/wallet/interfaces/user-wallet-blockchain.interface';

/**
 * Sync-сервис L3 кошельков (`ledger2::userwallets`, Эпик 3).
 *
 * Подписывается на дельты таблицы `userwallets` контракта `ledger2`.
 * present=false (запись стёрта `walletop`/`migrate3` при обнулении баланса)
 * прокидывается в репозиторий — base-blockchain-repository хранит копию
 * для версионирования и форк-rollback.
 */
@Injectable()
export class UserWalletSyncService
  extends AbstractEntitySyncService<UserWalletDomainEntity, IUserWalletBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'UserWallet';

  constructor(
    @Inject(USER_WALLET_REPOSITORY)
    repository: UserWalletRepository,
    deltaMapper: UserWalletDeltaMapper,
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2
  ) {
    super(repository, deltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации ledger2::userwallets инициализирован. Контракты: [${supportedVersions.contracts.join(
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
  async handleUserWalletFork(forkData: { block_num: number }): Promise<void> {
    await this.handleFork(forkData.block_num);
  }
}
