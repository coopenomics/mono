import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '~/shared/services/abstract-entity-sync.service';
import { MarketplaceOrderDomainEntity } from '../domain/entities/marketplace-order.entity';
import type { MarketplaceOrderBlockchainData } from '../domain/entities/marketplace-order.entity';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../domain/repositories/marketplace-order.repository';
import { MarketplaceOrderDeltaMapper } from '../infrastructure/mappers/marketplace-order-delta.mapper';
import {
  MARKETPLACE_OFFER_COUNTERS_SERVICE,
  MarketplaceOfferCountersService,
} from '../application/services/marketplace-offer-counters.service';

/**
 * Story 4.1: реальная реализация sync-service Order'ов (заменяет
 * scaffolding с throw NOT_IMPLEMENTED).
 *
 * Подписывается на `delta::marketplace::orders` через EventEmitter2
 * (паттерн `ProgramWalletSyncService`; ParserClient (parser2) ещё не
 * включён в monorepo, переходим на него в Phase 2).
 *
 * Story 4.1 contract:
 *  - Counter side-effects (`onOrderBlocked` / `onOrderUnblocked` /
 *    `onOrderConsumed`) дёргаются СИНХРОННО в backend create/cancel/
 *    consume сервисах (optimistic update, compensating rollback при
 *    chain-failure). Syncer counter НЕ дёргает на normal delta-flow,
 *    чтобы избежать double-decrement.
 *  - Counter `onOrderRolledBack` дёргается ТОЛЬКО в `afterForkProcessing`
 *    для каждого Order'а в block-состоянии после fork-rollback цепи.
 *    Это компенсирует backend optimistic update при катастрофе fork.
 *
 * См. spec-3-4-bc-integration.md секция 2.4-2.5 и controller/CLAUDE.md
 * Dispatch pipeline / Fork handling правила.
 */
@Injectable()
export class MarketplaceOrderSyncService
  extends AbstractEntitySyncService<MarketplaceOrderDomainEntity, MarketplaceOrderBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'MarketplaceOrder';

  constructor(
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    repo: MarketplaceOrderDomainRepository,
    deltaMapper: MarketplaceOrderDeltaMapper,
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(MARKETPLACE_OFFER_COUNTERS_SERVICE)
    private readonly offerCounters: MarketplaceOfferCountersService
  ) {
    super(repo, deltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `MarketplaceOrderSyncService инициализирован: contracts=[${supportedVersions.contracts.join(
        ', '
      )}], tables=[${supportedVersions.tables.join(', ')}]`
    );

    const patterns = this.getAllEventPatterns();
    for (const pattern of patterns) {
      this.eventEmitter.on(pattern, this.processDelta.bind(this));
    }
    this.eventEmitter.on(this.getForkEventPattern(), this.handleForkEvent.bind(this));
    this.logger.debug(
      `MarketplaceOrderSyncService: подписан на ${patterns.length} delta-паттернов + fork-канал`
    );
  }

  /**
   * Fork-канал EventEmitter2 проходит через эту обёртку, которая
   * нормализует payload в `{ block_num }` (см. контракт fork-events).
   */
  async handleForkEvent(forkData: { block_num: number }): Promise<void> {
    if (!forkData || typeof forkData.block_num !== 'number') {
      this.logger.warn(`MarketplaceOrderSyncService: некорректный fork payload — ${JSON.stringify(forkData)}`);
      return;
    }
    await this.handleFork(forkData.block_num);
  }

  /**
   * После rollback rows: для каждого Order'а, который был в block-state
   * до отката (`is_in_block_state === true`), вызвать
   * `offerCounters.onOrderRolledBack(offer_id, qty)`. Это компенсирует
   * backend optimistic update в `MarketplaceOrderCreateService`.
   *
   * Counter rollback без CAS-проверки (ADR-005 «frozen past with
   * Rollback Horizon»). При rollback вне горизонта оставляем
   * counter inconsistent + alert (manual reconciliation, Phase 2).
   */
  protected async afterForkProcessing(
    forkBlockNum: number,
    affectedEntities: MarketplaceOrderDomainEntity[]
  ): Promise<void> {
    const inBlockEntities = affectedEntities.filter((e) => e.is_in_block_state);
    this.logger.log(
      `MarketplaceOrderSyncService.afterFork: возвращаю counters для ${inBlockEntities.length}/${affectedEntities.length} Order'ов (block_num > ${forkBlockNum})`
    );
    for (const order of inBlockEntities) {
      try {
        await this.offerCounters.onOrderRolledBack(order.offer_id, order.quantity);
      } catch (error: any) {
        this.logger.error(
          `MarketplaceOrderSyncService.afterFork: не удалось вернуть counter для Order ${order.id} (offer ${order.offer_id}, qty ${order.quantity}): ${error.message}`,
          error.stack
        );
      }
    }
  }
}
