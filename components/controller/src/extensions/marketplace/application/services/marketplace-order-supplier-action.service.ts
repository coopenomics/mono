import { rethrowChainError } from '@coopenomics/extension-kit';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY,
  type MarketplaceConsolidatedRequestDomainRepository,
} from '../../domain/repositories/marketplace-consolidated-request.repository';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import {
  MARKETPLACE_OFFER_COUNTERS_SERVICE,
  MarketplaceOfferCountersService,
} from './marketplace-offer-counters.service';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import { MarketplaceOrderStatuses } from '../../domain/entities/marketplace-order.types';
import { normalizeChainTxHash } from '../shared/chain-tx.util';

import {
  MARKETPLACE_ORDER_DECLINED_BY_SUPPLIER_EVENT,
  type MarketplaceOrderDeclinedBySupplierEvent,
} from '../events/marketplace-notification.events';

export interface MarketplaceSupplierAcceptBatchInput {
  coopname: string;
  offerer_account: string;
  /** Заказы (offer × КУ), которые поставщик берёт к поставке. Любое подмножество. */
  order_ids: string[];
}

export interface MarketplaceSupplierDeclineBatchInput {
  coopname: string;
  offerer_account: string;
  order_ids: string[];
  reason: string;
}

export interface MarketplaceSupplierActionResult {
  order: MarketplaceOrderDomainEntity;
  tx_hash: string;
}

export interface MarketplaceSupplierBatchResult {
  /** Партия-накопитель, в которую обёрнуты принятые заказы (null при decline). */
  cycle_id: string | null;
  orders: MarketplaceOrderDomainEntity[];
  tx_hashes: string[];
}

