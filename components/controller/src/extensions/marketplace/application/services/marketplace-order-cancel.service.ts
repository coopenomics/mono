import { rethrowChainError } from '@coopenomics/extension-kit';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import { MarketplaceOrderStatuses } from '../../domain/entities/marketplace-order.types';
import {
  MARKETPLACE_OFFER_COUNTERS_SERVICE,
  MarketplaceOfferCountersService,
} from './marketplace-offer-counters.service';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import { normalizeChainTxHash } from '../shared/chain-tx.util';


export interface MarketplaceOrderCancelInputDto {
  /** coopname кооператива. Берётся из core-сессии в resolver'е. */
  coopname: string;
  /** Пайщик-заказчик. Из core-сессии в resolver'е. */
  orderer_account: string;
  /** ID Order'а из marketplace_order. */
  order_id: string;
}

export interface MarketplaceOrderCancelResult {
  order: MarketplaceOrderDomainEntity;
  tx_hash: string;
}

/**
 * Story 4.4: заказчик отменяет Order до акцепта поставщиком.
 *
 *   1. Guard: Order существует / coopname match / orderer match /
 *      status='ACTIVE'. Backend разрешает отмену только в `ACTIVE` —
 *      это match с C++ check (after acceptorder отмена через Story 4.5
 *      decline уже не доступна заказчику). Для cycle_type='individual'
 *      Order сразу попадает в `ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL`
 *      backend hook'ом — отмена заказчиком возможна, пока поставщик не
 *      нажал Accept (он же может decline → Story 4.5).
 *
 *   2. Chain submit `cancelorder` через canonical adapter. C++:
 *      `o.mkt.unlock` на full `total_cost` (сумма возвращается на
 *      `w.wal.member.available` пайщика) + on-chain Order.status:
 *      ACTIVE → CANCELLED.
 *
 *   3. Counter `onOrderUnblocked(offer_id, quantity)` — `quantity_blocked`
 *      → `quantity_available`. Best-effort: counter-fail → лог warn +
 *      всё равно applyStatusTransition (on-chain unblk прошёл).
 *
 *   4. Persist Order.status: ACTIVE → CANCELLED_BY_ORDERER с reason
 *      'Отменён заказчиком'.
 *
 * Chain submit fail (любой `eosio::check`) — clean BadRequest пайщику
 * без модификации Order'а в БД (compensating не нужен — counter был не
 * тронут до момента chain success).
 */
@Injectable()
export class MarketplaceOrderCancelService {
  constructor(
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_OFFER_COUNTERS_SERVICE)
    private readonly offerCounters: MarketplaceOfferCountersService,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceOrderCancelService.name);
  }

  async execute(input: MarketplaceOrderCancelInputDto): Promise<MarketplaceOrderCancelResult> {
    if (!input.order_id) {
      throw new BadRequestException('Не указан order_id.');
    }

    // ── 1. Guard ────────────────────────────────────────────────────
    const order = await this.orderRepo.findById(input.order_id);
    if (!order) {
      throw new NotFoundException('Заказ не найден.');
    }
    if (order.coopname !== input.coopname) {
      throw new ForbiddenException('Заказ принадлежит другому кооперативу.');
    }
    if (order.orderer_account !== input.orderer_account) {
      throw new ForbiddenException('Отменить заказ может только его заказчик.');
    }
    // Отмена / отказ от получения заказчиком. Граница удержания — акцепт
    // поставщиком (это решает КОНТРАКТ): до акцепта (ACTIVE / ожидание
    // поставщика) — бесплатно, полный возврат; после акцепта и до открытия
    // выдачи (ACCEPTED / SUPPLY_PREPARED / ACCEPTED_TO_COOP) — отказ с
    // удержанием 50% (поставщик уже взял обязательство). На выдаче (отказ от
    // позиции) заказ как раз в ACCEPTED_TO_COOP. После открытия акта выдачи
    // (READY_TO_RECEIVE / RECEIVED) отмена закрыта — контракт её отвергнет.
    const CANCELABLE_STATUSES = [
      MarketplaceOrderStatuses.ACTIVE,
      MarketplaceOrderStatuses.ACCEPTED_PENDING_SUPPLIER,
      MarketplaceOrderStatuses.ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL,
      MarketplaceOrderStatuses.ACCEPTED,
      MarketplaceOrderStatuses.SUPPLY_PREPARED,
      MarketplaceOrderStatuses.ACCEPTED_TO_COOP,
    ] as const;
    if (!(CANCELABLE_STATUSES as readonly string[]).includes(order.status)) {
      throw new BadRequestException(
        `Нельзя отменить заказ в статусе «${order.status}». Отмена закрыта после открытия акта выдачи.`
      );
    }

    // ── 2. Chain submit cancelorder ─────────────────────────────────
    let txHash: string;
    try {
      const tx = await this.chainPort.cancelOrder({
        coopname: input.coopname,
        orderer: input.orderer_account,
        order_hash: order.order_hash,
      });
      txHash = normalizeChainTxHash(
        tx,
        'Отмена заказа: цепь не вернула tx_hash. Повторите попытку.'
      );
    } catch (error: any) {
      this.logger.error(
        `MarketplaceOrderCancelService: chain.cancelOrder fail для Order ${order.id} (orderer=${input.orderer_account}): ${error.message}`,
        error.stack
      );
      rethrowChainError(error);
    }

    // ── 3. Counter onOrderUnblocked (best-effort) ───────────────────
    try {
      await this.offerCounters.onOrderUnblocked(order.offer_id, order.quantity);
    } catch (counterErr: any) {
      this.logger.warn(
        `MarketplaceOrderCancelService: counter onOrderUnblocked упал (offer=${order.offer_id}, qty=${order.quantity}, order=${order.id}): ${counterErr.message} — продолжаю applyStatusTransition`
      );
    }

    // ── 4. Persist Order.status → CANCELLED_BY_ORDERER ──────────────
    const updated = await this.orderRepo.applyStatusTransition(
      order.id,
      'CANCELLED_BY_ORDERER',
      'Отменён заказчиком'
    );

    this.logger.log(
      `MarketplaceOrderCancelService: Order ${order.id} (hash=${order.order_hash}) отменён заказчиком ${input.orderer_account}; offer=${order.offer_id}, qty=${order.quantity}, tx=${txHash!}`
    );

    return { order: updated, tx_hash: txHash! };
  }
}

export const MARKETPLACE_ORDER_CANCEL_SERVICE = Symbol('MARKETPLACE_ORDER_CANCEL_SERVICE');
