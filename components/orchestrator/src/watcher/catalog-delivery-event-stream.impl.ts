/**
 * @fileoverview Поток событий каталога для watcher'а — опрос catalog-delivery
 * (Архитектура v5 каталога, 487-34).
 *
 * Контракт apps выведен: подписки кооператива ведёт провайдер, каталог
 * хранит их копию, выпуски живут в базе каталога. Оркестратор узнаёт о
 * переменах опросом catalog-delivery от имени своего кооператива:
 *
 *  - `GET /v1/subscriptions/active` (tenant JWT) — действующие подписки.
 *    Появилась — `subscription-activated`, пропала — `subscription-expired`.
 *    Продление подписки событием не считается: установка уже есть.
 *  - `dist-tags.latest` пакета в registry (через {@link LatestVersionPort}) —
 *    раз в `releasePollEvery` опросов. Сменилась версия — `release-published`.
 *    Каталог отдаёт версию уже с учётом scope выпуска для этого кооператива,
 *    поэтому событие идёт со scope `all`. Пропала версия — `release-withdrawn`.
 *
 * Первый удачный опрос — снимок: каждая действующая подписка выдаёт
 * `subscription-activated`, так узел доводится до состояния каталога после
 * перезапуска. Неудавшаяся обработка активации забывает подписку, и следующий
 * опрос выдаёт событие снова.
 */
import { Logger } from '@nestjs/common';
import type { AppsContractEvent, AppsContractEventStreamPort } from './ports';
import type { CatalogTenantToken } from './catalog-tenant-token';

const REQUEST_TIMEOUT_MS = 10_000;

/** Последняя доступная кооперативу версия пакета; `null` — выпуска нет. */
export interface LatestVersionPort {
  latestVersion(packageId: string): Promise<string | null>;
}

export interface CatalogDeliveryEventStreamConfig {
  catalogDeliveryBaseUrl: string;
  coopname: string;
  pollIntervalMs: number;
  /** Версии выпусков проверяются раз в столько опросов подписок. */
  releasePollEvery: number;
  /**
   * Пакеты, которые уже стоят на узле к моменту старта. Первый опрос сверяет
   * их с действующими подписками: установленное без подписки снимается.
   * Без этого приложение, отписанное пока оркестратор был выключен, работало
   * бы на узле без срока.
   */
  installedPackages?: () => Promise<string[]>;
  /**
   * Пакеты, чей контейнер сейчас работает. Каждый опрос сверяет с ним
   * приложения, которые оркестратор считает установленными: контейнер,
   * остановленный или удалённый мимо оркестратора (ручной `docker rm`, чистка
   * узла), ставится заново. До 26.11.2026 сверки не было, и такое приложение
   * не работало до перезапуска оркестратора.
   */
  runningPackages?: () => Promise<string[]>;
}

interface ActiveSubscriptionWire {
  package_id: string;
  state: 'trial' | 'active' | 'expired';
  end_at: string;
}

/** Потолок паузы между попытками установки одного пакета. */
const RETRY_MAX_MS = 10 * 60_000;

export class CatalogDeliveryEventStream implements AppsContractEventStreamPort {
  private readonly logger = new Logger(CatalogDeliveryEventStream.name);
  /** Пакеты, у которых контейнер видели работающим. */
  private readonly containerSeen = new Set<string>();
  private knownSubs = new Set<string>();
  private knownVersions = new Map<string, string>();
  /**
   * Неудачные установки: сколько раз подряд упала и когда пробовать снова.
   * Первая неудача повторяется следующим опросом, дальше пауза удваивается
   * до RETRY_MAX_MS: сломанный образ не должен дёргать реестр каждый опрос.
   */
  private failedInstalls = new Map<string, { count: number; retryAt: number }>();
  private initialised = false;
  private polls = 0;

  constructor(
    private readonly cfg: CatalogDeliveryEventStreamConfig,
    private readonly token: CatalogTenantToken,
    private readonly versions: LatestVersionPort,
  ) {}

