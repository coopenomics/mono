import type {
  NotificationDeliveryDomainInterface,
  NotificationOutboxDomainInterface,
  NotificationOutboxStatus,
} from '../interfaces/notification-outbox.domain.interface';
import type { NotificationInboxDomainInterface } from '../interfaces/notification-inbox.domain.interface';
import type { NotificationChannel } from '../interfaces/notify-input.domain.interface';

/** Новая строка очереди: ключ и даты ставит база. */
export type NotificationOutboxCreate = Omit<NotificationOutboxDomainInterface, 'id' | 'createdAt' | 'updatedAt' | 'lastError'>;

export interface NotificationOutboxFilter {
  coopname: string;
  workflowId?: string;
  channel?: NotificationChannel;
  status?: NotificationOutboxStatus;
  recipientSubscriberId?: string;
}

/** Очередь уведомлений (`notification_outbox`). */
export interface NotificationOutboxRepository {
  /** Вставка пачкой; строка с уже занятым ключом идемпотентности пропускается. Возвращает ключи вставленных. */
  insertIgnoringDuplicates(rows: NotificationOutboxCreate[]): Promise<string[]>;
  create(row: NotificationOutboxCreate): Promise<NotificationOutboxDomainInterface>;
  findById(id: string): Promise<NotificationOutboxDomainInterface | null>;
  /** К отправке: ожидающие со сроком не позже `now` и отправка, зависшая с `staleBefore`; по сроку, не больше `limit`. */
  findDue(now: Date, staleBefore: Date, limit: number): Promise<NotificationOutboxDomainInterface[]>;
  /** Журнал кооператива, новые сверху. */
  findPage(filter: NotificationOutboxFilter, page: number, limit: number): Promise<[NotificationOutboxDomainInterface[], number]>;
  /** Сохранить ход доставки: статус, счётчик попыток, срок, последняя ошибка. */
  saveProgress(row: NotificationOutboxDomainInterface): Promise<void>;
}

/** Журнал попыток доставки (`notification_deliveries`), только дополняется. */
export interface NotificationDeliveryRepository {
  append(row: Omit<NotificationDeliveryDomainInterface, 'id' | 'createdAt'>): Promise<void>;
  /** Попытки одной строки очереди, по времени. */
  findByOutboxId(outboxId: string): Promise<NotificationDeliveryDomainInterface[]>;
}

/** Личные входящие пайщика (`notification_inbox`). */
export interface NotificationInboxRepository {
  create(row: Omit<NotificationInboxDomainInterface, 'id' | 'createdAt' | 'isRead' | 'readAt'>): Promise<NotificationInboxDomainInterface>;
  /** Входящие получателя, новые сверху. */
  findPage(coopname: string, subscriberId: string, page: number, limit: number): Promise<[NotificationInboxDomainInterface[], number]>;
  countUnread(coopname: string, subscriberId: string): Promise<number>;
  findOwn(id: string, subscriberId: string): Promise<NotificationInboxDomainInterface | null>;
  markRead(id: string, readAt: Date): Promise<void>;
  /** Отметить все непрочитанные получателя; возвращает число затронутых строк. */
  markAllRead(coopname: string, subscriberId: string, readAt: Date): Promise<number>;
}

export const NOTIFICATION_OUTBOX_REPOSITORY = Symbol('NotificationOutboxRepository');
export const NOTIFICATION_DELIVERY_REPOSITORY = Symbol('NotificationDeliveryRepository');
export const NOTIFICATION_INBOX_REPOSITORY = Symbol('NotificationInboxRepository');
