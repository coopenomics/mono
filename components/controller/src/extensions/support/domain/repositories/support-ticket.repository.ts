import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import { SupportTicketDomainEntity } from '../entities/support-ticket.entity';
import { SupportTicketMessageDomainEntity } from '../entities/support-ticket-message.entity';
import { SupportTicketAttachmentDomainEntity } from '../entities/support-ticket-attachment.entity';
import { SupportTicketParticipantDomainEntity } from '../entities/support-ticket-participant.entity';
import type { SupportParticipantDraft } from './support-ticket-participant.repository';
import { SupportTicketStatus } from '../enums/support-ticket-status.enum';
import { SupportTicketKind } from '../enums/support-ticket-kind.enum';
import { SupportTicketPriority } from '../enums/support-ticket-priority.enum';

/** Вложение, готовое к записи: тело уже лежит в хранилище, здесь только метаданные. */
export type SupportAttachmentDraft = Omit<
  SupportTicketAttachmentDomainEntity,
  'id' | 'ticketId' | 'messageId' | 'uploadedAt'
>;

/** Запись ленты вместе со своими вложениями — единица атомарной дописи. */
export interface SupportLedgerEntryDraft {
  message: Omit<SupportTicketMessageDomainEntity, 'id' | 'ticketId' | 'createdAt'>;
  attachments: SupportAttachmentDraft[];
}

/**
 * Поля обращения, которые команда вправе изменить.
 *
 * `lastMessageAt` входит сюда намеренно: связка «дописали ленту — сдвинули
 * время последнего сообщения» лежит на сервисном слое, и он передаёт значение
 * явно. Репозиторий его не выводит и не подставляет.
 */
export type SupportTicketChanges = Partial<
  Omit<SupportTicketDomainEntity, 'id' | 'number' | 'coopname' | 'authorUsername' | 'createdAt'>
>;

/**
 * Фильтр очереди совета. Все поля необязательны, пустой фильтр даёт всё.
 *
 * Статусы — набор, а не одно значение: закладка «активные» это `NEW` и
 * `IN_PROGRESS` вместе (спецификация, раздел 2).
 */
export interface SupportTicketFilter {
  statuses?: SupportTicketStatus[];
  kind?: SupportTicketKind;
  priority?: SupportTicketPriority;
  assigneeUsername?: string;
  /** `true` — только эскалированные, `false` — только неэскалированные. */
  escalated?: boolean;
  authorUsername?: string;
  /**
   * Член совета, подключённый к обращению участником.
   *
   * Ответственный сюда не попадает: он в своей колонке, и отбирают его полем
   * `assigneeUsername`. Экран «где я участвую» — это очередь с этим полем,
   * заполненным своим именем; отдельного запроса под него нет.
   */
  participantUsername?: string;
  /** Подстрока темы без учёта регистра. Полнотекстового поиска по переписке нет. */
  subjectContains?: string;
}

/** Фильтр «моих обращений» — беднее: приоритет и оператор пайщику как фильтр не нужны. */
export type SupportMemberTicketFilter = Pick<SupportTicketFilter, 'statuses' | 'kind'>;

export interface SupportTicketRepository {
  create(
    data: Omit<SupportTicketDomainEntity, 'id' | 'number' | 'createdAt' | 'updatedAt'>
  ): Promise<SupportTicketDomainEntity>;

  findById(id: string): Promise<SupportTicketDomainEntity | null>;

  findByNumber(number: string): Promise<SupportTicketDomainEntity | null>;