  async subscribe(
    handler: (e: AppsContractEvent) => Promise<void>,
  ): Promise<{ unsubscribe(): void }> {
    let stopped = false;
    let inFlight = false;
    const tick = async (): Promise<void> => {
      if (stopped || inFlight || this.token.get() === null) return;
      inFlight = true;
      try {
        await this.poll(handler);
      } catch (e) {
        this.logger.error(`poll failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        inFlight = false;
      }
    };
    void tick();
    // timing: schedule — опрос каталога; событий каталог узлу не присылает
    const timer = setInterval(() => void tick(), this.cfg.pollIntervalMs);
    return {
      unsubscribe: () => {
        stopped = true;
        clearInterval(timer);
      },
    };
  }

  /** @internal exposed для юнит-тестов. */
  async poll(handler: (e: AppsContractEvent) => Promise<void>): Promise<void> {
    const live = await this.fetchLive();
    if (!this.initialised && this.cfg.installedPackages !== undefined) {
      for (const packageId of await this.cfg.installedPackages()) {
        // Установленное без подписки ниже получит subscription-expired.
        if (!live.has(packageId)) this.knownSubs.add(packageId);
      }
    }
    await this.dropVanishedContainers(live);
    const events: AppsContractEvent[] = [];
    const activation = new Map<AppsContractEvent, string>();

    const now = Date.now();
    const postponed = new Set<string>();
    for (const [packageId, endAtUnix] of live) {
      if (this.knownSubs.has(packageId)) continue;
      const failed = this.failedInstalls.get(packageId);
      if (failed !== undefined && failed.retryAt > now) {
        // Пауза после неудачи ещё идёт: подписку не считаем установленной.
        postponed.add(packageId);
        continue;
      }
      const e: AppsContractEvent = {
        kind: 'subscription-activated',
        coopname: this.cfg.coopname,
        packageId,
        expiresAtUnix: endAtUnix,
        blockNum: 0,
      };
      events.push(e);
      activation.set(e, packageId);
    }
    for (const packageId of this.knownSubs) {
      if (!live.has(packageId)) {
        events.push({ kind: 'subscription-expired', coopname: this.cfg.coopname, packageId, blockNum: 0 });
        this.knownVersions.delete(packageId);
      }
    }
    this.knownSubs = new Set([...live.keys()].filter((id) => !postponed.has(id)));
    for (const packageId of this.failedInstalls.keys()) {
      // Подписка пропала — устанавливать нечего, счётчик неудач не нужен.
      if (!live.has(packageId)) this.failedInstalls.delete(packageId);
    }

    if (this.initialised && this.polls % this.cfg.releasePollEvery === 0) {
      events.push(...(await this.releaseEvents(live)));
    }
    this.polls += 1;
    this.initialised = true;

    for (const e of events) {
      const packageId = activation.get(e);
      try {
        await handler(e);
        if (packageId !== undefined) this.failedInstalls.delete(packageId);
      } catch (err) {
        this.logger.error(
          `handler failed on ${e.kind} ${'packageId' in e ? e.packageId : ''}: ${err instanceof Error ? err.message : String(err)}`,
        );
        if (packageId !== undefined) {
          this.knownSubs.delete(packageId);
          const count = (this.failedInstalls.get(packageId)?.count ?? 0) + 1;
          const delay = count <= 1 ? 0 : Math.min(this.cfg.pollIntervalMs * 2 ** (count - 1), RETRY_MAX_MS);
          this.failedInstalls.set(packageId, { count, retryAt: Date.now() + delay });
        }
      }
    }
  }

  /**
   * Забыть установку приложения, чей контейнер перестал работать: этот же
   * опрос поставит его заново как новую подписку.
   *
   * Сверяются только пакеты, у которых контейнер уже видели работающим:
   * приложение без бэкенда контейнера не имеет, и переустанавливать его
   * каждый опрос незачем.
   */
  private async dropVanishedContainers(live: Map<string, number>): Promise<void> {
    if (this.cfg.runningPackages === undefined) return;
    const running = new Set(await this.cfg.runningPackages());
    for (const packageId of this.containerSeen) {
      if (!live.has(packageId)) {
        this.containerSeen.delete(packageId);
      } else if (!running.has(packageId) && this.knownSubs.has(packageId)) {
        this.logger.warn(`контейнер приложения ${packageId} не работает — устанавливаю заново`);
        this.knownSubs.delete(packageId);
        this.containerSeen.delete(packageId);
      }
    }
    for (const packageId of running) {
      if (live.has(packageId)) this.containerSeen.add(packageId);
    }
  }

  /**
   * Смена версии у действующих подписок. Первое наблюдение версии события не
   * даёт: установку при активации ведёт `subscription-activated`.
   */
  private async releaseEvents(live: Map<string, number>): Promise<AppsContractEvent[]> {
    const events: AppsContractEvent[] = [];
    for (const packageId of live.keys()) {
      let version: string | null;
      try {
        version = await this.versions.latestVersion(packageId);
      } catch (e) {
        this.logger.warn(`версия ${packageId} не получена: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      const prev = this.knownVersions.get(packageId);
      if (version === null) {
        if (prev !== undefined) {
          events.push({ kind: 'release-withdrawn', packageId, version: prev, blockNum: 0 });
          this.knownVersions.delete(packageId);
        }
        continue;
      }
      if (prev !== undefined && prev !== version) {
        events.push({ kind: 'release-published', packageId, version, scopeType: 'all', blockNum: 0 });
      }
      this.knownVersions.set(packageId, version);
    }
    return events;
  }

  /** Действующие подписки: пакет → конец срока, unix-секунды. */
  private async fetchLive(): Promise<Map<string, number>> {
    const ctrl = new AbortController();
    // timing: timeout — запрос к каталогу не держит опрос дольше 10 секунд
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const resp = await fetch(`${this.cfg.catalogDeliveryBaseUrl}/v1/subscriptions/active`, {
        headers: { Authorization: `Bearer ${this.token.require()}` },
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        throw new Error(`catalog-delivery GET /v1/subscriptions/active → HTTP ${resp.status}`);
      }
      const body = (await resp.json()) as { subscriptions?: ActiveSubscriptionWire[] };
      const live = new Map<string, number>();
      for (const s of body.subscriptions ?? []) {
        if (s.state === 'expired') continue;
        live.set(s.package_id, Math.floor(Date.parse(s.end_at) / 1000) || 0);
      }
      return live;
    } finally {
      clearTimeout(timer);
    }
  }
}
