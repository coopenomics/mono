import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import {
  AuthRoles,
  CurrentUser,
  GqlJwtAuthGuard,
  PaginationInputDTO,
  RolesGuard,
  createPaginationResult,
  type PaginationResult,
} from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { SupportQueriesService } from '../services/support-queries.service';
import { toSupportActor } from '../services/support-commands.types';
import { SupportTicketsFilterInputDTO } from '../dto/support-tickets-filter.input';
import { SupportMemberTicketsFilterInputDTO } from '../dto/support-member-tickets-filter.input';
import {
  SupportTicketListItemOutputDTO,
  SupportTicketOutputDTO,
} from '../dto/support-ticket.output';
import { SupportTicketMessageOutputDTO } from '../dto/support-ticket-message.output';
import { SupportTicketAttachmentWithUrlOutputDTO } from '../dto/support-ticket-attachment.output';
import { SupportQueueSummaryOutputDTO } from '../dto/support-queue-summary.output';

const paginatedSupportTickets = createPaginationResult(
  SupportTicketListItemOutputDTO,
  'PaginatedSupportTickets'
);

const paginatedSupportTicketMessages = createPaginationResult(
  SupportTicketMessageOutputDTO,
  'PaginatedSupportTicketMessages'
);

/**
 * Чтение стола поддержки: шесть запросов.
 *
 * **Резолвер ничего не проверяет по данным.** Декоратор ролей отвечает на один
 * вопрос — доступен ли такой род данных этой роли вообще; всё остальное
 * («своё ли это обращение», «состоит ли пайщик в совете») уже проверено в слое
 * чтений. Вторая проверка здесь означала бы два места с одними правилами,
 * которые со временем разойдутся.
 *
 * **Кооператив аргументом не принимается ни одной операцией.** Область
 * видимости задаёт сервер: база у каждого кооператива своя, а имя кооператива
 * слой чтений берёт из настроек контура. Это осознанное отступление от
 * образца смет расходов, где `coopname` приходит от клиента (решение
 * председателя от 18.08.2026).
 *
 * Личность — из `@CurrentUser`, и в слой чтений уходит не она сама, а суженный
 * актор (`toSupportActor`). Учётная запись структурно совместима и прошла бы
 * целиком, но тогда объявленная узость актора осталась бы обещанием на словах:
 * почта, открытый ключ и состояние регистрации физически лежали бы внутри
 * прикладного слоя, и воспользовавшийся ими не нарушил бы ни одного типа.
 */
@Resolver()
export class SupportQueriesResolver {
  constructor(private readonly queries: SupportQueriesService) {}

  @Query(() => paginatedSupportTickets, {
    name: 'supportTicketsByCooperative',
    description: 'Очередь обращений кооператива. Тем же запросом с фильтром по автору смотрят историю общения с конкретным пайщиком.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async supportTicketsByCooperative(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('filter', { type: () => SupportTicketsFilterInputDTO, nullable: true })
    filter?: SupportTicketsFilterInputDTO,
    @Args('options', { type: () => PaginationInputDTO, nullable: true })
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketListItemOutputDTO>> {
    const page = await this.queries.supportTicketsByCooperative(filter, options, toSupportActor(currentUser));
    return { ...page, items: page.items.map(SupportTicketListItemOutputDTO.fromView) };
  }

  @Query(() => paginatedSupportTickets, {
    name: 'supportTicketsByMember',
    description: 'Обращения текущего пайщика. Имя пайщика аргументом не принимается — список всегда свой.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async supportTicketsByMember(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('filter', { type: () => SupportMemberTicketsFilterInputDTO, nullable: true })
    filter?: SupportMemberTicketsFilterInputDTO,
    @Args('options', { type: () => PaginationInputDTO, nullable: true })
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketListItemOutputDTO>> {
    const page = await this.queries.supportTicketsByMember(filter, options, toSupportActor(currentUser));
    return { ...page, items: page.items.map(SupportTicketListItemOutputDTO.fromView) };
  }

  @Query(() => SupportTicketOutputDTO, {
    name: 'supportTicket',
    description: 'Карточка обращения. Пайщику доступно только его собственное обращение.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async supportTicket(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('id', { type: () => String }) id: string
  ): Promise<SupportTicketOutputDTO> {
    const view = await this.queries.supportTicket(id, toSupportActor(currentUser));
    return SupportTicketOutputDTO.fromCardView(view);
  }

  @Query(() => paginatedSupportTicketMessages, {
    name: 'supportTicketMessages',
    description: 'Переписка обращения от старых записей к новым. Отдельный запрос, а не поле карточки: переписка растёт неограниченно.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async supportTicketMessages(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('ticket_id', { type: () => String }) ticketId: string,
    @Args('options', { type: () => PaginationInputDTO, nullable: true })
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketMessageOutputDTO>> {
    const page = await this.queries.supportTicketMessages(ticketId, options, toSupportActor(currentUser));
    return { ...page, items: page.items.map(SupportTicketMessageOutputDTO.fromView) };
  }

  @Query(() => SupportTicketAttachmentWithUrlOutputDTO, {
    name: 'supportTicketAttachment',
    description: 'Файл обращения вместе со ссылкой на скачивание. Ссылка действует ограниченное время, поэтому запрашивается перед самым открытием файла.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async supportTicketAttachment(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('id', { type: () => String }) id: string
  ): Promise<SupportTicketAttachmentWithUrlOutputDTO> {
    const view = await this.queries.supportTicketAttachment(id, toSupportActor(currentUser));
    return SupportTicketAttachmentWithUrlOutputDTO.fromUrlView(view);
  }

  @Query(() => SupportQueueSummaryOutputDTO, {
    name: 'supportTicketQueueSummary',
    description: 'Сколько обращений в каждом статусе — числа на закладках очереди совета.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async supportTicketQueueSummary(
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<SupportQueueSummaryOutputDTO> {
    const view = await this.queries.supportTicketQueueSummary(toSupportActor(currentUser));
    return SupportQueueSummaryOutputDTO.fromView(view);
  }
}
