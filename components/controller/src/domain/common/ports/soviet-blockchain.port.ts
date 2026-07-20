import { SovietContract } from 'cooptypes';
import type { TransactResult } from '@wharfkit/session';

export interface SovietBlockchainPort {
  getDecisions(coopname: string): Promise<SovietContract.Tables.Decisions.IDecision[]>;
  getDecision(coopname: string, decision_id: string): Promise<SovietContract.Tables.Decisions.IDecision | null>;

  // Все советы кооператива (`soviet::boards`). Нужен состав совета (`soviet`) для
  // вычисления порога отрицательного консенсуса на стороне фронта.
  getBoards(coopname: string): Promise<SovietContract.Tables.Boards.IBoards[]>;

  // Конфиг соглашения кооператива (program_id, draft_id) по типу.
  getCoagreement(coopname: string, agreement_type: string): Promise<SovietContract.Tables.CoopAgreements.ICoopAgreement | null>;

  // Все строки `coagreements` кооператива (≤10 строк per coop).
  getCoagreements(coopname: string): Promise<SovietContract.Tables.CoopAgreements.ICoopAgreement[]>;

  // Целевые потребительские программы кооператива (`soviet::programs`).
  getPrograms(coopname: string): Promise<SovietContract.Tables.Programs.IProgram[]>;

  publishProjectOfFreeDecision(
    data: SovietContract.Actions.Decisions.CreateFreeDecision.ICreateFreeDecision
  ): Promise<TransactResult>;

  cancelExpiredDecision(data: SovietContract.Actions.Decisions.Cancelexprd.ICancelExpired): Promise<TransactResult>;

  // Явное отклонение решения советом по отрицательному консенсусу (до истечения
  // срока). Проводится ключом кооператива; контракт проверяет большинство «против».
  declineDecision(data: SovietContract.Actions.Decisions.Declinedec.IDeclineDecision): Promise<TransactResult>;

  sendAgreement(data: SovietContract.Actions.Agreements.SendAgreement.ISendAgreement): Promise<TransactResult>;

  confirmAgreement(data: SovietContract.Actions.Agreements.ConfirmAgreement.IConfirmAgreement): Promise<TransactResult>;

  declineAgreement(data: SovietContract.Actions.Agreements.DeclineAgreement.IDeclineAgreement): Promise<TransactResult>;

  // Утверждение + исполнение решения совета одной транзакцией ключом кооператива
  // (soviet::authorize + soviet::exec). Согласие председателя — в подписанном им
  // документе внутри authorizeData.document.
  authorizeDecision(
    authorizeData: SovietContract.Actions.Decisions.Authorize.IAuthorize,
    execData: SovietContract.Actions.Decisions.Exec.IExec
  ): Promise<TransactResult>;
}

export const SOVIET_BLOCKCHAIN_PORT = Symbol('SovietBlockchainPort');
