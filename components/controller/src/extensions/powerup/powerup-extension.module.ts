import cron from 'node-cron';
import { createHash } from 'crypto';
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
  // 5) RUB floor — минимальный RUB на w.wal.bill[coopname], при котором ещё
  //    можно докупать. Запасной guard поверх subscription_type.min_topup_rub.
  rubFloor: 100,
  // 6) Circuit breaker — после превышения месячного RUB-потолка плагин стопится
  //    до начала следующего месяца. Поле хранит YYYY-MM, до которого блокировка действует.
  circuitBreakerUntilMonth: '',
  // 7) Monthly RUB cap — суммарный RUB-потолок за месяц на этот плагин.
  //    Epic 13 v5.1 (исправленная модель): provider на горячем пути не участвует,
  //    поэтому месячный потолок enforce'ится ЛОКАЛЬНО через monthRubSpent.
  monthlyRubCap: 5000,
  // 8) Идемпотентность calendar-trigger'а — YYYY-MM последнего календарного пакета.
  lastCalendarPackageMonth: '',
  // Epic 13 v5.1 — связь с реестром подписок у провайдера. 0 означает, что
  // пакетная модель ещё не подключена: PowerupPlugin делает только on-chain
  // powerup без обращения к provider'у. Должен быть выставлен оператором
  // в admin-UI (Story 13.8 desktop settings) после того, как provider создал
  // подписку с subscription_type.kind=package для этого кооператива.
  subscriptionId: 0,
  // Счётчик пакетов текущего месяца (1, 2, 3...). Сбрасывается на 1 при первом
  // packageTopup в новом месяце; используется как idx в детерминированном
  // payment_hash = sha256(coopname|YYYY-MM-01|converttoaxn|idx). Provider
  // восстанавливает тот же хэш из события парсера и дедуплицирует invoice.
  monthlyPackageIdx: 0,
  // Adversarial round 2: YYYY-MM, к которому относится monthlyPackageIdx.
  // lastPackagePeriod обновляется на КАЖДОМ recordTopup (calendar + threshold),
  // idx считается по нему — иначе threshold-first в новом месяце даст idx=1
  // при второй докупке → коллизия payment_hash → double-burn.
  lastPackagePeriod: '',
  // Epic 13 v5.1 — локальный месячный RUB-аккумулятор (provider off hot-path):
  // суммарный членский RUB, потраченный на пакеты в текущем месяце. Сбрасывается
  // при смене monthRubPeriod. Обеспечивает monthlyRubCap без участия провайдера.
  monthRubSpent: 0,
  monthRubPeriod: '',

  // ===== Epic 13 v5.1 — счётчики дня (сбрасываются ежедневной cron-job) =====
  todayAxonSpent: 0,
  todayPackagesIssued: 0,
  // ISO-дата, к которой относятся todayAxonSpent / todayPackagesIssued — позволяет
  // определить, что сутки сменились, и обнулить счётчики при следующем runTask.
  todayCounterDate: '',
  // ISO-таймштамп последней докупки (для cooldown).
  lastTopupAt: '',

  // ===== Epic 13 v5.1 — pre-burn persistence (adversarial round 2) =====
  // Перед on-chain packagePowerUp пишем в config факт «готовимся жечь членский».
  // Если процесс падает между tx и recordTopup, boot-time recovery увидит
  // pendingPaymentHash и ПРОДВИНЕТ idx без повтора tx (контракт payment_hash не
  // дедуплицирует, поэтому idx нельзя переиспользовать — иначе double-burn).
  pendingPaymentHash: '',
  pendingMonthKey: '',
  pendingIdx: 0,
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
  subscriptionId: z
    .number()
    .int()
    .min(0)
    .default(defaultConfig.subscriptionId)
    .describe(
      describeField({
        label: 'ID подписки package-типа у провайдера',
        note: '0 = пакетная модель не подключена. Заполняется оператором после регистрации subscription_type.kind=package у провайдера.',
        rules: ['val >= 0'],
      })
    ),
  monthlyPackageIdx: z
    .number()
    .int()
    .min(0)
    .default(defaultConfig.monthlyPackageIdx)
    .describe(describeField({ label: 'Индекс пакета в текущем месяце', visible: false })),
  lastPackagePeriod: z
    .string()
    .default(defaultConfig.lastPackagePeriod)
    .describe(describeField({ label: 'YYYY-MM к которому относится monthlyPackageIdx', visible: false })),
  monthRubSpent: z
    .number()
    .min(0)
    .default(defaultConfig.monthRubSpent)
    .describe(describeField({ label: 'RUB потрачено за месяц', visible: false })),
  monthRubPeriod: z
    .string()
    .default(defaultConfig.monthRubPeriod)
    .describe(describeField({ label: 'YYYY-MM месячного RUB-счётчика', visible: false })),
  pendingPaymentHash: z
    .string()
    .default(defaultConfig.pendingPaymentHash)
    .describe(describeField({ label: 'Pre-burn payment_hash (recovery)', visible: false })),
  pendingMonthKey: z
    .string()
    .default(defaultConfig.pendingMonthKey)
    .describe(describeField({ label: 'Pre-burn YYYY-MM (recovery)', visible: false })),
  pendingIdx: z
    .number()
    .int()
    .min(0)
    .default(defaultConfig.pendingIdx)
    .describe(describeField({ label: 'Pre-burn idx (recovery)', visible: false })),
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
  // Epic 13 v5.1 — in-process mutex для executePackageTopup. Защищает от наложения
  // calendar (00:00 UTC) + threshold (per-minute) триггеров: иначе оба прочитают
  // stale config, пройдут guards и сделают двойной powerUp до того, как любой
  // успеет recordTopup (см. adversarial review 2026-05-30, BLOCKER #3).
  private packageTopupInflight = false;

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

    // Epic 13 v5.1: все три крона на UTC, чтобы daily-counter (todayCounterDate)
    // и monthly-key (lastCalendarPackageMonth) совпадали с PowerupPlugin'овой
    // логикой (`nowIso.slice(0,7)`). Без timezone:'UTC' тик сместится в локальное
    // время сервера и сломает идемпотентность.
    this.dailyCronJob = cron.schedule(
      '0 0 * * *',
      () => { void this.runDailyTask().catch((err) =>
        this.logger.error('PowerupPlugin: daily-cron fail', err as Error),
      ); },
      { timezone: 'UTC' },
    );
    this.resourceCronJob = cron.schedule(
      '* * * * *',
      () => { void this.runTask().catch((err) =>
        this.logger.error('PowerupPlugin: resource-cron fail', err as Error),
      ); },
      { timezone: 'UTC' },
    );
    // Epic 13 v5.1 — calendar trigger: 1-го числа месяца в 00:00 UTC.
    // Идемпотентен через config.lastCalendarPackageMonth.
    this.calendarCronJob = cron.schedule(
      '0 0 1 * *',
      () => {
        void this.runCalendarTask().catch((err) =>
          this.logger.error('PowerupPlugin: calendar-trigger fail', err as Error),
        );
      },
      { timezone: 'UTC' },
    );

    // Adversarial round 2 BLOCKER #1: pre-burn recovery должен идти ПЕРВЫМ,
    // ДО boot-time backfill calendar. Иначе runCalendarTask() сделает второй
    // powerUp на том же idx — double-burn AXON. Recovery продвигает idx по
    // pending без повтора tx; calendar backfill затем скипнет через свежий idx.
    await this.recoverPendingIfAny().catch((err) =>
      this.logger.error('PowerupPlugin: pre-burn recovery fail', err as Error),
    );

    // Boot-time backfill: если процесс был down 1-го числа в 00:00 UTC, тик
    // пропущен и cron сработает только 1-го числа следующего месяца. Проверяем
    // на старте: если текущий месяц ещё не «закрыт» календарным пакетом, запускаем
    // runCalendarTask() однократно. Идемпотентность — через lastCalendarPackageMonth.
    void this.runCalendarTask().catch((err) =>
      this.logger.error('PowerupPlugin: calendar boot-backfill fail', err as Error),
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
   * Epic 13 v5.1 (исправленная модель) — общая обработка докупки (calendar + threshold).
   *
   * Порядок (provider на горячем пути НЕ участвует — автономно):
   * 1. checkRunawayGuards → если signal → log + skip.
   * 2. Локально посчитать детерминированный payment_hash (как его восстановит
   *    парсер Восхода): sha256(coopname|period_start|'converttoaxn'|idx).
   * 3. persistPending(payment_hash) — pre-burn маркер.
   * 4. blockchainPort.packagePowerUp — атомарно billing::converttoaxn (членский→AXON)
   *    + eosio::powerup (AXON→ресурсы), подпись coopname@active.
   * 5. recordTopup (fresh-snapshot commit, продвигает idx + месячный RUB-счётчик).
   *
   * Provider закрывает package-invoice реактивно: парсер Восхода ловит
   * billing::converttoaxn → callback POST /billing/topup-axon-confirmed.
   */
  protected async executePackageTopup(trigger: 'calendar' | 'threshold', nowIso: string): Promise<void> {
    // Mutex: единая точка для calendar + threshold. Любой одновременный тик
    // даёт `skip — inflight` и проигрывает гонку победителю; победитель доводит
    // цикл packagePowerUp → recordTopup до конца.
    if (this.packageTopupInflight) {
      this.logger.info(`PowerupPlugin[${trigger}]: skip — inflight (предыдущий тик ещё не завершён)`);
      return;
    }

    // Adversarial round 2 BLOCKER #1: если есть unresolved pending — boot recovery
    // не закрыл его. Новый packagePowerUp делать нельзя (контракт payment_hash не
    // дедупит → double-burn). Продвигаем idx по pending и выходим.
    if (this.plugin.config.pendingPaymentHash) {
      this.logger.info(`PowerupPlugin[${trigger}]: skip — есть unresolved pending payment_hash`);
      await this.recoverPendingIfAny().catch((err) =>
        this.logger.error('PowerupPlugin: inline pending recovery fail', err as Error),
      );
      return;
    }

    this.packageTopupInflight = true;
    const username = coopConfig.coopname;
    try {
      const account = await this.blockchainPort.getAccount(username);
      if (!account) throw new Error('Аккаунт не найден');

      // billWalletRub: на MVP считаем 0 (чтение w.wal.bill[coopname] не реализовано);
      // rubFloor по умолчанию 0, так что guard не блочит. TODO: подключить чтение
      // баланса w.wal.bill[coopname] через blockchainPort.
      const billWalletRub = 0;
      const signal = await this.checkRunawayGuards({ nowIso, billWalletRub });
      if (signal) {
        this.logger.info(`PowerupPlugin[${trigger}]: skip — guard "${signal}" сработал`);
        return;
      }

      const cfg = this.plugin.config;
      const axonQuantity = this.getQuantity(cfg.dailyPackageSize);
      const rubAmount = this.getRubAmount(cfg.dailyPackageSize);

      // Adversarial round 2 BLOCKER #2: idx считаем от lastPackagePeriod (обновляется
      // на КАЖДОМ recordTopup). Период-якорь — YYYY-MM-01; payment_hash детерминирован.
      const monthKey = nowIso.slice(0, 7);
      const periodStart = `${monthKey}-01`;
      const prevPackagePeriod = cfg.lastPackagePeriod || '';
      const nextIdx = prevPackagePeriod === monthKey ? (cfg.monthlyPackageIdx || 0) + 1 : 1;

      // Epic 13 v5.1 (исправленная модель): provider на горячем пути НЕ участвует.
      // payment_hash считаем ЛОКАЛЬНО и детерминированно — ровно так же, как его
      // потом восстановит парсер Восхода (sha256(coopname|period_start|action|idx)).
      const paymentHash = this.computePackagePaymentHash(username, periodStart, 'converttoaxn', nextIdx);

      // Pre-burn persistence: фиксируем намерение ДО on-chain транзакции. Если
      // процесс упадёт между tx и recordTopup, boot-recovery ПРОДВИНЕТ idx без
      // повтора tx (контракт payment_hash не дедупит → нельзя переиспользовать idx).
      await this.persistPending(paymentHash, monthKey, nextIdx);

      // Атомарная транзакция coopname@active: billing::converttoaxn (членский→AXON)
      // + eosio::powerup (AXON→ресурсы). Отказ пробрасывается → recordTopup не
      // выполнится → счётчики не растут (см. adversarial review 2026-05-30).
      await this.blockchainPort.packagePowerUp(username, rubAmount, axonQuantity, paymentHash);

      await this.recordTopup({
        axonAmount: cfg.dailyPackageSize,
        rubAmount: cfg.dailyPackageSize * 10,
        nowIso,
        trigger,
        monthlyPackageIdx: nextIdx,
        clearPending: true,
      });

      const updatedAccount = await this.blockchainPort.getAccount(username);
      if (!updatedAccount) return;
      await this.log({
        type: trigger === 'calendar' ? 'daily' : 'now',
        amount: axonQuantity,
        resources: {
          username: updatedAccount.account_name,
          ram_usage: updatedAccount.ram_usage,
          ram_quota: updatedAccount.ram_quota,
          net_limit: updatedAccount.net_limit,
          cpu_limit: updatedAccount.cpu_limit,
        },
      });
    } catch (error: any) {
      this.logger.error(`PowerupPlugin[${trigger}]: executePackageTopup error`, error as Error);
    } finally {
      this.packageTopupInflight = false;
    }
  }

  private getQuantity(amount: number): string {
    return `${amount.toFixed(this.plugin.config.systemPrecision)} ${this.plugin.config.systemSymbol}`;
  }

  /**
   * Epic 13 v5.1 — сумма членского взноса (RUB) к конвертации для получения
   * `axonAmount` AXON по курсу 10 ₽ = 1 AXON. Используется как amount для
   * billing::converttoaxn (root_govern_symbol = RUB).
   */
  private getRubAmount(axonAmount: number): string {
    const rub = axonAmount * 10;
    return `${rub.toFixed(config.blockchain.root_govern_precision)} ${config.blockchain.root_govern_symbol}`;
  }

  /**
   * Epic 13 v5.1 — детерминированный payment_hash докупки, идентичный тому, что
   * восстанавливает парсер Восхода и provider: sha256(coopname|period_start|action|idx),
   * period_start = YYYY-MM-01. Связывает on-chain billing::converttoaxn с
   * package-invoice провайдера без обращения к нему на горячем пути.
   */
  private computePackagePaymentHash(coopname: string, periodStart: string, actionName: string, idx: number): string {
    const payload = `${coopname}|${periodStart}|${actionName}|${idx}`;
    return createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Epic 13 v5.1 — единая проверка слоёв защиты от runaway.
   * Возвращает имя сработавшего guard'а (или `null`, если все прошли).
   * Гарантирует: пакет НЕ будет докуплен, пока хотя бы один guard сигналит.
   *
   * Порядок важен — дешёвые проверки первыми, чтобы не тянуть RPC ради
   * банального cooldown'а.
   */
  protected async checkRunawayGuards(input: {
    nowIso: string;
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
    // (4) AXON pre-gate — REMOVED в adversarial review 2026-05-30: cpu_limit.max ≠
    // AXON balance. Реальное чтение баланса AXON — отдельная задача; нехватка
    // AXON всё равно даст ошибку в packagePowerUp → recordTopup не выполнится.
    // (5) RUB floor.
    if (input.billWalletRub < cfg.rubFloor) return 'rub_floor';
    // (7) Monthly RUB cap — Epic 13 v5.1 (исправленная модель): enforce'им ЛОКАЛЬНО,
    // провайдера на горячем пути нет. monthRubSpent сбрасывается при смене месяца
    // (см. recordTopup). Размер докупки в RUB = dailyPackageSize * 10 (10₽=1AXON).
    if (cfg.monthlyRubCap > 0) {
      const monthChanged = cfg.monthRubPeriod !== monthKey;
      const monthRubSpent = monthChanged ? 0 : Number(cfg.monthRubSpent || 0);
      const rubThisPackage = cfg.dailyPackageSize * 10;
      if (monthRubSpent + rubThisPackage > cfg.monthlyRubCap) {
        // Жёсткий месячный потолок — поднимаем circuit-breaker до конца месяца,
        // чтобы не долбить guard каждую минуту до 1-го числа.
        await this.tripCircuitBreaker(monthKey);
        return 'monthly_rub_cap';
      }
    }
    return null;
  }

  /**
   * Epic 13 v5.1 — атомарный fresh-snapshot commit факта докупки в config:
   * перечитываем config из БД, считаем дельту, сохраняем единый JSONB. См.
   * паттерн в runDailyTask — daily-cron держит in-memory снимок с момента boot.
   */
  protected async recordTopup(input: {
    axonAmount: number;
    rubAmount: number;
    nowIso: string;
    trigger: 'calendar' | 'threshold';
    monthlyPackageIdx: number;
    clearPending?: boolean;
  }): Promise<void> {
    const todayKey = input.nowIso.slice(0, 10);
    const monthKey = input.nowIso.slice(0, 7);
    const fresh = await this.extensionRepository.findByName(this.name);
    const prev = fresh?.config ?? this.plugin.config;
    const dayChanged = prev.todayCounterDate !== todayKey;
    const monthChanged = prev.monthRubPeriod !== monthKey;
    const nextConfig: IConfig = {
      ...prev,
      lastTopupAt: input.nowIso,
      todayCounterDate: todayKey,
      todayAxonSpent: dayChanged ? input.axonAmount : Number(prev.todayAxonSpent || 0) + input.axonAmount,
      todayPackagesIssued: dayChanged ? 1 : Number(prev.todayPackagesIssued || 0) + 1,
      lastCalendarPackageMonth: input.trigger === 'calendar' ? monthKey : prev.lastCalendarPackageMonth,
      monthlyPackageIdx: input.monthlyPackageIdx,
      // Adversarial round 2 BLOCKER #2: lastPackagePeriod обновляется на КАЖДОМ
      // recordTopup независимо от trigger. Это база для расчёта idx в следующий раз.
      lastPackagePeriod: monthKey,
      // Epic 13 v5.1 — локальный месячный RUB-аккумулятор для monthlyRubCap.
      monthRubPeriod: monthKey,
      monthRubSpent: monthChanged ? input.rubAmount : Number(prev.monthRubSpent || 0) + input.rubAmount,
      // Pre-burn pending снимаем — recordTopup доехал, всё консистентно.
      pendingPaymentHash: input.clearPending ? '' : prev.pendingPaymentHash,
      pendingMonthKey: input.clearPending ? '' : prev.pendingMonthKey,
      pendingIdx: input.clearPending ? 0 : prev.pendingIdx,
    };
    await this.extensionRepository.update({ name: this.name, config: nextConfig });
    this.plugin = { ...this.plugin, config: nextConfig };
  }

  /**
   * Adversarial round 2 BLOCKER #1: записать pendingPaymentHash в config ДО
   * on-chain packagePowerUp'а. При краше процесса между tx и recordTopup boot
   * recovery увидит pending и продвинет idx, не повторяя tx.
   */
  protected async persistPending(paymentHash: string, monthKey: string, idx: number): Promise<void> {
    const fresh = await this.extensionRepository.findByName(this.name);
    const prev = fresh?.config ?? this.plugin.config;
    const nextConfig: IConfig = {
      ...prev,
      pendingPaymentHash: paymentHash,
      pendingMonthKey: monthKey,
      pendingIdx: idx,
    };
    await this.extensionRepository.update({ name: this.name, config: nextConfig });
    this.plugin = { ...this.plugin, config: nextConfig };
  }

  /**
   * Adversarial round 2 BLOCKER #1 (исправленная модель): boot-time recovery.
   * Если pendingPaymentHash не пуст — мы упали между on-chain packagePowerUp и
   * recordTopup. Неизвестно, долетела ли tx до chain'а, а контракт payment_hash
   * НЕ дедуплицирует — значит повторять tx нельзя (риск double-burn). Поэтому
   * консервативно ПРОДВИГАЕМ idx (recordTopup по pending) без повтора tx:
   *  - если tx долетела → состояние консистентно;
   *  - если нет → кооператив пропустил один пакет (добёрется следующим тиком по
   *    threshold/calendar с новым idx). Это безопасное направление отказа.
   * Provider узнаёт об on-chain событии реактивно через парсер → callback —
   * обращаться к нему из recovery не нужно.
   */
  protected async recoverPendingIfAny(): Promise<void> {
    const cfg = this.plugin.config;
    if (!cfg.pendingPaymentHash || !cfg.pendingMonthKey) return;

    this.logger.info(
      `PowerupPlugin: обнаружен pending paymentHash=${cfg.pendingPaymentHash} (${cfg.pendingMonthKey}/${cfg.pendingIdx}) — продвигаем idx без повтора tx`,
    );

    const nowIso = new Date().toISOString();
    await this.recordTopup({
      axonAmount: cfg.dailyPackageSize,
      rubAmount: cfg.dailyPackageSize * 10,
      nowIso,
      trigger: 'threshold',
      monthlyPackageIdx: cfg.pendingIdx,
      clearPending: true,
    });
    this.logger.info('PowerupPlugin: pending закрыт (idx продвинут)');
  }

  protected async clearPending(): Promise<void> {
    const fresh = await this.extensionRepository.findByName(this.name);
    const prev = fresh?.config ?? this.plugin.config;
    const nextConfig: IConfig = {
      ...prev,
      pendingPaymentHash: '',
      pendingMonthKey: '',
      pendingIdx: 0,
    };
    await this.extensionRepository.update({ name: this.name, config: nextConfig });
    this.plugin = { ...this.plugin, config: nextConfig };
  }

  /**
   * Epic 13 v5.1 — активация circuit breaker'а до конца месяца. Вызывается при
   * достижении локального monthlyRubCap (checkRunawayGuards).
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
        // daily/monthly caps, circuit-breaker и идемпотентность через единую точку.
        await this.executePackageTopup('threshold', new Date().toISOString());
      }
    } catch (error) {
      this.logger.info('Предупреждение при проверке и пополнении ресурсов:', error as Error);
    }
  }
}

@Module({
  // Epic 13 v5.1 (исправленная модель): PowerupPlugin автономен — provider на
  // горячем пути не участвует, BillingProviderClient больше не нужен. On-chain
  // докупка (billing::converttoaxn + eosio::powerup) идёт через BLOCKCHAIN_PORT;
  // provider узнаёт о событии реактивно через парсер Восхода → callback.
  providers: [PowerupPlugin],
  exports: [PowerupPlugin],
})
export class PowerupPluginModule {
  constructor(public readonly powerupPlugin: PowerupPlugin) {}

  async initialize() {
    await this.powerupPlugin.initialize();
  }
}
