import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { ContributorRepository, CONTRIBUTOR_REPOSITORY } from '../../domain/repositories/contributor.repository';
import { AccountDomainEntity } from '~/domain/account/entities/account-domain.entity';
import { ParticipationManagementInteractor } from '../../application/use-cases/participation-management.interactor';

/**
 * Сервис синхронизации участников при обновлении аккаунтов
 *
 * Подписывается на события обновления аккаунтов и обновляет
 * соответствующие участники с новыми данными display_name
 */
@Injectable()
export class ContributorAccountSyncService implements OnModuleInit {
  constructor(
    @Inject(CONTRIBUTOR_REPOSITORY)
    private readonly contributorRepository: ContributorRepository,
    private readonly participationManagementInteractor: ParticipationManagementInteractor,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(ContributorAccountSyncService.name);
  }

  async onModuleInit() {
    this.logger.log('Сервис синхронизации участников с аккаунтами инициализирован');
  }

  /**
   * Обработка события обновления аккаунта
   */
  @OnEvent('account::updated')
  async handleAccountUpdate(eventData: { username: string; account: AccountDomainEntity }): Promise<void> {
    try {
      this.logger.log(`Получено событие обновления аккаунта: ${eventData.username}`);

      // Ищем всех участников с этим username
      const contributor = await this.contributorRepository.findByUsername(eventData.username);
      if (!contributor) {
        this.logger.debug(`Не найдено участников для пользователя ${eventData.username}`);
        return;
      }

      // Получаем новое display_name из аккаунта
      const displayName = this.extractDisplayNameFromAccount(eventData.account);

      try {
        // Обновляем display_name в сущности
        contributor.display_name = displayName;

        // Сохраняем обновленную сущность
        await this.contributorRepository.update(contributor);

        this.logger.debug(`Обновлен display_name для участника ${contributor._id}`);
      } catch (error: any) {
        this.logger.error(`Ошибка обновления участника ${contributor._id}: ${error.message}`, error.stack);
      }

      this.logger.log(`Завершено обновление участника для пользователя ${eventData.username}`);
    } catch (error: any) {
      this.logger.error(`Ошибка обработки события обновления аккаунта ${eventData.username}: ${error.message}`, error.stack);
    }
  }

  /**
   * Извлечение display_name из аккаунта
   */
  private extractDisplayNameFromAccount(account: AccountDomainEntity): string {
    const privateAccount = account.private_account;

    if (!privateAccount) {
      throw new Error(`Private account not found for user ${account.username}`);
    }

    // Определяем тип аккаунта и извлекаем соответствующее имя
    if (privateAccount.type === 'individual' && privateAccount.individual_data) {
      const { first_name, last_name, middle_name } = privateAccount.individual_data;
      return `${last_name} ${first_name} ${middle_name || ''}`.trim();
    } else if (privateAccount.type === 'organization' && privateAccount.organization_data) {
      return privateAccount.organization_data.short_name;
    } else if (privateAccount.type === 'entrepreneur' && privateAccount.entrepreneur_data) {
      const { first_name, last_name, middle_name } = privateAccount.entrepreneur_data;
      return `${last_name} ${first_name} ${middle_name || ''}`.trim();
    }

    throw new Error(`Invalid account type for user ${account.username}`);
  }
}
