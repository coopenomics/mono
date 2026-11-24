import './i18n';
import cron from 'node-cron';
import { Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { BaseExtensionModule, EXTENSION_REPOSITORY, type ExtensionDomainRepository, LOG_EXTENSION_REPOSITORY, LogExtensionDomainRepository, DomainError } from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort, ACCOUNT_PORT, type IAccountPort, type InnerAccount, MEET_PORT, IMeetPort } from '@coopenomics/innercoop';
import type { ExtensionDomainEntity } from '@coopenomics/extension-kit';
import { merge } from 'lodash';
import { IConfig, defaultConfig, Schema, ILog } from './types';
import { MeetTrackerService } from './meet-tracker.service';
import { MeetWorkflowNotificationService } from './meet-workflow-notification.service';

@Injectable()
export class ParticipantExtension extends BaseExtensionModule implements OnModuleDestroy {
  private cronJob: cron.ScheduledTask | null = null;
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(LOG_EXTENSION_REPOSITORY) private readonly logExtensionRepository: LogExtensionDomainRepository<ILog>,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    @Inject(MEET_PORT) private readonly meetPort: IMeetPort,
    @Inject(ACCOUNT_PORT) private readonly accountPort: IAccountPort,
    private readonly meetTracker: MeetTrackerService
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

  async initialize() {
    const extensionData = await this.extensionRepository.findByName(this.name);
    if (!extensionData) throw DomainError.internal('PARTICIPANT_CONFIG_NOT_FOUND');

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
  ],
  providers: [MeetTrackerService, MeetWorkflowNotificationService, ParticipantExtension],
  exports: [ParticipantExtension],
})
export class ParticipantExtensionModule {
  constructor(private readonly participantExtension: ParticipantExtension) {}

  async initialize() {
    await this.participantExtension.initialize();
  }
}
