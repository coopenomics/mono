import { Injectable, Inject } from '@nestjs/common';
import { SOVIET_BLOCKCHAIN_PORT, SovietBlockchainPort } from '~/domain/common/ports/soviet-blockchain.port';
import { SovietContract } from 'cooptypes';
import type { TransactResult } from '@wharfkit/session';
import { AuthorizeDecisionInputDTO } from '../dto/authorize-decision-input.dto';
import { DeclineDecisionInputDTO } from '../dto/decline-decision-input.dto';
import { DomainToBlockchainUtils } from '@coopenomics/extension-kit';
import {
  DECISION_DECLINE_REASON_REPOSITORY,
  type DecisionDeclineReasonRepository,
} from '~/domain/decision/repositories/decision-decline-reason.repository';

@Injectable()
export class DecisionInteractor {
  constructor(
    @Inject(SOVIET_BLOCKCHAIN_PORT) private readonly sovietBlockchainPort: SovietBlockchainPort,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils,
    @Inject(DECISION_DECLINE_REASON_REPOSITORY) private readonly declineReasons: DecisionDeclineReasonRepository
  ) {}

  async authorizeDecision(data: AuthorizeDecisionInputDTO): Promise<TransactResult> {
    const authorizeData: SovietContract.Actions.Decisions.Authorize.IAuthorize = {
      coopname: data.coopname,
      chairman: data.chairman,
      decision_id: data.decision_id,
      document: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.document),
      // Председатель подписал протокол сам, своим активным ключом. Подпись
      // робота по разрешению автоматизации проводит расширение робота, не этот путь.
      permission: 'active',
    };

    const execData: SovietContract.Actions.Decisions.Exec.IExec = {
      // executer — аудит-метка инициатора; авторизация транзакции идёт ключом кооператива.
      executer: data.chairman,
      coopname: data.coopname,
      decision_id: data.decision_id,
    };

    return await this.sovietBlockchainPort.authorizeDecision(authorizeData, execData);
  }

  /**
   * Отклонение решения по большинству «против». Пояснение председателя (если
   * написано) пишется в базу ДО транзакции: обратный вызов отклонения
   * расширение разбирает сразу, и пояснение к этому моменту уже должно быть
   * на месте. Отклонение в цепи не прошло — пояснение снимается, иначе оно
   * приписалось бы к будущему снятию того же вопроса по сроку.
   */
  async declineDecision(data: DeclineDecisionInputDTO, declinedBy: string | null = null): Promise<TransactResult> {
    const declineData: SovietContract.Actions.Decisions.Declinedec.IDeclineDecision = {
      coopname: data.coopname,
      decision_id: data.decision_id,
    };

    const reason = data.reason?.trim() ?? '';
    if (reason) await this.declineReasons.save(data.coopname, data.decision_id, reason, declinedBy);
    try {
      return await this.sovietBlockchainPort.declineDecision(declineData);
    } catch (error) {
      if (reason) await this.declineReasons.remove(data.coopname, data.decision_id);
      throw error;
    }
  }
}
