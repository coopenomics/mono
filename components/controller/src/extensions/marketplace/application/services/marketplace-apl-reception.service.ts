import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  MARKETPLACE_SHIPMENT_REPOSITORY,
  type MarketplaceShipmentDomainRepository,
} from '../../domain/repositories/marketplace-shipment.repository';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_OFFER_COUNTERS_SERVICE,
  MarketplaceOfferCountersService,
} from './marketplace-offer-counters.service';
import {
  MARKETPLACE_APL_RECEPTION_REPOSITORY,
  type MarketplaceAplReceptionDomainRepository,
} from '../../domain/repositories/marketplace-apl-reception.repository';
import {
  MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY,
  type MarketplaceOutgoingPaymentRequestDomainRepository,
} from '../../domain/repositories/marketplace-outgoing-payment-request.repository';
import { MarketplaceOutgoingPaymentRequestStatuses } from '../../domain/entities/marketplace-outgoing-payment-request.types';
import {
  MARKETPLACE_ASSET_CONFIG,
  type MarketplaceAssetConfig,
} from './marketplace-asset.config';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import {
  MarketplaceAplReceptionStatuses,
  MarketplaceAplReceptionVariants,
  type MarketplaceAplReceptionFactQuantityEntry,
  type MarketplaceAplReceptionVariant,
} from '../../domain/entities/marketplace-apl-reception.types';
import {
  MarketplaceShipmentDeliveryVariants,
  MarketplaceShipmentStatuses,
} from '../../domain/entities/marketplace-shipment.types';
import type { MarketplaceAplReceptionDomainEntity } from '../../domain/entities/marketplace-apl-reception.entity';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';

export interface MarketplaceAplReceptionCreateInputDto {
  coopname: string;
  /** Account оператора КУ, формирующего АПП (из core-сессии). */
  operator_account: string;
  shipment_id: string;
  /** Опционально для Варианта Б — фактическое количество per-Order; при отсутствии берётся order.quantity. */
  fact_quantity_per_order?: MarketplaceAplReceptionFactQuantityEntry[];
}

export interface MarketplaceAplReceptionSignSupplierInputDto {
  coopname: string;
  /** Account поставщика — для Варианта А лично подписывает на стойке оператора;
   * для Варианта Б — через push в свой стол. */
  supplier_account: string;
  apl_reception_id: string;
}

export interface MarketplaceAplReceptionSignChairmanInputDto {
  coopname: string;
  chairman_account: string;
  apl_reception_id: string;
}

export interface MarketplaceAplReceptionResult {
  apl_reception: MarketplaceAplReceptionDomainEntity;
}

/**
 * Story 5.3 / 5.4: state machine АПП приёмки на КУ.
 *
 * Flow:
 *   1. `create(shipment_id, variant, fact_quantity?)`: оператор формирует
 *      АПП по партии в статусе SUPPLY_PREPARED. fact_quantity для
 *      Варианта Б позволяет указать расхождение против заявки; для
 *      Варианта А — `quantity = order.quantity` по умолчанию.
 *      Статус АПП → PENDING_SUPPLIER_SIGN; Shipment → RECEPTION_IN_PROGRESS.
 *      Для Варианта Б — backend инициирует push поставщику (Story 5.4).
 *
 *   2. `signAsSupplier(apl_reception_id)`: первая подпись поставщика.
 *      Backend per-Order переводит status в PG; on-chain `signsupp`
 *      не выполняется в этом MVP (FR45 signing infrastructure — техдолг
 *      Story 5.4); on-chain интеграция отдельным follow-up'ом со
 *      связкой document factory + AR33. Статус АПП →
 *      PENDING_CHAIRMAN_RECEPTION_SIGN.
 *
 *   3. `signAsChairman(apl_reception_id, chairman_account)`:
 *      закрывающая подпись. Story 5.6 расширяет этот шаг до atomic
 *      on-chain `signchair` per-Order + создания outgoing_payment.
 *      Здесь — backend-only переход в ACCEPTED_TO_COOP; Order'ы группы
 *      переводятся в ACCEPTED_TO_COOP, Shipment → ACCEPTED_TO_COOP.
 *      offerer_counters.onOrderRolledBack/onOrderConsumed не дёргаем —
 *      consumed-переход выполняется на выдаче (Эпик 6).
 *
 * Edge-case (Story 5.4 «поставщик не подписывает»): АПП остаётся в
 * PENDING_SUPPLIER_SIGN. MVP не автоматизирует разрешение; кооператив
 * решает через свои процедуры. Compensating-транзакций нет.
 */
