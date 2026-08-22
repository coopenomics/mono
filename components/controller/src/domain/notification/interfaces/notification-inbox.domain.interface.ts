/**
 * Доменный тип личного инбокса Центра уведомлений (DC v3).
 *
 * `notification_inbox` — in-app уведомления получателя: одна строка = одно
 * показанное в приложении уведомление. Канал «In-app» (см. `InAppChannelPort`)
 * персистит сюда отрендеренный из каталога текст; read-side (`getNotifications`,
 * `unreadCount`, отметка «прочитано», live-подписка) — резолверы инбокса (эпик 6).
 */

/** Доменное представление строки инбокса. */
export interface NotificationInboxDomainInterface {
  id: string;
  /** Кооператив-владелец (federation-инвариант: каждый коп — свой инбокс). */
  coopname: string;
  /** Outbox-строка, из которой создано (трассировка к попытке доставки). */
  outboxId: string;
  /** Immutable subscriber_id получателя (адресация инбокса). */
  recipientSubscriberId: string;
  /** Имя аккаунта получателя (фильтр выборки инбокса по сессии). */
  recipientUsername?: string;
  /** Тип уведомления — `Workflows.<Type>.id` из `@coopenomics/notifications`. */
  workflowId: string;
  /** Заголовок (отрендерен из шаблона in-app step каталога). */
  title: string;
  /** Тело (отрендерено из шаблона in-app step каталога). */
  body: string;
  /** Исходные данные уведомления (для deep-link / доп-рендера на фронте). */
  payload?: Record<string, unknown>;
  /** Инициатор уведомления (для «от кого»). */
  actorSubscriberId?: string;
  /** Прочитано получателем. */
  isRead: boolean;
  /** Когда отмечено прочитанным. */
  readAt?: Date;
  createdAt: Date;
}
