import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import {
  createPaginationResult,
  PaginationInputDTO,
  PaginationResult,
} from '~/application/common/dto/pagination.dto';
import { NotificationInboxService } from './notification-inbox.service';
import {
  InboxNotificationDTO,
  UnreadNotificationsCountDTO,
} from './graphql/inbox-notification.dto';

const paginatedInbox = createPaginationResult(InboxNotificationDTO, 'InboxNotification');

/**
 * Личный инбокс пайщика (эпик 6.6). Каждый авторизованный пользователь видит и
 * меняет ТОЛЬКО свой инбокс — `subscriberId` берётся из JWT-сессии
 * ({@link CurrentUser}.subscriber_id), не из аргументов клиента.
 *
 * Live-подписка `onNotification` отложена: GraphQL-подписок в репо нет
 * (нет `@Subscription`/PubSub/graphql-ws конфига); фронт обновляет ленту poll'ом.
 */
@Resolver()
export class NotificationInboxResolver {
  constructor(private readonly inboxService: NotificationInboxService) {}

  @Query(() => paginatedInbox, {
    name: 'getInboxNotifications',
    description: 'Лента личного инбокса текущего пользователя',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getInboxNotifications(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('coopname') coopname: string,
    @Args('pagination') pagination: PaginationInputDTO
  ): Promise<PaginationResult<InboxNotificationDTO>> {
    return this.inboxService.getInbox(coopname, user.subscriber_id, pagination);
  }

  @Query(() => UnreadNotificationsCountDTO, {
    name: 'getUnreadNotificationsCount',
    description: 'Число непрочитанных уведомлений в инбоксе (бейдж на колоколе)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getUnreadNotificationsCount(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('coopname') coopname: string
  ): Promise<UnreadNotificationsCountDTO> {
    const count = await this.inboxService.getUnreadCount(coopname, user.subscriber_id);
    return { count };
  }

  @Mutation(() => InboxNotificationDTO, {
    name: 'markNotificationRead',
    description: 'Отметить уведомление инбокса прочитанным',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async markNotificationRead(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('id') id: string
  ): Promise<InboxNotificationDTO> {
    return this.inboxService.markRead(id, user.subscriber_id);
  }

  @Mutation(() => UnreadNotificationsCountDTO, {
    name: 'markAllNotificationsRead',
    description: 'Отметить все уведомления инбокса прочитанными',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async markAllNotificationsRead(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('coopname') coopname: string
  ): Promise<UnreadNotificationsCountDTO> {
    await this.inboxService.markAllRead(coopname, user.subscriber_id);
    const count = await this.inboxService.getUnreadCount(coopname, user.subscriber_id);
    return { count };
  }
}
