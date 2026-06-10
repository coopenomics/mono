/**
 * @fileoverview Реальный импл {@link AppsContractEventStreamPort} — Story 10.5b.
 *
 * Поллит таблицы apps-контракта через nodeos `POST /v1/chain/get_table_rows`
 * и синтезирует события из диффа снапшотов:
 *
 *  - новый/обновлённый row `releases` со status=active → `release-published`;
 *  - row `releases` перешёл в withdrawn → `release-withdrawn`;
 *  - новый row `subs` c active=true → `subscription-activated`
 *    (продление end_at тоже даёт событие — install идемпотентен);
 *  - row `subs` active true→false или end_at в прошлом → `subscription-expired`.
 *
 * On-chain `package_id` — Antelope-имя (≤12 chars); каталог и registry
 * оперируют npm-формой `@scope/name`. Маппинг берётся из таблицы
 * `packages` контракта (поле `package_name`) — то же, что делает
 * `AntelopeNameResolver` на стороне apps-catalog.
 *
 * Первый снапшот: для активных подписок НАШЕГО кооператива синтезируются
 * `subscription-activated` — чтобы orchestrator при старте довёл стенд до
 * состояния chain'а (install идемпотентен). Активные релизы на первом
 * снапшоте НЕ отыгрываются — установка управляется подписками.
 *
 * Scope-маппинг контракт → событие: `all`→`all`, `subnet`→`subnets`,
 * `canary`→`cooperatives` (targets → scopeCoopnames).
 */
import { Logger } from '@nestjs/common';
import type { AppsContractEvent, AppsContractEventStreamPort } from './ports';

const REQUEST_TIMEOUT_MS = 10_000;
const TABLE_PAGE_LIMIT = 100;

export interface ChainRpcEventStreamConfig {
  /** nodeos HTTP endpoint, например `http://node:8888`. */
  rpcUrl: string;
  /** Аккаунт apps-контракта (default `apps`). */
  contractAccount: string;
  /** Наш кооператив — для initial-снапшота подписок. */
  coopname: string;
  /** Интервал опроса таблиц. */
  pollIntervalMs: number;
}

interface RawReleaseRow {
  id: number;
  package_id: string;
  version: string;
  scope: { kind: string; targets: string[] };
  status: string;
}

interface RawSubRow {
  id: number;
  coopname: string;
  package_id: string;
  active: boolean | number;
  end_at: string;
}

interface RawPackageRow {
  package_id: string;
  package_name?: string;
}

const scopeKindToEvent = (
  kind: string,
): 'all' | 'subnets' | 'cooperatives' | 'empty' => {
  switch (kind) {
    case 'all':
      return 'all';
    case 'subnet':
      return 'subnets';
    case 'canary':
      return 'cooperatives';
    default:
      return 'empty';
  }
};

export class ChainRpcAppsEventStream implements AppsContractEventStreamPort {
  private readonly logger = new Logger(ChainRpcAppsEventStream.name);

  private knownReleases = new Map<number, { status: string; version: string }>();
  private knownSubs = new Map<number, { live: boolean; endAtSec: number }>();
  private packageNames = new Map<string, string>();
  private initialised = false;

  constructor(private readonly cfg: ChainRpcEventStreamConfig) {}

