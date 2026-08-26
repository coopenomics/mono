import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AuthRoles, CurrentUser, GqlJwtAuthGuard, RolesGuard } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { SupportCommandsService } from '../services/support-commands.service';
import { SupportQueriesService } from '../services/support-queries.service';
import { toSupportActor, type SupportActor } from '../services/support-actor';
import { CreateSupportTicketInputDTO } from '../dto/create-support-ticket.input';
import { ReplySupportTicketInputDTO } from '../dto/reply-support-ticket.input';
import { AssignSupportTicketInputDTO } from '../dto/assign-support-ticket.input';
import { ChangeSupportTicketPriorityInputDTO } from '../dto/change-support-ticket-priority.input';
import { ResolveSupportTicketInputDTO } from '../dto/resolve-support-ticket.input';
import { EscalateSupportTicketInputDTO } from '../dto/escalate-support-ticket.input';
import { SupportTicketOutputDTO } from '../dto/support-ticket.output';

/**
 * Команды стола поддержки: шесть мутаций.
 *
 * **Резолвер ничего не проверяет по данным** — то же правило, что у чтений
 * (см. `SupportQueriesResolver`). Декоратор ролей отвечает на вопрос «такой
 * род операций вообще доступен этой роли»; «своё или чужое», допустимость
 * перехода и повторные вызовы уже разобраны в `SupportCommandsService`.
 * `assignSupportTicket` / `changeSupportTicketPriority` / `resolveSupportTicket`
 * / `escalateSupportTicket` держат явную проверку роли в коде сервиса —
 * послабление `RolesGuard` по совпадению имени здесь не годится (спецификация,
 * раздел 6), и дублировать эту проверку в резолвере незачем.
 *
 * **Кооператив аргументом не принимается ни одной мутацией** — как и у чтений.
 * **Автор нигде не принимается аргументом** — ни в создании, ни в ответе:
 * подставляется из актора резолвером через `toSupportActor`.
 *
 * **Все шесть возвращают карточку обращения** (`SupportTicketOutputDTO`) —
 * тот же вид, что отдаёт запрос `supportTicket`, а не голый идентификатор и не
 * признак успеха. Стол поддержки в блокчейн не ходит, поэтому образец
 * `TransactionDTO` у мутаций расходов сюда не переносится — он про квитанцию
 * блокчейн-транзакции, которой здесь нет. Ближайший образец — `uploadExpenseFile`,
 * единственная в расходах мутация без выхода в блокчейн: она тоже возвращает
 * полную карточку изменённой записи, а не её идентификатор.
 *
 * Эта форма ответа устроена так, что команды с молчаливым повтором (повторное
 * «решено», повторное взятие в работу тем же оператором, повторная эскалация)
 * возвращают текущее состояние обращения без всякого дополнительного кода —
 * команда отдаёт ту же сущность, из которой строится та же карточка.
 *
 * Карточку строит не сама команда, а слой чтений: `SupportCommandsService`
 * возвращает доменную сущность, а `SupportQueriesService.supportTicket`
 * собирает из неё вид с агрегатами (число сообщений, наличие вложений,
 * расчётный момент автозакрытия) — ровно так же, как это делает запрос
 * `supportTicket`. Второе обращение к базе за агрегатами дороже, чем если бы
 * команда сама знала об агрегатах, но команда тогда обязана была бы знать о
 * форме карточки, а сегодня это единолично знает `SupportVisibilityService`,
 * которая наружу из модуля не экспортируется намеренно.
 */
@Resolver()
export class SupportMutationsResolver {
  constructor(
    private readonly commands: SupportCommandsService,
    private readonly queries: SupportQueriesService
  ) {}

  @Mutation(() => SupportTicketOutputDTO, {
    name: 'createSupportTicket',
    description: 'Завести обращение в поддержку вместе с первым сообщением и его вложениями.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async createSupportTicket(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data', { type: () => CreateSupportTicketInputDTO }) data: CreateSupportTicketInputDTO
  ): Promise<SupportTicketOutputDTO> {
    const actor = toSupportActor(currentUser);
    const ticket = await this.commands.createSupportTicket(data, actor);
    return this.toCard(ticket.id, actor);
  }

  @Mutation(() => SupportTicketOutputDTO, {
    name: 'replySupportTicket',
    description: 'Добавить сообщение и вложения в ленту обращения. Сообщение автора в решённом или закрытом обращении возвращает его в работу.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async replySupportTicket(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data', { type: () => ReplySupportTicketInputDTO }) data: ReplySupportTicketInputDTO
  ): Promise<SupportTicketOutputDTO> {
    const actor = toSupportActor(currentUser);
    const ticket = await this.commands.replySupportTicket(data, actor);
    return this.toCard(ticket.id, actor);
  }

  @Mutation(() => SupportTicketOutputDTO, {
    name: 'assignSupportTicket',
    description: 'Взять обращение в работу или переназначить оператора.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async assignSupportTicket(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data', { type: () => AssignSupportTicketInputDTO }) data: AssignSupportTicketInputDTO
  ): Promise<SupportTicketOutputDTO> {
    const actor = toSupportActor(currentUser);
    const ticket = await this.commands.assignSupportTicket(data, actor);
    return this.toCard(ticket.id, actor);
  }

  @Mutation(() => SupportTicketOutputDTO, {
    name: 'changeSupportTicketPriority',
    description: 'Изменить приоритет обращения.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async changeSupportTicketPriority(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data', { type: () => ChangeSupportTicketPriorityInputDTO }) data: ChangeSupportTicketPriorityInputDTO
  ): Promise<SupportTicketOutputDTO> {
    const actor = toSupportActor(currentUser);
    const ticket = await this.commands.changeSupportTicketPriority(data, actor);
    return this.toCard(ticket.id, actor);
  }

  @Mutation(() => SupportTicketOutputDTO, {
    name: 'resolveSupportTicket',
    description: 'Пометить обращение решённым и запустить отсчёт автозакрытия. Возможно только для обращения, взятого в работу.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async resolveSupportTicket(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data', { type: () => ResolveSupportTicketInputDTO }) data: ResolveSupportTicketInputDTO
  ): Promise<SupportTicketOutputDTO> {
    const actor = toSupportActor(currentUser);
    const ticket = await this.commands.resolveSupportTicket(data, actor);
    return this.toCard(ticket.id, actor);
  }

  @Mutation(() => SupportTicketOutputDTO, {
    name: 'escalateSupportTicket',
    description: 'Перевести обращение на председателя.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async escalateSupportTicket(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data', { type: () => EscalateSupportTicketInputDTO }) data: EscalateSupportTicketInputDTO
  ): Promise<SupportTicketOutputDTO> {
    const actor = toSupportActor(currentUser);
    const ticket = await this.commands.escalateSupportTicket(data, actor);
    return this.toCard(ticket.id, actor);
  }

  /**
   * Карточка обращения после команды — тем же способом, что и запрос
   * `supportTicket`: слой чтений сам соберёт агрегаты и рассчитает момент
   * автозакрытия. Актор, только что выполнивший команду над этим обращением,
   * всегда проходит проверку доступа на чтение того же обращения.
   */
  private async toCard(ticketId: string, actor: SupportActor): Promise<SupportTicketOutputDTO> {
    const view = await this.queries.supportTicket(ticketId, actor);
    return SupportTicketOutputDTO.fromCardView(view);
  }
}
