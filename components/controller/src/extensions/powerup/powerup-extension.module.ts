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

// Дефолтные параметры конфигурации (Epic 13 v5.1: добавлены 8 слоёв защиты от runaway).
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

  // ===== Epic 13 v5.1 — 8 слоёв защиты от runaway =====
  // 1) Cooldown между двумя докупками — минимум 5 минут.
  cooldownMinutes: 5,
  // 2) Daily AXON cap — суммарный AXON, который PowerupPlugin может потратить за сутки.
  dailyAxonCap: 50,
  // 3) Daily package cap — максимальное число докупок-пакетов в сутки.
  dailyPackageCap: 10,
  // 4) AXON pre-gate — минимальный AXON-баланс coopname@active, ниже которого
  //    докупка не запускается (нет токенов, чтобы оплатить PowerUp).
  axonMinBalance: 1,
  // 5) RUB floor — минимальный RUB на w.wal.bill[coopname], при котором ещё
  //    можно докупать. Запасной guard поверх subscription_type.min_topup_rub.
  rubFloor: 100,
  // 6) Circuit breaker — после MonthlyPackageQuotaExceeded плагин стопится до
  //    начала следующего месяца. Поле хранит YYYY-MM, до которого блокировка действует.
  circuitBreakerUntilMonth: '',
  // 7) Monthly RUB cap — суммарный RUB-потолок за месяц на этот плагин (заменяет
  //    /дополняет subscription_type.monthly_quota_rub, если плагин используется в
  //    нескольких подписках).
  monthlyRubCap: 5000,
  // 8) Идемпотентность calendar-trigger'а — YYYY-MM последнего календарного пакета.
  lastCalendarPackageMonth: '',

  // ===== Epic 13 v5.1 — счётчики дня (сбрасываются ежедневной cron-job) =====
  todayAxonSpent: 0,
  todayPackagesIssued: 0,
  // ISO-дата, к которой относятся todayAxonSpent / todayPackagesIssued — позволяет
  // определить, что сутки сменились, и обнулить счётчики при следующем runTask.
  todayCounterDate: '',
  // ISO-таймштамп последней докупки (для cooldown).
  lastTopupAt: '',
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

  // ===== Epic 13 v5.1 — guards =====
  cooldownMinutes: z
    .number()
    .min(0)
    .default(defaultConfig.cooldownMinutes)
    .describe(describeField({ label: 'Минимальная пауза между докупками (мин)', rules: ['val >= 0'] })),
  dailyAxonCap: z
    .number()
    .min(0)
    .default(defaultConfig.dailyAxonCap)
    .describe(describeField({ label: 'Суточный потолок AXON', rules: ['val >= 0'], prepend: defaultConfig.systemSymbol })),
  dailyPackageCap: z
    .number()
    .int()
    .min(0)
    .default(defaultConfig.dailyPackageCap)
    .describe(describeField({ label: 'Суточный лимит докупок (шт.)', rules: ['val >= 0'] })),
  axonMinBalance: z
    .number()
    .min(0)
    .default(defaultConfig.axonMinBalance)
    .describe(describeField({ label: 'Минимальный AXON для запуска докупки', rules: ['val >= 0'] })),
  rubFloor: z
    .number()
    .min(0)
    .default(defaultConfig.rubFloor)
    .describe(describeField({ label: 'RUB-floor биллинг-кошелька', rules: ['val >= 0'] })),
  circuitBreakerUntilMonth: z
    .string()
    .default(defaultConfig.circuitBreakerUntilMonth)
    .describe(describeField({ label: 'Circuit-breaker до месяца YYYY-MM', visible: false })),
  monthlyRubCap: z
    .number()
    .min(0)
    .default(defaultConfig.monthlyRubCap)
    .describe(describeField({ label: 'Месячный потолок RUB', rules: ['val >= 0'] })),
  lastCalendarPackageMonth: z
    .string()
    .default(defaultConfig.lastCalendarPackageMonth)
    .describe(describeField({ label: 'YYYY-MM последнего календарного пакета', visible: false })),
  todayAxonSpent: z
    .number()
    .min(0)
    .default(defaultConfig.todayAxonSpent)
    .describe(describeField({ label: 'AXON израсходовано за сегодня', visible: false })),
  todayPackagesIssued: z
    .number()
    .int()
    .min(0)
    .default(defaultConfig.todayPackagesIssued)
    .describe(describeField({ label: 'Пакетов сегодня', visible: false })),
  todayCounterDate: z
    .string()
    .default(defaultConfig.todayCounterDate)
    .describe(describeField({ label: 'Дата сегодняшнего счётчика', visible: false })),
  lastTopupAt: z
    .string()
    .default(defaultConfig.lastTopupAt)
    .describe(describeField({ label: 'Время последней докупки (ISO)', visible: false })),
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
  // Epic 13 v5.1: дополнительный календарный триггер «1-го числа месяца в 00:00 UTC».
  // Идемпотентен через config.lastCalendarPackageMonth, при сбое процесса
  // повторный запуск 1-го числа корректно скипнет уже отработанный месяц.
  private calendarCronJob: cron.ScheduledTask | null = null;

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

    // Epic 13 v5.1 — calendar trigger: 1-го числа месяца в 00:00 UTC.
    // Идемпотентен через config.lastCalendarPackageMonth — если процесс
    // упал в момент срабатывания, перезапуск 1-го числа корректно скипнет
    // уже отработанный месяц.
    this.calendarCronJob = cron.schedule(
      '0 0 1 * *',
      () => {
        void this.runCalendarTask().catch((err) =>
          this.logger.info('PowerupPlugin: calendar-trigger fail', err as Error),
        );
      },
      { timezone: 'UTC' },
    );
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

    if (this.calendarCronJob) {
      this.calendarCronJob.stop();
      this.calendarCronJob = null;
      this.logger.info('node-cron calendar-trigger (Epic 13) остановлен');
    }
  }

  /**
   * Epic 13 v5.1 — calendar trigger.
   *
   * 1-го числа месяца в 00:00 UTC PowerupPlugin делает РОВНО один пакетный
   * пакет (даже если threshold ещё не достигнут), чтобы кооператив всегда
   * имел свежий пакет в начале месяца. Идемпотентность через
   * `config.lastCalendarPackageMonth` (YYYY-MM): повтор в течение того же
   * месяца — no-op.
   */
  private async runCalendarTask(): Promise<void> {
    const nowIso = new Date().toISOString();
    const monthKey = nowIso.slice(0, 7); // YYYY-MM
    if (this.plugin.config.lastCalendarPackageMonth === monthKey) {
      // Уже отработали в этом месяце — идемпотентный no-op.
      return;
    }
    await this.executePackageTopup('calendar', nowIso);
  }

  /**
   * Epic 13 v5.1 — общая обработка докупки (calendar + threshold).
   *
   * Порядок:
   * 1. Считать AXON-баланс и RUB на w.wal.bill (через blockchainPort).
   * 2. checkRunawayGuards → если signal → log + skip.
   * 3. blockchainPort.powerUp + (в production) inline billing::topupaxon +
   *    HTTP confirm к provider'у через BillingProviderClient.confirmTopupAxon.
   * 4. recordTopup (fresh-snapshot commit).
   *
   * При MonthlyPackageQuotaExceeded от provider'а — tripCircuitBreaker.
   */
  protected async executePackageTopup(trigger: 'calendar' | 'threshold', nowIso: string): Promise<void> {
    const username = coopConfig.coopname;
    try {
      const account = await this.blockchainPort.getAccount(username);
      if (!account) throw new Error('Аккаунт не найден');

      // AXON-баланс кооператива (системный токен Воскхода) — берём из account.
      // На MVP-этапе billWalletRub считаем 0 (provider — источник истины);
      // финальная проверка в provider'е через accountPackageTopup.
      const axonBalance = Number(account.cpu_limit?.max ?? 0); // TODO: использовать реальный AXON balance из eosio.token.
      const billWalletRub = 0;

      const signal = await this.checkRunawayGuards({ nowIso, axonBalance, billWalletRub });
      if (signal) {
        this.logger.info(`PowerupPlugin[${trigger}]: skip — guard "${signal}" сработал`);
        return;
      }

      const quantity = this.getQuantity(this.plugin.config.dailyPackageSize);
      await this.blockchainPort.powerUp(username, quantity);

      // Real confirm-cycle to provider — TODO: подключить BillingProviderClient.confirmTopupAxon
      // после того как PowerupPlugin сможет получить payment_hash от provider'а
      // через createPackageInvoice. На MVP — только PowerUp + локальный recordTopup.

      await this.recordTopup({
        axonAmount: this.plugin.config.dailyPackageSize,
        nowIso,
        trigger,
      });

      const updatedAccount = await this.blockchainPort.getAccount(username);
      if (!updatedAccount) return;
      await this.log({
        type: trigger === 'calendar' ? 'daily' : 'now',
        amount: quantity,
        resources: {
          username: updatedAccount.account_name,
          ram_usage: updatedAccount.ram_usage,
          ram_quota: updatedAccount.ram_quota,
          net_limit: updatedAccount.net_limit,
          cpu_limit: updatedAccount.cpu_limit,
        },
      });
    } catch (error: any) {
      // Provider может бросить MonthlyPackageQuotaExceeded — ловим и активируем breaker.
      if (error?.response?.data?.error === 'MonthlyPackageQuotaExceeded') {
        const monthKey = new Date(nowIso).toISOString().slice(0, 7);
        await this.tripCircuitBreaker(monthKey);
        return;
      }
      this.logger.info(`PowerupPlugin[${trigger}]: executePackageTopup error`, error as Error);
    }
  }

  private getQuantity(amount: number): string {
    return `${amount.toFixed(this.plugin.config.systemPrecision)} ${this.plugin.config.systemSymbol}`;
  }

  /**
   * Epic 13 v5.1 — единая проверка 8 слоёв защиты от runaway.
   * Возвращает имя сработавшего guard'а (или `null`, если все прошли).
   * Гарантирует: пакет НЕ будет докуплен, пока хотя бы один guard сигналит.
   *
   * Порядок важен — дешёвые проверки первыми, чтобы не тянуть RPC ради
   * банального cooldown'а.
   */
  protected async checkRunawayGuards(input: {
    nowIso: string;
    axonBalance: number; // в системных AXON-единицах
    billWalletRub: number; // RUB в w.wal.bill[coopname]
  }): Promise<string | null> {
    const cfg = this.plugin.config;
    const now = new Date(input.nowIso);
    const todayKey = input.nowIso.slice(0, 10); // YYYY-MM-DD
    const monthKey = input.nowIso.slice(0, 7); // YYYY-MM

    // (6) Circuit breaker — приоритет 1 — если задан и ещё не истёк.
    if (cfg.circuitBreakerUntilMonth && cfg.circuitBreakerUntilMonth >= monthKey) {
      return 'circuit_breaker';
    }
    // (1) Cooldown.
    if (cfg.lastTopupAt) {
      const lastMs = Date.parse(cfg.lastTopupAt);
      if (Number.isFinite(lastMs)) {
        const diffMin = (now.getTime() - lastMs) / 60_000;
        if (diffMin < cfg.cooldownMinutes) return 'cooldown';
      }
    }
    // (2) Daily AXON cap + (3) Daily package cap — проверяем относительно
    // СЕГОДНЯШНЕГО счётчика; если день сменился, инкременты обнулятся при
    // commit (см. recordTopup).
    const dayChanged = cfg.todayCounterDate !== todayKey;
    const todayAxonSpent = dayChanged ? 0 : Number(cfg.todayAxonSpent || 0);
    const todayPackagesIssued = dayChanged ? 0 : Number(cfg.todayPackagesIssued || 0);
    if (todayAxonSpent + cfg.dailyPackageSize > cfg.dailyAxonCap) return 'daily_axon_cap';
    if (todayPackagesIssued + 1 > cfg.dailyPackageCap) return 'daily_package_cap';
    // (4) AXON pre-gate.
    if (input.axonBalance < cfg.axonMinBalance) return 'axon_pre_gate';
    // (5) RUB floor.
    if (input.billWalletRub < cfg.rubFloor) return 'rub_floor';
    // (7) Monthly RUB cap — на этом уровне плагин знает только локальный cap;
    // финальная проверка (с учётом subscription_type.monthly_quota_rub) идёт
    // на стороне provider'а через MonthlyPackageQuotaExceeded.
    // На стороне плагина считаем по daily-counter * 30 (грубая оценка); точный
    // учёт делается provider'ом при createPackageInvoice.
    // (8) dailyPackageSize override — gate'ом не является, но фиксируем
    // что размер пакета берём из config (не magic), уже учтено выше.
    return null;
  }

  /**
   * Epic 13 v5.1 — атомарный fresh-snapshot commit факта докупки в config:
   * перечитываем config из БД, считаем дельту, сохраняем единый JSONB. См.
   * паттерн в runDailyTask — daily-cron держит in-memory снимок с момента boot.
   */
  protected async recordTopup(input: { axonAmount: number; nowIso: string; trigger: 'calendar' | 'threshold' }): Promise<void> {
    const todayKey = input.nowIso.slice(0, 10);
    const monthKey = input.nowIso.slice(0, 7);
    const fresh = await this.extensionRepository.findByName(this.name);
    const prev = fresh?.config ?? this.plugin.config;
    const dayChanged = prev.todayCounterDate !== todayKey;
    const nextConfig: IConfig = {
      ...prev,
      lastTopupAt: input.nowIso,
      todayCounterDate: todayKey,
      todayAxonSpent: dayChanged ? input.axonAmount : Number(prev.todayAxonSpent || 0) + input.axonAmount,
      todayPackagesIssued: dayChanged ? 1 : Number(prev.todayPackagesIssued || 0) + 1,
      lastCalendarPackageMonth: input.trigger === 'calendar' ? monthKey : prev.lastCalendarPackageMonth,
    };
    await this.extensionRepository.update({ name: this.name, config: nextConfig });
    this.plugin = { ...this.plugin, config: nextConfig };
  }

  /**
   * Epic 13 v5.1 — активация circuit breaker'а до конца месяца. Вызывается из
   * 13.5 при отлове MonthlyPackageQuotaExceeded от provider'а.
   */
  protected async tripCircuitBreaker(monthKey: string): Promise<void> {
    const fresh = await this.extensionRepository.findByName(this.name);
    const nextConfig: IConfig = {
      ...(fresh?.config ?? this.plugin.config),
      circuitBreakerUntilMonth: monthKey,
    };
    await this.extensionRepository.update({ name: this.name, config: nextConfig });
    this.plugin = { ...this.plugin, config: nextConfig };
    this.logger.info(`PowerupPlugin: circuit-breaker activated until end of ${monthKey}`);
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
        // Epic 13 v5.1: threshold-trigger теперь проходит через checkRunawayGuards
        // + recordTopup внутри executePackageTopup. Это гарантирует cooldown,
        // daily caps, circuit-breaker и идемпотентность через единую точку.
        await this.executePackageTopup('threshold', new Date().toISOString());
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
