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

/**
 * Программа кооператива в его реестре.
 *
 * `draft_id` — шаблон оферты именно этой программы: подпись сверяется с ним, а
 * не со справочником соглашений. Значения расходятся, когда шаблон программы
 * правили отдельно, и подпись по справочнику тогда не проходит.
 */
export interface InnerCoopProgram {
  id: string | number;
  draft_id: string | number;
  [key: string]: any;
}

/** Заявка на открытие целевой программы в кооперативе. */
export interface InnerEnsureProgramParams {
  coopname: string;
  /** Вид программы в реестре кооператива: `marketplace`, `capital`, `generator`. */
  type: string;
  /** Название программы для реестра. */
  title: string;
  /** Вправе ли кооператив расходовать паевые взносы программы. */
  is_can_coop_spend_share_contributions?: boolean;
}

export interface InnerEnsureProgramResult {
  /** `false` — программа уже была открыта, в цепь ничего не отправляли. */
  created: boolean;
  program_id: number;
}

export interface ICouncilPort {
  getDecisions(coopname: string): Promise<InnerCouncilDecision[]>;

  /** Типовое соглашение по его виду; `null`, если такого в кооперативе нет. */
  getCoagreement(coopname: string, agreementType: string): Promise<InnerCoopAgreement | null>;

  /** Программы, открытые в кооперативе. */
  getPrograms(coopname: string): Promise<InnerCoopProgram[]>;

  /**
   * Открыть программу расширения в кооперативе, если её ещё нет.
   *
   * Идемпотентно: открытую программу второй раз не заводят и транзакцию не
   * шлют. Номер программы и шаблон её оферты назначает контракт по виду —
   * это константы протокола, кооператив их не выбирает.
   */
  ensureProgram(params: InnerEnsureProgramParams): Promise<InnerEnsureProgramResult>;

  /**
   * Погасить просроченное решение. Отказ по существу — отдельное действие
   * председателя: истечение срока и отклонение по голосам развязаны.
   */
  cancelExpiredDecision(input: { coopname: string; decision_id: string | number }): Promise<InnerTransactResult>;
}

export const COUNCIL_PORT = Symbol.for('Innercoop.CorePort.Council');