  /** Очередь оператора: обращения выбранных статусов, свежие сверху — индекс (status, last_message_at). */
  findByStatuses(
    statuses: SupportTicketStatus[],
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>>;

  /** «Мои обращения» у пайщика — индекс (author_username, created_at). */
  findByAuthor(
    authorUsername: string,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>>;

  /** «Взятые мной» у оператора — индекс (assignee_username, status). */
  findByAssignee(
    assigneeUsername: string,
    statuses?: SupportTicketStatus[],
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>>;

  /** Фильтр по виду обращения — индекс (kind, status). */
  findByKind(
    kind: SupportTicketKind,
    statuses?: SupportTicketStatus[],
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>>;

  /** Обращения в статусе RESOLVED с resolved_at не позже cutoff — под задачу автозакрытия, частичный индекс (resolved_at). */
  findResolvedBefore(cutoff: Date): Promise<SupportTicketDomainEntity[]>;

  /** Эскалированные обращения — частичный индекс (escalated_at). */
  findEscalated(options?: PaginationInputDTO): Promise<PaginationResult<SupportTicketDomainEntity>>;

  /** Очередь совета: составной фильтр по всем полям сразу. */
  findByFilter(
    filter: SupportTicketFilter,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>>;

  /**
   * «Мои обращения»: автор задаётся отдельным параметром, а не полем фильтра.
   *
   * Так его нечем подделать — вызывающий подставляет туда текущего пайщика, и
   * структурно нет места, куда клиент мог бы передать чужое имя.
   */
  findByAuthorFilter(
    authorUsername: string,
    filter: SupportMemberTicketFilter,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>>;

  /** Счётчики очереди: сколько обращений в каждом статусе. Ноли присутствуют. */
  countByStatus(): Promise<Record<SupportTicketStatus, number>>;

  update(id: string, changes: SupportTicketChanges): Promise<SupportTicketDomainEntity>;

  // ── Атомарные записи ────────────────────────────────────────────────
  //
  // Прикладной границы транзакции в контроллере нет: ни декоратора, ни единицы
  // работы, ни менеджера в контейнере. Единственный существующий приём —
  // `manager.transaction` внутри инфраструктурного адаптера, где вся операция
  // упакована в один метод репозитория (образец: marketplace-inventory).
  //
  // Поэтому граница транзакции живёт здесь, а решения — в сервисе. Методы
  // ниже намеренно тупые: внутри нет ни одного условия про статусы, роли и
  // допустимость переходов. Сервис вычисляет, ЧТО записать; репозиторий
  // записывает это атомарно и не знает, почему.

  /**
   * Одной транзакцией: обращение, первая запись его ленты и её вложения.
   *
   * Первый текст обращения — это первое сообщение, отдельной колонки под него
   * нет (модель, раздел 11), поэтому обращение без записи ленты не создаётся
   * вовсе и раздельного метода создания для команд не предусмотрено.
   */
  createWithFirstMessage(
    ticket: Omit<SupportTicketDomainEntity, 'id' | 'number' | 'createdAt' | 'updatedAt'>,
    firstMessage: SupportLedgerEntryDraft
  ): Promise<{
    ticket: SupportTicketDomainEntity;
    message: SupportTicketMessageDomainEntity;
    attachments: SupportTicketAttachmentDomainEntity[];
  }>;

  /**
   * Одной транзакцией: N записей ленты со своими вложениями и частичное
   * обновление обращения.
   *
   * Двух записей требует решение с комментарием — сообщение оператора и
   * системная запись о решении идут вместе, одним действием человека
   * (спецификация, раздел 3). Пустой список записей допустим: смена
   * приоритета меняет только обращение.
   *
   * `participants` — подключения, которые обязаны попасть в ту же транзакцию.
   * Такое нужно ровно эскалации: она одним действием ставит отметку, пишет
   * системную запись и подключает председателя, и разъехаться эти три вещи не
   * должны. Уже существующие подключения пропускаются молча, в ответ идут
   * только фактически созданные — по ним команда решает, кого уведомлять.
   */
  appendAndUpdate(
    ticketId: string,
    messages: SupportLedgerEntryDraft[],
    changes: SupportTicketChanges,
    participants?: SupportParticipantDraft[]
  ): Promise<{
    ticket: SupportTicketDomainEntity;
    messages: SupportTicketMessageDomainEntity[];
    participants: SupportTicketParticipantDomainEntity[];
  }>;

  /**
   * Одной транзакцией и одним условным обновлением: закрыть обращение, если
   * оно всё ещё в статусе `RESOLVED` и отсчёт не сдвинулся позже `cutoff`, и
   * дописать системную запись о закрытии.
   *
   * Возвращает `null`, если под условие не подошла ни одна строка: автор
   * успел написать и вернуть обращение в работу. Гонка «таймер против
   * сообщения автора» гасится этим сама, и повторный тик безопасен — второй
   * раз условие уже не выполнится (спецификация, раздел 8).
   */
  closeIfStillResolved(
    ticketId: string,
    cutoff: Date,
    systemMessage: SupportLedgerEntryDraft
  ): Promise<{
    ticket: SupportTicketDomainEntity;
    message: SupportTicketMessageDomainEntity;
  } | null>;
}

export const SUPPORT_TICKET_REPOSITORY = Symbol('SupportTicketRepository');
