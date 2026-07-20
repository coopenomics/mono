/**
 * Доменные типы транзакционного outbox Центра уведомлений (DC v3).
 *
 * `notification_outbox` — очередь на доставку: одна строка = намерение доставить
 * один тип уведомления одному получателю по одному каналу. Пишется в той же
 * транзакции вызывающего domain-сервиса (см. {@link NotificationPort}); если
 * транзакция откатилась — строки нет, уведомление не «повисает».
 *
 * `notification_deliveries` — журнал фактических попыток отправки и их исходов:
 * источник для «стола председателя» (кто/что/когда получил) и кнопки «переотправить».
 */

import type { NotificationChannel } from './notify-input.domain.interface';

/** Статус строки outbox. Жизненный цикл: PENDING → SENDING → SENT | FAILED (| CANCELED). */
export enum NotificationOutboxStatus {
  /** Ждёт обработки worker'ом (scheduled_at ≤ now). */
  PENDING = 'pending',
  /** Захвачена worker'ом, идёт отправка (защита от двойной обработки). */
  SENDING = 'sending',
  /** Доставлена провайдеру канала успешно. */
  SENT = 'sent',
  /** Исчерпаны попытки — финальный провал (виден на столе председателя для переотправки). */
  FAILED = 'failed',
  /** Отменена до отправки (напр. получатель отписался). */
  CANCELED = 'canceled',
}

/** Исход одной попытки доставки (строка журнала). */
export enum NotificationDeliveryStatus {
  /** Канал принял сообщение (SMTP accept / push 201 / in-app persisted). */
  SENT = 'sent',
  /** Попытка не удалась (будет ретрай, если попытки не исчерпаны). */
  FAILED = 'failed',
}

/** Доменное представление строки outbox. */
export interface NotificationOutboxDomainInterface {
  id: string;
  /** Кооператив-владелец (federation-инвариант: доставляет себе сам). */
  coopname: string;
  /** Тип уведомления — `Workflows.<Type>.id` из `@coopenomics/notifications`. */
  workflowId: string;
  /** Канал доставки этой строки. */
  channel: NotificationChannel;
  /** Immutable subscriber_id получателя. */
  recipientSubscriberId: string;
  /** Email получателя на момент постановки (gate email-канала). */
  recipientEmail?: string;
  /** Имя аккаунта получателя (адресация in-app / журнал). */
  recipientUsername?: string;
  /** Данные для подстановки в шаблон. */
  payload?: Record<string, unknown>;
  /** Инициатор уведомления (для «от кого»). */
  actorSubscriberId?: string;
  /**
   * Ключ идемпотентности = sha256(coopname + workflowId + recipientSubscriberId +
   * channel + payload-hash). Повторный notify() с тем же ключом — no-op. Канал
   * входит в ключ: одна строка на канал, иначе unique-индекс ловит коллизию.
   */
  idempotencyKey: string;
  status: NotificationOutboxStatus;
  /** Сделано попыток отправки. */
  attempts: number;
  /** Лимит попыток до перевода в FAILED. */
  maxAttempts: number;
  /** Когда строка снова доступна worker'у (база backoff-ретраев). */
  scheduledAt: Date;
  /** Текст последней ошибки (диагностика). */
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Доменное представление строки журнала доставок. */
export interface NotificationDeliveryDomainInterface {
  id: string;
  /** Outbox-строка, к которой относится попытка. */
  outboxId: string;
  /** Денормализовано для индексов журнала (стол председателя). */
  coopname: string;
  channel: NotificationChannel;
  recipientSubscriberId: string;
  workflowId: string;
  /** Номер попытки (1-based). */
  attemptNumber: number;
  status: NotificationDeliveryStatus;
  /** Ответ провайдера: message-id / push-status / error-body. */
  providerResponse?: string;
  /** Текст ошибки при FAILED. */
  error?: string;
  createdAt: Date;
}
