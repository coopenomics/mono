import './i18n';
import cron from 'node-cron';
import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { BaseExtensionModule, EXTENSION_REPOSITORY, type ExtensionDomainRepository, LOG_EXTENSION_REPOSITORY, LogExtensionDomainRepository, platformSettings, DomainError } from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort,
  CHAIN_RESOURCES_PORT,
  type IChainResourcesPort,
} from '@coopenomics/innercoop';
import type { ExtensionDomainEntity } from '@coopenomics/extension-kit';
import { z } from 'zod';
import { type DeserializedDescriptionOfExtension } from '@coopenomics/extension-kit';
import { t } from './i18n';

// Функция для проверки и сериализации FieldDescription
function describeField(description: DeserializedDescriptionOfExtension): string {
  return JSON.stringify(description);
}

// Символ и точность системного токена — свойство контура, а не расширения:
// расширение обязано подставлять их в суммы пополнения ровно такими, какими их
// понимает цепь. Настройки задаёт composition root до загрузки расширений.
const { rootSymbol, rootPrecision } = platformSettings().blockchain;

// Дефолтные параметры конфигурации
export const defaultConfig = {
  dailyPackageSize: 5,
  systemSymbol: rootSymbol,
  systemPrecision: rootPrecision,
  thresholds: {
    cpu: 70, // Процент использования (0-100)
    net: 70,
    ram: 70,
  },
  lastDailyReplenishmentDate: '',
};

// Определение Zod-схемы
export const Schema = z.object({
  dailyPackageSize: z
    .number()
    .default(defaultConfig.dailyPackageSize)
    .describe(
      describeField({
        label: t('powerup.settings.minQuotaCostLabel'),
        note: t('powerup.settings.minQuotaCostNote', { symbol: defaultConfig.systemSymbol }),
        rules: ['val >= 5'],
        prepend: defaultConfig.systemSymbol,
      })
    ),
  thresholds: z
    .object({
      cpu: z
        .number()
        .min(0)
        .max(100)
        .default(defaultConfig.thresholds.cpu)
        .describe(
          describeField({
            label: t('powerup.settings.cpuThresholdLabel'),
            note: t('powerup.settings.cpuThresholdNote'),
            append: '%',
            rules: ['val >= 0', 'val <= 100'],
          })
        ),
      net: z
        .number()
        .min(0)
        .max(100)
        .default(defaultConfig.thresholds.net)
        .describe(
          describeField({
            label: t('powerup.settings.netThresholdLabel'),
            note: t('powerup.settings.netThresholdNote'),
            append: '%',
            rules: ['val >= 0', 'val <= 100'],
          })
        ),
      ram: z
        .number()
        .min(0)
        .max(100)
        .default(defaultConfig.thresholds.ram)
        .describe(
          describeField({
            label: t('powerup.settings.ramThresholdLabel'),
            note: t('powerup.settings.ramThresholdNote'),
            append: '%',
            rules: ['val >= 0', 'val <= 100'],
          })
        ),
    })
    .default(defaultConfig.thresholds)
    .describe(
      describeField({
        label: t('powerup.settings.thresholdsGroupLabel'),
        note: t('powerup.settings.thresholdsGroupNote'),
      })
    ),
  lastDailyReplenishmentDate: z
    .string()
    .default(defaultConfig.lastDailyReplenishmentDate)
    .describe(
      // i18n-ignore: поле конфигурации visible:false — не отображается пайщику/админу
      describeField({ label: 'Дата последнего ежедневного пополнения', visible: false, minLength: 10, maxLength: 10 })
    ),
  systemPrecision: z
    .number()
    .default(defaultConfig.systemPrecision)
    // i18n-ignore: поле конфигурации visible:false — не отображается пайщику/админу
    .describe(describeField({ label: 'Точность системного утилити-токена', visible: false })),
  systemSymbol: z
    .string()
    .default(defaultConfig.systemSymbol)
    .describe(
      // i18n-ignore: поле конфигурации visible:false — не отображается пайщику/админу
      describeField({ label: 'Символ системного утилити-токена', visible: false, minLength: 3, maxLength: 5, maxRows: 4 })
    ),
});

// Автоматическое создание типа IConfig на основе Zod-схемы
export type IConfig = z.infer<typeof Schema>;

export interface ILog {
  type: 'daily' | 'now';
  amount: string;
  /**
   * Идентификатор транзакции пополнения. Журнал аренды ведётся по факту: запись
   * появляется только тогда, когда цепь приняла транзакцию, и по этому
   * идентификатору пополнение можно найти в цепи.
   */
  trx_id?: string;
  resources: {
    username: string;
    ram_usage: any;
    ram_quota: any;
    net_limit: any;
    cpu_limit: any;
  };
}

/** С какой паузы начинается отход после первого отказа пополнения. */
const RETRY_BACKOFF_START_MS = 5 * 60 * 1000;
/** Дальше пауза удваивается, но не растёт больше часа. */
const RETRY_BACKOFF_MAX_MS = 60 * 60 * 1000;