@Injectable()
export class MarketplaceOrderSupplierActionService {
  constructor(
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY)
    private readonly cycleRepo: MarketplaceConsolidatedRequestDomainRepository,
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_OFFER_COUNTERS_SERVICE)
    private readonly offerCounters: MarketplaceOfferCountersService,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    private readonly eventBus: EventEmitter2,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceOrderSupplierActionService.name);
  }

  /**
   * Эпик 15: поставщик принимает к поставке выбранное подмножество заказов
   * (offer × КУ) — единый путь вместо individual/collective. Каждый заказ
   * акцептуется on-chain (`acceptorder`), переходит в ACCEPTED; все принятые
   * заказы обёртываются в ОДНУ партию-накопитель (consolidated_request,
   * статус ACCEPTED) — далее единый путь формирования отгрузки (Эпик 14).
   * Партию здесь НЕ формируем: поставщик сам выберет вариант доставки.
   *
   * Проверки — все до первого обращения к цепи: заказ существует, принадлежит
   * этому кооперативу и этому поставщику, активен и не в партии. Отказ по любой
   * из них не оставляет следа, потому что цепи мы ещё не касались.
   *
   * Сбой самой цепи на отдельном заказе — best-effort: принятое on-chain уже не
   * откатить, поэтому такой заказ логируется и пропускается, а партия
   * собирается из принятых. Если не прошёл ни один — отказ целиком.
   */
  async acceptOrdersBatch(input: MarketplaceSupplierAcceptBatchInput): Promise<MarketplaceSupplierBatchResult> {
    const orderIds = this.dedupeOrderIds(input.order_ids);
    const accepted: MarketplaceOrderDomainEntity[] = [];
    const txHashes: string[] = [];

    // Раньше эти проверки жили внутри цикла приёма: непроходной заказ в
    // середине списка ронял всю операцию уже ПОСЛЕ того, как предыдущие были
    // приняты on-chain и переведены в ACCEPTED. Поставщик получал 400 и не
    // знал, что часть заказов всё-таки принята.
    const candidates: MarketplaceOrderDomainEntity[] = [];
    for (const orderId of orderIds) {
      const order = await this.guardSupplierOrder(orderId, input.coopname, input.offerer_account);
      if (order.status !== MarketplaceOrderStatuses.ACTIVE || order.cycle_id != null) {
        throw new BadRequestException(
          `Заказ ${order.id} нельзя принять — он уже не активен или присоединён к партии. [E4SAS-ACC-WRONG-STATE]`
        );
      }
      candidates.push(order);
    }

    for (const order of candidates) {
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
          `MarketplaceOrderSupplierActionService.acceptOrdersBatch: chain.acceptOrder fail для Order ${order.id}: ${error.message}; пропускаю заказ в партии.`,
          error.stack
        );
        continue;
      }

      const updated = await this.orderRepo.applyStatusTransition(
        order.id,
        MarketplaceOrderStatuses.ACCEPTED,
        'Принят поставщиком к поставке'
      );
      accepted.push(updated);
      txHashes.push(txHash!);
    }

    if (accepted.length === 0) {
      throw new BadRequestException('Не удалось принять ни одного заказа — повторите попытку.');
    }

    const cycle = await this.synthesizeBatchCycle(accepted, input.offerer_account);
    return { cycle_id: cycle?.id ?? null, orders: cycle?.orders ?? accepted, tx_hashes: txHashes };
  }

  /**
   * Обернуть принятые заказы в ОДНУ партию-накопитель (consolidated_request,
   * ACCEPTED) и присвоить им cycle_id — переиспользует канон формирования
   * отгрузки (Shipment строится из заявки ACCEPTED, backend-only L10). Партию
   * НЕ формируем (поставщик сам выберет вариант доставки, Эпик 14). Best-effort:
   * если синтез упал — заказы остаются ACCEPTED без cycle_id.
   */
  private async synthesizeBatchCycle(
    orders: MarketplaceOrderDomainEntity[],
    offerer_account: string
  ): Promise<{ id: string; orders: MarketplaceOrderDomainEntity[] } | null> {
    const first = orders[0];
    try {
      const now = new Date();
      const total_quantity = orders.reduce((s, o) => s + o.quantity, 0);
      const total_amount = orders
        .reduce((s, o) => s + Number(o.total_cost), 0)
        .toFixed(4);
      const cycle = await this.cycleRepo.create({
        coopname: first.coopname,
        offer_id: first.offer_id,
        supplier_account: offerer_account,
        total_quantity,
        total_amount,
        status: 'ACCEPTED',
        cycle_started_at: first.blocked_at ?? first.created_at ?? now,
        cycle_ended_at: now,
        expires_at: null,
        triggered_by_supplier_at: now,
      });

      await this.orderRepo.assignToCycle(
        orders.map((o) => o.id),
        cycle.id,
        MarketplaceOrderStatuses.ACCEPTED
      );

      const refreshed: MarketplaceOrderDomainEntity[] = [];
      for (const o of orders) {
        refreshed.push((await this.orderRepo.findById(o.id)) ?? o);
      }
      this.logger.log(
        `MarketplaceOrderSupplierActionService.synthesizeBatchCycle: заявка ${cycle.id} из ${orders.length} заказов (КУ ${first.delivery_braname}); ждёт явного формирования отгрузки.`
      );
      return { id: cycle.id, orders: refreshed };
    } catch (error: any) {
      this.logger.error(
        `MarketplaceOrderSupplierActionService.synthesizeBatchCycle: синтез партии упал (offer=${first.offer_id}): ${error.message}; заказы остаются ACCEPTED.`,
        error.stack
      );
      return null;
    }
  }

  /**
   * Эпик 15: поставщик отклоняет выбранные активные заказы (до приёма к
   * поставке) — массово. Каждый `declineorder` on-chain → CANCELLED_BY_SUPPLIER.
   */
  async declineOrdersBatch(input: MarketplaceSupplierDeclineBatchInput): Promise<MarketplaceSupplierBatchResult> {
    const reason = (input.reason ?? '').trim();
    if (!reason) throw new BadRequestException('Укажите причину отказа.');

    const orderIds = this.dedupeOrderIds(input.order_ids);
    const declined: MarketplaceOrderDomainEntity[] = [];
    const txHashes: string[] = [];

    // Как и в приёме: все проверки до первого обращения к цепи, иначе
    // непроходной заказ в середине списка оставляет уже отклонённые заказы
    // отклонёнными, а поставщику отдаёт ошибку.
    const candidates: MarketplaceOrderDomainEntity[] = [];
    for (const orderId of orderIds) {
      const order = await this.guardSupplierOrder(orderId, input.coopname, input.offerer_account);
      if (order.status !== MarketplaceOrderStatuses.ACTIVE || order.cycle_id != null) {
        throw new BadRequestException(
          `Заказ ${order.id} нельзя отклонить — он уже не активен или присоединён к партии. [E4SAS-DEC-WRONG-STATE]`
        );
      }
      candidates.push(order);
    }

    for (const order of candidates) {
      const res = await this.runDeclineChain(order, input.offerer_account, reason);
      declined.push(res.order);
      txHashes.push(res.tx_hash);
    }

    if (declined.length === 0) {
      throw new BadRequestException('Не указано ни одного заказа для отказа.');
    }

    // Уведомляем каждого заказчика отклонённого заказа (у каждого свой) с
    // причиной отказа — заблокированные средства ему возвращены. Эмит ПОСЛЕ
    // записи статусов в PG (INV-12); название товара тянем одним батчем по
    // offer_id, чтобы текст уведомления был человекочитаемым.
    await this.emitDeclinedNotifications(declined, reason);

    return { cycle_id: null, orders: declined, tx_hashes: txHashes };
  }

  /**
   * Отказ в приёмке (некондиция): поставщик привёз позиции, которые оператор
   * снял с приёмки (факт = 0). Переиспользует тот же on-chain путь, что и
   * pre-cycle отказ — `declineorder` (полный возврат резерва и членского взноса
   * заказчику без штрафа + erase), но заказы здесь уже акцептованы и в партии:
   * статус ACCEPTED / SUPPLY_PREPARED, не ACTIVE, и `cycle_id != null`. Поэтому
   * это отдельный публичный вход, минующий guard `ACTIVE && cycle_id == null`
   * массового pre-cycle отказа; контракт `declineorder` сам допускает эти
   * статусы (имущество ещё не оприходовано — клоубэка нет).
   *
   * Best-effort per-order: накладная подпись поставщика по принятым позициям
   * уже зафиксирована вызывающим, откатить её нельзя — поэтому сбой отказа по
   * отдельной позиции логируется (заказчику возврат не выполнен, требуется
   * ручной разбор), но не валит всю операцию. Ownership заказов гарантирован
   * вызывающим (приёмка принадлежит этому поставщику).
   */
  async declineOrdersAtReception(input: {
    coopname: string;
    offerer_account: string;
    orders: MarketplaceOrderDomainEntity[];
    reason: string;
  }): Promise<MarketplaceOrderDomainEntity[]> {
    const reason = (input.reason ?? '').trim() || 'Отказ в приёмке: некондиция';
    const declined: MarketplaceOrderDomainEntity[] = [];
    for (const order of input.orders) {
      if (order.supplier_account !== input.offerer_account) continue;
      try {
        const res = await this.runDeclineChain(order, input.offerer_account, reason);
        declined.push(res.order);
      } catch (err: any) {
        this.logger.error(
          `MarketplaceOrderSupplierActionService.declineOrdersAtReception: отказ позиции ${order.id} (hash=${order.order_hash}) упал: ${err.message}; заказчику ${order.orderer_account} возврат не выполнен — требуется ручной разбор.`,
          err.stack
        );
      }
    }
    if (declined.length > 0) {
      await this.emitDeclinedNotifications(declined, reason);
    }
    return declined;
  }

  private async emitDeclinedNotifications(
    declined: MarketplaceOrderDomainEntity[],
    reason: string
  ): Promise<void> {
    try {
      const offerIds = Array.from(new Set(declined.map((o) => o.offer_id)));
      const offers = await this.offerRepo.findByIds(offerIds);
      const productNameByOfferId = new Map(offers.map((of) => [of.id, of.product_name]));
      for (const order of declined) {
        const event: MarketplaceOrderDeclinedBySupplierEvent = {
          coopname: order.coopname,
          order_id: order.id,
          orderer_account: order.orderer_account,
          delivery_braname: order.delivery_braname,
          product_name: productNameByOfferId.get(order.offer_id) ?? 'Товар по предложению',
          reason,
        };
        this.eventBus.emit(MARKETPLACE_ORDER_DECLINED_BY_SUPPLIER_EVENT, event);
      }
    } catch (err: any) {
      // Уведомление не критично для доменного результата — не валим отказ.
      this.logger.warn(
        `MarketplaceOrderSupplierActionService.emitDeclinedNotifications: не удалось разослать уведомления об отказе (${err.message}) — flow не блокируется.`
      );
    }
  }

  private dedupeOrderIds(order_ids: string[]): string[] {
    const ids = (order_ids ?? []).map((s) => (s ?? '').trim()).filter(Boolean);
    if (ids.length === 0) throw new BadRequestException('Не выбрано ни одного заказа.');
    return Array.from(new Set(ids));
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
      `MarketplaceOrderSupplierActionService: Order ${order.id} (hash=${order.order_hash}) отклонён поставщиком ${offerer_account}; tx=${txHash!}; reason="${reason}"`
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
