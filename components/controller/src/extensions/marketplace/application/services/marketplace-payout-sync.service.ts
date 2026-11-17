import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { MarketContract } from 'cooptypes';
import { LOGGER_PORT, type ILoggerPort, PaymentStatus,
  type InnerChainActionRecord,
} from '@coopenomics/innercoop';
import {
  MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY,
  type MarketplaceOutgoingPaymentRequestDomainRepository,
} from '../../domain/repositories/marketplace-outgoing-payment-request.repository';
import {
  MARKETPLACE_SUPPLIER_PAYMENT_CONFIRMED_EVENT,
  MARKETPLACE_SUPPLIER_PAYMENT_DECLINED_EVENT,
  type MarketplaceSupplierPaymentConfirmedEvent,
  type MarketplaceSupplierPaymentDeclinedEvent,
} from '../events/marketplace-notification.events';
import { PAYMENT_DESK_PORT, type IPaymentDeskPort } from '@coopenomics/innercoop';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import {
  MARKETPLACE_APL_RECEPTION_REPOSITORY,
  type MarketplaceAplReceptionDomainRepository,
} from '../../domain/repositories/marketplace-apl-reception.repository';
import type { MarketplaceOutgoingPaymentRequestDomainEntity } from '../../domain/entities/marketplace-outgoing-payment-request.entity';
import { presentSaleUnit } from '../shared/packaging.util';
import { t } from '../../i18n';

/** Что поставщику говорит выплата: имущество, количество и дата акта приёмки. */
interface PayoutSubject {
  item_name: string;
  quantity: string;
  act_date: string;
}

/**
 * Story 5.6 / 5.7 + E11 техдолг 598-16 (Locked Decision L12):
 *
 * Слушатель callback'ов от gateway-контракта по выплате поставщику.
 * Поток:
 *   - `marketplace::payout` (init backend'ом) уже создал запись
 *     marketplace_outgoing_payment_request в статусе PENDING в момент
 *     закрывающей подписи председателя (см. MarketplaceAplReceptionService).
 *   - `marketplace::payconfirm` приходит inline-вызовом из
 *     `gateway::outcomplete` после подтверждения кассиром фактического
 *     банковского перевода — здесь applyCompletion + setPaymentStatus
 *     в core + push поставщику.
 *   - `marketplace::paydecline` приходит inline-вызовом из
 *     `gateway::outdecline` при отказе кассира — applyDecline +
 *     setPaymentStatus(CANCELLED) в core + push поставщику с причиной.
 *
 * Кассир работает в общем столе кооператива (расширение gateway), не в
 * marketplace — здесь нет user-facing мутаций, только реакция на
 * blockchain-action delta для отзеркаливания статусов.
 */