export class PowerupExtension extends BaseExtensionModule implements OnModuleDestroy {
  private dailyCronJob: cron.ScheduledTask | null = null;
  private resourceCronJob: cron.ScheduledTask | null = null;

  /**
   * Отход после отказа пополнения. Проверка ресурсов идёт каждую минуту, и
   * пока причина отказа не устранена (нет системного токена, ассерт цепи),
   * минутный цикл бьётся в ту же стену: за двое суток инцидента 16.09.2026
   * набралось 3 235 одинаковых отказов. Пауза растёт вдвое с каждой неудачей,
   * а первая ошибка серии пишется уровнем `error` — чтобы её было видно.
   */
  private failureStreak = 0;
  private nextAttemptAt = 0;

  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(LOG_EXTENSION_REPOSITORY) private readonly logExtensionRepository: LogExtensionDomainRepository<ILog>,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    @Inject(CHAIN_RESOURCES_PORT) private readonly blockchainPort: IChainResourcesPort
  ) {
    super();
    this.logger.setContext(PowerupExtension.name);
  }

  name = 'powerup';
  extension!: ExtensionDomainEntity<IConfig>;

  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  async initialize() {
    const extensionData = await this.extensionRepository.findByName(this.name);
    if (!extensionData) throw DomainError.internal('POWERUP_CONFIG_NOT_FOUND');

    this.extension = extensionData;

    // Проверяем, было ли ежедневное пополнение в последние 24 часа
    const lastDate = this.extension.config.lastDailyReplenishmentDate
      ? new Date(this.extension.config.lastDailyReplenishmentDate)
      : null;

    const now = new Date();

    if (lastDate) {
      const diffInHours = Math.abs(now.getTime() - lastDate.getTime()) / 36e5; // Разница во времени в часах
      if (diffInHours >= 24) {
        await this.runDailyTask();
      }
    } else {
      await this.runDailyTask();
    }

    // Регистрация cron-задачи для ежедневного пополнения
    this.dailyCronJob = cron.schedule('0 0 * * *', () => {
      this.runDailyTask();
    });

    // Регистрация cron-задачи для проверки ресурсов каждую минуту
    this.resourceCronJob = cron.schedule('* * * * *', () => {
      this.runTask();
    });
  }

  onModuleDestroy() {
    if (this.dailyCronJob) {
      this.dailyCronJob.stop();
      this.dailyCronJob = null;
      this.logger.info('node-cron задача ежедневного пополнения остановлена');
    }

    if (this.resourceCronJob) {
      this.resourceCronJob.stop();
      this.resourceCronJob = null;
      this.logger.info('node-cron задача проверки ресурсов остановлена');
    }
  }

  private getQuantity(amount: number): string {
    return `${amount.toFixed(this.extension.config.systemPrecision)} ${this.extension.config.systemSymbol}`;
  }

  // Ежедневная задача пополнения
  private async runDailyTask() {
    const quantity = this.getQuantity(this.extension.config.dailyPackageSize);

    try {
      // Получаем имя пользователя из окружения или другой конфигурации
      const username = platformSettings().coopname;
      const account = await this.blockchainPort.getAccount(username);

      if (!account) {
        throw DomainError.internal('POWERUP_ACCOUNT_NOT_FOUND');
      }

      const trx_id = await this.blockchainPort.powerUp(username, quantity);
      this.onReplenishmentSucceeded();

      // Дата последнего пополнения ставится только после того, как цепь приняла
      // транзакцию: иначе отказ выглядел бы выполненным пополнением и сутки
      // никто бы не повторил попытку.
      //
      // read-modify-write по СВЕЖЕМУ config: daily-cron держит in-memory снимок
      // `this.extension` с момента boot, а update() заменяет весь config JSONB
      // целиком. Перезапись устаревшего снимка стёрла бы поля, записанные за
      // сутки другими сервисами (онбординг и т.п.). Берём актуальный config и
      // трогаем только lastDailyReplenishmentDate.
      const fresh = await this.extensionRepository.findByName(this.name);
      const nextConfig = {
        ...(fresh?.config ?? this.extension.config),
        lastDailyReplenishmentDate: new Date().toISOString(),
      };
      await this.extensionRepository.update({ name: this.name, config: nextConfig });
      this.extension = { ...this.extension, config: nextConfig };

      // Ресурсы читаем после пополнения — в журнале должно стоять то состояние,
      // к которому пополнение привело, а не то, что было до него.
      const updatedAccount = (await this.blockchainPort.getAccount(username)) ?? account;

      await this.log({
        type: 'daily',
        amount: quantity,
        trx_id,
        resources: {
          username: updatedAccount.account_name,
          ram_usage: updatedAccount.ram_usage,
          ram_quota: updatedAccount.ram_quota,
          net_limit: updatedAccount.net_limit,
          cpu_limit: updatedAccount.cpu_limit,
        },
      });
    } catch (error) {
      this.onReplenishmentFailed(t('powerup.replenishment.kind.daily'), error);
    }
  }

  private async log(action: ILog) {
    await this.logExtensionRepository.push(this.name, action);
  }

  /**
   * Пополнение прошло: серия отказов закончилась, следующая проверка ресурсов
   * идёт по обычному расписанию.
   */
  private onReplenishmentSucceeded() {
    if (this.failureStreak > 0) {
      this.logger.info(`Пополнение ресурсов прошло после ${this.failureStreak} неудачных попыток`);
    }
    this.failureStreak = 0;
    this.nextAttemptAt = 0;
  }

  /**
   * Пополнение не прошло: записи в журнал аренды не будет, а следующая попытка
   * отодвигается — пока причина не устранена, повтор каждую минуту ничего не
   * меняет и только засыпает журнал одинаковыми строками.
   */
  private onReplenishmentFailed(what: string, error: unknown) {
    this.failureStreak += 1;
    const backoffMs = Math.min(RETRY_BACKOFF_START_MS * 2 ** (this.failureStreak - 1), RETRY_BACKOFF_MAX_MS);
    this.nextAttemptAt = Date.now() + backoffMs;

    const message = t('powerup.replenishment.failureMessage', { what, attempt: this.failureStreak, minutes: Math.round(backoffMs / 60000) });

    // Первый отказ серии — заметный; дальше причина та же, и повторять её
    // уровнем `error` незачем.
    if (this.failureStreak === 1) {
      this.logger.error(message, error instanceof Error ? error : String(error));
    } else {
      this.logger.warn(`${message}: ${String(error)}`);
    }
  }

  // Задача проверки и пополнения ресурсов
  private async runTask() {
    // Отход после отказа: пока пауза не вышла, цепь не трогаем.
    if (this.nextAttemptAt > Date.now()) return;

    try {
      // Получаем имя пользователя из окружения или другой конфигурации
      const username = platformSettings().coopname;

      const account = await this.blockchainPort.getAccount(username);

      if (!account) {
        throw DomainError.internal('POWERUP_ACCOUNT_NOT_FOUND');
      }

      // Получаем текущие значения квот
      const cpuLimit = account.cpu_limit;
      const netLimit = account.net_limit;
      const ramQuota = account.ram_quota;
      const ramUsage = account.ram_usage;

      // Вычисляем проценты использования
      const cpuUsed = parseFloat(String(cpuLimit.used));
      const cpuMax = parseFloat(String(cpuLimit.max));
      const cpuUsagePercent = cpuMax > 0 ? (cpuUsed / cpuMax) * 100 : 0;

      const netUsed = parseFloat(String(netLimit.used));
      const netMax = parseFloat(String(netLimit.max));
      const netUsagePercent = netMax > 0 ? (netUsed / netMax) * 100 : 0;

      const ramUsagePercent = ramQuota > 0 ? (ramUsage / ramQuota) * 100 : 0;

      // Проверяем пороги и пополняем при необходимости
      let needPowerUp = false;

      if (cpuUsagePercent >= this.extension.config.thresholds.cpu) {
        needPowerUp = true;
      }

      if (netUsagePercent >= this.extension.config.thresholds.net) {
        needPowerUp = true;
      }

      if (ramUsagePercent >= this.extension.config.thresholds.ram) {
        needPowerUp = true;
      }

      if (needPowerUp) {
        // Выполняем пополнение ресурсов на сумму ежедневной аренды
        const quantity = this.getQuantity(this.extension.config.dailyPackageSize);
        const trx_id = await this.blockchainPort.powerUp(username, quantity);
        this.onReplenishmentSucceeded();

        // Получаем актуальные данные после пополнения для логирования
        const updatedAccount = await this.blockchainPort.getAccount(username);

        if (!updatedAccount) {
          throw DomainError.internal('POWERUP_ACCOUNT_NOT_FOUND');
        }

        // Журнал аренды ведётся по факту: строка появляется только после того,
        // как цепь приняла транзакцию.
        await this.log({
          type: 'now',
          amount: quantity,
          trx_id,
          resources: {
            username: updatedAccount.account_name,
            ram_usage: updatedAccount.ram_usage,
            ram_quota: updatedAccount.ram_quota,
            net_limit: updatedAccount.net_limit,
            cpu_limit: updatedAccount.cpu_limit,
          },
        });
      }
    } catch (error) {
      this.onReplenishmentFailed(t('powerup.replenishment.kind.manual'), error);
    }
  }
}

@Module({
  providers: [PowerupExtension], // Регистрируем PowerupExtension как провайдер
  exports: [PowerupExtension], // Экспортируем его для доступа в других модулях
})
export class PowerupExtensionModule {
  constructor(public readonly powerupExtension: PowerupExtension) {}

  async initialize() {
    await this.powerupExtension.initialize();
  }
}
