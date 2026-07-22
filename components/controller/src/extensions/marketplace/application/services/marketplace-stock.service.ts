import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash } from 'crypto';
import type { MarketContract } from 'cooptypes';
import { computeStockOrderHash } from '../shared/order-hash.util';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  MARKETPLACE_ASSET_CONFIG,
  type MarketplaceAssetConfig,
} from './marketplace-asset.config';
import {
  MARKETPLACE_INVENTORY_REPOSITORY,
  type MarketplaceInventoryDomainRepository,
} from '../../domain/repositories/marketplace-inventory.repository';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
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
import {
  MarketplaceInventoryOwnerships,
} from '../../domain/entities/marketplace-inventory.types';
import { MarketplaceOfferStatuses } from '../../domain/entities/marketplace-offer.types';
import {
  MarketplaceOrderStatuses,
  type MarketplaceOrderCreateTxSnapshot,
} from '../../domain/entities/marketplace-order.types';
import type { MarketplaceInventoryDomainEntity } from '../../domain/entities/marketplace-inventory.entity';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import { rethrowChainError, normalizeChainTxHash } from '../shared/chain-tx.util';
import { MARKETPLACE_OFFER_APPROVED_EVENT } from '../events/marketplace-notification.events';

export interface MarketplaceStockPublishInput {
  coopname: string;
  operator_account: string;
  /** Позиции обезличенного остатка одного КУ (могут быть разных товаров). */
  inventory_ids: string[];
  /**
   * Цена публикации за единицу (numeric-строка). Не указана — цена прибытия
   * позиции; указана меньше цены прибытия — уценка (requirement 76, решение 12).
   */
  price_per_unit?: string | null;
}

export interface MarketplaceStockUnpublishInput {
  coopname: string;
  operator_account: string;
  inventory_ids: string[];
}

export interface MarketplaceStockOrderCreateInput {
  coopname: string;
  orderer_account: string;
  /** Оффер кооператива (stock_braname non-null). */
  offer_id: string;
  quantity: number;
  /** Грань «заказ заказчика» — общий id строк одного оформления/предложения. */
  checkout_id?: string | null;
  /** Предвычисленный order_hash из заявления о конвертации (см. order-create). */
  order_hash?: string;
  /**
   * Подписанное заказчиком заявление о конвертации паевого взноса в членский
   * (registry 1110). Заказ из остатка фондируется из членских средств; если
   * членских не хватает, перед заказом выполняется отдельное действие `convert`
   * на сумму `convert_amount` с этим заявлением. Опционально: при замене
   * непоставленного высвобожденные средства уже в членском — конвертация не
   * нужна, заявление не передаётся.
   */
  convert_statement?: MarketContract.Actions.Convert.IConvert['convert_statement'] | null;
  /**
   * Сумма конвертации (asset «X.XXXX RUB», тело + членский взнос строки) —
   * обязательна вместе с `convert_statement`; столько паевого переводится в
   * членский кошелёк перед заказом из остатка.
   */
  convert_amount?: string | null;
}

export interface MarketplaceStockOrderCreateResult {
  order: MarketplaceOrderDomainEntity;
  tx_hash: string;
}

/**
 * requirement 76 «Склад кооператива на КУ»: публикация обезличенного остатка
 * как оффера от кооператива и заказ из остатка (контрактный stockorder).
 *
 * Поток публикации (решение 12): оператор на складе выбирает свободные
 * COOP-позиции → группа по исходному товару (stock_origin_offer_id) →
 * создаётся/пополняется оффер кооператива (supplier_account = coopname,
 * stock_braname = КУ остатка, исполнение мгновенное со склада). Цена —
 * прибытия либо уценка. Неопубликованный остаток недоступен ни докладке,
 * ни каталогу.
 *
 * Поток заказа из остатка: пайщик (через корзину — remote-докладка,
 * решение 13) или акцепт предложения у стойки → optimistic counters →
 * chain `stockorder` (Order сразу acceptcoop, средства блокируются) →
 * PG row → резерв конкретных позиций остатка (FIFO по сроку годности).
 * Дальше — штатная выдача signiss1/signiss2 в гейте «подписи на месте».
 */
