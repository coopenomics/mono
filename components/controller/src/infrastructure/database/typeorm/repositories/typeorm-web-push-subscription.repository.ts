import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebPushSubscriptionEntity } from '../entities/web-push-subscription.entity';
import { NotificationPort } from '~/domain/notification/interfaces/web-push-subscription.port';
import type { WebPushSubscriptionDomainInterface } from '~/domain/notification/interfaces/web-push-subscription-domain.interface';
import type { CreateWebPushSubscriptionDomainInterface } from '~/domain/notification/interfaces/create-web-push-subscription-domain.interface';
import type { SubscriptionStatsDomainInterface } from '~/domain/notification/interfaces/subscription-stats-domain.interface';
import { DomainError } from '@coopenomics/extension-kit';

@Injectable()
export class TypeOrmWebPushSubscriptionRepository implements NotificationPort {
  constructor(
    @InjectRepository(WebPushSubscriptionEntity)
    private readonly ormRepo: Repository<WebPushSubscriptionEntity>
  ) {}

  /**
   * Сохранить веб-пуш подписку
   */
  async saveSubscription(data: CreateWebPushSubscriptionDomainInterface): Promise<WebPushSubscriptionDomainInterface> {
    const entity = this.ormRepo.create({
      username: data.username,
      endpoint: data.endpoint,
      p256dhKey: data.p256dhKey,
      authKey: data.authKey,
      userAgent: data.userAgent,
      isActive: true,
    });

    const savedEntity = await this.ormRepo.save(entity);
    return savedEntity.toDomainEntity();
  }

  /**
   * Найти подписку по endpoint
   */
  async findByEndpoint(endpoint: string): Promise<WebPushSubscriptionDomainInterface | null> {
    const entity = await this.ormRepo.findOne({ where: { endpoint } });
    return entity ? entity.toDomainEntity() : null;
  }

  /**
   * Получить все активные подписки пользователя
   */
  async getUserSubscriptions(username: string): Promise<WebPushSubscriptionDomainInterface[]> {
    const entities = await this.ormRepo.find({
      where: { username, isActive: true },
    });
    return entities.map((entity) => entity.toDomainEntity());
  }

  /**
   * Получить все активные подписки
   */
  async getAllActiveSubscriptions(): Promise<WebPushSubscriptionDomainInterface[]> {
    const entities = await this.ormRepo.find({
      where: { isActive: true },
    });
    return entities.map((entity) => entity.toDomainEntity());
  }

  /**
   * Деактивировать подписку по endpoint
   */
  async deactivateSubscription(endpoint: string): Promise<void> {
    await this.ormRepo.update({ endpoint }, { isActive: false });
  }

  /**
   * Деактивировать подписку по ID
   */
  async deactivateSubscriptionById(id: string): Promise<void> {
    await this.ormRepo.update({ id }, { isActive: false });
  }

  /**
   * Удалить неактивные подписки старше указанного количества дней
   */
  async cleanupInactiveSubscriptions(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.ormRepo
      .createQueryBuilder()
      .delete()
      .where('isActive = :isActive AND updatedAt < :cutoffDate', {
        isActive: false,
        cutoffDate,
      })
      .execute();

    return result.affected || 0;
  }

  /**
   * Получить статистику подписок
   */
  async getSubscriptionStats(): Promise<SubscriptionStatsDomainInterface> {
    const total = await this.ormRepo.count();
    const active = await this.ormRepo.count({
      where: { isActive: true },
    });
    const inactive = total - active;

    const uniqueUsersResult = await this.ormRepo
      .createQueryBuilder('subscription')
      .select('COUNT(DISTINCT subscription.username)', 'count')
      .where('subscription.isActive = :isActive', { isActive: true })
      .getRawOne();

    return {
      total,
      active,
      inactive,
      uniqueUsers: parseInt(uniqueUsersResult.count),
    };
  }

  /**
   * Обновить подписку
   */
  async updateSubscription(
    endpoint: string,
    data: Partial<CreateWebPushSubscriptionDomainInterface>
  ): Promise<WebPushSubscriptionDomainInterface> {
    const existingEntity = await this.ormRepo.findOne({ where: { endpoint } });

    if (!existingEntity) {
      throw DomainError.internal('DATABASE_WEB_PUSH_SUBSCRIPTION_NOT_FOUND');
    }

    // Обновляем только переданные поля
    if (data.username !== undefined) existingEntity.username = data.username;
    if (data.p256dhKey !== undefined) existingEntity.p256dhKey = data.p256dhKey;
    if (data.authKey !== undefined) existingEntity.authKey = data.authKey;
    if (data.userAgent !== undefined) existingEntity.userAgent = data.userAgent;

    // Активируем подписку при обновлении
    existingEntity.isActive = true;

    const savedEntity = await this.ormRepo.save(existingEntity);
    return savedEntity.toDomainEntity();
  }
}
