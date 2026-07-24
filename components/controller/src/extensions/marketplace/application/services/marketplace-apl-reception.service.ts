import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  MARKETPLACE_APL_RECEPTION_STATUS_CHANGED_EVENT,
  MARKETPLACE_APL_SUPPLIER_SIGN_REQUEST_EVENT,
  MARKETPLACE_APL_SUPPLIER_ONSITE_SIGN_REQUEST_EVENT,
  MARKETPLACE_APL_RECEPTION_CANCELLED_BY_SUPPLIER_EVENT,
  MARKETPLACE_CASHIER_NEW_PAYMENT_EVENT,
  type MarketplaceAplReceptionStatusChangedEvent,
  type MarketplaceAplSupplierSignRequestEvent,
  type MarketplaceAplSupplierOnsiteSignRequestEvent,
  type MarketplaceAplReceptionCancelledBySupplierEvent,
  type MarketplaceCashierNewPaymentEvent,
} from '../events/marketplace-notification.events';
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
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import {
  MARKETPLACE_INVENTORY_REPOSITORY,
  type MarketplaceInventoryDomainRepository,
} from '../../domain/repositories/marketplace-inventory.repository';
import { MarketplaceInventoryStatuses } from '../../domain/entities/marketplace-inventory.types';
import {
  MARKETPLACE_ASSET_CONFIG,
  type MarketplaceAssetConfig,
} from './marketplace-asset.config';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import {
  GATEWAY_INTERACTOR_PORT,
  type GatewayInteractorPort,
} from '~/domain/wallet/ports/gateway-interactor.port';
import { Cooperative, type MarketContract } from 'cooptypes';
import { HttpApiError } from '~/utils/httpApiError';
import { PublicKey, Signature } from '@wharfkit/antelope';
import http from 'http-status';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import type { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import type { DocumentDomainAggregate } from '~/domain/document/aggregates/document-domain.aggregate';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import type { MarketplaceAplReceptionSignedDocumentInputDTO } from '~/application/document/documents-dto/marketplace-apl-reception-document.dto';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
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
import { computeActNumber } from '../shared/act-number.util';
import { toQuantityAsset } from '../shared/quantity.util';
import {
  MARKETPLACE_SUPPLIER_SETTINGS_SERVICE,
  MarketplaceSupplierSettingsService,
} from './marketplace-supplier-settings.service';
import {
  MARKETPLACE_SUPPLIER_REGISTRY_SERVICE,
  MarketplaceSupplierRegistryService,
} from './marketplace-supplier-registry.service';
import {
  MARKETPLACE_ORDER_SUPPLIER_ACTION_SERVICE,
  MarketplaceOrderSupplierActionService,
} from './marketplace-order-supplier-action.service';
import { formatPayoutDestination } from '../shared/payout-destination.util';
import type { PaymentMethodDomainEntity } from '~/domain/payment-method/entities/method-domain.entity';
import type { MarketplaceAplReceptionDomainEntity } from '../../domain/entities/marketplace-apl-reception.entity';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import { MarketplaceOrderStatuses } from '../../domain/entities/marketplace-order.types';
import { marketplaceOrderUnitLabel } from '../shared/unit-label.util';

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
  /**
   * Подписанные клиентом канонические Document2 per-Order. Backend
   * верифицирует каждую подпись и отправляет on-chain `signsupp` с
   * этим документом. Каждый документ должен иметь meta.order_id одного
   * из Order'ов группы.
   */
  signed_documents: MarketplaceAplReceptionSignedDocumentInputDTO[];
}

export interface MarketplaceAplReceptionSignChairmanInputDto {
  coopname: string;
  chairman_account: string;
  apl_reception_id: string;
  /** То же что у поставщика — но для on-chain `signchair`. */
  signed_documents: MarketplaceAplReceptionSignedDocumentInputDTO[];
}

export interface MarketplaceAplReceptionResult {
  apl_reception: MarketplaceAplReceptionDomainEntity;
}

/**
 * Story 14.2: express-приёмка по факту присутствия. Оператор принимает
 * самовывоз поставщика, который НЕ сформировал партию заранее — указывает
 * поставщика и свой КУ, backend синтезирует SELF-партию из его ACCEPTED-
 * заказов на этот КУ и открывает приёмку.
 */
export interface MarketplaceCreateExpressReceptionInputDto {
  coopname: string;
  /** Account оператора КУ (из core-сессии). */
  operator_account: string;
  /** Поставщик, физически приехавший на ПВЗ. */
  offerer_account: string;
  /** КУ оператора, на котором идёт приёмка. */
  braname: string;
  /**
   * Фактически принятое количество и цена per-Order — оператор корректирует их
   * при открытии приёмки (так же, как на батч-приёмке). При отсутствии записи по
   * Order'у берётся order.quantity и цена заказа.
   */
  fact_quantity_per_order?: MarketplaceAplReceptionFactQuantityEntry[];
}

export interface MarketplaceCreateExpressReceptionResult {
  apl_receptions: MarketplaceAplReceptionDomainEntity[];
}

