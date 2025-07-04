export interface NotificationSubscriberData {
  subscriberId: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  locale?: string;
  timezone?: string;
  data?: Record<string, string>;
}

export interface NotificationPort {
  /**
   * Создает или обновляет подписчика в системе уведомлений
   * @param subscriber Данные подписчика
   */
  upsertSubscriber(subscriber: NotificationSubscriberData): Promise<void>;

  /**
   * Получает подписчика по ID
   * @param subscriberId ID подписчика
   */
  getSubscriber(subscriberId: string): Promise<NotificationSubscriberData | null>;

  /**
   * Удаляет подписчика
   * @param subscriberId ID подписчика
   */
  deleteSubscriber(subscriberId: string): Promise<void>;
}

export const NOTIFICATION_PORT = Symbol('NotificationPort');
