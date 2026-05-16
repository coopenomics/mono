import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY,
  type MarketplaceConsolidatedRequestDomainRepository,
} from '../../domain/repositories/marketplace-consolidated-request.repository';
import {
  MARKETPLACE_OFFER_COUNTERS_SERVICE,
  MarketplaceOfferCountersService,
} from './marketplace-offer-counters.service';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import type { MarketplaceConsolidatedRequestDomainEntity } from '../../domain/entities/marketplace-consolidated-request.entity';

export interface MarketplaceConsolidatedRequestAcceptInputDto {
  coopname: string;
  offerer_account: string;
  request_id: string;
}

export interface MarketplaceConsolidatedRequestDeclineInputDto {
  coopname: string;
  offerer_account: string;
  request_id: string;
  reason: string;
}

export interface MarketplaceConsolidatedRequestActionResult {
  request: MarketplaceConsolidatedRequestDomainEntity;
  affected_orders: number;
  on_chain_succeeded: number;
  on_chain_failed: number;
}

/**
 * Story 4.5: accept/decline консолидированной заявки (`time_based` /
 * `volume_based`). Open_subscription автоматически в `ACCEPTED` на
 * `triggerOpenSubscription` (Story 4.2), для него этот сервис не
 * вызывается.
 *
 * Accept (batch):
 *  1. Guard: заявка существует / coopname / cycle_type ∈ (time_based,
 *     volume_based) / supplier_account == offerer / status =
 *     PENDING_SUPPLIER_ACCEPT.
 *  2. Per-Order chain `acceptOrder` (без ledger2-операций, только смена
 *     on-chain статуса active→accepted; partial fail tolerance — лог
 *     error и продолжаем; следующий цикл cron / manual reconciliation).
 *  3. На каждый успешно «принятый» Order — applyStatusTransition
 *     ACCEPTED_PENDING_SUPPLIER → ACCEPTED.
 *  4. consolidated_request → ACCEPTED.
 *
 * Decline (batch):
 *  1. Guard: как в accept + требуется `reason`.
 *  2. Per-Order chain `declineOrder` (C++ серия: o.mkt.unblk на
 *     total_cost + on-chain статус active→cancelled).
 *  3. Counter `onOrderUnblocked` per-Order (best-effort: warn на fail).
 *  4. applyStatusTransition Order: ACCEPTED_PENDING_SUPPLIER →
 *     CANCELLED_BY_SUPPLIER с reason.
 *  5. consolidated_request → DECLINED_BY_SUPPLIER с decline_reason.
 *
 * Locked Decision L10: consolidated_request — backend-only, без on-chain
 * представления. On-chain движется только статусы и средства per-Order.
 */
