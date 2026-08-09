import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { AbstractBlockchainDeltaMapper } from '@coopenomics/extension-kit/sync';
import type { IDelta } from '~/types/common';
import { Interfaces } from 'cooptypes';
type IOrderRow = Interfaces.Marketplace.IOrder;
import type { MarketplaceOrderBlockchainData } from '../../domain/entities/marketplace-order.entity';
import {
  MarketplaceOrderStatuses,
  type MarketplaceOrderStatus,
} from '../../domain/entities/marketplace-order.types';

/**
 * Story 4.1: дельта-маппер для `marketplace::orders` (canonical Story 11.1).
 *
 * Подписывается на `delta::marketplace::orders` event-канал (см.
 * AbstractEntitySyncService.getAllEventPatterns + ProgramWalletDeltaMapper
 * pattern).
 *
 * Sync-key: `order_hash` (backend имя) = `hash` поле on-chain row.
 *
 * Status mapping: on-chain `eosio::name` — короткие имена (≤12 символов),
 * как объявлено в C++ `OrderStatus` (table_marketplace_orders.hpp): ровно
 * 7 значений `active`, `cancelled`, `accepted`, `supplyprep`, `acceptcoop`,
 * `readyrecv`, `received`. Это НЕ snake_case доменных статусов — раньше
 * STATUS_MAP ошибочно ждал `supply_prepared`/`accepted_to_coop`/
 * `ready_to_receive`, из-за чего happy-path read-back дельты падали в
 * «schema drift» и не материализовали bc.status (#220).
 *
 * Доменный `MarketplaceOrderStatus` богаче: расщепляет `cancelled` на
 * CANCELLED_BY_ORDERER/CANCELLED_BY_SUPPLIER и добавляет промежуточные
 * ACCEPTED_PENDING_SUPPLIER, EXPIRED_NO_*, RETURNED, которых on-chain enum НЕ
 * содержит — их выставляет только backend (cycle-hook / app-слой), и они
 * никогда не приходят дельтой. Поэтому STATUS_MAP содержит ровно on-chain
 * значения; `cancelled` обрабатывается отдельно (см. KNOWN_UNMAPPED_STATUSES).
 *
 * requirement b6: `membership_fee` контракт считает и пишет в `order` row
 * САМ (createorder.cpp, по ставке `mkt_config_singleton` на момент создания
 * заказа) — backend его не вычисляет, только зеркалит через эту дельту.
 */
@Injectable()
export class MarketplaceOrderDeltaMapper extends AbstractBlockchainDeltaMapper<
  MarketplaceOrderBlockchainData
> {
  private static readonly STATUS_MAP: Record<string, MarketplaceOrderStatus> = {
    active: MarketplaceOrderStatuses.ACTIVE,
    accepted: MarketplaceOrderStatuses.ACCEPTED,
    supplyprep: MarketplaceOrderStatuses.SUPPLY_PREPARED,
    acceptcoop: MarketplaceOrderStatuses.ACCEPTED_TO_COOP,
    readyrecv: MarketplaceOrderStatuses.READY_TO_RECEIVE,
    received: MarketplaceOrderStatuses.RECEIVED,
  };

  /**
   * On-chain `cancelled` — единый терминальный статус. Домен расщепляет его
   * на CANCELLED_BY_ORDERER / CANCELLED_BY_SUPPLIER (а просрочки — на
   * EXPIRED_NO_*), и точный под-статус выставляет backend в БД ДО прихода
   * дельты: отмену/просрочку всегда инициирует app-слой (cancelorder /
   * declineorder / expireorder), затем подтягивается on-chain delta. Read-back
   * generic `cancelled` не несёт нового и НЕ должен перетирать точный под-статус
   * (updateFromBlockchain применяет терминальные статусы безусловно). Поэтому
   * дельту с `cancelled` намеренно пропускаем — это не schema drift, alert не нужен.
   */
  private static readonly KNOWN_UNMAPPED_STATUSES: ReadonlySet<string> = new Set(['cancelled']);

  constructor(@Inject(LOGGER_PORT) private readonly logger: ILoggerPort) {
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
      const rawStatus = value.status?.toLowerCase();
      const status = MarketplaceOrderDeltaMapper.STATUS_MAP[rawStatus];
      if (!status) {
        if (MarketplaceOrderDeltaMapper.KNOWN_UNMAPPED_STATUSES.has(rawStatus)) {
          this.logger.debug(
            `MarketplaceOrderDeltaMapper: on-chain status "${value.status}" (order_hash=${value.hash}) намеренно не маппится — точный терминальный под-статус хранит backend; дельта пропущена`
          );
        } else {
          this.logger.error(
            `MarketplaceOrderDeltaMapper: неизвестный on-chain status "${value.status}" для order_hash=${value.hash} — schema drift, требуется обновление STATUS_MAP`
          );
        }
        return null;
      }
      return {
        order_hash: value.hash,
        on_chain_id: value.id.toString(),
        status,
        membership_fee: MarketplaceOrderDeltaMapper.parseAssetAmount(value.membership_fee),
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

  /**
   * `membership_fee` on-chain — `binary_extension<asset>` вида `"45.0000 RUB"`
   * (может отсутствовать у строк, созданных до requirement b6). Храним в БД
   * как чистую numeric-строку без символа — тот же формат, что у
   * `total_cost`/`price_per_unit` (см. `computeTotalCostAmount`).
   */
  private static parseAssetAmount(asset: string | undefined): string | null {
    if (!asset) return null;
    const amount = asset.split(' ')[0];
    return Number.isNaN(Number(amount)) ? null : amount;
  }
}
