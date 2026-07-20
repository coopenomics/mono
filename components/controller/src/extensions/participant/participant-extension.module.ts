import cron from 'node-cron';
import { Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { BaseExtModule } from '../base.extension.module';
import {
  EXTENSION_REPOSITORY,
  type ExtensionDomainRepository,
} from '~/domain/extension/repositories/extension-domain.repository';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import type { ExtensionDomainEntity } from '~/domain/extension/entities/extension-domain.entity';
import {
  LOG_EXTENSION_REPOSITORY,
  LogExtensionDomainRepository,
} from '~/domain/extension/repositories/log-extension-domain.repository';
import { ACCOUNT_DATA_PORT, AccountDataPort } from '~/domain/account/ports/account-data.port';
import { MEET_DATA_PORT, MeetDataPort } from '~/domain/meet/ports/meet-data.port';
import { AccountInfrastructureModule } from '~/infrastructure/account/account-infrastructure.module';
import { MeetInfrastructureModule } from '~/infrastructure/meet/meet-infrastructure.module';
import { merge } from 'lodash';
import { IConfig, defaultConfig, Schema, ILog } from './types';
import { NotificationSenderService } from './notification-sender.service';
import { MeetTrackerService } from './meet-tracker.service';
import { MeetWorkflowNotificationService } from './meet-workflow-notification.service';
import { AccountDomainEntity } from '~/domain/account/entities/account-domain.entity';

@Injectable()
export class ParticipantPlugin extends BaseExtModule implements OnModuleDestroy {
  private cronJob: cron.ScheduledTask | null = null;
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(LOG_EXTENSION_REPOSITORY) private readonly logExtensionRepository: LogExtensionDomainRepository<ILog>,
    private readonly logger: WinstonLoggerService,
    @Inject(MEET_DATA_PORT) private readonly meetPort: MeetDataPort,
    @Inject(ACCOUNT_DATA_PORT) private readonly accountPort: AccountDataPort,
    private readonly meetTracker: MeetTrackerService,
    private readonly notificationSender: NotificationSenderService
  ) {
    super();
    this.logger.setContext(ParticipantPlugin.name);
  }

  name = 'participant';
  plugin!: ExtensionDomainEntity<IConfig>;

  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  // Получение всех аккаунтов с использованием пакетной загрузки
  async getAllAccounts(): Promise<AccountDomainEntity[]> {
    return this.meetTracker.getAllAccounts();
  }

  // Получение всех email-адресов пользователей
  async getAllUserEmails(): Promise<Array<{ email: string; subscriberId: string }>> {
    // Получаем аккаунты через meetTracker
    const accounts = await this.meetTracker.getAllAccounts();

    // Извлекаем email и subscriberId из аккаунтов
    return accounts
      .map((account) => ({
        email: account.provider_account?.email,
        subscriberId: account.provider_account?.subscriber_id,
      }))
      .filter((user) => user.email && user.email.includes('@') && user.subscriberId) as Array<{
      email: string;
      subscriberId: string;
    }>;
  }

  async initialize() {
    const pluginData = await this.extensionRepository.findByName(this.name);
    if (!pluginData) throw new Error('Конфиг не найден');

    // Применяем глубокий мердж дефолтных параметров с существующими
    this.plugin = {
      ...pluginData,
      config: merge({}, defaultConfig, pluginData.config),
    };

    // Убедимся, что у всех собраний есть поле restartNotification
    for (const meet of this.plugin.config.trackedMeets) {
      if (meet.notifications.restartNotification === undefined) {
        meet.notifications.restartNotification = false;
      }
    }

    this.logger.info(`Инициализация ${this.name} с конфигурацией`, this.plugin.config);

    // Настраиваем сервис отправки уведомлений
    this.notificationSender.setGetUserEmailsFunction(() => this.getAllUserEmails());

    // Инициализируем трекер собраний
    await this.meetTracker.initialize(this.plugin);

    // Запускаем проверку сразу при инициализации
    await this.meetTracker.checkMeets();

    // Регистрация cron-задачи для проверки собраний
    const cronExpression = `*/${this.plugin.config.checkIntervalMinutes} * * * *`;
    this.cronJob = cron.schedule(cronExpression, () => {
      this.meetTracker.checkMeets();
    });
  }

  onModuleDestroy() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.logger.info('node-cron задача проверки собраний остановлена');
    }
  }
}

@Module({
  imports: [
    AccountInfrastructureModule,
    MeetInfrastructureModule, // Импортируем инфраструктурные модули для портов
  ],
  providers: [NotificationSenderService, MeetTrackerService, MeetWorkflowNotificationService, ParticipantPlugin],
  exports: [ParticipantPlugin],
})
export class ParticipantPluginModule {
  constructor(private readonly participantPlugin: ParticipantPlugin) {}

  async initialize() {
    await this.participantPlugin.initialize();
  }
}
