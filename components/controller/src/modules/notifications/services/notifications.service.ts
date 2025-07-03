import { Injectable, ForbiddenException } from '@nestjs/common';
import config from '~/config/config';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';

@Injectable()
export class NotificationsService {
  /**
   * Проверяет права доступа пользователя к уведомлениям
   * @param user - текущий пользователь из JWT
   * @param subscriberId - ID подписчика из запроса
   * @returns true если доступ разрешен
   */
  validateAccess(user: MonoAccountDomainInterface, subscriberId: string): boolean {
    if (!user || !user.username) {
      throw new ForbiddenException('Требуется аутентификация');
    }

    // Ожидаемый формат subscriberId: "{coopname}-{username}"
    const expectedSubscriberId = `${config.coopname}-${user.username}`;

    if (subscriberId !== expectedSubscriberId) {
      throw new ForbiddenException(
        `Доступ запрещен. Ожидается subscriberId: ${expectedSubscriberId}, получен: ${subscriberId}`
      );
    }

    return true;
  }

  /**
   * Проверяет subscriberId из заголовков или параметров
   * @param headers - заголовки запроса
   * @param query - параметры запроса
   * @returns subscriberId из запроса
   */
  extractSubscriberId(headers: Record<string, any>, query: Record<string, any>): string {
    console.log('extractSubscriberId', headers, query);
    // Проверяем различные возможные места где может быть subscriberId
    return headers['x-novu-subscriber-id'] || query.subscriberId || query.subscriber_id || headers['subscriber-id'] || '';
  }
}
