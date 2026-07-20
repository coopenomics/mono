import { Injectable, Inject } from '@nestjs/common';
import { SOVIET_BLOCKCHAIN_PORT, SovietBlockchainPort } from '~/domain/common/ports/soviet-blockchain.port';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import { SovietContract } from 'cooptypes';
import type { TransactResult } from '@wharfkit/session';
import { AuthorizeDecisionInputDTO } from '../dto/authorize-decision-input.dto';
import { DeclineDecisionInputDTO } from '../dto/decline-decision-input.dto';

@Injectable()
export class DecisionInteractor {
  constructor(
    @Inject(SOVIET_BLOCKCHAIN_PORT) private readonly sovietBlockchainPort: SovietBlockchainPort,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils
  ) {}

  async authorizeDecision(data: AuthorizeDecisionInputDTO): Promise<TransactResult> {
    const authorizeData: SovietContract.Actions.Decisions.Authorize.IAuthorize = {
      coopname: data.coopname,
      chairman: data.chairman,
      decision_id: data.decision_id,
      document: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.document),
    };

    const execData: SovietContract.Actions.Decisions.Exec.IExec = {
      // executer — аудит-метка инициатора; авторизация транзакции идёт ключом кооператива.
      executer: data.chairman,
      coopname: data.coopname,
      decision_id: data.decision_id,
    };

    return await this.sovietBlockchainPort.authorizeDecision(authorizeData, execData);
  }

  async declineDecision(data: DeclineDecisionInputDTO): Promise<TransactResult> {
    const declineData: SovietContract.Actions.Decisions.Declinedec.IDeclineDecision = {
      coopname: data.coopname,
      decision_id: data.decision_id,
    };

    return await this.sovietBlockchainPort.declineDecision(declineData);
  }
}
