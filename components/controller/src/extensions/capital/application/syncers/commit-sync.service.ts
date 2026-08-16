import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LOGGER_PORT, type ILoggerPort,
  type InnerTransactResult,
  type InnerChainActionRecord,
} from '@coopenomics/innercoop';
import { AbstractEntitySyncService } from '@coopenomics/extension-kit/sync';
import { CommitDomainEntity } from '../../domain/entities/commit.entity';
import { CommitRepository, COMMIT_REPOSITORY } from '../../domain/repositories/commit.repository';
import { CommitDeltaMapper } from '../../infrastructure/blockchain/mappers/commit-delta.mapper';
import type { ICommitBlockchainData } from '../../domain/interfaces/commit-blockchain.interface';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import { getAppliedBlockNum } from '@coopenomics/extension-kit';

/**
 * Сервис синхронизации коммитов с блокчейном
 *
 * Подписывается на дельты таблицы commits контракта capital
 * и синхронизирует данные коммитов в локальной базе данных
 */
@Injectable()
export class CommitSyncService
  extends AbstractEntitySyncService<CommitDomainEntity, ICommitBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'Commit';

  constructor(
    @Inject(COMMIT_REPOSITORY)
    commitRepository: CommitRepository,
    commitDeltaMapper: CommitDeltaMapper,
    @Inject(LOGGER_PORT) logger: ILoggerPort,
    private readonly eventEmitter: EventEmitter2,
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort
  ) {
    super(commitRepository, commitDeltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации коммитов инициализирован. Поддерживаемые контракты: [${supportedVersions.contracts.join(
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

    this.logger.debug('Сервис синхронизации коммитов полностью инициализирован с подписками на паттерны');
  }

  /**
   * Синхронизация коммита между блокчейном и базой данных
   */
  async syncCommit(coopname: string, commitHash: string, transactResult: InnerTransactResult): Promise<CommitDomainEntity | null> {
    // Извлекаем данные коммита из блокчейна
    const blockchainCommit = await this.capitalBlockchainPort.getCommitByHash(coopname, commitHash);

    if (!blockchainCommit) {
      this.logger.warn(`Не удалось получить данные коммита ${commitHash} из блокчейна после транзакции`);
      return null;
    }

    // Синхронизируем коммит (createIfNotExists сам разберется - создать новый или обновить существующий)
    const commitEntity = await this.repository.createIfNotExists(
      blockchainCommit,
      getAppliedBlockNum(transactResult),
      true
    );

    return commitEntity;
  }

  // Одобрение и отклонение коммита слушает сам `GenerationInteractor`: там
  // лежит обработка, а здесь стояли два переходника, ради которых синхронизатор
  // инжектил сценарий — и получался цикл (FC1-21). Подписка на событие цепи
  // ничего не требует от синхронизатора, обработчику нужен только `actionData`.
}
