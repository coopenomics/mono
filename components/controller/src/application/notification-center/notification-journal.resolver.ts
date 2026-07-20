import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import {
  createPaginationResult,
  PaginationInputDTO,
  PaginationResult,
} from '~/application/common/dto/pagination.dto';
import { NotificationJournalService } from './notification-journal.service';
import { NotificationDTO, NotificationDetailDTO } from './graphql/notification.dto';
import { NotificationsFilterInput } from './graphql/notifications-filter.input';

const paginatedNotifications = createPaginationResult(NotificationDTO, 'Notification');

/**
 * Резолвер журнала уведомлений (стол председателя, эпик 6).
 * Видимость — председатель/совет (RolesGuard). Платформенный CASL — Phase 2.
 */
@Resolver()
export class NotificationJournalResolver {
  constructor(private readonly journalService: NotificationJournalService) {}

  @Query(() => paginatedNotifications, {
    name: 'getNotifications',
    description: 'Журнал уведомлений кооператива с фильтрами и пагинацией',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async getNotifications(
    @Args('filter') filter: NotificationsFilterInput,
    @Args('pagination') pagination: PaginationInputDTO
  ): Promise<PaginationResult<NotificationDTO>> {
    return this.journalService.listNotifications(filter, pagination);
  }

  @Query(() => NotificationDetailDTO, {
    name: 'getNotification',
    description: 'Детализация одного уведомления с историей попыток доставки',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async getNotification(@Args('id') id: string): Promise<NotificationDetailDTO> {
    return this.journalService.getNotification(id);
  }

  @Mutation(() => NotificationDTO, {
    name: 'resendNotification',
    description: 'Переотправить уведомление (force-постановка новой строки в очередь доставки)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async resendNotification(@Args('id') id: string): Promise<NotificationDTO> {
    return this.journalService.resendNotification(id);
  }
}