@Injectable()
export class MarketplaceStockService {
  private static readonly ZERO_HASH = '0'.repeat(64);

  constructor(
    @Inject(MARKETPLACE_INVENTORY_REPOSITORY)
    private readonly inventoryRepo: MarketplaceInventoryDomainRepository,
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_OFFER_COUNTERS_SERVICE)
    private readonly offerCounters: MarketplaceOfferCountersService,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(MARKETPLACE_ASSET_CONFIG)
    private readonly assetConfig: MarketplaceAssetConfig,
    private readonly eventBus: EventEmitter2,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceStockService.name);
  }

  /** Свободный остаток КУ для стола склада (с публикационным состоянием). */
  async listStock(
    coopname: string,
    branames: string[]
  ): Promise<MarketplaceInventoryDomainEntity[]> {
    if (branames.length === 0) return [];
    return this.inventoryRepo.list({
      coopname,
      braname: branames,
      ownership: MarketplaceInventoryOwnerships.COOP,
      status: ['RECEIVED', 'LABELED'],
    });
  }

  /**
   * Публикация позиций остатка в каталог как оффер(ы) кооператива.
   * Позиции группируются по исходному товару; на группу создаётся либо
   * пополняется оффер кооператива этого КУ. Возвращает затронутые офферы.
   */
  async publishStock(input: MarketplaceStockPublishInput): Promise<MarketplaceOfferDomainEntity[]> {
    const positions = await this.loadFreeStockPositions(input.coopname, input.inventory_ids);
    if (positions.some((p) => p.published_offer_id !== null)) {
      throw new ConflictException('Часть позиций уже опубликована — снимите с публикации перед изменением.');
    }
    if (input.price_per_unit !== undefined && input.price_per_unit !== null) {
      const price = Number.parseFloat(input.price_per_unit);
      if (Number.isNaN(price) || price <= 0) {
        throw new BadRequestException('Цена публикации должна быть больше нуля.');
      }
      // Только уценка (requirement 76, решение 12): продажа выше цены прибытия
      // потребовала бы доходной проводки, которой в модели нет; уценка же
      // закрывается расходом o.mkt.loss при выдаче.
      const tooHigh = positions.find(
        (p) => p.arrival_price !== null && price > Number.parseFloat(p.arrival_price) + 1e-9
      );
      if (tooHigh) {
        throw new BadRequestException(
          `Цена публикации выше цены прибытия позиции «${tooHigh.product_name_snapshot}» (${tooHigh.arrival_price}) — допускается только уценка.`
        );
      }
    }
    const braname = positions[0].braname;
    if (positions.some((p) => p.braname !== braname)) {
      throw new BadRequestException('Публикация выполняется по одному КУ за раз.');
    }

    // Группа по исходному товару: order → offer поставщика (происхождение).
    const byOrigin = await this.groupByOriginOffer(positions);

    const touched: MarketplaceOfferDomainEntity[] = [];
    for (const [origin, group] of byOrigin) {
      const qty = group.reduce((s, p) => s + p.quantity_per_label, 0);
      // Цена публикации: явная → она; иначе цена прибытия первой позиции.
      const price =
        input.price_per_unit ??
        group.find((p) => p.arrival_price !== null)?.arrival_price ??
        origin.price_per_unit;

      let coopOffer = await this.findCoopOffer(input.coopname, braname, origin.id);
      if (!coopOffer) {
        coopOffer = await this.offerRepo.create({
          coopname: input.coopname,
          supplier_account: input.coopname, // продавец — сам кооператив
          vitrine_id: 'default',
          product_name: origin.product_name,
          description: origin.description,
          category_id: origin.category_id,
          price_per_unit: this.normalizePrice(price),
          unit_of_measure: origin.unit_of_measure,
          order_unit_size: origin.order_unit_size,
          quantity_available: qty,
          unlimited_flag: false,
          // Исполнение мгновенное со склада этого КУ — доставка только сюда.
          delivery_points: [{ braname, min_supply_volume: 1 }],
          warranty_days: origin.warranty_days,
          barcode_strategy: origin.barcode_strategy,
          pack_size: origin.pack_size,
          images: origin.images,
          stock_braname: braname,
          stock_origin_offer_id: origin.id,
        });
      } else {
        coopOffer = await this.offerRepo.applyUpdate(coopOffer.id, {
          quantity_available: coopOffer.quantity_available + qty,
          ...(input.price_per_unit ? { price_per_unit: this.normalizePrice(input.price_per_unit) } : {}),
          status: MarketplaceOfferStatuses.ACTIVE,
        });
      }
      await this.inventoryRepo.setPublication(
        input.coopname,
        group.map((p) => p.id),
        coopOffer.id
      );
      touched.push(coopOffer);
      // Каталог обновляется тем же широковещательным сигналом, что и
      // одобренный оффер поставщика.
      this.eventBus.emit(MARKETPLACE_OFFER_APPROVED_EVENT, {
        offer_id: coopOffer.id,
        supplier_account: input.coopname,
        approved_by: input.operator_account,
        category_id: coopOffer.category_id,
      });
      this.logger.log(
        `Остаток КУ ${braname}: опубликовано ${qty} ед. «${origin.product_name}» оффером кооператива ${coopOffer.id} (оператор ${input.operator_account}).`
      );
    }
    return touched;
  }

  /** Снятие свободных позиций с публикации (зарезервированные не трогаем). */
  async unpublishStock(input: MarketplaceStockUnpublishInput): Promise<number> {
    const positions = await this.loadFreeStockPositions(input.coopname, input.inventory_ids);
    const published = positions.filter((p) => p.published_offer_id !== null);
    if (published.length === 0) return 0;

    // Сначала уменьшаем счётчики офферов, затем отвязываем позиции.
    const byOffer = new Map<string, number>();
    for (const p of published) {
      byOffer.set(p.published_offer_id!, (byOffer.get(p.published_offer_id!) ?? 0) + p.quantity_per_label);
    }
    const affected = await this.inventoryRepo.setPublication(
      input.coopname,
      published.map((p) => p.id),
      null
    );
    for (const [offer_id, qty] of byOffer) {
      const offer = await this.offerRepo.findById(offer_id);
      if (!offer) continue;
      await this.offerRepo.applyUpdate(offer_id, {
        quantity_available: Math.max(0, offer.quantity_available - qty),
      });
      this.eventBus.emit(MARKETPLACE_OFFER_APPROVED_EVENT, {
        offer_id,
        supplier_account: input.coopname,
        approved_by: input.operator_account,
        category_id: offer.category_id,
      });
    }
    this.logger.log(
      `Остаток: снято с публикации ${affected} позиций (оператор ${input.operator_account}).`
    );
    return affected;
  }

  /**
   * Конвертация паевого взноса в членский кошелёк «Стола заказов» (chain
   * `convert`). Пополняет членские средства под заказы из остатка — одним
   * действием на весь дефицит принятия. Заявление о конвертации публикуется в
   * реестр документов контрактом.
   */
  async convertToMember(input: {
    coopname: string;
    orderer: string;
    amount: string;
    convert_statement: MarketContract.Actions.Convert.IConvert['convert_statement'];
  }): Promise<void> {
    try {
      await this.chainPort.convert({
        coopname: input.coopname,
        orderer: input.orderer,
        amount: input.amount,
        convert_statement: input.convert_statement,
      });
    } catch (error: any) {
      rethrowChainError(error);
    }
  }

  /**
   * Заказ из остатка кооператива: chain `stockorder` (Order сразу acceptcoop,
   * средства блокируются из членского кошелька на акцепте) + резерв позиций.
   */
  async createStockOrder(
    input: MarketplaceStockOrderCreateInput
  ): Promise<MarketplaceStockOrderCreateResult> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('Количество должно быть целым числом больше нуля.');
    }
    const offer = await this.offerRepo.findById(input.offer_id);
    if (!offer || offer.coopname !== input.coopname) {
      throw new NotFoundException('Предложение не найдено.');
    }
    if (!offer.stock_braname) {
      throw new BadRequestException('Это предложение поставщика — оформите обычный заказ.');
    }
    if (offer.status !== MarketplaceOfferStatuses.ACTIVE) {
      throw new BadRequestException(`Предложение не активно (статус «${offer.status}»).`);
    }
    if (offer.quantity_available < input.quantity) {
      throw new BadRequestException(
        `На складе доступно только ${offer.quantity_available} ед.; нельзя заказать ${input.quantity}.`
      );
    }

    const order_hash =
      input.order_hash ?? computeStockOrderHash(input.coopname, input.orderer_account, offer.id);
    const offer_hash = createHash('sha256').update(`offer:${offer.id}`).digest('hex');
    const priceFloat = Number.parseFloat(offer.price_per_unit);
    const total_cost = (priceFloat * input.quantity).toFixed(this.assetConfig.decimals);
    const unit_price_asset = `${priceFloat.toFixed(this.assetConfig.decimals)} ${this.assetConfig.symbol}`;
    const warranty_period_secs = offer.warranty_days * 86_400;

    // Заказ из остатка фондируется из членского кошелька. Если передано
    // Заявление о конвертации — сперва пополняем членский с паевого на сумму
    // строки (тело + взнос) отдельным действием `convert`; иначе средства уже
    // в членском (замена непоставленного — высвобождены отменой), конвертации нет.
    if (input.convert_statement) {
      if (!input.convert_amount) {
        throw new BadRequestException(
          'Не указана сумма конвертации для заказа из остатка с паевого.'
        );
      }
      await this.chainPort.convert({
        coopname: input.coopname,
        orderer: input.orderer_account,
        amount: input.convert_amount,
        convert_statement: input.convert_statement,
      });
    }

    // Optimistic counter ДО chain submit (как в createOrder поставщика).
    await this.offerCounters.onOrderBlocked(offer.id, input.quantity);

    let txHash: string;
    try {
      const tx = await this.chainPort.stockOrder({
        coopname: input.coopname,
        orderer: input.orderer_account,
        order_hash,
        offer_hash,
        delivery_braname: offer.stock_braname,
        quantity: input.quantity,
        unit_price: unit_price_asset,
        warranty_period_secs,
        batch_hash: MarketplaceStockService.ZERO_HASH,
      });
      txHash = normalizeChainTxHash(
        tx,
        'Заказ из остатка: цепь не вернула tx_hash. Повторите попытку.'
      );
    } catch (error: any) {
      this.logger.error(
        `createStockOrder: chain stockorder fail (rollback counter) — ${error.message}`,
        error.stack
      );
      try {
        await this.offerCounters.onOrderRolledBack(offer.id, input.quantity);
      } catch (compErr: any) {
        this.logger.error(
          `createStockOrder: compensating onOrderRolledBack упал (offer=${offer.id}): ${compErr.message}. РУЧНОЙ ФИКС counter!`
        );
      }
      rethrowChainError(error);
    }

    const create_tx: MarketplaceOrderCreateTxSnapshot = {
      tx_hash: txHash!,
      block_num: 0,
      locked_amount: total_cost,
      signed_at: new Date().toISOString(),
    };

    const order = await this.orderRepo.persistAfterBlock({
      coopname: input.coopname,
      order_hash,
      orderer_account: input.orderer_account,
      offer_id: offer.id,
      offer_hash,
      supplier_account: input.coopname, // продавец — кооператив (маркер stock-ордера)
      delivery_braname: offer.stock_braname,
      quantity: input.quantity,
      price_per_unit: offer.price_per_unit,
      total_cost,
      cycle_id: null,
      checkout_id: input.checkout_id ?? null,
      warranty_period_secs,
      warranty_until: null,
      status: MarketplaceOrderStatuses.ACCEPTED_TO_COOP, // имущество уже в кооперативе
      blocked_at: new Date(),
      create_tx,
    });

    // Резерв конкретных позиций под заказ. Counters-гард выше не даёт уйти в
    // овер-резерв; падение здесь — рассинхрон counters↔позиции, компенсируем
    // отменой заказа на цепи.
    try {
      await this.inventoryRepo.reserveStock(input.coopname, offer.id, input.quantity, order.id);
    } catch (error: any) {
      this.logger.error(
        `createStockOrder: резерв позиций не удался (order=${order.id}) — компенсирующая отмена. ${error.message}`
      );
      try {
        await this.chainPort.cancelOrder({
          coopname: input.coopname,
          orderer: input.orderer_account,
          order_hash,
        });
        await this.offerCounters.onOrderUnblocked(offer.id, input.quantity);
        await this.orderRepo.applyStatusTransition(order.id, 'CANCELLED_BY_ORDERER', 'Недостаточно свободного остатка на складе');
      } catch (compErr: any) {
        this.logger.error(
          `createStockOrder: компенсация тоже упала (order=${order.id}): ${compErr.message}. РУЧНАЯ СВЕРКА!`
        );
      }
      throw new ConflictException(
        'Свободного остатка на складе не хватило — заказ отменён, средства разблокированы.'
      );
    }

    this.logger.log(
      `Stock-order ${order.id} (hash=${order_hash}) создан для ${input.orderer_account}: «${offer.product_name}» ×${input.quantity} со склада КУ ${offer.stock_braname}; tx=${txHash!}`
    );
    return { order, tx_hash: txHash! };
  }

  /**
   * Отмена заказа из остатка до открытия выдачи: откат оператора при
   * переформировании докладки либо отказ самого пайщика (решение 11).
   */
  async cancelStockOrder(
    coopname: string,
    order_id: string,
    cancelled_by: string,
    reason: string
  ): Promise<MarketplaceOrderDomainEntity> {
    const order = await this.orderRepo.findById(order_id);
    if (!order || order.coopname !== coopname) {
      throw new NotFoundException('Заказ не найден.');
    }
    if (order.supplier_account !== coopname) {
      throw new BadRequestException('Это не заказ из остатка кооператива.');
    }
    if (order.status !== MarketplaceOrderStatuses.ACCEPTED_TO_COOP) {
      throw new ConflictException(
        `Заказ в статусе «${order.status}» — отмена доступна только до открытия выдачи.`
      );
    }

    try {
      await this.chainPort.cancelOrder({
        coopname,
        orderer: order.orderer_account,
        order_hash: order.order_hash,
      });
    } catch (error: any) {
      this.logger.error(`cancelStockOrder: chain cancelorder fail (order=${order.id}): ${error.message}`);
      rethrowChainError(error);
    }

    try {
      await this.offerCounters.onOrderUnblocked(order.offer_id, order.quantity);
    } catch (counterErr: any) {
      this.logger.warn(
        `cancelStockOrder: counter onOrderUnblocked упал (offer=${order.offer_id}): ${counterErr.message} — продолжаю`
      );
    }
    const released = await this.inventoryRepo.releaseReservation(coopname, order.id);
    const updated = await this.orderRepo.applyStatusTransition(
      order.id,
      'CANCELLED_BY_ORDERER',
      reason
    );
    this.logger.log(
      `Stock-order ${order.id} отменён (${cancelled_by}): резерв снят с ${released} позиций; «${reason}».`
    );
    return updated;
  }

  // ── private ──────────────────────────────────────────────────────────

  private async loadFreeStockPositions(
    coopname: string,
    inventory_ids: string[]
  ): Promise<MarketplaceInventoryDomainEntity[]> {
    if (inventory_ids.length === 0) {
      throw new BadRequestException('Не выбраны позиции остатка.');
    }
    const positions = await Promise.all(inventory_ids.map((id) => this.inventoryRepo.findById(id)));
    const found = positions.filter(Boolean) as MarketplaceInventoryDomainEntity[];
    if (found.length !== inventory_ids.length) {
      throw new NotFoundException('Часть позиций остатка не найдена.');
    }
    for (const p of found) {
      if (p.coopname !== coopname) {
        throw new ForbiddenException('Позиция принадлежит другому кооперативу.');
      }
      if (p.ownership !== MarketplaceInventoryOwnerships.COOP) {
        throw new BadRequestException(
          `Позиция «${p.product_name_snapshot}» — адресная (под заказ), к остатку не относится.`
        );
      }
      if (p.reserved_order_id !== null) {
        throw new ConflictException(
          `Позиция «${p.product_name_snapshot}» зарезервирована под заказ из остатка.`
        );
      }
      if (p.status !== 'RECEIVED' && p.status !== 'LABELED') {
        throw new ConflictException(`Позиция «${p.product_name_snapshot}» уже не на складе.`);
      }
    }
    return found;
  }

  /** Группировка позиций по исходному офферу поставщика (через заказ-провенанс). */
  private async groupByOriginOffer(
    positions: MarketplaceInventoryDomainEntity[]
  ): Promise<Map<MarketplaceOfferDomainEntity, MarketplaceInventoryDomainEntity[]>> {
    const orderIds = [...new Set(positions.map((p) => p.order_id))];
    const orders = await Promise.all(orderIds.map((id) => this.orderRepo.findById(id)));
    const offerIdByOrderId = new Map<string, string>();
    for (const o of orders) {
      if (o) offerIdByOrderId.set(o.id, o.offer_id);
    }
    const offerIds = [...new Set([...offerIdByOrderId.values()])];
    const offers = await this.offerRepo.findByIds(offerIds);
    const offerById = new Map(offers.map((o) => [o.id, o] as const));

    const grouped = new Map<MarketplaceOfferDomainEntity, MarketplaceInventoryDomainEntity[]>();
    for (const p of positions) {
      const offerId = offerIdByOrderId.get(p.order_id);
      const origin = offerId ? offerById.get(offerId) : undefined;
      if (!origin) {
        throw new ConflictException(
          `Не удалось определить товар позиции «${p.product_name_snapshot}» — публикация невозможна.`
        );
      }
      // Если исходник сам — оффер кооператива (остаток перепубликуется после
      // отмены stock-ордера), группируем по его первоисточнику.
      const key = origin.stock_origin_offer_id
        ? offerById.get(origin.stock_origin_offer_id) ?? origin
        : origin;
      const arr = grouped.get(key) ?? [];
      arr.push(p);
      grouped.set(key, arr);
    }
    return grouped;
  }

  private async findCoopOffer(
    coopname: string,
    braname: string,
    origin_offer_id: string
  ): Promise<MarketplaceOfferDomainEntity | null> {
    const page = await this.offerRepo.list(
      { coopname, supplier_account: coopname },
      { page: 1, limit: 500, sortBy: 'created_at', sortOrder: 'DESC' }
    );
    return (
      page.items.find(
        (o) => o.stock_braname === braname && o.stock_origin_offer_id === origin_offer_id
      ) ?? null
    );
  }

  private normalizePrice(price: string): string {
    return Number.parseFloat(price).toFixed(this.assetConfig.decimals);
  }

}

export const MARKETPLACE_STOCK_SERVICE = Symbol('MARKETPLACE_STOCK_SERVICE');
