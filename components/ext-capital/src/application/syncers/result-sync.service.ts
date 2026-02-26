import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '../../../../shared/services/abstract-entity-sync.service';
import { ResultDomainEntity } from '../../domain/entities/result.entity';
import { ResultRepository, RESULT_REPOSITORY } from '../../domain/repositories/result.repository';
import { ResultDeltaMapper } from '../../infrastructure/blockchain/mappers/result-delta.mapper';
import type { IResultBlockchainData } from '../../domain/interfaces/result-blockchain.interface';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import type { TransactResult } from '@wharfkit/session';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';

/**
 * Сервис синхронизации результатов с блокчейном
 *
 * Подписывается на дельты таблицы results контракта capital
 * и синхронизирует данные результатов в локальной базе данных
 */
@Injectable()
export class ResultSyncService
  extends AbstractEntitySyncService<ResultDomainEntity, IResultBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'Result';

  constructor(
    @Inject(RESULT_REPOSITORY)
    resultRepository: ResultRepository,
    resultDeltaMapper: ResultDeltaMapper,
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils
  ) {
    super(resultRepository, resultDeltaMapper, logger);
    this.resultRepository = resultRepository;
  }

  private readonly resultRepository: ResultRepository;

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации результатов инициализирован. Поддерживаемые контракты: [${supportedVersions.contracts.join(
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

    this.logger.debug('Сервис синхронизации результатов полностью инициализирован с подписками на паттерны');
  }

  /**
   * Синхронизация результата между блокчейном и базой данных
   */
  async syncResult(resultHash: string, transactResult: TransactResult): Promise<ResultDomainEntity | null> {
    // Извлекаем данные результата из блокчейна по result_hash
    // Для этого нам нужно получить результат из репозитория, чтобы узнать coopname
    const existingResult = await this.resultRepository.findByResultHash(resultHash);
    if (!existingResult) {
      this.logger.warn(`Результат с хэшем ${resultHash} не найден в базе данных для синхронизации`);
      return null;
    }

    // Получаем данные из блокчейна по индексу by_hash (result_hash)
    const blockchainResult = await this.capitalBlockchainPort.getResultByHash(existingResult.coopname || '', resultHash);

    if (!blockchainResult) {
      this.logger.warn(`Не удалось получить данные результата ${resultHash} из блокчейна после транзакции`);
      return null;
    }

    // Преобразуем документы из блокчейн формата в доменный
    const processedBlockchainResult = {
      ...blockchainResult,
      statement: this.domainToBlockchainUtils.convertBlockchainDocumentToDomainFormat(blockchainResult.statement),
      authorization: blockchainResult.authorization
        ? this.domainToBlockchainUtils.convertBlockchainDocumentToDomainFormat(blockchainResult.authorization)
        : undefined,
      act: blockchainResult.act
        ? this.domainToBlockchainUtils.convertBlockchainDocumentToDomainFormat(blockchainResult.act)
        : undefined,
    };

    // Синхронизируем результат (createIfNotExists сам разберется - создать новый или обновить существующий)
    const resultEntity = await this.repository.createIfNotExists(
      processedBlockchainResult,
      Number(transactResult.transaction?.ref_block_num ?? 0),
      true
    );

    return resultEntity;
  }

  /**
   * Обработка форков для результатов
   * Теперь подписывается на все форки независимо от контракта
   */
  @OnEvent('fork::*')
  async handleResultFork(forkData: { block_num: number }): Promise<void> {
    await this.handleFork(forkData.block_num);
  }
}
