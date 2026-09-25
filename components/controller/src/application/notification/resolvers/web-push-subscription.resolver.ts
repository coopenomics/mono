import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SubscriptionService } from '../services/subscription.service';
import { WebPushSubscriptionDto } from '../dto/web-push-subscription.dto';
import { CreateSubscriptionInput } from '../dto/create-subscription-input.dto';
import { CreateSubscriptionResponse } from '../dto/create-subscription-response.dto';
import { SubscriptionStatsDto } from '../dto/subscription-stats.dto';
import { GetUserSubscriptionsInput } from '../dto/get-user-subscriptions.dto';
import { DeactivateSubscriptionInput } from '../dto/deactivate-subscription.dto';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, CurrentUser, DomainError } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';

/**
 * Подписки на уведомления личные: каждый управляет только своими — член совета
 * и председатель тоже. До 25.09.2026 член совета создавал, читал (с ключами
 * устройства) и снимал подписки любого пайщика, а сам пайщик не мог снять
 * свою (нашёл внешний слой).
 */
function assertSelf(currentUser: IMonoAccount, username: string): void {
  if (currentUser.username !== username) throw DomainError.forbidden('NOTIFICATION_SUBSCRIPTION_SELF_ONLY');
}
@Resolver(() => WebPushSubscriptionDto)
export class SubscriptionResolver {
  constructor(private readonly webPushSubscriptionService: SubscriptionService) {}

  @Mutation(() => CreateSubscriptionResponse, {
    description: 'Создать веб-пуш подписку для пользователя',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'], { allowSelf: false })
  async createWebPushSubscription(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data') data: CreateSubscriptionInput
  ): Promise<CreateSubscriptionResponse> {
    assertSelf(currentUser, data.username);
    return await this.webPushSubscriptionService.createSubscription(data);
  }

  @Query(() => [WebPushSubscriptionDto], {
    description: 'Получить веб-пуш подписки пользователя',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'], { allowSelf: false })
  async getUserWebPushSubscriptions(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data') data: GetUserSubscriptionsInput
  ): Promise<WebPushSubscriptionDto[]> {
    assertSelf(currentUser, data.username);
    return await this.webPushSubscriptionService.getUserSubscriptions(data.username);
  }

  @Query(() => SubscriptionStatsDto, {
    description: 'Получить статистику веб-пуш подписок (только для председателя)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async getWebPushSubscriptionStats(): Promise<SubscriptionStatsDto> {
    return await this.webPushSubscriptionService.getSubscriptionStats();
  }

  @Mutation(() => Boolean, {
    description: 'Деактивировать веб-пуш подписку по ID',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async deactivateWebPushSubscriptionById(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data') data: DeactivateSubscriptionInput
  ): Promise<boolean> {
    // Чужая подписка — «не найдена»: не выдаём, что такой id существует.
    const own = await this.webPushSubscriptionService.getUserSubscriptions(currentUser.username);
    if (!own.some(s => s.id === data.subscriptionId)) throw DomainError.notFound('NOTIFICATION_SUBSCRIPTION_NOT_FOUND');
    await this.webPushSubscriptionService.deactivateSubscriptionById(data.subscriptionId);
    return true;
  }
}
