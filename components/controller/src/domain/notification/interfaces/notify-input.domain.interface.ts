/**
 * Доменные типы единого входа уведомлений (Центр уведомлений DC v3).
 *
 * Заменяет `WorkflowTriggerDomainInterface`: domain-сервис
 * описывает ЧТО и КОМУ отправить, не зная про каналы и провайдеров. Маршрутизацию
 * по каналам и доставку выполняет реализация {@link NotificationPort}.
 */

/**
 * Канал доставки. На MVP активны три; webhook/sms/matrix зарезервированы под v4
 * (federation) и в этот union не входят, пока не реализованы.
 */
export enum NotificationChannel {
  EMAIL = 'email',
  IN_APP = 'in_app',
  PUSH = 'push',
}

/** Получатель уведомления. */
export interface NotifyRecipient {
  /**
   * Идентификатор подписчика — immutable `subscriber_id` из онбординга
   * (`AccountDomainService.generateSubscriberId()`). Стабилен между перезапусками.
   */
  subscriberId: string;
  /** Email получателя (если подтверждён) — gate для email-канала. */
  email?: string;
  /** Имя аккаунта в кооперативе (для in-app адресации и журнала). */
  username?: string;
}

/** Кто инициировал уведомление (для отображения «от кого»). */
export interface NotifyActor {
  subscriberId: string;
  email?: string;
}

/** Единый вход уведомления. */
export interface NotifyInput {
  /**
   * Кооператив-владелец уведомления. Обязателен: federation-readiness инвариант —
   * каждый кооператив доставляет своим подписчикам сам, точка доставки локальна.
   */
  coopname: string;
  /**
   * Тип уведомления — `Workflows.<Type>.id` из пакета `@coopenomics/notifications`.
   * Каталог типов хранит каналы (`steps[].type`) и шаблоны (`controlValues`).
   */
  workflowId: string;
  /** Один получатель или массив (broadcast по участникам кооператива). */
  to: NotifyRecipient | NotifyRecipient[];
  /** Данные для подстановки в шаблон; валидируются Zod-схемой типа из каталога. */
  payload?: Record<string, unknown>;
  /** Инициатор уведомления (опционально). */
  actor?: NotifyActor;
}

/** Итог постановки одного уведомления в очередь доставки (outbox). */
export interface NotifyResult {
  /** Принято к доставке (записаны outbox-строки). */
  acknowledged: boolean;
  /** Идентификаторы созданных outbox-строк (по получателям × каналам). */
  outboxIds: string[];
}
