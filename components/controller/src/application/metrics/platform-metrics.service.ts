import { Inject, Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Counter, Gauge, register as globalRegistry, type Registry } from 'prom-client';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { PLATFORM_METRICS_PORT, type PlatformMetricsPort } from '~/domain/metrics/ports/platform-metrics.port';
import { USER_ACTIVITY_PORT, type UserActivityPort } from '~/domain/metrics/ports/user-activity.port';

/**
 * Как часто пересчитывать снимок. Полминуты недостаточно, а раз в минуту —
 * ровно то, что нужно: показатели меняются медленно, а Prometheus всё равно
 * скрейпит реже, чем раз в 15 секунд.
 */
const REFRESH_MS = Number(process.env.PLATFORM_METRICS_INTERVAL_MS) || 60_000;

/** Окна активности, попадающие в метку `window`. */
const ACTIVITY_WINDOWS: Record<string, number> = { '1d': 1, '7d': 7, '30d': 30 };

/**
 * Идемпотентная регистрация метрики: повторный вызов конструктора (юнит-тест,
 * пересборка модуля) переиспользует уже зарегистрированную на реестре метрику
 * вместо throw «metric already registered». Тот же приём, что в
 * `AuthMetricsService`.
 */
function ensureGauge(registry: Registry, config: { name: string; help: string; labelNames?: string[] }): Gauge<string> {
  const existing = registry.getSingleMetric(config.name);
  if (existing) return existing as Gauge<string>;
  return new Gauge({ labelNames: [], ...config, registers: [registry] });
}

function ensureCounter(registry: Registry, config: { name: string; help: string; labelNames?: string[] }): Counter<string> {
  const existing = registry.getSingleMetric(config.name);
  if (existing) return existing as Counter<string>;
  return new Counter({ labelNames: [], ...config, registers: [registry] });
}

/** Состояние синхронизации в виде, не завязанном на DTO модуля system. */
export interface NodeSyncMetricInput {
  status: string;
  head_block_num?: number;
  current_block_num?: number;
  lag_blocks?: number;
  cursor_updated_at?: string;
}

/**
 * Прикладные метрики кооператива на эндпоинте GET /metrics.
 *
 * Метрики живут на ГЛОБАЛЬНОМ реестре prom-client — его же по умолчанию отдаёт
 * эндпоинт `@willsoto/nestjs-prometheus`, где уже лежат процессные метрики Node
 * и счётчики входов из `AuthMetricsService`. Отдельной проводки в экспозицию
 * не требуется.
 *
 * Метка `coopname` здесь НЕ ставится: кооператив на инстанс один, а имя
 * приезжает меткой цели из конфигурации скрейпа Prometheus. Дублировать его в
 * самой метрике значит хранить одно и то же значение в двух местах, которые
 * рано или поздно разойдутся.
 *
 * Показатели узла (голова цепи, позиция чтения, отставание) не считаются здесь
 * заново: их уже считает `NodeSyncHealthService` на своём тике, и он же зовёт
 * {@link recordNodeSync}. Второй опрос цепи ради тех же чисел был бы лишней
 * нагрузкой и вторым источником правды.
 */
@Injectable()
export class PlatformMetricsService {
  private readonly usersByStatus: Gauge<string>;
  private readonly usersWithAccountFlag: Gauge<string>;
  private readonly usersWithChainKey: Gauge<string>;
  private readonly chainParticipants: Gauge<string>;
  private readonly candidatesByStatus: Gauge<string>;
  private readonly outboxDepth: Gauge<string>;
  private readonly activeUsers: Gauge<string>;

  private readonly chainHeadBlock: Gauge<string>;
  private readonly parserCurrentBlock: Gauge<string>;
  private readonly parserLagBlocks: Gauge<string>;
  private readonly parserCursorAge: Gauge<string>;
  private readonly parserSynced: Gauge<string>;

  private readonly collectErrors: Counter<string>;
  private readonly lastSuccess: Gauge<string>;

