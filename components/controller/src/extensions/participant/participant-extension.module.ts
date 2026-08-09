import cron from 'node-cron';
import { Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { BaseExtensionModule, EXTENSION_REPOSITORY, type ExtensionDomainRepository, LOG_EXTENSION_REPOSITORY, LogExtensionDomainRepository } from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort, ACCOUNT_PORT, type IAccountPort, type InnerAccount } from '@coopenomics/innercoop';
import type { ExtensionDomainEntity } from '@coopenomics/extension-kit';
import { MEET_DATA_PORT, MeetDataPort } from '~/domain/meet/ports/meet-data.port';
import { AccountInfrastructureModule } from '~/infrastructure/account/account-infrastructure.module';
import { MeetInfrastructureModule } from '~/infrastructure/meet/meet-infrastructure.module';
import { merge } from 'lodash';
import { IConfig, defaultConfig, Schema, ILog } from './types';
import { NotificationSenderService } from './notification-sender.service';
import { MeetTrackerService } from './meet-tracker.service';
import { MeetWorkflowNotificationService } from './meet-workflow-notification.service';

@Injectable()
export class ParticipantExtension extends BaseExtensionModule implements OnModuleDestroy {
  private cronJob: cron.ScheduledTask | null = null;
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(LOG_EXTENSION_REPOSITORY) private readonly logExtensionRepository: LogExtensionDomainRepository<ILog>,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    @Inject(MEET_DATA_PORT) private readonly meetPort: MeetDataPort,
    @Inject(ACCOUNT_PORT) private readonly accountPort: IAccountPort,
    private readonly meetTracker: MeetTrackerService,
    private readonly notificationSender: NotificationSenderService
  ) {
    super();
    this.logger.setContext(ParticipantExtension.name);
  }

  name = 'participant';
  extension!: ExtensionDomainEntity<IConfig>;

  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  // Получение всех аккаунтов с использованием пакетной загрузки
  async getAllAccounts(): Promise<InnerAccount[]> {
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
    const extensionData = await this.extensionRepository.findByName(this.name);
    if (!extensionData) throw new Error('Конфиг не найден');

    // Применяем глубокий мердж дефолтных параметров с существующими
    this.extension = {
      ...extensionData,
      config: merge({}, defaultConfig, extensionData.config),
    };

    // Убедимся, что у всех собраний есть поле restartNotification
    for (const meet of this.extension.config.trackedMeets) {
      if (meet.notifications.restartNotification === undefined) {
        meet.notifications.restartNotification = false;
      }
    }

    this.logger.info(`Инициализация ${this.name} с конфигурацией`, this.extension.config);

    // Настраиваем сервис отправки уведомлений
    this.notificationSender.setGetUserEmailsFunction(() => this.getAllUserEmails());

    // Инициализируем трекер собраний
    await this.meetTracker.initialize(this.extension);

    // Запускаем проверку сразу при инициализации
    await this.meetTracker.checkMeets();

    // Регистрация cron-задачи для проверки собраний
    const cronExpression = `*/${this.extension.config.checkIntervalMinutes} * * * *`;
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
  providers: [NotificationSenderService, MeetTrackerService, MeetWorkflowNotificationService, ParticipantExtension],
  exports: [ParticipantExtension],
})
export class ParticipantExtensionModule {
  constructor(private readonly participantExtension: ParticipantExtension) {}

  async initialize() {
    await this.participantExtension.initialize();
  }
}
