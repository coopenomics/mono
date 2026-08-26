import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import {
  SUPPORT_TICKET_REPOSITORY,
  type SupportTicketFilter,
  type SupportTicketRepository,
} from '../../domain/repositories/support-ticket.repository';
import {
  SUPPORT_TICKET_MESSAGE_REPOSITORY,
  type SupportTicketMessageRepository,
} from '../../domain/repositories/support-ticket-message.repository';
import {
  SUPPORT_TICKET_ATTACHMENT_REPOSITORY,
  type SupportTicketAttachmentRepository,
} from '../../domain/repositories/support-ticket-attachment.repository';
import {
  SUPPORT_TICKET_PARTICIPANT_REPOSITORY,
  type SupportTicketParticipantRepository,
} from '../../domain/repositories/support-ticket-participant.repository';
import type { SupportTicketDomainEntity } from '../../domain/entities/support-ticket.entity';
import { TICKET_NOT_FOUND_MESSAGE, isCouncilRole } from '../../constants/support-access';
import { SupportAttachmentsService } from './support-attachments.service';
import { SupportVisibilityService, type SupportTicketAggregates } from './support-visibility.service';
import type { SupportActor } from './support-actor';
import type {
  SupportAttachmentWithUrlView,
  SupportQueueSummaryView,
  SupportTicketCardView,
  SupportTicketListItemView,
  SupportTicketMessageView,
} from './support-queries.types';
import type { SupportTicketsFilterInputDTO } from '../dto/support-tickets-filter.input';
import type { SupportMemberTicketsFilterInputDTO } from '../dto/support-member-tickets-filter.input';

/**
 * Шесть операций чтения стола поддержки.
 *
 * Что здесь есть и чего нет:
 *
 * - **Кооператив не принимается аргументом ни одной операцией** — как и в
 *   командах. Область видимости задаёт сервер: база у каждого кооператива своя.
 * - **Актор передаётся явным параметром**, из глобального контекста запроса
 *   личность не берётся: прикладной сервис не должен знать, что вызов вообще
 *   пришёл по HTTP.
 * - **Ни одна доменная сущность наружу не выходит.** Всё, что возвращается,
 *   собрано {@link SupportVisibilityService}. После отмены обезличивания
 *   (25.08.2026) он решает одно: показывать ли детали системного события — и
 *   тем закрывает текст причины эскалации, оставшийся внутренним для совета.
 *
 * Проверка доступа. Пайщику доступно только его собственное обращение, и отказ
 * выглядит как «не найдено» — тем же ответом, что и у несуществующего
 * идентификатора. Разница ответов сама по себе сообщила бы, что обращение
 * существует, а обращения пайщиков закрыты друг от друга вместе с фактом
 * существования.
 */
@Injectable()
export class SupportQueriesService {
  constructor(
    @Inject(SUPPORT_TICKET_REPOSITORY) private readonly tickets: SupportTicketRepository,
    @Inject(SUPPORT_TICKET_MESSAGE_REPOSITORY) private readonly messages: SupportTicketMessageRepository,
    @Inject(SUPPORT_TICKET_ATTACHMENT_REPOSITORY)
    private readonly attachments: SupportTicketAttachmentRepository,
    @Inject(SUPPORT_TICKET_PARTICIPANT_REPOSITORY)
    private readonly participants: SupportTicketParticipantRepository,
    private readonly attachmentFiles: SupportAttachmentsService,
    private readonly visibility: SupportVisibilityService
  ) {}

  // ── Списки ──────────────────────────────────────────────────────────

  /** Очередь совета: все обращения кооператива с составным фильтром. */
  async supportTicketsByCooperative(
    filter: SupportTicketsFilterInputDTO | undefined,
    options: PaginationInputDTO | undefined,
    actor: SupportActor
  ): Promise<PaginationResult<SupportTicketListItemView>> {
    this.assertCouncil(actor, 'Очередь обращений доступна только совету кооператива.');

    const page = await this.tickets.findByFilter(this.toRepositoryFilter(filter), options);
    return this.toListPage(page);
  }

  /**
   * «Мои обращения».
   *
   * Имя пайщика аргументом не принимается: автором подставляется актор.
   * Совет смотрит чужие обращения через очередь с фильтром по автору — один
   * способ вместо двух, и подделать нечем.
   */
  async supportTicketsByMember(
    filter: SupportMemberTicketsFilterInputDTO | undefined,
    options: PaginationInputDTO | undefined,
    actor: SupportActor
  ): Promise<PaginationResult<SupportTicketListItemView>> {
    const page = await this.tickets.findByAuthorFilter(
      actor.username,
      { statuses: filter?.statuses, kind: filter?.kind },
      options
    );
    return this.toListPage(page);
  }

  // ── Карточка и лента ────────────────────────────────────────────────

  async supportTicket(ticketId: string, actor: SupportActor): Promise<SupportTicketCardView> {
    const ticket = await this.requireTicketAccess(ticketId, actor);
    const [aggregates] = await this.loadAggregates([ticket]);
    return this.visibility.card(ticket, aggregates);
  }

