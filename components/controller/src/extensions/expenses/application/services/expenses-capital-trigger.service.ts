import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { ExpenseProposalDomainEntity } from '../../domain/entities/expense-proposal.entity';
import { ExpenseProposalStatus } from '../../domain/enums/expense-proposal-status.enum';
import {
  ExpenseProposalRepository,
  EXPENSE_PROPOSAL_REPOSITORY,
} from '../../domain/repositories/expense-proposal.repository';

/**
 * Payload события `expense::capitalization::required`. Эмитит при переходе сметы
 * в CLOSED — подписчик в capital extension выполнит capital::createrid через
 * WriteMutationPool под подпись кооператива.
 */
export interface ExpenseCapitalizationRequiredPayload {
  coopname: string;
  proposal_hash: string;
  username: string;
  total_actual: string;
  block_num: number;
}

export const EXPENSE_CAPITALIZATION_REQUIRED = 'expense::capitalization::required';

/**
 * Триггер capitalization при закрытии сметы расхода (CLOSED).
 *
 * Подписан на `entitysynced::expense::proposals` (emit'ит `ExpenseProposalSyncService`
 * после save в PG). При переходе в CLOSED — эмитит платформенное событие
 * `expense::capitalization::required` с полным payload.
 *
 * Capital extension подписывается на это событие и выполняет capital::createrid
 * через WriteMutationPool — coupling двух extensions через event-bus, без прямой
 * инъекции CapitalExtensionModule.
 *
 * Идемпотентность: подписан на `entitysynced` (после save в PG), повторная
 * capitalization защищается на уровне capital через sync_key dedup в pool.
 */
@Injectable()
export class ExpensesCapitalTriggerService {
  constructor(
    @Inject(EXPENSE_PROPOSAL_REPOSITORY)
    private readonly proposals: ExpenseProposalRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(ExpensesCapitalTriggerService.name);
  }

  @OnEvent('entitysynced::expense::proposals')
  async handleProposalSynced(payload: { entity: ExpenseProposalDomainEntity; blockNum: number }): Promise<void> {
    const { entity, blockNum } = payload;

    if (entity.status !== ExpenseProposalStatus.CLOSED) {
      return;
    }

    if (!entity.total_actual) {
      this.logger.warn(
        `СЗ ${entity.proposal_hash} закрыта без total_actual — capitalization не запускается.`
      );
      return;
    }

    if (!entity.username) {
      this.logger.warn(
        `СЗ ${entity.proposal_hash} закрыта без username — capitalization не запускается.`
      );
      return;
    }

    const event: ExpenseCapitalizationRequiredPayload = {
      coopname: entity.coopname,
      proposal_hash: entity.proposal_hash,
      username: entity.username,
      total_actual: entity.total_actual,
      block_num: blockNum,
    };

    this.logger.log(
      `СЗ ${entity.proposal_hash} закрыта в блоке ${blockNum} (total_actual=${entity.total_actual}). ` +
        `Эмит ${EXPENSE_CAPITALIZATION_REQUIRED} для capital extension.`
    );

    this.eventEmitter.emit(EXPENSE_CAPITALIZATION_REQUIRED, event);

    void this.proposals;
  }
}