/** Поставщик с принятыми заказами, ожидающими самовывоза на конкретном КУ. */
export interface MarketplaceExpressPickupCandidate {
  offerer_account: string;
  braname: string;
  orders_count: number;
  total_units: number;
  total_amount: string;
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
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_INVENTORY_REPOSITORY)
    private readonly inventoryRepo: MarketplaceInventoryDomainRepository,
    @Inject(MARKETPLACE_ASSET_CONFIG)
    private readonly assetConfig: MarketplaceAssetConfig,
    @Inject(GATEWAY_INTERACTOR_PORT)
    private readonly coreGateway: GatewayInteractorPort,
    @Inject(MARKETPLACE_SUPPLIER_SETTINGS_SERVICE)
    private readonly supplierSettings: MarketplaceSupplierSettingsService,
    @Inject(MARKETPLACE_SUPPLIER_REGISTRY_SERVICE)
    private readonly supplierRegistry: MarketplaceSupplierRegistryService,
    @Inject(MARKETPLACE_ORDER_SUPPLIER_ACTION_SERVICE)
    private readonly supplierActionService: MarketplaceOrderSupplierActionService,
    private readonly documentDomainService: DocumentDomainService,
    private readonly eventBus: EventEmitter2,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceAplReceptionService.name);
    // chainPort и offerCounters сохраняются для будущих recipients
    // (consumed-переход на выдаче, ledger-операции после L12 split).
    void this.offerCounters;
  }

  /**
   * Preview-документы для подписания на клиенте. Один документ на каждый
   * Order группы — рендерится в платформенном пакете factory под
   * registry_id=1102. Клиент берёт hash каждого документа, подписывает
   * приватным ключом и возвращает целиком в mutation подписи.
   */
  async getSupplierSignablePayloads(
    coopname: string,
    apl_reception_id: string
  ): Promise<DocumentDomainEntity[]> {
    const reception = await this.loadReception(coopname, apl_reception_id);
    const groupOrders = await this.loadGroupOrders(reception);
    // Поставщик подписывает акт только по принятым позициям (факт > 0). Снятые
    // оператором позиции (факт = 0, некондиция) в акт не попадают — они уходят
    // отказом в приёмке (declineorder) на шаге подписи поставщика.
    const { accepted } = this.splitGroupByFact(reception, groupOrders);
    const docs: DocumentDomainEntity[] = [];
    for (const order of accepted) {
      docs.push(
        await this.generateReceptionDocument({
          reception,
          order,
          username: reception.offerer_account,
        })
      );
    }
    return docs;
  }

  /**
   * Канон двухподписного акта (как приём РИД в Capital): председатель НЕ
   * генерирует документ заново, а получает уже подписанный поставщиком акт.
   * Возвращаем агрегат на каждый Order группы: `rawDocument` — исходный
   * документ для ознакомления и наложения подписи (оригинальный порядок meta
   * по doc_hash), `document` — supplier-подписанный документ с подписью
   * поставщика. Фронт делает signDocument(rawDocument, chairman, 2,
   * [document]) — цепь не читает.
   */
  async getChairmanSignablePayloads(
    coopname: string,
    apl_reception_id: string,
    chairman_account: string
  ): Promise<DocumentDomainAggregate[]> {
    void chairman_account;
    const reception = await this.loadReception(coopname, apl_reception_id);
    const signedDocs = reception.supplier_signed_documents;
    if (!signedDocs || signedDocs.length === 0) {
      throw new ConflictException(
        `АПП ${reception.id}: нет supplier-подписанных документов — закрывающая подпись председателя недоступна до подписи поставщика.`
      );
    }
    const aggregates: DocumentDomainAggregate[] = [];
    for (const signed of signedDocs) {
      const aggregate = await this.documentDomainService.buildDocumentAggregate(signed);
      if (!aggregate) {
        throw new ConflictException(
          `АПП ${reception.id}: исходный документ по doc_hash ${signed.doc_hash} не найден в сторе. Требуется пересоздать АПП (тело документа не сохранено).`
        );
      }
      aggregates.push(aggregate);
    }
    return aggregates;
  }

  private async generateReceptionDocument(input: {
    reception: MarketplaceAplReceptionDomainEntity;
    order: MarketplaceOrderDomainEntity;
    username: string;
    chairman_account?: string;
  }): Promise<DocumentDomainEntity> {
    const fact = input.reception.fact_quantity_per_order.find(
      (f) => f.order_id === input.order.id
    );
    // АПП приёмки (registry 1104, поставщик → кооператив):
    //   `user` = ПОСТАВЩИК (передающая сторона, «Передал»);
    //   `transmitter` = оператор КУ (председатель или доверенное им лицо) —
    //   принимающая сторона от лица Кооператива («Получил»). Известен по
    //   chairman_account на закрывающей подписи; на превью — оператор, создавший АПП.
    // Заказчик стороной этого акта не является.
    const transmitter = input.chairman_account ?? input.reception.created_by_operator_account;
    const fact_quantity = fact?.fact_quantity ?? input.order.quantity;
    const fact_unit_price = fact?.fact_unit_price ?? input.order.price_per_unit;
    const total_amount = (
      fact_quantity * Number.parseFloat(fact_unit_price)
    ).toFixed(4);
    // Артикул/наименование/единица — из оферты заказа: акт несёт реальный СКУ и
    // данные товара, а не заглушку фабрики. Оферта могла быть снята — тогда
    // подставляем безопасные значения по самому заказу.
    const offer = await this.offerRepo.findById(input.order.offer_id);
    // Акт приёма-передачи ведётся В ЕДИНИЦАХ ЗАКАЗА (фасовках), без пересчёта в
    // базовые: количество = число единиц заказа, цена — за единицу заказа,
    // подпись единицы = ярлык фасовки («упаковка 8 шт» / «100 г» / «кг»).
    const action: Cooperative.Registry.MarketplaceAplReception.Action = {
      registry_id: Cooperative.Registry.MarketplaceAplReception.registry_id,
      coopname: input.reception.coopname,
      username: input.reception.offerer_account,
      order_id: input.order.id,
      order_hash: input.order.order_hash,
      act_id: computeActNumber(input.order.order_hash, input.reception.id),
      transmitter,
      braname: input.reception.braname,
      accept_braname: input.reception.braname,
      reception_id: input.reception.id,
      fact_quantity,
      total_amount,
      supplier_account: input.reception.offerer_account,
      sku: input.order.offer_id,
      product_title: offer?.product_name ?? 'Товар по предложению',
      unit_of_measurement: offer
        ? marketplaceOrderUnitLabel(offer.unit_of_measure)
        : '',
      unit_cost: fact_unit_price,
      currency: this.assetConfig.symbol,
      // Тело документа сохраняется в стор: председателю при закрывающей
      // подписи нужен ИСХОДНЫЙ документ (оригинальный порядок ключей meta)
      // по doc_hash через buildDocumentAggregate — как приём РИД в Capital.
      // On-chain meta-строка переупорядочена и для re-sign непригодна.
      skip_save: false,
    };
    return this.documentDomainService.generateDocument({ data: action });
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

    // Состав партии — по прямой связи order.shipment_id (обязательно при
    // нескольких частичных партиях на одном КУ). Fallback на инференцию
    // «по (cycle, КУ)» — для партий, созданных до появления связи.
    let groupOrders = await this.orderRepo.findByShipmentId(shipment.coopname, shipment.id);
    if (groupOrders.length === 0) {
      const orders = await this.orderRepo.findByCycleId(shipment.coopname, shipment.cycle_id);
      groupOrders = orders.filter((o) => o.delivery_braname === shipment.braname);
    }
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
      braname: shipment.braname,
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

    this.emitReceptionStatusChanged(reception);

    this.logger.log(
      `АПП ${reception.id} (вариант ${variant}) для партии ${shipment.id}, ku=${shipment.braname}, orders=${groupOrders.length}, total=${total}`
    );

    // Вариант Б (экспедитор): есть бумажная ТТН, передача подтверждена —
    // ответ поставщика ждём асинхронно, экран ему НЕ перекрываем.
    // Вариант А (очно): поставщик ЛИЧНО у стойки, другого документа о передаче
    // нет — нужен realtime-сигнал, чтобы у него моментально всплыл перекрывающий
    // гейт «Подпишите документ», и он подписал, не уходя.
    if (variant === MarketplaceAplReceptionVariants.EXPEDITOR) {
      const event: MarketplaceAplSupplierSignRequestEvent = {
        coopname: reception.coopname,
        apl_reception_id: reception.id,
        supplier_account: reception.offerer_account,
        ku_name: reception.braname,
        ttn_number: reception.ttn_number ?? '—',
        expeditor_name: reception.expeditor_data?.expeditor_full_name ?? 'экспедитор',
      };
      this.eventBus.emit(MARKETPLACE_APL_SUPPLIER_SIGN_REQUEST_EVENT, event);
    } else {
      const event: MarketplaceAplSupplierOnsiteSignRequestEvent = {
        coopname: reception.coopname,
        apl_reception_id: reception.id,
        supplier_account: reception.offerer_account,
        ku_name: reception.braname,
      };
      this.eventBus.emit(MARKETPLACE_APL_SUPPLIER_ONSITE_SIGN_REQUEST_EVENT, event);
    }

    return { apl_reception: reception };
  }

  /**
   * Story 14.2: поставщики с ACCEPTED-заказами на КУ, ожидающие самовывоза.
   * Лента для operator-стола: оператор видит, кто приехал/может приехать со
   * своим имуществом без предварительно сформированной партии.
   */
  async listExpressPickupCandidates(
    coopname: string,
    braname: string
  ): Promise<MarketplaceExpressPickupCandidate[]> {
    const page = await this.orderRepo.list(
      { coopname, status: 'ACCEPTED', delivery_braname: braname },
      { page: 1, limit: 1000, sortOrder: 'DESC' }
    );
    const bySupplier = new Map<string, MarketplaceOrderDomainEntity[]>();
    for (const o of page.items) {
      // Без заявки (cycle_id) приёмку не открыть — модель приёмки per (cycle, КУ).
      if (!o.cycle_id) continue;
      const arr = bySupplier.get(o.supplier_account) ?? [];
      arr.push(o);
      bySupplier.set(o.supplier_account, arr);
    }
    const out: MarketplaceExpressPickupCandidate[] = [];
    for (const [offerer_account, orders] of bySupplier) {
      out.push({
        offerer_account,
        braname,
        orders_count: orders.length,
        total_units: orders.reduce((a, o) => a + o.quantity, 0),
        total_amount: orders.reduce((a, o) => a + Number.parseFloat(o.total_cost), 0).toFixed(4),
      });
    }
    return out;
  }

  /**
   * Эпик 14 (агрегирующая приёмка): все единицы имущества поставщика,
   * ожидающие приёмки на этом КУ — единый базис «акцепт поставщика на КУ».
   * Возвращает Order'ы в статусах:
   *   - SUPPLY_PREPARED — задекларированы в сформированной партии (по ТТН);
   *   - ACCEPTED        — акцептованы, но в партию не вошли (добор по акцепту).
   * Партия/ТТН — лишь разметка поверх; потолок приёмки каждой позиции =
   * order.quantity (акцепт). Оператор довзвешивает факт на приёмке (≤ акцепта).
   */
  async listSupplierPickupOrders(
    coopname: string,
    braname: string,
    offerer_account: string
  ): Promise<MarketplaceOrderDomainEntity[]> {
    const page = await this.orderRepo.list(
      {
        coopname,
        supplier_account: offerer_account,
        delivery_braname: braname,
        status: [MarketplaceOrderStatuses.SUPPLY_PREPARED, MarketplaceOrderStatuses.ACCEPTED],
      },
      { page: 1, limit: 1000, sortOrder: 'DESC' }
    );
    // Без заявки (cycle_id) приёмку не открыть — модель приёмки per (cycle, КУ).
    return page.items.filter((o) => o.cycle_id);
  }

  /**
   * Story 14.2: express-приёмка самовывоза. Для каждого цикла, по которому у
   * поставщика есть ACCEPTED-заказы на этот КУ, синтезирует SELF-партию
   * (Вариант А, без ТТН) и открывает по ней приёмку через {@link create}.
   * Дальнейший двухподписный акт и переход в ACCEPTED_TO_COOP — без изменений.
   */
  async createExpress(
    input: MarketplaceCreateExpressReceptionInputDto
  ): Promise<MarketplaceCreateExpressReceptionResult> {
    if (!input.offerer_account || !input.braname) {
      throw new BadRequestException('Не указан поставщик или ПВЗ для express-приёмки.');
    }

    const page = await this.orderRepo.list(
      {
        coopname: input.coopname,
        supplier_account: input.offerer_account,
        status: 'ACCEPTED',
        delivery_braname: input.braname,
      },
      { page: 1, limit: 1000, sortOrder: 'DESC' }
    );
    const orders = page.items.filter((o) => o.cycle_id);
    if (orders.length === 0) {
      throw new BadRequestException(
        'У поставщика нет принятых заказов, ожидающих самовывоза на этом КУ.'
      );
    }

    // Партия (и приёмка) формируется per (cycle, КУ) — группируем по заявке.
    const byCycle = new Map<string, MarketplaceOrderDomainEntity[]>();
    for (const o of orders) {
      const cid = o.cycle_id as string;
      const arr = byCycle.get(cid) ?? [];
      arr.push(o);
      byCycle.set(cid, arr);
    }

    const receptions: MarketplaceAplReceptionDomainEntity[] = [];
    for (const [cycle_id, cycleOrders] of byCycle) {
      const total = cycleOrders
        .reduce((a, o) => a + Number.parseFloat(o.total_cost), 0)
        .toFixed(4);

      // Синтез SELF-партии по факту присутствия. В отличие от планового пути
      // поставщик партию заранее не формировал — оператор создаёт её на свой КУ
      // и сразу открывает приёмку. Жёсткий 1:1-акцепт всех КУ цикла (Story 5.2)
      // здесь намеренно не применяется: принимается только то, что привезли на
      // этот КУ; остальные КУ цикла формируются своими путями.
      const shipment = await this.shipmentRepo.create({
        coopname: input.coopname,
        cycle_id,
        offerer_account: input.offerer_account,
        braname: input.braname,
        delivery_variant: MarketplaceShipmentDeliveryVariants.SELF,
        total_amount: total,
        ttn_number: null,
        ttn_data: null,
        ttn_document_id: null,
        status: MarketplaceShipmentStatuses.SUPPLY_PREPARED,
      });

      // Привязка заказов к синтезированной партии + SUPPLY_PREPARED одним
      // bulk-апдейтом (как в плановом формировании) — чтобы create() резолвил
      // состав строго по shipment_id, а не инференцией по (cycle, КУ).
      await this.orderRepo.assignToShipment(
        cycleOrders.map((o) => o.id),
        shipment.id,
        `Express-приёмка самовывоза (оператор ${input.operator_account}, партия ${shipment.id})`
      );

      const result = await this.create({
        coopname: input.coopname,
        operator_account: input.operator_account,
        shipment_id: shipment.id,
        // Коррекция оператора (кол-во+цена) — единый базис с батч-приёмкой.
        // `create` сам отфильтрует записи по Order'ам этой партии (buildFactQuantity).
        fact_quantity_per_order: input.fact_quantity_per_order,
      });
      receptions.push(result.apl_reception);
    }

    this.logger.log(
      `Express-приёмка: оператор ${input.operator_account} принял самовывоз поставщика ${input.offerer_account} на КУ ${input.braname}: ${receptions.length} акт(ов).`
    );

    return { apl_receptions: receptions };
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

    // Разнос позиций: оператор на стойке снял некондицию (факт = 0). Поставщик
    // подтверждает приёмку целиком — подписывает акт по принятым позициям и тем
    // же действием отменяет поставку снятых (отказ в приёмке без штрафа, полный
    // возврат заказчику). Симметрия с отказом пайщика на выдаче.
    const groupOrders = await this.loadGroupOrders(reception);
    const { accepted, rejected } = this.splitGroupByFact(reception, groupOrders);

    // Вся партия некондиция: подписывать нечего. Отклоняем все позиции (полный
    // возврат заказчикам, поставщику без штрафа) и закрываем приёмку как
    // отменённую — имущество поставщик увозит, принимать нечего.
    if (accepted.length === 0) {
      await this.supplierActionService.declineOrdersAtReception({
        coopname: reception.coopname,
        offerer_account: input.supplier_account,
        orders: rejected,
        reason: 'Отказ в приёмке: вся партия снята оператором (некондиция)',
      });
      const cancelled = await this.receptionRepo.applySignatures(reception.id, {
        status: MarketplaceAplReceptionStatuses.CANCELLED,
      });
      await this.shipmentRepo.applyStatusTransition(
        reception.shipment_id,
        MarketplaceShipmentStatuses.CANCELLED
      );
      this.logger.log(
        `АПП ${reception.id}: вся партия отклонена в приёмке (${rejected.length} поз.) — приёмка отменена, заказчикам полный возврат.`
      );
      this.emitReceptionStatusChanged(cancelled);
      return { apl_reception: cancelled };
    }

    let txHash: string;
    try {
      txHash = await this.submitOnChainSignSupp(
        reception,
        accepted,
        input.signed_documents,
        input.supplier_account
      );
    } catch (err: any) {
      this.logger.warn(
        `АПП ${reception.id}: on-chain signsupp упал (${err.message}); статус не меняется, повторите подпись.`
      );
      throw new ConflictException(
        `Подпись на цепи не выполнена: ${err.message}. Повторите подписание.`
      );
    }

    // Снятые позиции — отказ в приёмке (полный возврат заказчику, без штрафа).
    // Best-effort: подпись по принятым уже на цепи, сбой отказа отдельной
    // позиции логируется внутри сервиса и не валит фиксацию подписи.
    if (rejected.length > 0) {
      await this.supplierActionService.declineOrdersAtReception({
        coopname: reception.coopname,
        offerer_account: input.supplier_account,
        orders: rejected,
        reason: 'Отказ в приёмке: позиция снята оператором (некондиция)',
      });
    }

    const updated = await this.receptionRepo.applySignatures(reception.id, {
      supplier_signed_at: new Date(),
      supplier_signsupp_tx_hash: txHash,
      // Сохраняем supplier-подписанные документы, чтобы при закрывающей
      // подписи отдать председателю подпись поставщика (Capital-паттерн
      // приёма РИД); фронт цепь не читает.
      supplier_signed_documents: input.signed_documents as ISignedDocumentDomainInterface[],
      status: MarketplaceAplReceptionStatuses.PENDING_CHAIRMAN_RECEPTION_SIGN,
    });

    this.logger.log(
      `АПП ${reception.id}: подпись поставщика принята (tx=${txHash}); принято ${accepted.length} поз., отклонено в приёмке ${rejected.length} поз.`
    );

    this.emitReceptionStatusChanged(updated);

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

    // Председатель закрывает приёмку только по принятым позициям (факт > 0).
    // Снятые при подписи поставщика позиции уже отклонены (declineorder, заказ
    // терминальный) — их нет в акте, в signchair, в переходе ACCEPTED_TO_COOP,
    // на складе и в выплатах.
    const groupOrders = await this.loadGroupOrders(reception);
    const { accepted: acceptedOrders } = this.splitGroupByFact(reception, groupOrders);

    let txHash: string;
    try {
      txHash = await this.submitOnChainSignChair(
        reception,
        acceptedOrders,
        input.signed_documents,
        input.chairman_account
      );
    } catch (err: any) {
      this.logger.warn(
        `АПП ${reception.id}: on-chain signchair упал (${err.message}); статус не меняется, повторите подпись.`
      );
      throw new ConflictException(
        `Закрывающая подпись на цепи не выполнена: ${err.message}. Повторите подписание.`
      );
    }
    const acceptedAt = new Date();

    const updated = await this.receptionRepo.applySignatures(reception.id, {
      chairman_signed_at: acceptedAt,
      chairman_account: input.chairman_account,
      chairman_signchair_tx_hash: txHash,
      status: MarketplaceAplReceptionStatuses.ACCEPTED_TO_COOP,
    });

    // Принятые Order'ы → ACCEPTED_TO_COOP (FR19a выдача разблокируется только
    // после этого момента). Отклонённые в приёмке сюда не попадают — они уже
    // терминальные (CANCELLED_BY_SUPPLIER).
    for (const o of acceptedOrders) {
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

    // Имущество, принятое по акту, появляется на складе КУ сразу — независимо
    // от маркировки (штрих-код опционален). Полку и штрих-код оператор назначит
    // позже на столе раскладки/маркировки.
    await this.materializeInventory(updated, acceptedOrders);

    // Story 5.6 / 598-16 (L12): инициируем выплаты поставщику per-Order
    // через gateway. Кассир увидит каждую выплату в общем реестре
    // платежей кооператива и подтвердит/отклонит её там.
    const orderHashByOrderId = new Map(acceptedOrders.map((o) => [o.id, o.order_hash] as const));
    await this.initiatePayouts(updated, acceptedOrders, orderHashByOrderId);

    // Story 598-20: push кассиру о новой партии выплат — одно
    // суммарное уведомление на АПП с агрегатом по поставщику.
    const event: MarketplaceCashierNewPaymentEvent = {
      coopname: updated.coopname,
      apl_reception_id: updated.id,
      payment_request_id: updated.id,
      supplier_account: updated.offerer_account,
      amount: `${updated.total_amount} ${this.assetConfig.symbol}`,
    };
    this.eventBus.emit(MARKETPLACE_CASHIER_NEW_PAYMENT_EVENT, event);

    this.logger.log(
      `АПП ${reception.id}: закрывающая подпись председателя ${input.chairman_account} принята (tx=${txHash}); выплаты по ${acceptedOrders.length} заказам инициированы через gateway.`
    );

    this.emitReceptionStatusChanged(updated);

    return { apl_reception: updated };
  }

  /**
   * Откат черновика приёмки до подписи поставщика (PENDING_SUPPLIER_SIGN):
   * on-chain ещё ничего не произошло (заказы в ACCEPTED, signsupp не
   * отправлялся), поэтому откат — чисто PG: приёмка → CANCELLED, партия
   * возвращается в SUPPLY_PREPARED (готова к новой приёмке), заказы не
   * трогаем. Инициатор — оператор КУ или сам поставщик (не согласен с фактом
   * приёмки). После подписи поставщика откат невозможен — signsupp уже на цепи.
   */
  async cancelReception(input: {
    coopname: string;
    cancelled_by: string;
    apl_reception_id: string;
  }): Promise<MarketplaceAplReceptionResult> {
    const reception = await this.loadReception(input.coopname, input.apl_reception_id);
    if (reception.status !== MarketplaceAplReceptionStatuses.PENDING_SUPPLIER_SIGN) {
      throw new ConflictException(
        `Отменить приёмку можно только до подписи поставщика. Текущий статус: «${reception.status}».`
      );
    }

    const cancelled = await this.receptionRepo.applySignatures(reception.id, {
      status: MarketplaceAplReceptionStatuses.CANCELLED,
    });
    // Партия снова доступна к приёмке — оператор пересоберёт акт (findByShipmentId
    // исключает CANCELLED, поэтому повторный create() по этой партии пройдёт).
    await this.shipmentRepo.applyStatusTransition(
      reception.shipment_id,
      MarketplaceShipmentStatuses.SUPPLY_PREPARED
    );

    this.logger.log(
      `АПП ${reception.id}: приёмка отменена ${input.cancelled_by} — партия ${reception.shipment_id} снова готова к приёмке.`
    );
    this.emitReceptionStatusChanged(cancelled);

    // Поставщик отказался у стойки — только создавшему акт оператору (он на
    // месте). Откат самим оператором уведомление не шлёт.
    if (input.cancelled_by === reception.offerer_account) {
      const event: MarketplaceAplReceptionCancelledBySupplierEvent = {
        coopname: reception.coopname,
        apl_reception_id: reception.id,
        braname: reception.braname,
        supplier_account: reception.offerer_account,
        operator_account: reception.created_by_operator_account,
      };
      this.eventBus.emit(MARKETPLACE_APL_RECEPTION_CANCELLED_BY_SUPPLIER_EVENT, event);
    }

    return { apl_reception: cancelled };
  }

  /**
   * Realtime-сигнал смены статуса акта: оператор у стойки и поставщик видят
   * проставленную подпись сразу, без поллинга. Эмитится ПОСЛЕ commit'а
   * статуса в PG (INV-12); маршрутизация по адресатам — в realtime-мосте.
   */
  private emitReceptionStatusChanged(reception: MarketplaceAplReceptionDomainEntity): void {
    const event: MarketplaceAplReceptionStatusChangedEvent = {
      coopname: reception.coopname,
      apl_reception_id: reception.id,
      status: reception.status,
      braname: reception.braname,
      supplier_account: reception.offerer_account,
    };
    this.eventBus.emit(MARKETPLACE_APL_RECEPTION_STATUS_CHANGED_EVENT, event);
  }

  /**
   * Story 5.6 + 598-16 (L12) + AR35: per-Order инициирует выплату поставщику.
   *
   * Для каждого Order'а группы:
   *   1. создаёт audit-projection marketplace_outgoing_payment_request
   *      в статусе PENDING (идемпотентно по order_hash);
   *   2. регистрирует системный платёж в core-реестре gateway —
   *      кассир увидит выплату в общей ленте;
   *   3. отправляет on-chain `marketplace::payout` → inline
   *      `gateway::createoutpay` (gateway::outcomes pending). Кассир в
   *      своём столе подтверждает/отказывает; callback'и
   *      `marketplace::payconfirm` / `paydecline` дойдут до listener'а
   *      в `MarketplacePayoutSyncService` и обновят статус projection +
   *      core payment + emit push поставщику.
   *
   * Ошибки на отдельной выплате не блокируют АПП и другие выплаты —
   * statement остаётся ACCEPTED_TO_COOP, кооператив может повторить
   * через ручной retry (отдельный API-шаг).
   */
  /**
   * Назначение платежа выплаты поставщику — по его договору. Дата заключения
   * (`ГГГГ-ММ-ДД`) приводится к человеческому виду `ДД.ММ.ГГГГ`. Если у
   * поставщика номер договора не задан — обобщённая формулировка без акта.
   */
  private buildPayoutPurpose(contractNumber: string | null, contractDate: string | null): string {
    if (!contractNumber) return 'Оплата по договору поставки';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(contractDate ?? '');
    const datePart = m ? ` от ${m[3]}.${m[2]}.${m[1]}` : '';
    return `Оплата по договору № ${contractNumber}${datePart}`;
  }

  private async initiatePayouts(
    reception: MarketplaceAplReceptionDomainEntity,
    allOrders: MarketplaceOrderDomainEntity[],
    orderHashByOrderId: Map<string, string>
  ): Promise<void> {
    const factByOrderId = new Map(
      reception.fact_quantity_per_order.map((f) => [f.order_id, f.fact_quantity])
    );
    const groupOrders = allOrders.filter((o) => o.delivery_braname === reception.braname);

    // Реквизиты поставщика резолвятся один раз на всю группу: снапшот на
    // момент создания выплат — последующая смена «выплаты получаю на…»
    // уже созданные выплаты не трогает. Отсутствие реквизитов выплату не
    // блокирует (деньги поставщику должны уйти) — кассир увидит платёж
    // без реквизитов и запросит их у поставщика.
    let payoutMethod: PaymentMethodDomainEntity | null = null;
    try {
      payoutMethod = await this.supplierSettings.resolvePayoutMethod(
        reception.coopname,
        reception.offerer_account
      );
    } catch (err: any) {
      this.logger.warn(
        `initiatePayouts: резолв реквизитов поставщика ${reception.offerer_account} упал: ${err.message}; выплаты создаются без реквизитов.`
      );
    }
    if (!payoutMethod) {
      this.logger.warn(
        `initiatePayouts: у поставщика ${reception.offerer_account} нет реквизитов для выплат — кассир увидит платежи без реквизитов.`
      );
    }

    // Назначение платежа — по договору поставщика (номер + дата заключения),
    // одинаковое для всех заказов группы: оплата поставки как обычной покупки.
    // Номер акта приёма-передачи в назначение НЕ выносим — основанием выступает
    // договор. Режим налогообложения поставщика (НДС) пока не настраивается.
    const supplier = await this.supplierRegistry.findByMember(
      reception.coopname,
      reception.offerer_account
    );
    const purpose = this.buildPayoutPurpose(
      supplier?.contract_number ?? null,
      supplier?.contract_date ?? null
    );

    for (const order of groupOrders) {
      const orderHash = orderHashByOrderId.get(order.id);
      if (!orderHash) {
        this.logger.warn(
          `initiatePayouts: у заказа ${order.id} нет order_hash — выплата невозможна.`
        );
        continue;
      }
      const factQuantity = factByOrderId.get(order.id) ?? order.quantity;
      const amount = (factQuantity * Number.parseFloat(order.price_per_unit)).toFixed(4);

      await this.initiatePayoutForOrder({
        coopname: reception.coopname,
        order_hash: orderHash,
        order_id: order.id,
        apl_reception_id: reception.id,
        payee_account: reception.offerer_account,
        amount,
        purpose,
        payout_method: payoutMethod,
      });
    }
  }

  private async initiatePayoutForOrder(input: {
    coopname: string;
    order_hash: string;
    order_id: string;
    apl_reception_id: string;
    payee_account: string;
    amount: string;
    purpose: string;
    payout_method: PaymentMethodDomainEntity | null;
  }): Promise<void> {
    const payoutDestination = input.payout_method
      ? formatPayoutDestination(input.payout_method)
      : null;
    let projection;
    try {
      projection = await this.paymentRepo.createIfNotExists({
        coopname: input.coopname,
        order_hash: input.order_hash,
        order_id: input.order_id,
        apl_reception_id: input.apl_reception_id,
        payee_account: input.payee_account,
        amount: input.amount,
        symbol: this.assetConfig.symbol,
        purpose: input.purpose,
        payout_destination: payoutDestination,
      });
    } catch (err: any) {
      this.logger.warn(
        `initiatePayouts: создание projection для order ${input.order_id} упало: ${err.message}; пропускаю.`
      );
      return;
    }

    if (!projection.core_payment_id) {
      try {
        // payment_hash обязан совпадать с on-chain gateway::outcomes.outcome_hash,
        // который marketplace::payout регистрирует как сам order_hash. Иначе
        // кассирский gateway::outcomplete ищет объект выплаты по другому хэшу и
        // падает с «Объект возврата не существует с указанным хэшем».
        // Снапшот реквизитов поставщика — кассир видит банк/счёт/назначение
        // прямо в развороте платежа общего реестра (как у обычного withdraw).
        const corePayment = await this.coreGateway.createSystemOutgoingPayment({
          coopname: input.coopname,
          username: input.payee_account,
          quantity: Number.parseFloat(input.amount),
          symbol: this.assetConfig.symbol,
          memo: input.purpose,
          related_extension: 'marketplace',
          related_entity_id: projection.id,
          payment_hash: input.order_hash,
          payment_method_id: input.payout_method?.method_id,
          payment_details: input.payout_method
            ? {
                data: input.payout_method.data,
                amount_plus_fee: input.amount,
                amount_without_fee: input.amount,
                fee_amount: '0',
                fee_percent: 0,
                fact_fee_percent: 0,
                tolerance_percent: 0,
              }
            : undefined,
        });
        if (corePayment.id) {
          await this.paymentRepo.applyCorePaymentId(
            input.coopname,
            input.order_hash,
            corePayment.id
          );
        }
      } catch (err: any) {
        this.logger.warn(
          `initiatePayouts: core createSystemOutgoingPayment для order ${input.order_id} упал: ${err.message}; кассирский стол core не увидит выплату до повторной попытки.`
        );
      }
    }

    try {
      await this.chainPort.payOut({
        coopname: input.coopname,
        order_hash: input.order_hash,
      });
    } catch (err: any) {
      this.logger.warn(
        `initiatePayouts: on-chain payOut для order ${input.order_id} упал: ${err.message}; projection остаётся PENDING, gateway::outcomes не создан. Требуется retry.`
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

  private async loadGroupOrders(
    reception: MarketplaceAplReceptionDomainEntity
  ): Promise<MarketplaceOrderDomainEntity[]> {
    const orders = await this.orderRepo.findByCycleId(reception.coopname, reception.cycle_id);
    return orders.filter((o) => o.delivery_braname === reception.braname);
  }

  /**
   * Разнос заказов группы на принятые (факт > 0 — идут в акт, на баланс
   * кооператива и в выплату поставщику) и отклонённые в приёмке (факт = 0 —
   * оператор снял позицию: некондиция). Потолок факта = акцепт (см.
   * buildFactQuantity); отсутствие записи факта трактуется как полный приём.
   * Заказы с уже терминальным статусом (например, ранее отклонённые в этой же
   * приёмке при повторном вызове) в принятые не попадают.
   */
  private splitGroupByFact(
    reception: MarketplaceAplReceptionDomainEntity,
    groupOrders: MarketplaceOrderDomainEntity[]
  ): { accepted: MarketplaceOrderDomainEntity[]; rejected: MarketplaceOrderDomainEntity[] } {
    const factByOrderId = new Map(
      reception.fact_quantity_per_order.map((f) => [f.order_id, f.fact_quantity])
    );
    const accepted: MarketplaceOrderDomainEntity[] = [];
    const rejected: MarketplaceOrderDomainEntity[] = [];
    for (const o of groupOrders) {
      const fact = factByOrderId.get(o.id) ?? o.quantity;
      if (
        o.status === MarketplaceOrderStatuses.CANCELLED_BY_SUPPLIER ||
        o.status === MarketplaceOrderStatuses.CANCELLED_BY_ORDERER
      ) {
        continue;
      }
      (fact > 0 ? accepted : rejected).push(o);
    }
    return { accepted, rejected };
  }

  /**
   * Оприходование склада: на каждый принятый Order группы (fact_quantity > 0)
   * заводим позицию инвентаря в статусе RECEIVED — имущество физически на
   * складе КУ. Штрих-код и полка не назначаются (оператор сделает это на столе
   * раскладки/маркировки). Срок годности позиции — `received_at +
   * offer.shelf_life_days` (поле поставщика), основа списания скоропорта. НЕ
   * путать с гарантийным сроком возврата (`warranty_period_secs`, окно возврата).
   *
   * Идемпотентно: если по Order'у позиция уже есть (повторная подпись/ретрай),
   * пропускаем, чтобы не задвоить склад.
   */
  private async materializeInventory(
    reception: MarketplaceAplReceptionDomainEntity,
    orders: MarketplaceOrderDomainEntity[]
  ): Promise<void> {
    const groupOrders = orders.filter((o) => o.delivery_braname === reception.braname);
    if (groupOrders.length === 0) return;

    const factByOrderId = new Map(
      reception.fact_quantity_per_order.map((f) => [f.order_id, f.fact_quantity] as const)
    );
    const offerIds = [...new Set(groupOrders.map((o) => o.offer_id))];
    const offerById = new Map(
      (await this.offerRepo.findByIds(offerIds)).map((off) => [off.id, off] as const)
    );
    const receivedAt = reception.chairman_signed_at ?? new Date();

    let created = 0;
    for (const order of groupOrders) {
      const factQty = factByOrderId.get(order.id) ?? order.quantity;
      if (factQty <= 0) continue;
      const already = await this.inventoryRepo.countByOrder(reception.coopname, order.id);
      if (already > 0) continue;
      const offer = offerById.get(order.offer_id);
      // Срок годности берём из предложения (задал поставщик), а не из
      // гарантийного срока возврата заказа: списание скоропорта и окно возврата
      // теперь разведены. 0/отсутствие срока годности → позиция не списывается
      // по сроку (expiry_date=null).
      const shelfLifeDays = offer?.shelf_life_days ?? 0;
      const expiry =
        shelfLifeDays > 0
          ? new Date(receivedAt.getTime() + shelfLifeDays * 86_400 * 1000)
          : null;
      await this.inventoryRepo.create({
        coopname: reception.coopname,
        order_id: order.id,
        shipment_id: reception.shipment_id,
        braname: reception.braname,
        status: MarketplaceInventoryStatuses.RECEIVED,
        product_name_snapshot: offer?.product_name ?? '',
        quantity_per_label: factQty,
        orderer_account_snapshot: order.orderer_account,
        shelf: null,
        received_at: receivedAt,
        received_by_operator_account: reception.created_by_operator_account,
        barcode_value: null,
        barcode_format: null,
        labeled_at: null,
        labeled_by_operator_account: null,
        expiry_date: expiry,
        // Цена прибытия — закупочная цена заказа: база цены публикации,
        // если дельта позже уйдёт в обезличенный остаток КУ (requirement 76).
        arrival_price: order.price_per_unit,
      });
      created += 1;
    }

    this.logger.log(
      `АПП ${reception.id}: на склад КУ ${reception.braname} оприходовано ${created} позиций (RECEIVED).`
    );
  }

  /**
   * Per-Order on-chain `signsupp`. Каждый Order группы должен иметь свой
   * подписанный документ с meta.order_id, привязка идёт по нему.
   * Возвращает tx_hash последнего успешного submit; промежуточные —
   * в debug-логе.
   */
  private async submitOnChainSignSupp(
    reception: MarketplaceAplReceptionDomainEntity,
    groupOrders: MarketplaceOrderDomainEntity[],
    signed_documents: MarketplaceAplReceptionSignedDocumentInputDTO[],
    offerer: string
  ): Promise<string> {
    const byOrderId = this.indexSignedDocumentsByOrderId(signed_documents);
    let lastTxHash = '';
    for (const order of groupOrders) {
      const signed = byOrderId.get(order.id);
      if (!signed) {
        throw new BadRequestException(
          `Нет подписанного акта приёмки для Order ${order.id}; нужны акты по всем Order'ам группы (${groupOrders.length}).`
        );
      }
      this.verifyDocumentSignature(signed);
      const act = this.toChainDocument(signed) as MarketContract.Actions.SignSupp.ISignSupp['act'];
      const tx = await this.chainPort.signSupp({
        coopname: reception.coopname,
        offerer,
        order_hash: order.order_hash,
        accept_braname: reception.braname,
        act,
      });
      const txHash = this.extractTxHash(tx);
      if (!txHash) {
        // fail-fast: цепь приняла signsupp, но не вернула tx_hash. Часть
        // ордеров группы уже обработана выше — позволять создавать запись
        // в БД с фантомным fallback'ом ('signsupp-<reception_id>')
        // означает потерять связь с конкретным tx. Лучше отбить — ретрай
        // безопасен (цепь идемпотентна по order_hash).
        throw new ConflictException(
          `signsupp по Order ${order.id}: цепь не вернула tx_hash. Повторите подписание группы.`
        );
      }
      lastTxHash = txHash;
      this.logger.debug(`signsupp on-chain OK: order ${order.id} → tx ${txHash}`);
    }
    return lastTxHash;
  }

  /** Аналог `submitOnChainSignSupp` для закрывающей подписи председателя. */
  private async submitOnChainSignChair(
    reception: MarketplaceAplReceptionDomainEntity,
    groupOrders: MarketplaceOrderDomainEntity[],
    signed_documents: MarketplaceAplReceptionSignedDocumentInputDTO[],
    signer: string
  ): Promise<string> {
    const byOrderId = this.indexSignedDocumentsByOrderId(signed_documents);
    const factByOrderId = new Map(
      reception.fact_quantity_per_order.map((f) => [f.order_id, f])
    );
    let lastTxHash = '';
    for (const order of groupOrders) {
      const signed = byOrderId.get(order.id);
      if (!signed) {
        throw new BadRequestException(
          `Нет подписанного акта приёмки председателя для Order ${order.id}; нужны акты по всем Order'ам группы.`
        );
      }
      this.verifyDocumentSignature(signed);
      const act = this.toChainDocument(signed) as MarketContract.Actions.SignChair.ISignChair['act'];
      // Факт (кол-во + цена) зафиксирован оператором при открытии приёмки и
      // зашит в подписанный поставщиком акт; кооператив книжит поставщику
      // итоговую стоимость от него.
      const fact = factByOrderId.get(order.id);
      const actual_quantity = fact?.fact_quantity ?? order.quantity;
      const actual_unit_price = this.formatAsset(fact?.fact_unit_price ?? order.price_per_unit);
      const tx = await this.chainPort.signChair({
        coopname: reception.coopname,
        signer,
        order_hash: order.order_hash,
        actual_quantity: toQuantityAsset(actual_quantity, order.unit_of_measure),
        actual_unit_price,
        act,
      });
      const txHash = this.extractTxHash(tx);
      if (!txHash) {
        throw new ConflictException(
          `signchair по Order ${order.id}: цепь не вернула tx_hash. Повторите подписание группы.`
        );
      }
      lastTxHash = txHash;
      this.logger.debug(`signchair on-chain OK: order ${order.id} → tx ${txHash}`);
    }
    return lastTxHash;
  }

  private indexSignedDocumentsByOrderId(
    docs: MarketplaceAplReceptionSignedDocumentInputDTO[]
  ): Map<string, MarketplaceAplReceptionSignedDocumentInputDTO> {
    const out = new Map<string, MarketplaceAplReceptionSignedDocumentInputDTO>();
    for (const d of docs) {
      const orderId = d.meta?.order_id;
      if (!orderId) {
        throw new BadRequestException(
          'Каждый подписанный акт приёмки должен содержать meta.order_id, по которому он привязывается к Order группы.'
        );
      }
      out.set(orderId, d);
    }
    return out;
  }

  // Глобальный ValidationPipe сконфигурирован без transform:true, поэтому
  // элементы signed_documents приходят в resolver плоскими объектами без
  // методов класса. Оборачиваем в DTO, чтобы получить toDocument() с
  // корректной сериализацией meta перед отправкой on-chain.
  private toChainDocument(
    signed: MarketplaceAplReceptionSignedDocumentInputDTO
  ): Cooperative.Document.IChainDocument2 {
    return new SignedDigitalDocumentInputDTO(signed).toDocument();
  }

  private verifyDocumentSignature(document: ISignedDocumentDomainInterface): void {
    const sig = document.signatures?.[0];
    if (!sig) {
      throw new HttpApiError(http.BAD_REQUEST, 'Документ не подписан: signatures пуст.');
    }
    const publicKey = PublicKey.from(sig.public_key);
    const signature = Signature.from(sig.signature);
    const verified = signature.verifyDigest(sig.signed_hash, publicKey);
    if (!verified) {
      throw new HttpApiError(http.BAD_REQUEST, 'Недействительная подпись акта приёмки.');
    }
  }

  private extractTxHash(tx: unknown): string {
    const candidate = tx as
      | { response?: { transaction_id?: string }; resolved?: { transaction?: { id?: string } }; transaction?: { id?: string } }
      | undefined;
    return (
      candidate?.response?.transaction_id ??
      candidate?.resolved?.transaction?.id ??
      candidate?.transaction?.id ??
      ''
    );
  }

  private buildFactQuantity(
    provided: MarketplaceAplReceptionFactQuantityEntry[],
    groupOrders: MarketplaceOrderDomainEntity[]
  ): MarketplaceAplReceptionFactQuantityEntry[] {
    const providedMap = new Map(provided.map((p) => [p.order_id, p]));
    const out: MarketplaceAplReceptionFactQuantityEntry[] = [];
    for (const o of groupOrders) {
      const entry = providedMap.get(o.id);
      if (entry !== undefined) {
        const fact = entry.fact_quantity;
        if (!Number.isInteger(fact) || fact < 0) {
          throw new BadRequestException(
            `Некорректное fact_quantity для Order ${o.id}: ${fact}.`
          );
        }
        // Потолок приёмки = акцепт (заказанное кол-во): сверх акцепта
        // принципиально не принимаем («больше, чем заказано — не надо»).
        // Меньше — допустимо (недовоз). Партия/ТТН — лишь декларация, не лимит.
        if (fact > o.quantity) {
          throw new BadRequestException(
            `Нельзя принять сверх акцепта по Order ${o.id}: факт ${fact} > заказано ${o.quantity}.`
          );
        }
        // Цена за единицу: оператор может скорректировать (привезли хуже —
        // принимаем со скидкой). По умолчанию — цена заказа.
        let fact_unit_price = o.price_per_unit;
        if (entry.fact_unit_price !== undefined) {
          const priceNum = Number.parseFloat(entry.fact_unit_price);
          if (Number.isNaN(priceNum) || priceNum <= 0) {
            throw new BadRequestException(
              `Некорректная цена за единицу для Order ${o.id}: ${entry.fact_unit_price}.`
            );
          }
          fact_unit_price = priceNum.toFixed(this.assetConfig.decimals);
        }
        out.push({ order_id: o.id, fact_quantity: fact, fact_unit_price });
      } else {
        out.push({ order_id: o.id, fact_quantity: o.quantity, fact_unit_price: o.price_per_unit });
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
      const unitPrice = Number.parseFloat(entry.fact_unit_price ?? order.price_per_unit);
      total += entry.fact_quantity * unitPrice;
    }
    return total.toFixed(4);
  }

  private formatAsset(value: string): string {
    const amount = Number.parseFloat(value);
    return `${amount.toFixed(this.assetConfig.decimals)} ${this.assetConfig.symbol}`;
  }

}

export const MARKETPLACE_APL_RECEPTION_SERVICE = Symbol('MARKETPLACE_APL_RECEPTION_SERVICE');