@Injectable()
export class MarketplacePayoutSyncService {
  constructor(
    @Inject(MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY)
    private readonly paymentRepo: MarketplaceOutgoingPaymentRequestDomainRepository,
    @Inject(PAYMENT_DESK_PORT)
    private readonly coreGateway: IPaymentDeskPort,
    private readonly eventBus: EventEmitter2,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_APL_RECEPTION_REPOSITORY)
    private readonly receptionRepo: MarketplaceAplReceptionDomainRepository
  ) {
    this.logger.setContext(MarketplacePayoutSyncService.name);
  }

  @OnEvent(
    `action::${MarketContract.contractName.production}::${MarketContract.Actions.PayConfirm.actionName}`
  )
  async handlePayConfirm(action: InnerChainActionRecord): Promise<void> {
    try {
      const data = action.data as MarketContract.Actions.PayConfirm.IPayConfirm;
      if (!data?.coopname || !data?.outcome_hash) {
        this.logger.warn('payconfirm: пустые coopname/outcome_hash — пропускаю.');
        return;
      }
      // On-chain hash приходит в верхнем регистре, а order_hash в projection
      // хранится в нижнем — нормализуем, иначе applyCompletion не найдёт заявку.
      const outcomeHash = data.outcome_hash.toLowerCase();
      const updated = await this.paymentRepo.applyCompletion(
        data.coopname,
        outcomeHash,
        {
          completed_at: new Date(),
          payout_tx_hash: action.transaction_id,
        }
      );
      if (!updated) {
        this.logger.warn(
          `payconfirm: marketplace_outgoing_payment_request для outcome ${outcomeHash} не найден — projection не создалась? Пропускаю.`
        );
        return;
      }

      if (updated.core_payment_id) {
        try {
          await this.coreGateway.setPaymentStatus({
            id: updated.core_payment_id,
            status: PaymentStatus.COMPLETED,
          });
        } catch (err: any) {
          this.logger.warn(
            `payconfirm: core setPaymentStatus(${updated.core_payment_id}) упал: ${err.message}; marketplace-статус актуальный.`
          );
        }
      }

      const event: MarketplaceSupplierPaymentConfirmedEvent = {
        coopname: updated.coopname,
        apl_reception_id: updated.apl_reception_id,
        payment_request_id: updated.id,
        supplier_account: updated.payee_account,
        amount: `${updated.amount} ${updated.symbol}`,
        payment_reference: action.transaction_id,
        ...(await this.payoutSubject(updated)),
      };
      this.eventBus.emit(MARKETPLACE_SUPPLIER_PAYMENT_CONFIRMED_EVENT, event);
    } catch (err: any) {
      this.logger.error(
        `payconfirm listener упал: ${err.message}`,
        err.stack
      );
    }
  }

  @OnEvent(
    `action::${MarketContract.contractName.production}::${MarketContract.Actions.PayDecline.actionName}`
  )
  async handlePayDecline(action: InnerChainActionRecord): Promise<void> {
    try {
      const data = action.data as MarketContract.Actions.PayDecline.IPayDecline;
      if (!data?.coopname || !data?.outcome_hash) {
        this.logger.warn('paydecline: пустые coopname/outcome_hash — пропускаю.');
        return;
      }
      const outcomeHash = data.outcome_hash.toLowerCase();
      const updated = await this.paymentRepo.applyDecline(
        data.coopname,
        outcomeHash,
        data.reason ?? t('marketplace.payoutSync.reasonNotSpecified')
      );
      if (!updated) {
        this.logger.warn(
          `paydecline: marketplace_outgoing_payment_request для outcome ${outcomeHash} не найден — пропускаю.`
        );
        return;
      }

      if (updated.core_payment_id) {
        try {
          await this.coreGateway.setPaymentStatus({
            id: updated.core_payment_id,
            status: PaymentStatus.CANCELLED,
          });
        } catch (err: any) {
          this.logger.warn(
            `paydecline: core setPaymentStatus(${updated.core_payment_id}) упал: ${err.message}; marketplace-статус актуальный.`
          );
        }
      }

      const event: MarketplaceSupplierPaymentDeclinedEvent = {
        coopname: updated.coopname,
        apl_reception_id: updated.apl_reception_id,
        payment_request_id: updated.id,
        supplier_account: updated.payee_account,
        amount: `${updated.amount} ${updated.symbol}`,
        reason: updated.decline_reason ?? t('marketplace.payoutSync.reasonNotSpecified'),
      };
      this.eventBus.emit(MARKETPLACE_SUPPLIER_PAYMENT_DECLINED_EVENT, event);
    } catch (err: any) {
      this.logger.error(
        `paydecline listener упал: ${err.message}`,
        err.stack
      );
    }
  }

  /**
   * Содержание выплаты для поставщика: название имущества и принятое
   * количество по заказу (выплата заводится на каждый заказ партии) и дата
   * закрывающей подписи акта приёмки. Идентификаторы акта и транзакции
   * поставщику ни о чём не говорят (слово владельца 17.11.2026). Сбой чтения
   * не блокирует уведомление: оно отправляется с суммой.
   */
  private async payoutSubject(request: MarketplaceOutgoingPaymentRequestDomainEntity): Promise<Partial<PayoutSubject>> {
    try {
      const [order, reception] = await Promise.all([
        this.orderRepo.findById(request.order_id),
        this.receptionRepo.findById(request.apl_reception_id),
      ]);
      if (!order) return {};
      const offer = await this.offerRepo.findById(order.offer_id);
      const fact = reception?.fact_quantity_per_order.find((f) => f.order_id === order.id);
      const pres = presentSaleUnit(Number(fact?.fact_quantity ?? order.quantity), order.unit_of_measure, order.package_size);
      const signedAt = reception?.chairman_signed_at ?? reception?.created_at ?? null;
      return {
        item_name: offer?.product_name ?? '',
        quantity: `${pres.units} ${pres.unitLabel}`.trim(),
        act_date: signedAt ? signedAt.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '',
      };
    } catch (err: any) {
      this.logger.warn(`payconfirm: состав выплаты ${request.id} не прочитан (${err.message}) — уведомление отправляется с суммой.`);
      return {};
    }
  }
}

export const MARKETPLACE_PAYOUT_SYNC_SERVICE = Symbol('MARKETPLACE_PAYOUT_SYNC_SERVICE');
