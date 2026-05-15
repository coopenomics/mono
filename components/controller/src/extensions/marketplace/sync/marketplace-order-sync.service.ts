import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  MARKETPLACE_OFFER_COUNTERS_SERVICE,
  MarketplaceOfferCountersService,
} from '../application/services/marketplace-offer-counters.service';

/**
 * Scaffolding: `MarketplaceOrderSyncService`.
 *
 * **STATUS: NOT IMPLEMENTED** — заглушка точки интеграции для Эпика 4.
 *
 * Эта точка фиксирует **место в коде**, где живёт on-chain → PG
 * репликация on-chain сущности `marketplace::orders` (из PR #375
 * Story 11.1 Ledger2 marketplace canonical actions), и где вызывается
 * `MarketplaceOfferCountersService` Story 3.4 как side-effect внутри
 * dispatch pipeline.
 *
 * **Без этого класса** интеграция Эпика 3 ↔ Эпика 4 размазана по
 * JSDoc-комментариям других файлов. С этим классом — в коде есть
 * единое место, к которому Эпик 4 добавит реальную реализацию.
 *
 * Спецификация интеграции: `_bmad-output/implementation-artifacts/
 * spec-3-4-bc-integration.md` (проект `1-prilozhenie-stol-zakazov`,
 * компонент `3-minimalnyy-produkt`). Source-of-truth паттерна:
 * `13-platforma-tsifrovogo-kooperativa/components/14-versiya-3/
 * requirements/c3-arch-sinkhronizatsiya-uzla-s-blokcheynom-v1.md`
 * (ADR-001 .. ADR-012) + `4f-arch-integratsiya-kontrollera-s-parser2-v1.md`.
 *
 * Зависимости, которые Эпик 4 должен добавить:
 *   - `@DomainKey({primary:'id', sync:'order_id'})` декоратор;
 *   - `@SyncBehaviour({forkPolicy:'rollback-via-versions', dlq:true})`;
 *   - `@Versioned({strategy:'entity_versions'})`;
 *   - extends `AbstractEntitySyncService<MarketplaceOrderDomainEntity, ...>`;
 *   - регистрация через `MarketplaceContractSyncModule.forEntity(...)`;
 *   - subscription к `marketplace::orders` через ParserClient с
 *     `subscriptionId="controller-${coopname}"`, `consumerName="primary"`,
 *     `startFromBlock:'last_known'` (DEC-T01..T12 из `4f-arch-parser2`);
 *   - `ForkRegistry.register(this.handleFork.bind(this))` в onInit.
 *
 * Dispatch pipeline (ADR-002 + controller/CLAUDE.md INV-12):
 *   1. dedup check (event_id) → return если уже обработан;
 *   2. save sync: `mapper.toDomain(delta)` → `repo.upsert`;
 *   3. dedup.mark;
 *   4. wake waiters (sync_key + block_num) — для write-mutation pool ADR-012;
 *   5. **side-effect: вызов counters-сервиса в зависимости от action_name**
 *      (см. таблицу ниже);
 *   6. emit internal bus `delta::marketplace::orders` immediate;
 *   7. emit pubsub `MarketplaceOrderUpdated` (домен-entity из PG).
 *
 * Маппинг canonical actions → counters методы:
 *   - `p.mkt.supply.createorder` (o.mkt.assign + o.mkt.block) →
 *       `offerCounters.onOrderBlocked(offer_id, qty)`;
 *   - `p.mkt.supply.cancelorder` (FR12) / `expireorder` (FR14) /
 *     `declineorder` (FR16) (o.mkt.unblock) →
 *       `offerCounters.onOrderUnblocked(offer_id, qty)`;
 *   - `p.mkt.supply.consume`+`consume2` (Эпик 6 выдача пайщику,
 *     o.mkt.consume) → `offerCounters.onOrderConsumed(offer_id, qty)`;
 *   - корректировка «факт меньше заказа» (FR23) →
 *       `offerCounters.onOrderAdjusted(offer_id, qty_diff)`.
 *
 * Fork rollback (ADR-005):
 *   - `handleFork(blockNum)`: удалить `orders WHERE block_num > N` +
 *     restoreFromVersions; для каждого удалённого/откатанного Order'а
 *     в block-состоянии вызвать `offerCounters.onOrderRolledBack(
 *     offer_id, qty)` (без CAS-проверки, ADR-005 политика «frozen past
 *     with Rollback Horizon»).
 */
@Injectable()
export class MarketplaceOrderSyncService {
  constructor(
    @Inject(MARKETPLACE_OFFER_COUNTERS_SERVICE)
    protected readonly offerCounters: MarketplaceOfferCountersService,
    protected readonly eventBus: EventEmitter2,
    protected readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceOrderSyncService.name);
  }

  /**
   * Подписаться на marketplace::orders через ParserClient.
   * Реализация — Эпик 4.
   */
  async start(): Promise<void> {
    throw new Error(
      'MarketplaceOrderSyncService.start: NOT IMPLEMENTED — будет реализовано в Эпике 4 после merge PR #375. См. spec-3-4-bc-integration.md.'
    );
  }

  /**
   * Dispatch одной delta-event'и из marketplace::orders.
   * Реализация — Эпик 4.
   */
  async dispatch(_event: unknown): Promise<void> {
    throw new Error(
      'MarketplaceOrderSyncService.dispatch: NOT IMPLEMENTED — будет реализовано в Эпике 4. См. spec-3-4-bc-integration.md секция 2.4.'
    );
  }

  /**
   * Fork rollback handler — регистрируется в ForkRegistry.onInit.
   * Реализация — Эпик 4.
   */
  async handleFork(_blockNum: bigint): Promise<void> {
    throw new Error(
      'MarketplaceOrderSyncService.handleFork: NOT IMPLEMENTED — будет реализовано в Эпике 4. См. spec-3-4-bc-integration.md секция 2.5.'
    );
  }
}
