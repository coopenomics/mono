// infrastructure/blockchain/rpc-pool.service.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { APIClient } from '@wharfkit/antelope';
import config from '~/config/config';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';

/**
 * Пул COOPOS RPC-узлов с health-aware failover (CoopID, Story 9.4).
 *
 * Поведение — sticky healthy primary + автоматический failover (а НЕ per-request
 * round-robin): все чтения идут на один здоровый primary, переключение на
 * следующий здоровый — только при сбое или когда health-check пометил узел
 * недоступным. Это сохраняет read-after-write для остального read-path и
 * консистентность TaPoS на write-path, давая при этом устойчивость к падению узла.
 *
 * Здоровье узла определяет периодический `get_info`-probe (однозначный сигнал, не
 * путается с прикладными 4xx вроде «аккаунт не найден») + немедленная пометка
 * недоступным при транспортном сбое живого запроса (detection ≤ интервала, обычно
 * мгновенно). Недоступный узел переопрашивается по экспоненциальному backoff
 * (1с/2с/4с/8с) — частая проверка флапающего, редкая стабильно мёртвого.
 */

/** Экспоненциальный backoff переопроса недоступного узла: 1с/2с/4с/8с (cap 8с). */
export function rpcBackoffMs(failures: number): number {
  return Math.min(8000, 1000 * 2 ** Math.max(0, failures - 1));
}

