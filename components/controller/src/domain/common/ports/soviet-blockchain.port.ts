import { SovietContract } from 'cooptypes';
import type { TransactResult } from '@wharfkit/session';

/**
 * Параметры открытия программы ЦПП. Всё, что одинаково у любой программы
 * (безоплатный расчёт, нулевые взносы, пустые медиа-поля), подставляет адаптер —
 * расширение задаёт только то, чем программы отличаются.
 */
export interface EnsureProgramParams {
  coopname: string;
  /** Тип программы из реестра ЦПП контракта: `marketplace`, `capital`, `generator`. */
  type: string;
  /** Название программы для реестра кооператива. */
  title: string;
  /** Может ли кооператив расходовать паевые взносы программы. */
  is_can_coop_spend_share_contributions?: boolean;
}

export interface EnsureProgramResult {
  /** false — программа уже была открыта, транзакция не отправлялась. */
  created: boolean;
  program_id: number;
}

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

  /**
   * Открыть в кооперативе программу ЦПП, если её ещё нет.
   *
   * Нужна расширениям при самоинициализации: без строки в `soviet::programs`
   * пайщик не может подписать оферту ЦПП (`wallet::signagree` требует
   * существующую программу), а без подписи ledger2 не пропускает операции по
   * кошелькам программы. Раньше программу заводили вручную через cleos на
   * каждый кооператив — это не масштабировалось.
   *
   * Идемпотентна: если программа уже открыта, транзакция не отправляется.
   * `program_id` и шаблон оферты назначает сам контракт по типу программы —
   * это константы протокола, кооператив их не выбирает.
   */
  ensureProgram(params: EnsureProgramParams): Promise<EnsureProgramResult>;

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
