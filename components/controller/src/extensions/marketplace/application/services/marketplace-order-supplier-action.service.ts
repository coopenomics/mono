import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_OFFER_COUNTERS_SERVICE,
  MarketplaceOfferCountersService,
} from './marketplace-offer-counters.service';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';

export interface MarketplaceSupplierAcceptInput {
  coopname: string;
  offerer_account: string;
  order_id: string;
}

export interface MarketplaceSupplierDeclineInput {
  coopname: string;
  offerer_account: string;
  order_id: string;
  reason: string;
}

export interface MarketplaceSupplierActionResult {
  order: MarketplaceOrderDomainEntity;
  tx_hash: string;
}

/**
 * Story 4.5: per-Order accept/decline поставщика для cycle_type='individual'
 * и decline-частный случай для cycle_type='open_subscription' до запуска
 * поставки (`marketplaceDeclineOrderFromOpenPool`).
 *
 *   - **acceptIndividual** — Order в `ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL`
 *     → on-chain `acceptorder` (без ledger2-операций) → Order.status →
 *     ACCEPTED. Counter не двигается (quantity уже отделено в blocked).
 *
 *   - **declineIndividual** — Order в `ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL`
 *     → on-chain `declineorder` (C++ серия o.mkt.unblk на total_cost +
 *     статус active→cancelled) → counter `onOrderUnblocked` (best-effort)
 *     → Order.status → CANCELLED_BY_SUPPLIER с reason.
 *
 *   - **declineFromOpenPool** — Order в `ACTIVE` + cycle_type='open_subscription'
 *     + cycle_id IS NULL (пул ещё не запущен) → on-chain `declineorder` +
 *     counter unblk + Order.status → CANCELLED_BY_SUPPLIER. После
 *     `triggerOpenSubscription` (Story 4.2) частичный отказ невозможен —
 *     уже все Order'ы в `ACCEPTED`, а нажатие = акцепт всего пула (Story 4.5
 *     AC для open_subscription).
 */
