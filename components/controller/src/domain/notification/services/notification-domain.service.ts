import { Inject, Injectable, Logger } from '@nestjs/common';
import { NOTIFICATION_PORT, NotificationPort, NotificationSubscriberData } from '../interfaces/notification.port';
import type { AccountDomainEntity } from '~/domain/account/entities/account-domain.entity';

@Injectable()
export class NotificationDomainService {
  private readonly logger = new Logger(NotificationDomainService.name);

  constructor(@Inject(NOTIFICATION_PORT) private readonly notificationPort: NotificationPort) {}

  /**
   * Создает подписчика уведомлений из данных аккаунта
   * @param account Данные аккаунта пользователя
   */
  async createSubscriberFromAccount(account: AccountDomainEntity): Promise<void> {
    if (!account.provider_account) {
      this.logger.warn(`Нет данных provider_account для пользователя ${account.username}`);
      return;
    }

    const subscriber = this.buildSubscriberData(account);

    // Если нет email или имени, пропускаем
    if (!subscriber.email || (!subscriber.firstName && !subscriber.data?.org_name)) {
      this.logger.warn(`Недостаточно данных для создания подписчика ${account.username}`);
      return;
    }

    this.logger.log(`Создание подписчика уведомлений для ${account.username}`);

    try {
      await this.notificationPort.upsertSubscriber(subscriber);
      this.logger.log(`Подписчик ${account.username} успешно создан/обновлен`);
    } catch (error: any) {
      this.logger.error(`Ошибка создания подписчика ${account.username}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Формирует данные подписчика из аккаунта
   * @param account Данные аккаунта
   */
  private buildSubscriberData(account: AccountDomainEntity): NotificationSubscriberData {
    let email = '';
    let phone = '';
    let firstName = '';
    let lastName = '';
    const data: Record<string, string> = {};

    // Получаем email из provider_account
    if (account.provider_account?.email) {
      email = account.provider_account.email;
    }

    // Определяем тип аккаунта и извлекаем данные
    if (account.private_account) {
      const type = account.private_account.type;

      if (type === 'individual' && account.private_account.individual_data) {
        const ind = account.private_account.individual_data;
        firstName = ind.first_name || '';
        lastName = ind.last_name || '';
        email = ind.email || email;
        phone = ind.phone || '';
        if (ind.middle_name) data.middleName = ind.middle_name;
      } else if (type === 'organization' && account.private_account.organization_data) {
        const org = account.private_account.organization_data;
        email = org.email || email;
        phone = org.phone || '';
        data.org_name = org.full_name || '';

        // Данные представителя организации
        if (org.represented_by) {
          firstName = org.represented_by.first_name || '';
          lastName = org.represented_by.last_name || '';
          if (org.represented_by.middle_name) data.middleName = org.represented_by.middle_name;
        }
      } else if (type === 'entrepreneur' && account.private_account.entrepreneur_data) {
        const ent = account.private_account.entrepreneur_data;
        firstName = ent.first_name || '';
        lastName = ent.last_name || '';
        email = ent.email || email;
        phone = ent.phone || '';
        if (ent.middle_name) data.middleName = ent.middle_name;
      }
    }

    return {
      subscriberId: account.provider_account?.subscriber_id || account.username,
      email,
      phone,
      firstName,
      lastName,
      locale: 'ru_RU',
      timezone: 'Europe/Moscow',
      data,
    };
  }
}

export const NOTIFICATION_DOMAIN_SERVICE = Symbol('NOTIFICATION_DOMAIN_SERVICE');
