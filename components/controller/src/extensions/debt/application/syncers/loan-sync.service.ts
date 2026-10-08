import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { AbstractEntitySyncService } from '@coopenomics/extension-kit/sync';
import type { ISyncResult } from '@coopenomics/extension-kit/sync';
import { LoanDomainEntity } from '../../domain/entities/loan.entity';
import { LOAN_REPOSITORY, type LoanRepository } from '../../domain/repositories/loan.repository';
import { LoanDeltaMapper } from '../../infrastructure/blockchain/mappers/loan-delta.mapper';
import type { ILoanBlockchainData } from '../../domain/interfaces/loan-blockchain.interface';

/** Событие после записи займа в зеркало: его слушают платежи и уведомления. */
export const LOAN_SYNCED_EVENT = 'entitysynced::debt::debts';

export interface LoanSyncedPayload {
  entity: LoanDomainEntity;
  blockNum: number;
  syncResult: ISyncResult;
}

/** Подписка на дельты `debt::debts` и зеркалирование займов в базу. */
@Injectable()
export class LoanSyncService extends AbstractEntitySyncService<LoanDomainEntity, ILoanBlockchainData> implements OnModuleInit {
  protected readonly entityName = 'DebtLoan';

  constructor(
    @Inject(LOAN_REPOSITORY) loanRepository: LoanRepository,
    loanDeltaMapper: LoanDeltaMapper,
    @Inject(LOGGER_PORT) logger: ILoggerPort,
    private readonly eventEmitter: EventEmitter2
  ) {
    super(loanRepository, loanDeltaMapper, logger);
  }

  async onModuleInit() {
    const supported = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации займов инициализирован. Контракты: [${supported.contracts.join(', ')}], таблицы: [${supported.tables.join(', ')}]`
    );
    for (const pattern of this.getAllEventPatterns()) {
      this.eventEmitter.on(pattern, this.processDelta.bind(this));
    }
  }

  public override async handleSyncDelta(
    syncKey: string,
    syncValue: string,
    blockchainData: ILoanBlockchainData,
    blockNum: number,
    present = true
  ): Promise<ISyncResult> {
    const result = await super.handleSyncDelta(syncKey, syncValue, blockchainData, blockNum, present);
    if (result.created || result.updated) {
      const entity = await (this.repository as LoanRepository).findBySyncKey(syncKey, syncValue);
      if (entity) {
        this.eventEmitter.emit(LOAN_SYNCED_EVENT, { entity, blockNum, syncResult: result } satisfies LoanSyncedPayload);
      }
    }
    return result;
  }
}
