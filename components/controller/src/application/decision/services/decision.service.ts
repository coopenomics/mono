import { Injectable } from '@nestjs/common';
import { DecisionInteractor } from '../use-cases/decision.interactor';
import { AuthorizeDecisionInputDTO } from '../dto/authorize-decision-input.dto';
import { DeclineDecisionInputDTO } from '../dto/decline-decision-input.dto';
import { TransactionDTO } from '~/application/common/dto/transaction-result-response.dto';

@Injectable()
export class DecisionService {
  constructor(private readonly decisionInteractor: DecisionInteractor) {}

  public async authorizeDecision(data: AuthorizeDecisionInputDTO): Promise<TransactionDTO> {
    const result = await this.decisionInteractor.authorizeDecision(data);
    return result as TransactionDTO;
  }

  public async declineDecision(data: DeclineDecisionInputDTO): Promise<TransactionDTO> {
    const result = await this.decisionInteractor.declineDecision(data);
    return result as TransactionDTO;
  }
}