  async subscribe(
    handler: (e: AppsContractEvent) => Promise<void>,
  ): Promise<{ unsubscribe(): void }> {
    let stopped = false;
    let inFlight = false;

    const tick = async (): Promise<void> => {
      if (stopped || inFlight) return;
      inFlight = true;
      try {
        await this.poll(handler);
      } catch (e) {
        this.logger.error(
          `poll failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        inFlight = false;
      }
    };

    // Первый снапшот сразу, дальше — по таймеру.
    void tick();
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
    const [headBlockNum, packages, releases, subs] = await Promise.all([
      this.getHeadBlockNum(),
      this.getRows<RawPackageRow>('packages'),
      this.getRows<RawReleaseRow>('releases'),
      this.getRows<RawSubRow>('subs'),
    ]);

    this.packageNames = new Map(
      packages.map((p) => [p.package_id, p.package_name ?? p.package_id]),
    );

    const events: AppsContractEvent[] = [];
    const nowSec = this.nowSec();

    const nextReleases = new Map<number, { status: string; version: string }>();
    for (const r of releases) {
      nextReleases.set(r.id, { status: r.status, version: r.version });
      const prev = this.knownReleases.get(r.id);
      const packageId = this.toNpmId(r.package_id);
      if (this.initialised) {
        if (r.status === 'active' && (!prev || prev.status !== 'active' || prev.version !== r.version)) {
          events.push({
            kind: 'release-published',
            packageId,
            version: r.version,
            scopeType: scopeKindToEvent(r.scope?.kind ?? ''),
            scopeCoopnames: r.scope?.kind === 'canary' ? r.scope.targets : undefined,
            blockNum: headBlockNum,
          });
        }
        if (r.status === 'withdrawn' && prev && prev.status !== 'withdrawn') {
          events.push({
            kind: 'release-withdrawn',
            packageId,
            version: r.version,
            blockNum: headBlockNum,
          });
        }
      }
    }
    this.knownReleases = nextReleases;

    const nextSubs = new Map<number, { live: boolean; endAtSec: number }>();
    for (const s of subs) {
      const active = s.active === true || s.active === 1;
      const endAtSec = Date.parse(`${s.end_at}Z`) / 1000 || 0;
      const isLive = active && endAtSec >= nowSec;
      nextSubs.set(s.id, { live: isLive, endAtSec });
      const prev = this.knownSubs.get(s.id);
      const packageId = this.toNpmId(s.package_id);

      if (!this.initialised) {
        // initial-снапшот: довести стенд до chain-состояния для нашего коопа.
        if (isLive && s.coopname === this.cfg.coopname) {
          events.push({
            kind: 'subscription-activated',
            coopname: s.coopname,
            packageId,
            expiresAtUnix: endAtSec,
            blockNum: headBlockNum,
          });
        }
        continue;
      }

      const wasLive = prev?.live === true;
      if (isLive && (!wasLive || prev?.endAtSec !== endAtSec)) {
        events.push({
          kind: 'subscription-activated',
          coopname: s.coopname,
          packageId,
          expiresAtUnix: endAtSec,
          blockNum: headBlockNum,
        });
      }
      if (wasLive && !isLive) {
        events.push({
          kind: 'subscription-expired',
          coopname: s.coopname,
          packageId,
          blockNum: headBlockNum,
        });
      }
    }
    this.knownSubs = nextSubs;
    this.initialised = true;

    for (const e of events) {
      try {
        await handler(e);
      } catch (err) {
        this.logger.error(
          `handler failed on ${e.kind} ${'packageId' in e ? e.packageId : ''}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  /** @internal переопределяется в тестах для детерминизма. */
  protected nowSec(): number {
    return Math.floor(Date.now() / 1000);
  }

  private toNpmId(antelopeName: string): string {
    return this.packageNames.get(antelopeName) ?? antelopeName;
  }

  private async getHeadBlockNum(): Promise<number> {
    try {
      const resp = await this.post('/v1/chain/get_info', {});
      return Number((resp as { head_block_num?: number }).head_block_num ?? 0);
    } catch {
      return 0;
    }
  }

  private async getRows<T>(table: string): Promise<T[]> {
    const rows: T[] = [];
    let lowerBound: string | undefined;
    for (let page = 0; page < 100; page++) {
      const resp = (await this.post('/v1/chain/get_table_rows', {
        code: this.cfg.contractAccount,
        scope: this.cfg.contractAccount,
        table,
        json: true,
        limit: TABLE_PAGE_LIMIT,
        ...(lowerBound !== undefined ? { lower_bound: lowerBound } : {}),
      })) as { rows: T[]; more: boolean; next_key?: string };
      rows.push(...resp.rows);
      if (!resp.more || !resp.next_key) break;
      lowerBound = resp.next_key;
    }
    return rows;
  }

  /** @internal protected — тесты подменяют транспорт без сети. */
  protected async post(path: string, body: unknown): Promise<unknown> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const resp = await fetch(`${this.cfg.rpcUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        throw new Error(`${path} → HTTP ${resp.status}`);
      }
      return await resp.json();
    } finally {
      clearTimeout(timer);
    }
  }
}
