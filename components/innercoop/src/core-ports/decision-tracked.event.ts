import type { DecisionProcessedResult } from './tracking-rule.contract';

/**
 * Решение отслежено и обработано: хэш совпал с правилом, параметры кооператива
 * обновлены.
 *
 * Класс, а не тип: `EventEmitter2` в ядре различает события по имени, а
 * подписчик получает экземпляр.
 */
export class DecisionTrackedEvent {
  static readonly eventName = 'decision.tracked';

  constructor(public readonly result: DecisionProcessedResult) {}
}
