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
  MARKETPLACE_SHIPMENT_CREATE_SERVICE,
  MarketplaceShipmentCreateService,
} from './marketplace-shipment-create.service';
import { MarketplaceShipmentDeliveryVariants } from '../../domain/entities/marketplace-shipment.types';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import {
  MarketplaceOrderCycleTypes,
  MarketplaceOrderStatuses,
} from '../../domain/entities/marketplace-order.types';
import { normalizeChainTxHash, rethrowChainError } from '../shared/chain-tx.util';

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

@Injectable()
export class MarketplaceOrderSupplierActionService {
  constructor(
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY)
    private readonly cycleRepo: MarketplaceConsolidatedRequestDomainRepository,
    @Inject(MARKETPLACE_OFFER_COUNTERS_SERVICE)
    private readonly offerCounters: MarketplaceOfferCountersService,
    @Inject(MARKETPLACE_SHIPMENT_CREATE_SERVICE)
    private readonly shipmentCreate: MarketplaceShipmentCreateService,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceOrderSupplierActionService.name);
  }

  async acceptIndividual(input: MarketplaceSupplierAcceptInput): Promise<MarketplaceSupplierActionResult> {
    const order = await this.guardSupplierOrder(input.order_id, input.coopname, input.offerer_account);
    if (order.cycle_type !== MarketplaceOrderCycleTypes.INDIVIDUAL) {
      throw new BadRequestException(
        'Этот заказ нельзя принять по одному: он оформлен в пакетном предложении. Для накопительных и периодических предложений действие — приём сводной заявки целиком. [E4SAS-ACC-NOT-INDIVIDUAL]'
      );
    }
    if (order.status !== MarketplaceOrderStatuses.ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL) {
      throw new BadRequestException(
        'Принять заказ нельзя — он уже не ждёт вашего решения по индивидуальному приёму. [E4SAS-ACC-WRONG-STATE]'
      );
    }

    let txHash: string;
    try {
      const tx = await this.chainPort.acceptOrder({
        coopname: order.coopname,
        offerer: input.offerer_account,
        order_hash: order.order_hash,
      });
      txHash = normalizeChainTxHash(
        tx,
        'Действие поставщика: цепь не вернула tx_hash. Повторите попытку.'
      );
    } catch (error: any) {
      this.logger.error(
        `MarketplaceOrderSupplierActionService.acceptIndividual: chain.acceptOrder fail для Order ${order.id}: ${error.message}`,
        error.stack
      );
      rethrowChainError(error);
    }

    const updated = await this.orderRepo.applyStatusTransition(
      order.id,
      MarketplaceOrderStatuses.ACCEPTED,
      'Принят поставщиком'
    );

    this.logger.log(
      `MarketplaceOrderSupplierActionService.acceptIndividual: Order ${order.id} (hash=${order.order_hash}) принят поставщиком ${input.offerer_account}; tx=${txHash!}`
    );

    // individual: один заказ — самостоятельная единица поставки. Чтобы
    // переиспользовать канон формирования партии (Shipment строится только
    // из консолидированной заявки в статусе ACCEPTED — backend-only L10),
    // синтезируем «заявку из одного заказа» и сразу прогоняем её через
    // shipment-create. На выходе — Shipment SUPPLY_PREPARED + Order →
    // SUPPLY_PREPARED, по которому оператор КУ откроет акт приёмки.
    const prepared = await this.synthesizeIndividualShipment(updated, input.offerer_account);
    return { order: prepared, tx_hash: txHash! };
  }

  /**
   * individual flow: обернуть один ACCEPTED Order в консолидированную заявку
   * и сформировать по ней Shipment Варианта А (самовывоз поставщика, без ТТН).
   * Best-effort: если синтез упал, Order остаётся ACCEPTED — партию можно
   * сформировать вручную через стол поставщика; основной accept уже on-chain.
   */
  private async synthesizeIndividualShipment(
    order: MarketplaceOrderDomainEntity,
    offerer_account: string
  ): Promise<MarketplaceOrderDomainEntity> {
    try {
      const now = new Date();
      const cycle = await this.cycleRepo.create({
        coopname: order.coopname,
        offer_id: order.offer_id,
        supplier_account: offerer_account,
        cycle_type: MarketplaceOrderCycleTypes.INDIVIDUAL,
        total_quantity: order.quantity,
        total_amount: order.total_cost,
        status: 'ACCEPTED',
        cycle_started_at: order.blocked_at ?? order.created_at ?? now,
        cycle_ended_at: now,
        expires_at: null,
        triggered_by_supplier_at: now,
      });

      await this.orderRepo.assignToCycle(
        [order.id],
        cycle.id,
        MarketplaceOrderStatuses.ACCEPTED
      );

      await this.shipmentCreate.execute({
        coopname: order.coopname,
        offerer_account,
        cycle_id: cycle.id,
        groups: [
          {
            braname: order.delivery_braname,
            delivery_variant: MarketplaceShipmentDeliveryVariants.SELF,
            ttn_data: null,
          },
        ],
      });

      const refreshed = await this.orderRepo.findById(order.id);
      this.logger.log(
        `MarketplaceOrderSupplierActionService.synthesizeIndividualShipment: Order ${order.id} → SUPPLY_PREPARED через заявку ${cycle.id} (КУ ${order.delivery_braname})`
      );
      return refreshed ?? order;
    } catch (error: any) {
      this.logger.error(
        `MarketplaceOrderSupplierActionService.synthesizeIndividualShipment: синтез партии упал для Order ${order.id}: ${error.message}; Order остаётся ACCEPTED, партию сформировать вручную.`,
        error.stack
      );
      return order;
    }
  }

  async declineIndividual(input: MarketplaceSupplierDeclineInput): Promise<MarketplaceSupplierActionResult> {
    const reason = (input.reason ?? '').trim();
    if (!reason) throw new BadRequestException('Укажите причину отказа.');

    const order = await this.guardSupplierOrder(input.order_id, input.coopname, input.offerer_account);
    if (order.cycle_type !== MarketplaceOrderCycleTypes.INDIVIDUAL) {
      throw new BadRequestException(
        'Этот заказ нельзя отклонить по одному: он оформлен в пакетном предложении. Для накопительных и периодических предложений действие — отказ от сводной заявки целиком; для открытой подписки — отказ из пула до запуска поставки. [E4SAS-DEC-NOT-INDIVIDUAL]'
      );
    }
    if (order.status !== MarketplaceOrderStatuses.ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL) {
      throw new BadRequestException(
        'Отклонить заказ нельзя — он уже не ждёт вашего решения по индивидуальному приёму. [E4SAS-DEC-WRONG-STATE]'
      );
    }

    return await this.runDeclineChain(order, input.offerer_account, reason);
  }

  async declineFromOpenPool(input: MarketplaceSupplierDeclineInput): Promise<MarketplaceSupplierActionResult> {
    const reason = (input.reason ?? '').trim();
    if (!reason) throw new BadRequestException('Укажите причину отказа.');

    const order = await this.guardSupplierOrder(input.order_id, input.coopname, input.offerer_account);
    if (order.cycle_type !== MarketplaceOrderCycleTypes.OPEN_SUBSCRIPTION) {
      throw new BadRequestException(
        'Отказ от отдельного заказа из пула возможен только в предложениях с открытой подпиской. [E4SAS-OPEN-NOT-OPEN-SUBSCRIPTION]'
      );
    }
    if (order.status !== MarketplaceOrderStatuses.ACTIVE || order.cycle_id != null) {
      throw new BadRequestException(
        'Отказ из пула возможен только пока поставка ещё не запущена и заказ не присоединён к партии. После запуска отказ возможен только от сводной заявки целиком. [E4SAS-OPEN-WRONG-STATE]'
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
      txHash = normalizeChainTxHash(
        tx,
        'Действие поставщика: цепь не вернула tx_hash. Повторите попытку.'
      );
    } catch (error: any) {
      this.logger.error(
        `MarketplaceOrderSupplierActionService: chain.declineOrder fail для Order ${order.id}: ${error.message}`,
        error.stack
      );
      rethrowChainError(error);
    }

    try {
      await this.offerCounters.onOrderUnblocked(order.offer_id, order.quantity);
    } catch (counterErr: any) {
      this.logger.warn(
        `MarketplaceOrderSupplierActionService: counter onOrderUnblocked упал (offer=${order.offer_id}, qty=${order.quantity}, order=${order.id}): ${counterErr.message} — продолжаю applyStatusTransition`
      );
    }

    const updated = await this.orderRepo.applyStatusTransition(
      order.id,
      MarketplaceOrderStatuses.CANCELLED_BY_SUPPLIER,
      reason
    );
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
}

export const MARKETPLACE_ORDER_SUPPLIER_ACTION_SERVICE = Symbol(
  'MARKETPLACE_ORDER_SUPPLIER_ACTION_SERVICE'
);