/** HTTP-статус ошибки @wharfkit APIClient, если есть (иначе undefined — сеть/таймаут). */
function rpcErrorStatus(e: unknown): number | undefined {
  const status = (e as { response?: { status?: unknown } } | null)?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * Стоит ли переключаться на другой узел при этой ошибке. Транспортные ошибки
 * (нет ответа/таймаут, 5xx, 429) — да; прикладные 4xx (узел дал однозначный ответ,
 * напр. «аккаунт не найден») — нет: это не проблема здоровья узла, не маскируем
 * перебором узлов и не портим health-состояние пула.
 */
export function isFailoverWorthy(e: unknown): boolean {
  const status = rpcErrorStatus(e);
  if (status === undefined) return true;
  if (status === 429 || status >= 500) return true;
  return false;
}

interface RpcEndpoint {
  url: string;
  client: APIClient;
  healthy: boolean;
  failures: number;
  /** Время (ms epoch), раньше которого недоступный узел не переопрашивается (backoff). */
  nextProbeAt: number;
}

@Injectable()
export class RpcPool implements OnModuleInit, OnModuleDestroy {
  private readonly endpoints: RpcEndpoint[];
  private activeIndex = 0;
  private healthTimer: NodeJS.Timeout | null = null;

  /** Источник времени — вынесён для детерминизма тестов (backoff/cooldown). */
  private now: () => number = () => Date.now();

  constructor(private readonly logger: WinstonLoggerService) {
    // BLOCKCHAIN_RPC всегда preferred primary (endpoint[0]) — happy-path
    // идентичен поведению до пула; остальные из BLOCKCHAIN_RPC_LIST как резерв.
    const urls = [...new Set([config.blockchain.url, ...config.blockchain.rpcList])];
    this.endpoints = urls.map((url) => ({
      url,
      client: new APIClient({ url }),
      healthy: true,
      failures: 0,
      nextProbeAt: 0,
    }));
  }

  onModuleInit(): void {
    const interval = config.blockchain.rpcHealthCheckIntervalMs;
    if (this.endpoints.length > 1 && interval > 0) {
      this.healthTimer = setInterval(() => void this.probeAll(), interval);
      this.healthTimer.unref?.();
    }
  }

  onModuleDestroy(): void {
    if (this.healthTimer) clearInterval(this.healthTimer);
    this.healthTimer = null;
  }

  /** Текущий здоровый клиент (для write/session-пути и контрактных утилит). */
  getActiveClient(): APIClient {
    return this.pickActive().client;
  }

  /** URL текущего здорового узла (для сессии транзакции на write-пути). */
  activeUrl(): string {
    return this.pickActive().url;
  }

  /**
   * Выполнить чтение на здоровом узле с failover. Транспортный сбой → следующий
   * здоровый узел; прикладная 4xx → проброс без перебора. Если все узлы
   * исчерпаны — бросает последнюю ошибку (вызывающий решает: degraded/кэш).
   */
  async read<T>(fn: (client: APIClient) => Promise<T>): Promise<T> {
    const order = this.readOrder();
    let lastErr: unknown;
    for (let i = 0; i < order.length; i++) {
      const ep = order[i];
      try {
        const res = await this.withTimeout(fn(ep.client), config.blockchain.rpcTimeoutMs);
        this.markHealthy(ep);
        this.activeIndex = this.endpoints.indexOf(ep);
        return res;
      } catch (e) {
        lastErr = e;
        if (!isFailoverWorthy(e)) throw e;
        this.markUnhealthy(ep);
        if (i < order.length - 1) {
          this.logger.warn(`RpcPool: узел ${ep.url} недоступен, переключаюсь: ${errMsg(e)}`);
        }
      }
    }
    throw lastErr ?? new Error('RpcPool: нет доступных RPC-узлов');
  }

  /**
   * Прочитать `fn` параллельно с до `count` различных здоровых узлов (Story 9.7,
   * консенсус). Возвращает только успешные сэмплы (сбойные узлы молча отброшены).
   * <2 узлов — консенсус проверить нечем (вызывающий трактует как single-source).
   */
  async readFromHealthy<T>(count: number, fn: (client: APIClient) => Promise<T>): Promise<Array<{ url: string; value: T }>> {
    const healthy = this.endpoints.filter((e) => e.healthy);
    const chosen = (healthy.length ? healthy : this.endpoints).slice(0, Math.max(1, count));
    const settled = await Promise.allSettled(
      chosen.map((ep) =>
        this.withTimeout(fn(ep.client), config.blockchain.rpcTimeoutMs).then((value) => ({ url: ep.url, value })),
      ),
    );
    return settled
      .filter((s): s is PromiseFulfilledResult<{ url: string; value: T }> => s.status === 'fulfilled')
      .map((s) => s.value);
  }

  /** Фоновый health-probe: get_info по каждому узлу (с учётом backoff-cooldown). */
  private async probeAll(): Promise<void> {
    const now = this.now();
    await Promise.allSettled(
      this.endpoints.map(async (ep) => {
        if (!ep.healthy && now < ep.nextProbeAt) return; // ещё в backoff-cooldown
        try {
          await this.withTimeout(ep.client.v1.chain.get_info(), config.blockchain.rpcTimeoutMs);
          this.markHealthy(ep);
        } catch {
          this.markUnhealthy(ep);
        }
      }),
    );
  }

  /** Порядок попыток read: здоровые первыми (от active по кругу), затем недоступные. */
  private readOrder(): RpcEndpoint[] {
    const n = this.endpoints.length;
    const rotated: RpcEndpoint[] = [];
    for (let k = 0; k < n; k++) rotated.push(this.endpoints[(this.activeIndex + k) % n]);
    return [...rotated.filter((e) => e.healthy), ...rotated.filter((e) => !e.healthy)];
  }

  private pickActive(): RpcEndpoint {
    const active = this.endpoints[this.activeIndex];
    if (active?.healthy) return active;
    return this.endpoints.find((e) => e.healthy) ?? active ?? this.endpoints[0];
  }

  private markHealthy(ep: RpcEndpoint): void {
    ep.healthy = true;
    ep.failures = 0;
    ep.nextProbeAt = 0;
  }

  private markUnhealthy(ep: RpcEndpoint): void {
    ep.healthy = false;
    ep.failures += 1;
    ep.nextProbeAt = this.now() + rpcBackoffMs(ep.failures);
  }

  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    if (!ms || ms <= 0) return p;
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`RpcPool: таймаут RPC ${ms}мс`)), ms);
      t.unref?.();
      p.then(
        (v) => { clearTimeout(t); resolve(v); },
        (e) => { clearTimeout(t); reject(e); },
      );
    });
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
