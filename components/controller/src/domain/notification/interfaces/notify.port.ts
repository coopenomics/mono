import type { NotifyInput, NotifyResult } from './notify-input.domain.interface';

/**
 * Единый порт Центра уведомлений.
 *
 * Domain-сервис триггерит уведомление через `notify(input)` — без знания о
 * каналах и провайдерах. Реализация в той же транзакции вызывающего сервиса
 * пишет строки в `notification_outbox` (транзакционный outbox), фактическую
 * отправку по каналам выполняет фоновый worker.
 *
 * Единственный порт постановки уведомлений в очередь доставки.
 * завершения миграции consumer-сервисов (эпик 4) и удаляется в эпике 5.
 */
export interface NotificationPort {
  /**
   * Поставить уведомление в очередь доставки.
   * Идемпотентно по `idempotency_key` (вычисляется из типа + получателя + события):
   * повторный вызов с теми же данными — no-op.
   */
  notify(input: NotifyInput): Promise<NotifyResult>;
}

/** DI-токен единого порта уведомлений. */
export const NOTIFICATION_PORT = Symbol('NotificationPort');
