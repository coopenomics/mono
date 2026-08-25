import type { SupportTicketKind } from '../../domain/enums/support-ticket-kind.enum';
import type { SupportTicketPriority } from '../../domain/enums/support-ticket-priority.enum';
import type { SupportTicketStatus } from '../../domain/enums/support-ticket-status.enum';
import type { SupportResponsibilityZone } from '../../domain/enums/support-responsibility-zone.enum';
import type { SupportMessageAuthorRole } from '../../domain/enums/support-message-author-role.enum';
import type { SupportSystemEvent } from '../../domain/enums/support-system-event.enum';

/**
 * Виды ответа слоя чтений.
 *
 * Это НЕ доменные сущности и НЕ DTO GraphQL. Доменная сущность знает всё, DTO
 * появится своей фазой; здесь — то, что уже готово к выдаче наружу.
 *
 * Разделение осталось и после отмены обезличивания (25.08.2026): вид отличается
 * от сущности набором полей — в нём нет ключа объекта в хранилище, контрольной
 * суммы и внутренних деталей события, зато есть расчётные величины и агрегаты,
 * которых в сущности нет.
 */

/** Строка списка обращений. */
export interface SupportTicketListItemView {
  id: string;
  number: string;
  kind: SupportTicketKind;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  subject: string;
  authorUsername: string;
  /**
   * Ответная сторона обращения — **список**, а не одно имя.
   *
   * Сегодня в нём не больше одного члена совета (колонка исполнителя), но
   * список он с самого начала: решением председателя от 20.08.2026 к обращению
   * можно будет подключать нескольких, и тогда изменится только наполнение, а
   * не форма поля.
   *
   * Видна обеим сторонам: обезличивание ответной стороны отменено 25.08.2026.
   */
  councilSide: string[];
  /** Признак эскалации. Виден обеим сторонам. */
  escalated: boolean;
  reopenCount: number;
  lastMessageAt: Date;
  createdAt: Date;
  /** Число записей ленты — агрегат, считается батчем на страницу. */
  messageCount: number;
  /** Есть ли у обращения хоть одно вложение — агрегат, тоже батчем. */
  hasAttachments: boolean;
}

/** Карточка обращения: всё из строки списка плюс четыре поля. */
export interface SupportTicketCardView extends SupportTicketListItemView {
  /** Момент пометки «решено» — начало отсчёта автозакрытия. */
  resolvedAt: Date | null;
  /**
   * Расчётный момент автозакрытия: отсчёт плюс порог.
   *
   * Вычисляется, не хранится. Порог берётся из того же источника, что у
   * фоновой задачи, — иначе показанное время разошлось бы с тем, когда
   * обращение закроется на самом деле.
   */
  autoCloseAt: Date | null;
  /** Момент эскалации. Виден обеим сторонам. */
  escalatedAt: Date | null;
  responsibilityZone: SupportResponsibilityZone;
}

/** Вложение в ленте: без ссылки — она живёт минуты и выдаётся отдельным запросом. */
export interface SupportAttachmentView {
  id: string;
  originalFilename: string | null;
  mimeType: string;
  sizeBytes: number;
  /** Кто загрузил. Видно обеим сторонам: обезличивание отменено 25.08.2026. */
  uploadedByUsername: string;
  uploadedAt: Date;
}

/** То же вложение плюс короткоживущая ссылка — ответ отдельного запроса. */
export interface SupportAttachmentWithUrlView extends SupportAttachmentView {
  url: string;
}

/** Запись ленты переписки. */
export interface SupportTicketMessageView {
  id: string;
  /** Автор записи. Пуст только у действий самой системы — например, у автозакрытия. */
  authorUsername: string | null;
  /** Роль автора снимком. */
  authorRole: SupportMessageAuthorRole;
  /** Текст человеческого сообщения. У системных записей пуст: формулировку собирает интерфейс. */
  body: string | null;
  systemEvent: SupportSystemEvent | null;
  /**
   * Детали системного события. Автору обращения приходят просеянными: наружу
   * не идёт текст причины эскалации — единственное, что осталось внутренним.
   */
  payload: Record<string, unknown> | null;
  createdAt: Date;
  attachments: SupportAttachmentView[];
}

/** Счётчики закладок очереди оператора. */
export type SupportQueueSummaryView = Record<SupportTicketStatus, number>;

/** Фильтр очереди, как его принимает слой чтений. */
export interface SupportTicketsFilterInput {
  statuses?: SupportTicketStatus[];
  kind?: SupportTicketKind;
  priority?: SupportTicketPriority;
  assignee_username?: string;
  escalated?: boolean;
  author_username?: string;
  /** Подстрока темы без учёта регистра. */
  subject_contains?: string;
}

/**
 * Фильтр «моих обращений».
 *
 * Имени пайщика здесь нет и быть не должно: автор подставляется из актора.
 * Совет смотрит чужие обращения через очередь с фильтром по автору — один
 * способ вместо двух, и подделать нечем (спецификация, раздел 2).
 */
export interface SupportMemberTicketsFilterInput {
  statuses?: SupportTicketStatus[];
  kind?: SupportTicketKind;
}
