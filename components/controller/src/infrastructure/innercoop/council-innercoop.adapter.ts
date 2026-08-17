import { Inject, Injectable } from '@nestjs/common';
import type {
  ICouncilPort,
  InnerCoopAgreement,
  InnerCouncilDecision,
  InnerCoopProgram,
  InnerEnsureProgramParams,
  InnerEnsureProgramResult,
  InnerTransactResult,
} from '@coopenomics/innercoop';
import type { SovietContract } from 'cooptypes';
import { SOVIET_BLOCKCHAIN_PORT, type SovietBlockchainPort } from '~/domain/common/ports/soviet-blockchain.port';

/**
 * Реализация `ICouncilPort`: из большого порта совета наружу отданы три
 * операции — прочитать решения, найти типовое соглашение и погасить
 * просроченное решение.
 *
 * Всё остальное — вынесение решений, подпись соглашений, состав совета —
 * работа ядра и людей в повестке; расширению этих действий не даётся.
 */
@Injectable()
export class CouncilInnercoopAdapter implements ICouncilPort {
  constructor(
    @Inject(SOVIET_BLOCKCHAIN_PORT)
    private readonly sovietBlockchainPort: SovietBlockchainPort
  ) {}

  async getDecisions(coopname: string): Promise<InnerCouncilDecision[]> {
    return this.sovietBlockchainPort.getDecisions(coopname);
  }

  async getCoagreement(coopname: string, agreementType: string): Promise<InnerCoopAgreement | null> {
    return this.sovietBlockchainPort.getCoagreement(coopname, agreementType);
  }

  async getPrograms(coopname: string): Promise<InnerCoopProgram[]> {
    return this.sovietBlockchainPort.getPrograms(coopname);
  }

  async ensureProgram(params: InnerEnsureProgramParams): Promise<InnerEnsureProgramResult> {
    return this.sovietBlockchainPort.ensureProgram(params);
  }

  async cancelExpiredDecision(input: {
    coopname: string;
    decision_id: string | number;
  }): Promise<InnerTransactResult> {
    return this.sovietBlockchainPort.cancelExpiredDecision(
      input as SovietContract.Actions.Decisions.Cancelexprd.ICancelExpired
    );
  }
}