  constructor(
    private readonly logger: WinstonLoggerService,
    @Inject(PLATFORM_METRICS_PORT) private readonly snapshot: PlatformMetricsPort,
    @Inject(USER_ACTIVITY_PORT) private readonly activity: UserActivityPort
  ) {
    this.logger.setContext(PlatformMetricsService.name);

    this.usersByStatus = ensureGauge(globalRegistry, {
      name: 'coop_users_total',
      help: 'Число учётных записей пайщиков по статусу',
      labelNames: ['status'],
    });
    // Три показателя об одном и том же намеренно: они расходятся, и расхождение
    // — сама по себе диагностика. Флаг ставит контроллер, ключ появляется при
    // создании аккаунта, строка в soviet::participants означает, что совет
    // принял пайщика. 29.08.2026 на дев-стенде у пайщика `ant` флаг был false
    // при непустом ключе и живой строке в реестре цепи.
    this.usersWithAccountFlag = ensureGauge(globalRegistry, {
      name: 'coop_users_with_account_flag',
      help: 'Число учётных записей с выставленным флагом has_account (флаг контроллера, может расходиться с цепью)',
    });
    this.usersWithChainKey = ensureGauge(globalRegistry, {
      name: 'coop_users_with_chain_key',
      help: 'Число учётных записей с сохранённым публичным ключом цепи',
    });
    this.chainParticipants = ensureGauge(globalRegistry, {
      name: 'coop_chain_participants_total',
      help: 'Число пайщиков в реестре кооператива в самой цепи (живые строки soviet::participants)',
    });
    this.candidatesByStatus = ensureGauge(globalRegistry, {
      name: 'coop_candidates_total',
      help: 'Число кандидатов по статусу заявления',
      labelNames: ['status'],
    });
    this.outboxDepth = ensureGauge(globalRegistry, {
      name: 'coop_notification_outbox_depth',
      help: 'Число строк в транзакционном outbox Центра уведомлений по статусу',
      labelNames: ['status'],
    });
    this.activeUsers = ensureGauge(globalRegistry, {
      name: 'coop_users_active',
      help: 'Число разных пайщиков, заходивших за окно (по факту авторизованных запросов, сутки по UTC)',
      labelNames: ['window'],
    });

    this.chainHeadBlock = ensureGauge(globalRegistry, {
      name: 'coop_chain_head_block',
      help: 'Номер блока в голове цепи',
    });
    this.parserCurrentBlock = ensureGauge(globalRegistry, {
      name: 'coop_parser_current_block',
      help: 'Номер блока, до которого дочитал парсер узла',
    });
    this.parserLagBlocks = ensureGauge(globalRegistry, {
      name: 'coop_parser_lag_blocks',
      help: 'Отставание парсера от головы цепи в блоках',
    });
    this.parserCursorAge = ensureGauge(globalRegistry, {
      name: 'coop_parser_cursor_age_seconds',
      help: 'Сколько секунд назад двигалась позиция чтения парсера',
    });
    this.parserSynced = ensureGauge(globalRegistry, {
      name: 'coop_parser_synced',
      help: 'Узел у головы цепи: 1 — да, 0 — отстаёт или связи нет',
    });

    this.collectErrors = ensureCounter(globalRegistry, {
      name: 'coop_platform_metrics_collect_errors_total',
      help: 'Число неудачных пересчётов прикладных метрик',
    });
    this.lastSuccess = ensureGauge(globalRegistry, {
      name: 'coop_platform_metrics_last_success_timestamp_seconds',
      help: 'Момент последнего удачного пересчёта прикладных метрик (unix-время)',
    });
  }

  @Interval('platform-metrics', REFRESH_MS)
  async refresh(): Promise<void> {
    try {
      const [snapshot, active] = await Promise.all([this.snapshot.collect(), this.collectActivity()]);

      // reset() перед записью обязателен для метрик С МЕТКАМИ. Статус, по
      // которому строк не осталось, из выборки просто пропадает, а prom-client
      // помнит последнее записанное значение — и ряд навсегда застыл бы на
      // старом числе. Досыпка нулей в адаптере закрывает только известные
      // значения перечисления; reset снимает и те, что успели появиться из базы.
      this.usersByStatus.reset();
      for (const [status, count] of Object.entries(snapshot.usersByStatus)) {
        this.usersByStatus.set({ status }, count);
      }

      this.candidatesByStatus.reset();
      for (const [status, count] of Object.entries(snapshot.candidatesByStatus)) {
        this.candidatesByStatus.set({ status }, count);
      }

      this.outboxDepth.reset();
      for (const [status, count] of Object.entries(snapshot.notificationOutboxByStatus)) {
        this.outboxDepth.set({ status }, count);
      }

      this.activeUsers.reset();
      for (const [window, count] of Object.entries(active)) {
        this.activeUsers.set({ window }, count);
      }

      this.usersWithAccountFlag.set(snapshot.usersWithAccountFlag);
      this.usersWithChainKey.set(snapshot.usersWithChainKey);
      this.chainParticipants.set(snapshot.chainParticipants);
      this.lastSuccess.set(Date.now() / 1000);
    } catch (error: any) {
      // Тик не имеет права уронить планировщик: следующий пересчитает всё
      // заново. Счётчик ошибок отдаётся наружу — по нему видно, что метрики
      // застыли, а не что показатели перестали меняться.
      this.collectErrors.inc();
      this.logger.error(`Не удалось пересчитать прикладные метрики: ${error?.message}`, error?.stack);
    }
  }

  /**
   * Записать состояние синхронизации узла. Зовётся из `NodeSyncHealthService`
   * его же тиком — там эти числа уже посчитаны.
   *
   * Сбой записи метрики проглатывается: телеметрия не имеет права сломать
   * пересчёт состояния узла, от которого зависит рабочий стол.
   */
  recordNodeSync(state: NodeSyncMetricInput): void {
    try {
      if (typeof state.head_block_num === 'number') this.chainHeadBlock.set(state.head_block_num);
      if (typeof state.current_block_num === 'number') this.parserCurrentBlock.set(state.current_block_num);
      if (typeof state.lag_blocks === 'number') this.parserLagBlocks.set(state.lag_blocks);

      const movedAt = state.cursor_updated_at ? Date.parse(state.cursor_updated_at) : Number.NaN;
      if (!Number.isNaN(movedAt)) {
        this.parserCursorAge.set(Math.max(0, (Date.now() - movedAt) / 1000));
      }

      this.parserSynced.set(state.status === 'SYNCED' ? 1 : 0);
    } catch (error: any) {
      this.logger.warn(`Метрика состояния узла не записана: ${error?.message}`);
    }
  }

  private async collectActivity(): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const [label, days] of Object.entries(ACTIVITY_WINDOWS)) {
      result[label] = await this.activity.countActive(days);
    }
    return result;
  }
}
