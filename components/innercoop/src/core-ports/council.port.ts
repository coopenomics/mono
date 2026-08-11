import type { InnerTransactResult } from './chain.port';

/**
 * Совет кооператива: решения и типовые соглашения.
 *
 * Расширение спрашивает совет о том, что уже решено, и просит погасить
 * просроченное. Выносить решения оно не может — это делают люди в повестке,
 * а расширение лишь реагирует на результат.
 */

/**
 * Решение совета, как оно записано в цепи.
 *
 * Перечислены поля, которые читают расширения; остальные доступны через
 * индексную сигнатуру — форма решения задаётся контрактом и меняется вместе с
 * ним.
 */
export interface InnerCouncilDecision {
  id: string | number;
  /**
   * Момент, после которого решение считается просроченным. У решений, принятых
   * до появления срока, поле пустое — такие гасятся сразу.
   */
  expired_at?: string;
  [key: string]: any;
}

/** Типовое соглашение кооператива — то, что пайщик подписывает при вступлении. */
export interface InnerCoopAgreement {
  /** Программа, к которой соглашение относится. */
  program_id: string | number;
  [key: string]: any;
}

export interface ICouncilPort {
  getDecisions(coopname: string): Promise<InnerCouncilDecision[]>;

  /** Типовое соглашение по его виду; `null`, если такого в кооперативе нет. */
  getCoagreement(coopname: string, agreementType: string): Promise<InnerCoopAgreement | null>;

  /**
   * Погасить просроченное решение. Отказ по существу — отдельное действие
   * председателя: истечение срока и отклонение по голосам развязаны.
   */
  cancelExpiredDecision(input: { coopname: string; decision_id: string | number }): Promise<InnerTransactResult>;
}

export const COUNCIL_PORT = Symbol.for('Innercoop.CorePort.Council');
