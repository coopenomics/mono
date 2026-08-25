/**
 * События стола поддержки для Центра уведомлений.
 *
 * Их ровно два — по числу согласованных уведомлений (спецификация, раздел 7).
 * Оба излучаются в прикладном сервисе ПОСЛЕ фиксации транзакции: не в
 * репозитории и не в резолвере. Из транзакции уведомления не отправляют
 * вообще, порядок всегда «запись в базу → событие → слушатель зовёт порт вне
 * транзакции».
 *
 * Именование — домен, сущность, адресат, событие (канон marketplace).
 *
 * Адресат в самом событии не вычисляется: событие — это факт домена, и он
 * произошёл независимо от того, кому о нём писать. Слушатель (отдельная фаза)
 * определяет получателя и гасит отправку, когда инициатор совпадает с автором
 * обращения: пайщик не должен получать письмо о собственном сообщении.
 *
 * Отметок текущего времени в составе нет намеренно: ключ подавления повторов
 * в очереди уведомлений считается в том числе от данных шаблона, и время
 * внутри payload'а превратило бы одно событие в два разных письма.
 */
import { SupportMessageAuthorRole } from '../../domain/enums/support-message-author-role.enum';
import { SupportTicketStatus } from '../../domain/enums/support-ticket-status.enum';

/** В обращение добавлено человеческое сообщение (системные записи событие не излучают). */
export const SUPPORT_TICKET_AUTHOR_REPLIED_EVENT = 'support.ticket.author.replied';

/** Статус обращения изменился на один из переходов, видимых пайщику. */
export const SUPPORT_TICKET_AUTHOR_STATUS_CHANGED_EVENT = 'support.ticket.author.statusChanged';

export interface SupportTicketAuthorRepliedEvent {
  coopname: string;
  ticket_id: string;
  /** Человеко-читаемый номер обращения — им уведомление называет обращение. */
  ticket_number: string;
  subject: string;
  /** Автор сообщения. Слушателю нужен, чтобы не написать пайщику о его же реплике. */
  author_username: string;
  /** Роль автора снимком: по ней слушатель решает, от чьего лица пришёл ответ. */
  author_role: SupportMessageAuthorRole;
}

export interface SupportTicketAuthorStatusChangedEvent {
  coopname: string;
  ticket_id: string;
  ticket_number: string;
  subject: string;
  previous_status: SupportTicketStatus;
  status: SupportTicketStatus;
  /**
   * Кто вызвал переход. У автозакрытия инициатора нет — поле пустое, и
   * уведомление в этом случае уходит всегда.
   */
  initiator_username: string | null;
}
