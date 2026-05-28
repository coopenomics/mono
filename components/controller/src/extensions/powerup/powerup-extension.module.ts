import cron from 'node-cron';
import config, { default as coopConfig } from '../../config/config';
import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { BaseExtModule } from '../base.extension.module';
import { BLOCKCHAIN_PORT, BlockchainPort } from '~/domain/common/ports/blockchain.port';
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
import { z } from 'zod';
import type { DeserializedDescriptionOfExtension } from '~/types/shared';

// Функция для проверки и сериализации FieldDescription
function describeField(description: DeserializedDescriptionOfExtension): string {
  return JSON.stringify(description);
}

// Дефолтные параметры конфигурации
export const defaultConfig = {
  dailyPackageSize: 5,
  systemSymbol: config.blockchain.root_symbol,
  systemPrecision: config.blockchain.root_precision,
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
        label: 'Стоимость минимальной квоты',
        note: `Минимум: 5 ${defaultConfig.systemSymbol}. Ежедневно пополняет вычислительные ресурсы кооператива на указанную сумму токенов. При достижении минимального порога использования ресурсов происходит автоматическое пополнение ресурсов на сумму стоимости минимальной квоты.`,
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
            label: 'Порог использования CPU (%)',
            note: 'При достижении указанного процента использования CPU происходит автоматическое пополнение ресурсов на сумму минимальной квоты.',
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
            label: 'Порог использования NET (%)',
            note: 'При достижении указанного процента использования NET происходит автоматическое пополнение ресурсов на сумму минимальной квоты.',
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
            label: 'Порог использования RAM (%)',
            note: 'При достижении указанного процента использования RAM происходит автоматическое пополнение ресурсов на сумму минимальной квоты.',
            append: '%',
            rules: ['val >= 0', 'val <= 100'],
          })
        ),
    })
    .default(defaultConfig.thresholds)
    .describe(
      describeField({
        label: 'Пороги использования ресурсов',
        note: 'Настройки для автоматического пополнения при достижении указанного процента использования ресурсов. Если любой из ресурсов (CPU, NET или RAM) достигает указанного порога, происходит автоматическое пополнение на сумму минимальной квоты.',
      })
    ),
  lastDailyReplenishmentDate: z
    .string()
    .default(defaultConfig.lastDailyReplenishmentDate)
    .describe(
      describeField({ label: 'Дата последнего ежедневного пополнения', visible: false, minLength: 10, maxLength: 10 })
    ),
  systemPrecision: z
    .number()
    .default(defaultConfig.systemPrecision)
    .describe(describeField({ label: 'Точность системного утилити-токена', visible: false })),
  systemSymbol: z
    .string()
    .default(defaultConfig.systemSymbol)
    .describe(
      describeField({ label: 'Символ системного утилити-токена', visible: false, minLength: 3, maxLength: 5, maxRows: 4 })
    ),
});

// Автоматическое создание типа IConfig на основе Zod-схемы
export type IConfig = z.infer<typeof Schema>;

export interface ILog {
  type: 'daily' | 'now';
  amount: string;
  resources: {
    username: string;
    ram_usage: any;
    ram_quota: any;
    net_limit: any;
    cpu_limit: any;
  };
}

