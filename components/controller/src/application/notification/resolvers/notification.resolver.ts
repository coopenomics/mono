import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { NotificationService } from '../services/notification.service';
import { TriggerNotificationWorkflowInputDTO } from '../dto/trigger-notification-workflow-input.dto';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';

/**
 * Резолвер для управления уведомлениями и подписками
 */
@Resolver()
export class NotificationResolver {
  constructor(private readonly notificationService: NotificationService) {}

  @Mutation(() => Boolean, {
    name: 'triggerNotificationWorkflow',
    description: 'Запустить воркфлоу уведомлений (только для председателя или server-secret)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async triggerNotificationWorkflow(
    @Args('data', { type: () => TriggerNotificationWorkflowInputDTO })
    data: TriggerNotificationWorkflowInputDTO
  ): Promise<boolean> {
    return this.notificationService.triggerNotificationWorkflow(data);
  }
}
