import { Injectable } from '@nestjs/common';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractBlockchainDeltaMapper } from '~/shared/abstract-blockchain-delta.mapper';
import type { IDelta } from '~/types/common';
import { Interfaces } from 'cooptypes';
type IOrderRow = Interfaces.IOrderRow;
import type { MarketplaceOrderBlockchainData } from '../../domain/entities/marketplace-order.entity';
import type { MarketplaceOrderStatus } from '../../domain/entities/marketplace-order.types';

/**
 * Story 4.1: дельта-маппер для `marketplace::orders` (canonical Story 11.1).
 *
 * Подписывается на `delta::marketplace::orders` event-канал (см.
 * AbstractEntitySyncService.getAllEventPatterns + ProgramWalletDeltaMapper
 * pattern).
 *
 * Sync-key: `order_hash` (backend имя) = `hash` поле on-chain row.
 *
 * Status mapping: on-chain `eosio::name` = lowercase snake_case
 * (`active`, `accepted`, `ship_ready`, `supply_prepared`,
 * `accepted_to_coop`, `ready_to_receive`, `received`, `returned`,
 * `cancelled_by_orderer`, `cancelled_by_supplier`, `expired_no_threshold`,
 * `expired_no_volume`, `accepted_pending_supplier`,
 * `accepted_pending_supplier_individual`). Backend хранит как UPPERCASE.
 */
@Injectable()
export class MarketplaceOrderDeltaMapper extends AbstractBlockchainDeltaMapper<
  MarketplaceOrderBlockchainData
> {
  private static readonly STATUS_MAP: Record<string, MarketplaceOrderStatus> = {
    active: 'ACTIVE',
    accepted_pending_supplier: 'ACCEPTED_PENDING_SUPPLIER',
    accepted_pending_supplier_individual: 'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL',
    accepted: 'ACCEPTED',
    supply_prepared: 'SUPPLY_PREPARED',
    accepted_to_coop: 'ACCEPTED_TO_COOP',
    ready_to_receive: 'READY_TO_RECEIVE',
    received: 'RECEIVED',
    returned: 'RETURNED',
    cancelled_by_orderer: 'CANCELLED_BY_ORDERER',
    cancelled_by_supplier: 'CANCELLED_BY_SUPPLIER',
    expired_no_threshold: 'EXPIRED_NO_THRESHOLD',
    expired_no_volume: 'EXPIRED_NO_VOLUME',
  };

  constructor(private readonly logger: WinstonLoggerService) {
    super();
    this.logger.setContext(MarketplaceOrderDeltaMapper.name);
  }

  mapDeltaToBlockchainData(delta: IDelta): MarketplaceOrderBlockchainData | null {
    try {
      const value = delta.value as IOrderRow | undefined;
      if (!value || !value.hash) {
        this.logger.warn(
          `MarketplaceOrderDeltaMapper: пустой value/hash в дельте marketplace::orders (primary_key=${delta.primary_key})`
        );
        return null;
      }
      const status = MarketplaceOrderDeltaMapper.STATUS_MAP[value.status?.toLowerCase()];
      if (!status) {
        this.logger.error(
          `MarketplaceOrderDeltaMapper: неизвестный on-chain status "${value.status}" для order_hash=${value.hash} — schema drift, требуется обновление STATUS_MAP`
        );
        return null;
      }
      return {
        order_hash: value.hash,
        on_chain_id: value.id.toString(),
        status,
      };
    } catch (error: any) {
      this.logger.error(
        `MarketplaceOrderDeltaMapper: ошибка маппинга дельты — ${error.message}`,
        error.stack
      );
      return null;
    }
  }

  extractSyncValue(delta: IDelta): string {
    const value = delta.value as IOrderRow | undefined;
    if (!value?.hash) {
      throw new Error(
        `MarketplaceOrderDeltaMapper.extractSyncValue: delta без поля hash (primary_key=${delta.primary_key})`
      );
    }
    return value.hash.toLowerCase();
  }

  extractSyncKey(): string {
    return 'order_hash';
  }

  getSupportedContractNames(): string[] {
    return ['marketplace'];
  }

  getSupportedTableNames(): string[] {
    return ['orders'];
  }
}