export class PowerupPlugin extends BaseExtModule implements OnModuleDestroy {
  private dailyCronJob: cron.ScheduledTask | null = null;
  private resourceCronJob: cron.ScheduledTask | null = null;

  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(LOG_EXTENSION_REPOSITORY) private readonly logExtensionRepository: LogExtensionDomainRepository<ILog>,
    private readonly logger: WinstonLoggerService,
    @Inject(BLOCKCHAIN_PORT) private readonly blockchainPort: BlockchainPort
  ) {
    super();
    this.logger.setContext(PowerupPlugin.name);
  }

  name = 'powerup';
  plugin!: ExtensionDomainEntity<IConfig>;

  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  async initialize() {
    const pluginData = await this.extensionRepository.findByName(this.name);
    if (!pluginData) throw new Error('Конфиг не найден');

    this.plugin = pluginData;

    // Проверяем, было ли ежедневное пополнение в последние 24 часа
    const lastDate = this.plugin.config.lastDailyReplenishmentDate
      ? new Date(this.plugin.config.lastDailyReplenishmentDate)
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
    return `${amount.toFixed(this.plugin.config.systemPrecision)} ${this.plugin.config.systemSymbol}`;
  }

  // Ежедневная задача пополнения
  private async runDailyTask() {
    const quantity = this.getQuantity(this.plugin.config.dailyPackageSize);

    try {
      // Получаем имя пользователя из окружения или другой конфигурации
      const username = coopConfig.coopname;
      const account = await this.blockchainPort.getAccount(username);

      if (!account) {
        throw new Error('Аккаунт не найден');
      }

      await this.blockchainPort.powerUp(username, quantity);

      // read-modify-write по СВЕЖЕМУ config: daily-cron держит in-memory снимок
      // `this.plugin` с момента boot, а update() заменяет весь config JSONB
      // целиком. Перезапись устаревшего снимка стёрла бы поля, записанные за
      // сутки другими сервисами (онбординг и т.п.). Берём актуальный config и
      // трогаем только lastDailyReplenishmentDate.
      const fresh = await this.extensionRepository.findByName(this.name);
      const nextConfig = {
        ...(fresh?.config ?? this.plugin.config),
        lastDailyReplenishmentDate: new Date().toISOString(),
      };
      await this.extensionRepository.update({ name: this.name, config: nextConfig });
      this.plugin = { ...this.plugin, config: nextConfig };

      await this.log({
        type: 'daily',
        amount: quantity,
        resources: {
          username: account.account_name,
          ram_usage: account.ram_usage,
          ram_quota: account.ram_quota,
          net_limit: account.net_limit,
          cpu_limit: account.cpu_limit,
        },
      });
    } catch (error) {
      this.logger.info('Предупреждение при выполнении ежедневного пополнения:', error as Error);
    }
  }

  private async log(action: ILog) {
    await this.logExtensionRepository.push(this.name, action);
  }

  // Задача проверки и пополнения ресурсов
  private async runTask() {
    try {
      // Получаем имя пользователя из окружения или другой конфигурации
      const username = coopConfig.coopname;

      const account = await this.blockchainPort.getAccount(username);

      if (!account) {
        throw new Error('Аккаунт не найден');
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

      if (cpuUsagePercent >= this.plugin.config.thresholds.cpu) {
        needPowerUp = true;
      }

      if (netUsagePercent >= this.plugin.config.thresholds.net) {
        needPowerUp = true;
      }

      if (ramUsagePercent >= this.plugin.config.thresholds.ram) {
        needPowerUp = true;
      }

      if (needPowerUp) {
        // Выполняем пополнение ресурсов на сумму ежедневной аренды
        const quantity = this.getQuantity(this.plugin.config.dailyPackageSize);
        await this.blockchainPort.powerUp(username, quantity);

        // Получаем актуальные данные после пополнения для логирования
        const updatedAccount = await this.blockchainPort.getAccount(username);

        if (!updatedAccount) {
          throw new Error('Аккаунт не найден');
        }

        await this.log({
          type: 'now',
          amount: quantity,
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
      this.logger.info('Предупреждение при проверке и пополнении ресурсов:', error as Error);
    }
  }
}

@Module({
  providers: [PowerupPlugin], // Регистрируем PowerupPlugin как провайдер
  exports: [PowerupPlugin], // Экспортируем его для доступа в других модулях
})
export class PowerupPluginModule {
  constructor(public readonly powerupPlugin: PowerupPlugin) {}

  async initialize() {
    await this.powerupPlugin.initialize();
  }
}