  async supportTicketMessages(
    ticketId: string,
    options: PaginationInputDTO | undefined,
    actor: SupportActor
  ): Promise<PaginationResult<SupportTicketMessageView>> {
    await this.requireTicketAccess(ticketId, actor);

    const page = await this.messages.findByTicketId(ticketId, options);

    // Вложения всей страницы одним запросом: вызов на каждую запись превратил
    // бы ленту из двадцати сообщений в двадцать запросов.
    const attachmentsByMessage = await this.attachments.findByMessageIds(
      page.items.map((message) => message.id)
    );

    const items = page.items.map((message) =>
      this.visibility.message(message, attachmentsByMessage.get(message.id) ?? [], actor)
    );

    return { ...page, items };
  }

  // ── Вложение ────────────────────────────────────────────────────────

  /**
   * Запись о файле вместе с короткоживущей ссылкой.
   *
   * Права проверяются через обращение, которому файл принадлежит, — до того,
   * как ссылка будет выдана: получив её, скачать сможет любой держатель.
   */
  async supportTicketAttachment(
    attachmentId: string,
    actor: SupportActor
  ): Promise<SupportAttachmentWithUrlView> {
    const attachment = await this.attachments.findById(attachmentId);
    if (!attachment) {
      // Тот же ответ, что и у чужого файла ниже: существование чужого вложения
      // — такая же закрытая величина, как существование чужого обращения.
      throw new NotFoundException('Вложение не найдено.');
    }

    const ticket = await this.tickets.findById(attachment.ticketId);
    if (!ticket || !this.canReadTicket(ticket, actor)) {
      throw new NotFoundException('Вложение не найдено.');
    }

    const view = this.visibility.attachment(attachment);
    return { ...view, url: await this.attachmentFiles.getReadUrl(attachment.storageKey) };
  }

  // ── Счётчики ────────────────────────────────────────────────────────

  async supportTicketQueueSummary(actor: SupportActor): Promise<SupportQueueSummaryView> {
    this.assertCouncil(actor, 'Счётчики очереди доступны только совету кооператива.');
    return this.tickets.countByStatus();
  }

  // ── Общее ───────────────────────────────────────────────────────────

  private assertCouncil(actor: SupportActor, message: string): void {
    if (!isCouncilRole(actor.role)) throw new ForbiddenException(message);
  }

  /**
   * Может ли актор читать это обращение.
   *
   * Совету доступно любое обращение кооператива, пайщику — только своё.
   */
  private canReadTicket(ticket: SupportTicketDomainEntity, actor: SupportActor): boolean {
    return isCouncilRole(actor.role) || ticket.authorUsername === actor.username;
  }

  private async requireTicketAccess(
    ticketId: string,
    actor: SupportActor
  ): Promise<SupportTicketDomainEntity> {
    const ticket = await this.tickets.findById(ticketId);
    // Отсутствие и недоступность отвечают одинаково намеренно: иначе перебор
    // идентификаторов выдал бы список существующих чужих обращений.
    if (!ticket || !this.canReadTicket(ticket, actor)) {
      throw new NotFoundException(TICKET_NOT_FOUND_MESSAGE);
    }
    return ticket;
  }

  private toRepositoryFilter(filter: SupportTicketsFilterInputDTO | undefined): SupportTicketFilter {
    return {
      statuses: filter?.statuses,
      kind: filter?.kind,
      priority: filter?.priority,
      assigneeUsername: filter?.assignee_username,
      escalated: filter?.escalated,
      authorUsername: filter?.author_username,
      participantUsername: filter?.participant_username,
      subjectContains: filter?.subject_contains,
    };
  }

  private async toListPage(
    page: PaginationResult<SupportTicketDomainEntity>
  ): Promise<PaginationResult<SupportTicketListItemView>> {
    const aggregates = await this.loadAggregates(page.items);
    return {
      ...page,
      items: page.items.map((ticket, index) => this.visibility.listItem(ticket, aggregates[index])),
    };
  }

  /**
   * Агрегаты строки списка — тремя запросами на всю страницу, а не по строке.
   *
   * Участники добавились третьим запросом тем же приёмом, что и два первых:
   * ответная сторона показывается в каждой строке, поэтому список участников
   * нужен всем строкам сразу, а не запросом на строку.
   *
   * Порядок ответа совпадает с порядком переданных обращений: вызывающий
   * берёт агрегат по тому же индексу.
   */
  private async loadAggregates(
    tickets: SupportTicketDomainEntity[]
  ): Promise<SupportTicketAggregates[]> {
    const ids = tickets.map((ticket) => ticket.id);
    const [counts, withAttachments, participants] = await Promise.all([
      this.messages.countByTicketIds(ids),
      this.attachments.findTicketIdsWithAttachments(ids),
      this.participants.findUsernamesByTicketIds(ids),
    ]);

    return tickets.map((ticket) => ({
      // Обращения без записей в ответе группировки отсутствуют — здесь ноль.
      messageCount: counts.get(ticket.id) ?? 0,
      hasAttachments: withAttachments.has(ticket.id),
      // Обращения без участников в ответе тоже отсутствуют — здесь пусто.
      participants: participants.get(ticket.id) ?? [],
    }));
  }
}
