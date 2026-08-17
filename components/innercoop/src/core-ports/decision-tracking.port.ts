/**
 * Отслеживание решений: расширение регистрирует правило «когда примут решение
 * с этим хэшем — обновить такое-то поле параметров кооператива», и дальше ядро
 * следит само.
 *
 * Порт существовал в ядре как `DecisionTrackingPort` и уже инжектился
 * расширениями по токену — переехал потому, что жил по пути `~/domain/**`,
 * которого за пределами монолита нет.
 */
import type { CreateTrackingRuleInput, TrackingRule } from './tracking-rule.contract';

export interface IDecisionTrackingPort {
  registerTrackingRule(input: CreateTrackingRuleInput): Promise<TrackingRule>;

  /**
   * Заменить отслеживаемый хэш.
   *
   * Нужно при перезапуске общего собрания: собрание то же, документ новый, а
   * правило должно продолжать работать.
   */
  updateTrackingRuleHash(oldHash: string, newHash: string): Promise<void>;

  getActiveRules(): Promise<TrackingRule[]>;
  getRuleByHash(hash: string): Promise<TrackingRule | null>;
  getRuleById(id: string): Promise<TrackingRule | null>;

  /** Выключить правило, сохранив его историю. */
  deactivateRule(id: string): Promise<void>;

  deleteRule(id: string): Promise<void>;
}

// ─── DI-токен ──────────────────────────────────────────────────────────────────
/**
 * Отслеживание решений. Провайдер — ядро.
 * Реализацию подставляет composition root (`InnercoopBridgeModule`).
 */
export const DECISION_TRACKING_PORT = Symbol.for('Innercoop.CorePort.DecisionTracking');
