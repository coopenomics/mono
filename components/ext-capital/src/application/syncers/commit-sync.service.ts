import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '../../../../shared/services/abstract-entity-sync.service';
import { CommitDomainEntity } from '../../domain/entities/commit.entity';
import { CommitRepository, COMMIT_REPOSITORY } from '../../domain/repositories/commit.repository';
import { CommitDeltaMapper } from '../../infrastructure/blockchain/mappers/commit-delta.mapper';
import type { ICommitBlockchainData } from '../../domain/interfaces/commit-blockchain.interface';
import { GenerationInteractor } from '../use-cases/generation.interactor';
import { CapitalContract } from 'cooptypes';
import { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import type { TransactResult } from '@wharfkit/session';

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
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => GenerationInteractor))
    private readonly generationInteractor: GenerationInteractor,
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
  async syncCommit(coopname: string, commitHash: string, transactResult: TransactResult): Promise<CommitDomainEntity | null> {
    // Извлекаем данные коммита из блокчейна
    const blockchainCommit = await this.capitalBlockchainPort.getCommitByHash(coopname, commitHash);

    if (!blockchainCommit) {
      this.logger.warn(`Не удалось получить данные коммита ${commitHash} из блокчейна после транзакции`);
      return null;
    }

    // Синхронизируем коммит (createIfNotExists сам разберется - создать новый или обновить существующий)
    const commitEntity = await this.repository.createIfNotExists(
      blockchainCommit,
      Number(transactResult.transaction?.ref_block_num ?? 0),
      true
    );

    return commitEntity;
  }

  /**
   * Обработчик одобрения коммита
   */
  @OnEvent(`action::${CapitalContract.contractName.production}::${CapitalContract.Actions.CommitApprove.actionName}`)
  async handleApproveCommit(actionData: ActionDomainInterface): Promise<void> {
    try {
      await this.generationInteractor.handleApproveCommit(actionData);
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке одобрения коммита: ${error?.message}`, error?.stack);
    }
  }

  /**
   * Обработчик отклонения коммита
   */
  @OnEvent(`action::${CapitalContract.contractName.production}::${CapitalContract.Actions.CommitDecline.actionName}`)
  async handleDeclineCommit(actionData: ActionDomainInterface): Promise<void> {
    try {
      await this.generationInteractor.handleDeclineCommit(actionData);
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке отклонения коммита: ${error?.message}`, error?.stack);
    }
  }

  /**
   * Обработка форков для коммитов
   * Теперь подписывается на все форки независимо от контракта
   */
  @OnEvent('fork::*')
  async handleCommitFork(forkData: { block_num: number }): Promise<void> {
    await this.handleFork(forkData.block_num);
  }
}