@Injectable()
export class MarketplaceConsolidatedRequestAcceptDeclineService {
  constructor(
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY)
    private readonly cycleRepo: MarketplaceConsolidatedRequestDomainRepository,
    @Inject(MARKETPLACE_OFFER_COUNTERS_SERVICE)
    private readonly offerCounters: MarketplaceOfferCountersService,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceConsolidatedRequestAcceptDeclineService.name);
  }

  async accept(
    input: MarketplaceConsolidatedRequestAcceptInputDto
  ): Promise<MarketplaceConsolidatedRequestActionResult> {
    const cycle = await this.guardRequestForAction(input.request_id, input.coopname, input.offerer_account);

    const pool = await this.orderRepo.findByCycleId(cycle.coopname, cycle.id);
    let succeeded = 0;
    let failed = 0;
    for (const order of pool) {
      try {
        await this.chainPort.acceptOrder({
          coopname: order.coopname,
          offerer: input.offerer_account,
          order_hash: order.order_hash,
        });
        await this.orderRepo.applyStatusTransition(order.id, 'ACCEPTED', 'Принят поставщиком');
        succeeded++;
      } catch (chainErr: any) {
        failed++;
        this.logger.error(
          `MarketplaceConsolidatedRequestAcceptDeclineService.accept: chain.acceptOrder упал для Order ${order.id} (order_hash=${order.order_hash}): ${chainErr.message}. Order остаётся в ACCEPTED_PENDING_SUPPLIER, повтор через manual reconciliation.`,
          chainErr.stack
        );
      }
    }

    const updated = await this.cycleRepo.applyStatusTransition(cycle.id, 'ACCEPTED');

    this.logger.log(
      `MarketplaceConsolidatedRequestAcceptDeclineService.accept: request=${cycle.id} cycle_type=${cycle.cycle_type} ACCEPTED поставщиком ${input.offerer_account}; pool=${pool.length} (succeeded=${succeeded}, failed=${failed})`
    );

    return {
      request: updated,
      affected_orders: pool.length,
      on_chain_succeeded: succeeded,
      on_chain_failed: failed,
    };
  }

  async decline(
    input: MarketplaceConsolidatedRequestDeclineInputDto
  ): Promise<MarketplaceConsolidatedRequestActionResult> {
    const reason = (input.reason ?? '').trim();
    if (!reason) {
      throw new BadRequestException('Укажите причину отказа.');
    }
    const cycle = await this.guardRequestForAction(input.request_id, input.coopname, input.offerer_account);

    const pool = await this.orderRepo.findByCycleId(cycle.coopname, cycle.id);
    let succeeded = 0;
    let failed = 0;
    for (const order of pool) {
      try {
        await this.chainPort.declineOrder({
          coopname: order.coopname,
          offerer: input.offerer_account,
          order_hash: order.order_hash,
        });
        try {
          await this.offerCounters.onOrderUnblocked(order.offer_id, order.quantity);
        } catch (counterErr: any) {
          this.logger.warn(
            `MarketplaceConsolidatedRequestAcceptDeclineService.decline: counter onOrderUnblocked упал (offer=${order.offer_id}, qty=${order.quantity}, order=${order.id}): ${counterErr.message} — продолжаю applyStatusTransition`
          );
        }
        await this.orderRepo.applyStatusTransition(order.id, 'CANCELLED_BY_SUPPLIER', reason);
        succeeded++;
      } catch (chainErr: any) {
        failed++;
        this.logger.error(
          `MarketplaceConsolidatedRequestAcceptDeclineService.decline: chain.declineOrder упал для Order ${order.id} (order_hash=${order.order_hash}): ${chainErr.message}. Order остаётся в ACCEPTED_PENDING_SUPPLIER, повтор через manual reconciliation.`,
          chainErr.stack
        );
      }
    }

    const updated = await this.cycleRepo.applyStatusTransition(cycle.id, 'DECLINED_BY_SUPPLIER', {
      decline_reason: reason,
    });

    this.logger.log(
      `MarketplaceConsolidatedRequestAcceptDeclineService.decline: request=${cycle.id} cycle_type=${cycle.cycle_type} DECLINED_BY_SUPPLIER ${input.offerer_account}; pool=${pool.length} (succeeded=${succeeded}, failed=${failed}); reason="${reason}"`
    );

    return {
      request: updated,
      affected_orders: pool.length,
      on_chain_succeeded: succeeded,
      on_chain_failed: failed,
    };
  }

  private async guardRequestForAction(
    request_id: string,
    coopname: string,
    offerer_account: string
  ): Promise<MarketplaceConsolidatedRequestDomainEntity> {
    if (!request_id) throw new BadRequestException('Не указан request_id.');
    const cycle = await this.cycleRepo.findById(request_id);
    if (!cycle) throw new NotFoundException('Консолидированная заявка не найдена.');
    if (cycle.coopname !== coopname) {
      throw new ForbiddenException('Заявка принадлежит другому кооперативу.');
    }
    if (cycle.supplier_account !== offerer_account) {
      throw new ForbiddenException('Действие доступно только поставщику-владельцу заявки.');
    }
    if (cycle.cycle_type !== 'time_based' && cycle.cycle_type !== 'volume_based') {
      throw new BadRequestException(
        `Accept/decline консолидированной заявки доступен только для cycle_type='time_based' и 'volume_based'; заявка — '${cycle.cycle_type}'.`
      );
    }
    if (cycle.status !== 'PENDING_SUPPLIER_ACCEPT') {
      throw new BadRequestException(
        `Заявка в статусе '${cycle.status}' — действие недоступно. Допустимо только из 'PENDING_SUPPLIER_ACCEPT'.`
      );
    }
    return cycle;
  }
}

export const MARKETPLACE_CONSOLIDATED_REQUEST_ACCEPT_DECLINE_SERVICE = Symbol(
  'MARKETPLACE_CONSOLIDATED_REQUEST_ACCEPT_DECLINE_SERVICE'
);
