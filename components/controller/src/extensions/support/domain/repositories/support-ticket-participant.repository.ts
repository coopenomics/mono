import { SupportTicketParticipantDomainEntity } from '../entities/support-ticket-participant.entity';

/** Подключение, готовое к записи. Момент подключения проставляет база. */
export type SupportParticipantDraft = Omit<
  SupportTicketParticipantDomainEntity,
  'id' | 'ticketId' | 'addedAt'
>;

export interface SupportTicketParticipantRepository {
  /**
   * Подключает участника, если он ещё не подключён.
   *
   * Возвращает `null`, когда подключение уже есть: повтор — молчаливое
   * «ничего не делаем», как и все прочие повторы стола. Развилка живёт здесь,
   * а не в сервисе, чтобы между проверкой и вставкой не оставалось окна, в
   * которое пролезает второй одновременный запрос: уникальность пары
   * (обращение, участник) стоит в схеме, и гонку разрешает она.
   */
  addIfAbsent(
    ticketId: string,
    draft: SupportParticipantDraft
  ): Promise<SupportTicketParticipantDomainEntity | null>;

  /**
   * Отключает участника. `false`, если он и не был подключён.
   *
   * Запись удаляется физически, а не помечается отключённой. Это осознанно:
   * повторное подключение обязано дать новую запись с новым идентификатором,
   * иначе второе уведомление о подключении будет молча погашено как повтор
   * первого — различитель в ключе подавления повторов берётся именно отсюда.
   */
  remove(ticketId: string, participantUsername: string): Promise<boolean>;

  /** Участники одного обращения. */
  findByTicketId(ticketId: string): Promise<SupportTicketParticipantDomainEntity[]>;

  /**
   * Участники сразу для страницы списка — индекс (ticket_id).
   *
   * Батчем, а не вызовом на строку: ответная сторона показывается в каждой
   * строке списка, и запрос на строку превратил бы страницу из двадцати
   * обращений в двадцать запросов. Тем же приёмом, что счётчик сообщений и
   * признак вложений. Обращения без участников в ответе отсутствуют.
   */
  findUsernamesByTicketIds(ticketIds: string[]): Promise<Map<string, string[]>>;

  /**
   * Обращения, где участвует этот человек, — индекс (participant_username).
   *
   * Отдаёт идентификаторы, а не обращения: отбор очереди по участнику
   * склеивается с остальным фильтром на стороне обращений.
   */
  findTicketIdsByParticipant(participantUsername: string): Promise<string[]>;
}

export const SUPPORT_TICKET_PARTICIPANT_REPOSITORY = Symbol('SupportTicketParticipantRepository');
