/**
 * Пояснения председателя к отклонению решений совета (таблица
 * `decision_decline_reasons`). Хранятся только в базе узла: в цепи у
 * отклонения по большинству «против» одна общая фраза.
 */
export interface DecisionDeclineReasonRepository {
  /** Записать или заменить пояснение к решению. */
  save(coopname: string, decisionId: number, reason: string, declinedBy: string | null): Promise<void>;
  /** Снять пояснение — отклонение в цепи не состоялось. */
  remove(coopname: string, decisionId: number): Promise<void>;
  /** Пояснение к решению или `null`. */
  find(coopname: string, decisionId: string | number): Promise<string | null>;
}

export const DECISION_DECLINE_REASON_REPOSITORY = Symbol('DecisionDeclineReasonRepository');