@Injectable()
export class MarketplaceOrderSupplierActionService {
  constructor(
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_OFFER_COUNTERS_SERVICE)
    private readonly offerCounters: MarketplaceOfferCountersService,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceOrderSupplierActionService.name);
  }

  async acceptIndividual(input: MarketplaceSupplierAcceptInput): Promise<MarketplaceSupplierActionResult> {
    const order = await this.guardSupplierOrder(input.order_id, input.coopname, input.offerer_account);
    if (order.cycle_type !== 'individual') {
      throw new BadRequestException(
        `Per-Order accept доступен только для cycle_type='individual'; заказ — '${order.cycle_type}'. Для time/volume используйте marketplaceAcceptConsolidatedRequest.`
      );
    }
    if (order.status !== 'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL') {
      throw new BadRequestException(
        `Заказ в статусе '${order.status}' — accept недоступен. Допустимо только из 'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL'.`
      );
    }

    let txHash: string;
    try {
      const tx = await this.chainPort.acceptOrder({
        coopname: order.coopname,
        offerer: input.offerer_account,
        order_hash: order.order_hash,
      });
      txHash = this.normalizeTxHash(tx);
    } catch (error: any) {
      this.logger.error(
        `MarketplaceOrderSupplierActionService.acceptIndividual: chain.acceptOrder fail для Order ${order.id}: ${error.message}`,
        error.stack
      );
      this.rethrowChainError(error);
    }

    const updated = await this.orderRepo.applyStatusTransition(order.id, 'ACCEPTED', 'Принят поставщиком');

    this.logger.log(
      `MarketplaceOrderSupplierActionService.acceptIndividual: Order ${order.id} (hash=${order.order_hash}) принят поставщиком ${input.offerer_account}; tx=${txHash!}`
    );
    return { order: updated, tx_hash: txHash! };
  }

  async declineIndividual(input: MarketplaceSupplierDeclineInput): Promise<MarketplaceSupplierActionResult> {
    const reason = (input.reason ?? '').trim();
    if (!reason) throw new BadRequestException('Укажите причину отказа.');

    const order = await this.guardSupplierOrder(input.order_id, input.coopname, input.offerer_account);
    if (order.cycle_type !== 'individual') {
      throw new BadRequestException(
        `Per-Order decline доступен только для cycle_type='individual'; заказ — '${order.cycle_type}'. Для time/volume используйте marketplaceDeclineConsolidatedRequest, для open_subscription — marketplaceDeclineOrderFromOpenPool.`
      );
    }
    if (order.status !== 'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL') {
      throw new BadRequestException(
        `Заказ в статусе '${order.status}' — decline недоступен. Допустимо только из 'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL'.`
      );
    }

    return await this.runDeclineChain(order, input.offerer_account, reason);
  }

  async declineFromOpenPool(input: MarketplaceSupplierDeclineInput): Promise<MarketplaceSupplierActionResult> {
    const reason = (input.reason ?? '').trim();
    if (!reason) throw new BadRequestException('Укажите причину отказа.');

    const order = await this.guardSupplierOrder(input.order_id, input.coopname, input.offerer_account);
    if (order.cycle_type !== 'open_subscription') {
      throw new BadRequestException(
        `Частичный decline из пула доступен только для cycle_type='open_subscription'; заказ — '${order.cycle_type}'.`
      );
    }
    if (order.status !== 'ACTIVE' || order.cycle_id != null) {
      throw new BadRequestException(
        `Заказ в статусе '${order.status}' (cycle_id=${order.cycle_id ?? 'null'}) — decline из пула недоступен. Допустимо только до запуска поставки (ACTIVE + cycle_id=null).`
      );
    }

    return await this.runDeclineChain(order, input.offerer_account, reason);
  }

  private async runDeclineChain(
    order: MarketplaceOrderDomainEntity,
    offerer_account: string,
    reason: string
  ): Promise<MarketplaceSupplierActionResult> {
    let txHash: string;
    try {
      const tx = await this.chainPort.declineOrder({
        coopname: order.coopname,
        offerer: offerer_account,
        order_hash: order.order_hash,
      });
      txHash = this.normalizeTxHash(tx);
    } catch (error: any) {
      this.logger.error(
        `MarketplaceOrderSupplierActionService: chain.declineOrder fail для Order ${order.id}: ${error.message}`,
        error.stack
      );
      this.rethrowChainError(error);
    }

    try {
      await this.offerCounters.onOrderUnblocked(order.offer_id, order.quantity);
    } catch (counterErr: any) {
      this.logger.warn(
        `MarketplaceOrderSupplierActionService: counter onOrderUnblocked упал (offer=${order.offer_id}, qty=${order.quantity}, order=${order.id}): ${counterErr.message} — продолжаю applyStatusTransition`
      );
    }

    const updated = await this.orderRepo.applyStatusTransition(order.id, 'CANCELLED_BY_SUPPLIER', reason);
    this.logger.log(
      `MarketplaceOrderSupplierActionService: Order ${order.id} (hash=${order.order_hash}) отклонён поставщиком ${offerer_account}; cycle_type=${order.cycle_type}; tx=${txHash!}; reason="${reason}"`
    );
    return { order: updated, tx_hash: txHash! };
  }

  private async guardSupplierOrder(
    order_id: string,
    coopname: string,
    offerer_account: string
  ): Promise<MarketplaceOrderDomainEntity> {
    if (!order_id) throw new BadRequestException('Не указан order_id.');
    const order = await this.orderRepo.findById(order_id);
    if (!order) throw new NotFoundException('Заказ не найден.');
    if (order.coopname !== coopname) {
      throw new ForbiddenException('Заказ принадлежит другому кооперативу.');
    }
    if (order.supplier_account !== offerer_account) {
      throw new ForbiddenException('Действие доступно только поставщику-владельцу Offer\'а.');
    }
    return order;
  }

  private normalizeTxHash(tx: unknown): string {
    const t = tx as { transaction?: { id?: string }; processed?: { id?: string } };
    return t?.transaction?.id ?? t?.processed?.id ?? 'unknown';
  }

  private rethrowChainError(error: any): never {
    const raw: string = error?.message ?? String(error);
    const match = raw.match(/assertion failure with message: (.+?)(?:\n|$)/);
    const clean = match ? match[1].trim() : raw;
    throw new BadRequestException(clean);
  }
}

export const MARKETPLACE_ORDER_SUPPLIER_ACTION_SERVICE = Symbol(
  'MARKETPLACE_ORDER_SUPPLIER_ACTION_SERVICE'
);
