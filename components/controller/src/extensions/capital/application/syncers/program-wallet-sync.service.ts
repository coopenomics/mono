import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { AbstractEntitySyncService } from '@coopenomics/extension-kit/sync';
import { ProgramWalletDomainEntity } from '../../domain/entities/program-wallet.entity';
import { ProgramWalletRepository, PROGRAM_WALLET_REPOSITORY } from '../../domain/repositories/program-wallet.repository';
import { ProgramWalletDeltaMapper } from '../../infrastructure/blockchain/mappers/program-wallet-delta.mapper';
import type { IProgramWalletBlockchainData } from '../../domain/interfaces/program-wallet-blockchain.interface';

/**
 * Сервис синхронизации программных кошельков с блокчейном
 *
 * Подписывается на дельты таблицы capwallets контракта capital
 * и синхронизирует данные программных кошельков в локальной базе данных
 */
@Injectable()
export class ProgramWalletSyncService
  extends AbstractEntitySyncService<ProgramWalletDomainEntity, IProgramWalletBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'ProgramWallet';

  constructor(
    @Inject(PROGRAM_WALLET_REPOSITORY)
    programWalletRepository: ProgramWalletRepository,
    programWalletDeltaMapper: ProgramWalletDeltaMapper,
    @Inject(LOGGER_PORT) logger: ILoggerPort,
    private readonly eventEmitter: EventEmitter2
  ) {
    super(programWalletRepository, programWalletDeltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации программных кошельков инициализирован. Поддерживаемые контракты: [${supportedVersions.contracts.join(
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
}
