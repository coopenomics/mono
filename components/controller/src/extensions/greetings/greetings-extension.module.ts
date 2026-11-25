import './i18n';
import cron from 'node-cron';
import { Inject, Module, OnModuleDestroy, Optional } from '@nestjs/common';
import { merge } from 'lodash';
import { z } from 'zod';
import {
  APP_RIGHTS,
  BaseExtensionModule,
  DomainError,
  platformSettings,
  EXTENSION_REPOSITORY,
  RightsGuard,
  describeConfigField,
  type ExtensionDomainEntity,
  type ExtensionDomainRepository,
} from '@coopenomics/extension-kit';
import { CHAIN_CHANGES_PORT, LOGGER_PORT, type IChainChangesPort, type ILoggerPort } from '@coopenomics/innercoop';
import { t } from './i18n';
import { GreetingsDatabaseModule } from './infrastructure/database/greetings-stores';
import { CALENDAR_TABLE, SENDS_TABLE, TEMPLATES_TABLE } from './infrastructure/database/greetings.records';
import { GreetingsRights, GREETINGS_DESKTOP_NAME } from './application/access/greetings-rights';
import { GreetingsPeopleService } from './application/services/greetings-people.service';
import { GreetingsCalendarService } from './application/services/greetings-calendar.service';
import { GreetingsTemplatesService } from './application/services/greetings-templates.service';
import { GreetingsLetterService } from './application/services/greetings-letter.service';
import { GreetingsSenderService } from './application/services/greetings-sender.service';
import { GreetingsMailingService } from './application/services/greetings-mailing.service';
import { GreetingsQueryService } from './application/services/greetings-query.service';
import { GreetingsResolver } from './application/resolvers/greetings.resolver';

/** «Europe/Moscow, GMT+3» — зона кооператива и её смещение для подписи настройки. */
function timezoneLabel(timezone: string): string {
  try {
    const offset = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value;
    return offset ? `${timezone}, ${offset}` : timezone;
  } catch {
    return timezone;
  }
}

export const defaultConfig = {
  sendHour: 9,
  calendarFilledAt: '',
};

export const Schema = z.object({
  // coerce: форма настроек передаёт число из поля ввода, а значение
  // «9» строкой — тоже верный час; без приведения установка падала.
  sendHour: z.coerce
    .number()
    .int()
    .min(0)
    .max(23)
    .default(defaultConfig.sendHour)
    .describe(
      describeConfigField({
        label: t('greetings.settings.sendHourLabel'),
        note: t('greetings.settings.sendHourNote', { timezone: timezoneLabel(platformSettings().timezone) }),
        rules: ['val >= 0', 'val <= 23'],
        append: t('greetings.settings.sendHourAppend'),
      })
    ),
  calendarFilledAt: z
    .string()
    .default(defaultConfig.calendarFilledAt)
    // i18n-ignore: поле конфигурации visible:false — не отображается пайщику/админу
    .describe(describeConfigField({ label: 'Когда календарь заполнен при установке', visible: false })),
});

export type IConfig = z.infer<typeof Schema>;

/** Рассылка проверяет именинников раз в час, в пятую минуту: не в одну секунду с другими задачами. */
const SEND_CRON = '5 * * * *';

export class GreetingsExtension extends BaseExtensionModule implements OnModuleDestroy {
  name = GREETINGS_DESKTOP_NAME;
  extension!: ExtensionDomainEntity<IConfig>;
  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  private sendJob: cron.ScheduledTask | null = null;

  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    private readonly calendar: GreetingsCalendarService,
    private readonly sender: GreetingsSenderService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    @Optional() @Inject(CHAIN_CHANGES_PORT) private readonly chainChanges: IChainChangesPort | null = null
  ) {
    super();
    this.logger.setContext(GreetingsExtension.name);
  }

  async initialize(): Promise<void> {
    const extensionData = await this.extensionRepository.findByName(this.name);
    if (!extensionData) throw DomainError.internal('GREETINGS_CONFIG_NOT_FOUND');
    this.extension = { ...extensionData, config: merge({}, defaultConfig, extensionData.config) };

    // Таблицы приложения видят только совет и председатель: календарь — личные данные.
    this.chainChanges?.declareLocalTables(
      [TEMPLATES_TABLE, CALENDAR_TABLE, SENDS_TABLE].map((table) => ({ code: this.name, table, staff_only: true }))
    );

    // Первое заполнение идёт в фоне: на каждого пайщика ядро читает и цепь,
    // а запуск контроллера ждать этого не должен.
    if (!this.extension.config.calendarFilledAt) void this.fillCalendar();

    this.sendJob = cron.schedule(
      SEND_CRON,
      () => {
        this.sender.run(this.extension.config.sendHour).catch((error: unknown) => {
          this.logger.error(`Рассылка поздравлений упала: ${(error as Error).message}`);
        });
      },
      { timezone: 'UTC' }
    );
  }

  private async fillCalendar(): Promise<void> {
    try {
      const total = await this.calendar.fill();
      this.extension.config.calendarFilledAt = new Date().toISOString();
      await this.extensionRepository.update(this.extension);
      this.logger.info(`Календарь дней рождения заполнен: пайщиков с датой рождения ${total}`);
    } catch (error: unknown) {
      // Отметка не ставится — следующий запуск контроллера повторит заполнение.
      this.logger.error(`Календарь дней рождения не заполнен: ${(error as Error).message}`);
    }
  }

  onModuleDestroy(): void {
    this.sendJob?.stop();
    this.sendJob = null;
  }
}

@Module({
  imports: [GreetingsDatabaseModule],
  providers: [
    GreetingsExtension,
    GreetingsPeopleService,
    GreetingsCalendarService,
    GreetingsTemplatesService,
    GreetingsLetterService,
    GreetingsSenderService,
    GreetingsMailingService,
    GreetingsQueryService,
    GreetingsRights,
    { provide: APP_RIGHTS, useExisting: GreetingsRights },
    RightsGuard,
    GreetingsResolver,
  ],
})
export class GreetingsExtensionModule {
  constructor(private readonly greetingsExtension: GreetingsExtension) {}

  async initialize(): Promise<void> {
    await this.greetingsExtension.initialize();
  }
}