@Injectable()
export class MarketplaceAplReceptionService {
  constructor(
    @Inject(MARKETPLACE_SHIPMENT_REPOSITORY)
    private readonly shipmentRepo: MarketplaceShipmentDomainRepository,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_APL_RECEPTION_REPOSITORY)
    private readonly receptionRepo: MarketplaceAplReceptionDomainRepository,
    @Inject(MARKETPLACE_OFFER_COUNTERS_SERVICE)
    private readonly offerCounters: MarketplaceOfferCountersService,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY)
    private readonly paymentRepo: MarketplaceOutgoingPaymentRequestDomainRepository,
    @Inject(MARKETPLACE_ASSET_CONFIG)
    private readonly assetConfig: MarketplaceAssetConfig,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceAplReceptionService.name);
    // Ссылка на chainPort и offerCounters сохраняется на Story 5.6 follow-up
    // (on-chain signchair + outgoing_payment + consumed-переход на выдаче).
    void this.chainPort;
    void this.offerCounters;
  }

  async create(
    input: MarketplaceAplReceptionCreateInputDto
  ): Promise<MarketplaceAplReceptionResult> {
    if (!input.shipment_id) {
      throw new BadRequestException('Не указан shipment_id.');
    }

    const shipment = await this.shipmentRepo.findById(input.shipment_id);
    if (!shipment || shipment.coopname !== input.coopname) {
      throw new NotFoundException('Партия поставки не найдена.');
    }
    if (shipment.status !== MarketplaceShipmentStatuses.SUPPLY_PREPARED) {
      throw new BadRequestException(
        `Партия не готова к приёмке: статус «${shipment.status}», ожидался SUPPLY_PREPARED.`
      );
    }
    // Один Shipment — одна активная АПП.
    const existing = await this.receptionRepo.findByShipmentId(input.coopname, shipment.id);
    if (existing) {
      throw new ConflictException(
        `АПП для партии ${shipment.id} уже сформирована (id=${existing.id}); повторное создание запрещено.`
      );
    }

    const orders = await this.orderRepo.findByCycleId(shipment.coopname, shipment.cycle_id);
    const groupOrders = orders.filter((o) => o.delivery_braname === shipment.ku_id);
    if (groupOrders.length === 0) {
      throw new BadRequestException(
        'В партии поставки нет Order\'ов на этот КУ — нечего принимать.'
      );
    }

    const fact = this.buildFactQuantity(input.fact_quantity_per_order ?? [], groupOrders);
    const total = this.computeTotalAmount(fact, groupOrders);
    const variant: MarketplaceAplReceptionVariant =
      shipment.delivery_variant === MarketplaceShipmentDeliveryVariants.EXPEDITOR
        ? MarketplaceAplReceptionVariants.EXPEDITOR
        : MarketplaceAplReceptionVariants.IN_PERSON;

    const reception = await this.receptionRepo.create({
      coopname: shipment.coopname,
      shipment_id: shipment.id,
      cycle_id: shipment.cycle_id,
      ku_id: shipment.ku_id,
      offerer_account: shipment.offerer_account,
      variant,
      status: MarketplaceAplReceptionStatuses.PENDING_SUPPLIER_SIGN,
      fact_quantity_per_order: fact,
      ttn_number: shipment.ttn_number,
      expeditor_data: shipment.ttn_data,
      created_by_operator_account: input.operator_account,
      total_amount: total,
    });

    // Партия переходит в «приёмка идёт».
    await this.shipmentRepo.applyStatusTransition(
      shipment.id,
      MarketplaceShipmentStatuses.RECEPTION_IN_PROGRESS
    );

    this.logger.log(
      `АПП ${reception.id} (вариант ${variant}) для партии ${shipment.id}, ku=${shipment.ku_id}, orders=${groupOrders.length}, total=${total}`
    );

    return { apl_reception: reception };
  }

  async signAsSupplier(
    input: MarketplaceAplReceptionSignSupplierInputDto
  ): Promise<MarketplaceAplReceptionResult> {
    const reception = await this.loadReception(input.coopname, input.apl_reception_id);
    if (reception.offerer_account !== input.supplier_account) {
      throw new ForbiddenException('АПП подписывает только поставщик-владелец Offer\'ов.');
    }
    if (!reception.awaits_supplier) {
      throw new ConflictException(
        `АПП находится в статусе «${reception.status}», подпись поставщика недопустима.`
      );
    }

    const txHash = this.placeholderTxHash('signsupp', reception.id);
    const updated = await this.receptionRepo.applySignatures(reception.id, {
      supplier_signed_at: new Date(),
      supplier_signsupp_tx_hash: txHash,
      status: MarketplaceAplReceptionStatuses.PENDING_CHAIRMAN_RECEPTION_SIGN,
    });

    this.logger.log(
      `АПП ${reception.id}: подпись поставщика принята (placeholder tx=${txHash}). On-chain signsupp подключается отдельным follow-up'ом FR45.`
    );

    return { apl_reception: updated };
  }

  async signAsChairman(
    input: MarketplaceAplReceptionSignChairmanInputDto
  ): Promise<MarketplaceAplReceptionResult> {
    const reception = await this.loadReception(input.coopname, input.apl_reception_id);
    if (!reception.awaits_chairman) {
      throw new ConflictException(
        `АПП находится в статусе «${reception.status}», закрывающая подпись председателя недопустима.`
      );
    }

    const txHash = this.placeholderTxHash('signchair', reception.id);
    const acceptedAt = new Date();

    const updated = await this.receptionRepo.applySignatures(reception.id, {
      chairman_signed_at: acceptedAt,
      chairman_account: input.chairman_account,
      chairman_signchair_tx_hash: txHash,
      status: MarketplaceAplReceptionStatuses.ACCEPTED_TO_COOP,
    });

    // Order'ы группы → ACCEPTED_TO_COOP (FR19a выдача разблокируется только
    // после этого момента).
    const orders = await this.orderRepo.findByCycleId(reception.coopname, reception.cycle_id);
    for (const o of orders.filter((x) => x.delivery_braname === reception.ku_id)) {
      await this.orderRepo.applyStatusTransition(
        o.id,
        'ACCEPTED_TO_COOP',
        `АПП #${reception.id} закрывающая подпись председателя ${input.chairman_account}`
      );
    }

    await this.shipmentRepo.applyStatusTransition(
      reception.shipment_id,
      MarketplaceShipmentStatuses.ACCEPTED_TO_COOP
    );

    // Story 5.6: создаём marketplace-scoped запрос исходящего платежа.
    // Кассир увидит задачу в своём столе и подтвердит факт банковского
    // перевода (Story 5.7).
    await this.createOutgoingPaymentRequest(updated, input.chairman_account);

    this.logger.log(
      `АПП ${reception.id}: закрывающая подпись председателя ${input.chairman_account} принята (placeholder tx=${txHash}). On-chain signchair + ledger o.mkt.purch / o.mkt.payout подключаются FR45 follow-up'ом (требуется реальная подпись Document2 через AR33).`
    );

    return { apl_reception: updated };
  }

  /**
   * Story 5.6: marketplace-scoped реестр запросов на оплату поставщику.
   * Заявка создаётся со статусом PENDING_CASHIER_ACTION; синхронизация
   * с core outgoing_payment (AR35) — отдельным follow-up'ом со связкой
   * core/gateway-API.
   */
  private async createOutgoingPaymentRequest(
    reception: MarketplaceAplReceptionDomainEntity,
    chairman_account: string
  ): Promise<void> {
    try {
      const existing = await this.paymentRepo.findByAplReceptionId(
        reception.coopname,
        reception.id
      );
      if (existing) return;
      const orderIds = reception.fact_quantity_per_order.map((f) => f.order_id);
      const purpose = `Приобретение товаров по счёту marketplace, АПП #${reception.id} (председатель ${chairman_account})`;
      await this.paymentRepo.create({
        coopname: reception.coopname,
        apl_reception_id: reception.id,
        payee_account: reception.offerer_account,
        related_order_ids: orderIds,
        amount: reception.total_amount,
        symbol: this.assetConfig.symbol,
        purpose,
        status: MarketplaceOutgoingPaymentRequestStatuses.PENDING_CASHIER_ACTION,
      });
    } catch (err: any) {
      // Запрос платежа — критичен для Story 5.6/5.7, но не блокирует
      // успех АПП на цепи. Логируем и продолжаем (наблюдаемость по
      // marketplace_outgoing_payment_request статусу).
      this.logger.warn(
        `MarketplaceAplReceptionService.createOutgoingPaymentRequest: создание запроса платежа для АПП ${reception.id} упало (${err.message}); АПП в статусе ACCEPTED_TO_COOP остаётся.`
      );
    }
  }

  // ── private ──

  private async loadReception(
    coopname: string,
    id: string
  ): Promise<MarketplaceAplReceptionDomainEntity> {
    const reception = await this.receptionRepo.findById(id);
    if (!reception || reception.coopname !== coopname) {
      throw new NotFoundException('АПП приёмки не найден.');
    }
    return reception;
  }

  private buildFactQuantity(
    provided: MarketplaceAplReceptionFactQuantityEntry[],
    groupOrders: MarketplaceOrderDomainEntity[]
  ): MarketplaceAplReceptionFactQuantityEntry[] {
    const providedMap = new Map(provided.map((p) => [p.order_id, p.fact_quantity]));
    const out: MarketplaceAplReceptionFactQuantityEntry[] = [];
    for (const o of groupOrders) {
      const fact = providedMap.get(o.id);
      if (fact !== undefined) {
        if (!Number.isInteger(fact) || fact < 0) {
          throw new BadRequestException(
            `Некорректное fact_quantity для Order ${o.id}: ${fact}.`
          );
        }
        out.push({ order_id: o.id, fact_quantity: fact });
      } else {
        out.push({ order_id: o.id, fact_quantity: o.quantity });
      }
    }
    return out;
  }

  private computeTotalAmount(
    fact: MarketplaceAplReceptionFactQuantityEntry[],
    orders: MarketplaceOrderDomainEntity[]
  ): string {
    const byId = new Map(orders.map((o) => [o.id, o]));
    let total = 0;
    for (const entry of fact) {
      const order = byId.get(entry.order_id);
      if (!order) continue;
      total += entry.fact_quantity * Number.parseFloat(order.price_per_unit);
    }
    return total.toFixed(4);
  }

  /**
   * Story 5.3/5.4 MVP: placeholder tx_hash до подключения on-chain signsupp
   * / signchair с реальной подписью документа Document2 через FR45
   * инфраструктуру. Содержит prefix + reception_id для трассировки.
   */
  private placeholderTxHash(prefix: string, id: string): string {
    return `placeholder-${prefix}-${id.replace(/-/g, '').slice(0, 12)}`;
  }
}

export const MARKETPLACE_APL_RECEPTION_SERVICE = Symbol('MARKETPLACE_APL_RECEPTION_SERVICE');
