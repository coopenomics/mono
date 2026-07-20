import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '~/shared/services/abstract-entity-sync.service';
import type { ISyncResult } from '~/shared/interfaces/blockchain-sync.interface';
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
import {
  MARKETPLACE_ORDER_STATUS_CHANGED_EVENT,
  type MarketplaceOrderStatusChangedEvent,
} from '../application/events/marketplace-notification.events';

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
   * Единая точка применения дельты заказа. Переопределяем, чтобы на каждом
   * реальном переходе статуса (chain-as-source-of-truth) выпустить адресный
   * realtime-сигнал обеим сторонам заказа. Эмит — строго ПОСЛЕ `super` (то
   * есть после commit'а в PG, INV-12). Новый статус читаем из персиста уже
   * ПОСЛЕ применения forward-rank guard'а в `updateFromBlockchain`: запоздалая
   * дельта может не примениться, и сигнал должен отражать фактическое
   * состояние, а не сырую дельту. Цена — один дополнительный read на апдейт
   * (заказ переходит статус считанные разы за жизненный цикл, не hot-path).
   */
  public async handleSyncDelta(
    syncKey: string,
    syncValue: string,
    blockchainData: MarketplaceOrderBlockchainData,
    blockNum: number,
    present = true
  ): Promise<ISyncResult> {
    const before = await this.repository.findBySyncKey(syncKey, syncValue);
    const previousStatus = before?.status ?? null;

    const result = await super.handleSyncDelta(syncKey, syncValue, blockchainData, blockNum, present);

    if (result.updated && previousStatus !== null) {
      const after = await this.repository.findBySyncKey(syncKey, syncValue);
      if (after && after.status !== previousStatus) {
        const event: MarketplaceOrderStatusChangedEvent = {
          coopname: after.coopname,
          order_id: after.id,
          status: after.status,
          previous_status: previousStatus,
          orderer_account: after.orderer_account,
          supplier_account: after.supplier_account,
        };
        this.eventEmitter.emit(MARKETPLACE_ORDER_STATUS_CHANGED_EVENT, event);
        this.logger.debug(
          `MarketplaceOrderSyncService: статус заказа ${after.id} ${previousStatus}→${after.status} — эмит realtime-сигнала`
        );
      }
    }

    return result;
  }

  async handleForkEvent(forkData: { block_num: number }): Promise<void> {
    if (!forkData || typeof forkData.block_num !== 'number') {
      this.logger.warn(`MarketplaceOrderSyncService: некорректный fork payload — ${JSON.stringify(forkData)}`);
      return;
    }
    await this.handleFork(forkData.block_num);
  }

  // Откат заказов при форке цепи разнесён по двум уровням:
  //
  //   1. Сами строки `marketplace_order` удаляются базовой логикой
  //      `AbstractEntitySyncService.handleFork` — она зовёт
  //      `repository.deleteByBlockNumGreaterThan(forkBlockNum)` для
  //      записей с `on_chain_block_num > forkBlockNum`. После этого
  //      parser2 повторно проигрывает дельты из правильной ветки и
  //      восстанавливает заказ заново на pre-fork состояние через
  //      `updateFromBlockchain` (chain-as-source-of-truth).
  //
  //   2. Здесь, в `afterForkProcessing`, компенсируется побочный
  //      эффект, который НЕ хранится в цепи — счётчики Offer'а
  //      (`quantity_available` / `quantity_blocked`), которые
  //      backend двинул оптимистично в `MarketplaceOrderCreateService`
  //      ещё до подтверждения блока. Удалённые после форка заказы
  //      возвращают эти счётчики назад через `onOrderRolledBack`.
  //
  // Backend-only поля заказа (cycle_id, last_status_reason,
  // accepted_at) и заказы с `on_chain_block_num = null` (попавшие
  // в зазор между submit и доставкой дельты) ловятся отдельным
  // механизмом сверки — отдельная история ручной сверки.
  protected async afterForkProcessing(
    forkBlockNum: number,
    affectedEntities: MarketplaceOrderDomainEntity[]
  ): Promise<void> {
    this.logger.log(
      `MarketplaceOrderSyncService.afterFork: компенсирую счётчики Offer'а для ${affectedEntities.length} заказов, удалённых форком (block_num > ${forkBlockNum})`
    );
    for (const order of affectedEntities) {
      try {
        await this.offerCounters.onOrderRolledBack(order.offer_id, order.quantity);
      } catch (error: any) {
        this.logger.error(
          `MarketplaceOrderSyncService.afterFork: не удалось вернуть счётчик для заказа ${order.id} (offer ${order.offer_id}, qty ${order.quantity}): ${error.message}`,
          error.stack
        );
      }
    }
  }
}
