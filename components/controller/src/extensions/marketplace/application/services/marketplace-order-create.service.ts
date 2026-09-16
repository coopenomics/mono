import { rethrowChainError } from '@coopenomics/extension-kit';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash } from 'crypto';
import { LOGGER_PORT, type ILoggerPort,
} from '@coopenomics/innercoop';
import { computeOrderHash } from '../shared/order-hash.util';
import { toQuantityAsset } from '../shared/quantity.util';
import { calcCostAmount } from '../shared/cost.util';
import { normalizeChainTx } from '../shared/chain-tx.util';
import {
  packageDeltaOfSaleUnit,
  resolveSaleUnit,
  saleUnitShortfall,
  type OfferPackageDelta,
  type ResolvedSaleUnit,
} from '../shared/packaging.util';
import {
  MARKETPLACE_NEW_ORDER_FOR_SUPPLIER_EVENT,
  type MarketplaceNewOrderForSupplierEvent,
} from '../events/marketplace-notification.events';
import {
  MARKETPLACE_ASSET_CONFIG,
  type MarketplaceAssetConfig,
} from './marketplace-asset.config';
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
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';
import type { MarketContract } from 'cooptypes';
import {
  MarketplaceOrderStatuses,
  type MarketplaceOrderCreateTxSnapshot,
} from '../../domain/entities/marketplace-order.types';
import {
  MarketplaceOfferStatuses,
  type MarketplaceUnitOfMeasure,
} from '../../domain/entities/marketplace-offer.types';


export interface MarketplaceOrderCreateInputDto {
  /** coopname кооператива. Берётся из core-сессии в resolver'е. */
  coopname: string;
  /** Пайщик-заказчик (eosio::name). Из core-сессии в resolver'е. */
  orderer_account: string;
  /** ID Offer'а из marketplace_offer. */
  offer_id: string;
  /**
   * Заказываемое количество. При отпуске по мере — количество в базовой
   * единице (кг/л/шт, дробное для веса/объёма). При отпуске упаковкой (Эпик 18)
   * — целое число упаковок выбранного варианта `package_id`.
   */
  quantity: number;
  /**
   * Выбранная упаковка каталога (Эпик 18) — обязательна при отпуске упаковкой,
   * не передаётся при отпуске по мере.
   */
  package_id?: string | null;
  /** ПВЗ получения (branch.name). Story 2.3 валидирует existence в C++. */
  delivery_braname: string;
  /**
   * Грань «заказ заказчика» (Эпик 16): общий id всех строк одного
   * оформления корзины на один КУ. Штампуется checkout-сервисом; для
   * legacy покарточного заказа — не передаётся (null).
   */
  checkout_id?: string | null;
  /**
   * Предвычисленный order_hash (из превью оформления корзины) — чтобы клиент
   * и бэкенд говорили об одном заказе. Без него генерируется на месте.
   */
  order_hash?: string;
}

export interface MarketplaceOrderCreateResult {
  order: MarketplaceOrderDomainEntity;
  tx_snapshot: MarketplaceOrderCreateTxSnapshot;
}

/**
 * Строка заказа, прошедшая проверки и бронь остатка, но ещё не проведённая
 * цепью. `action` — параметры `marketplace::createorder`; остальное нужно,
 * чтобы после блока записать заказ или откатить бронь.
 */
export interface MarketplaceOrderPreparedLine {
  input: MarketplaceOrderCreateInputDto;
  offer: MarketplaceOfferDomainEntity;
  resolved: ResolvedSaleUnit;
  packageDelta: OfferPackageDelta | undefined;
  order_hash: string;
  offer_hash: string;
  /** Сумма заказа той же формулой, что у контракта, без валюты. */
  total_cost: string;
  warranty_period_secs: number;
  action: MarketContract.Actions.CreateOrder.ICreateOrder;
}

/**
 * Story 4.1: backend Order creation flow.
 *
 *   1. Guard FR11a (минимум): Offer существует / ACTIVE / quantity_available
 *      >= K. Полная проверка sum(available 3 кошельков) делегирована в C++
 *      `marketplace::createorder` (`eosio::check(σ available >= total_cost)`)
 *      — backend ловит chain exception и возвращает clean error пайщику.
 *      Это упрощение Story 4.1; полный backend balance guard — Story 9.x.
 *
 *   2. Detrministic `order_hash` = SHA256(coopname|orderer|offer_hash|nonce).
 *      Nonce — 16-байтовый random hex. Это гарантирует уникальность на цепи
 *      (idempotency C++ контракта) + позволяет re-submit при transient
 *      сетевых ошибках без коллизии.
 *
 *   3. Optimistic counter: `offerCounters.onOrderBlocked(offer_id, qty)` —
 *      синхронно ДО chain submit. Caтer держит инвариант available+blocked
 *      +consumed=lifetime сразу для UI каталога (Story 3.5 не должен
 *      показать Offer как «доступный K единиц» в момент гонки).
 *
 *   4. Chain submit `createorder` через canonical adapter. Один шаг
 *      в C++ `ledger2::apply`: o.mkt.lock (TRANSFER w.wal.share → w.mkt.order,
 *      Дт 80 / Кт 86). Любой `eosio::check` фейл = exception → backend ловит,
 *      выполняет compensating `onOrderRolledBack` и пробрасывает clean
 *      error пайщику.
 *
 *   5. Persist PG row Order через `persistAfterBlock(input)` со снапшотом
 *      tx (tx_hash, block_num, locked_amount).
 *      Idempotent через unique `(coopname, order_hash)` — повторный submit
 *      того же order_hash возвращает existing row без double-create.
 *
 *   6. Возвращает Order + tx_snapshot для UI (WalletTimeline новое
 *      BLOCK-движение).
 */
@Injectable()
export class MarketplaceOrderCreateService {
  private static readonly ZERO_HASH = '0'.repeat(64);

  private get assetSymbol(): string {
    return this.assetConfig.symbol;
  }

  private get assetDecimals(): number {
    return this.assetConfig.decimals;
  }

  constructor(
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
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceOrderCreateService.name);
  }

  /**
   * Одиночный заказ (покарточный поток): подготовка, своя транзакция,
   * завершение. Оформление корзины пользуется теми же шагами, но отправляет
   * строки одной транзакцией (см. `MarketplaceCheckoutService`).
   */
  async execute(input: MarketplaceOrderCreateInputDto): Promise<MarketplaceOrderCreateResult> {
    const prepared = await this.prepare(input);

    // ── 4. Chain submit createorder с compensating-rollback ────────
    let result: { tx_hash: string; block_num: number };
    try {
      const tx = await this.chainPort.createOrder(prepared.action);
      // fail-fast: без tx_hash запись заказа в базу сделает audit-trail фантомным.
      result = normalizeChainTx(tx, 'Создание заказа: цепь не вернула tx_hash. Повторите попытку.');
    } catch (error: any) {
      this.logger.error(
        `MarketplaceOrderCreateService: chain submit createorder fail (compensating rollback counter) — ${error.message}`,
        error.stack
      );
      await this.rollback(prepared);
      rethrowChainError(error);
    }

    return this.finalize(prepared, result!);
  }

  /**
   * Шаги до цепи: проверки предложения и количества, производные поля заказа
   * и бронь счётчика остатка. После подготовки строка либо уходит в цепь и
   * завершается `finalize`, либо откатывается `rollback` — бронь без одного
   * из двух исходов расходится с каталогом.
   */
  async prepare(input: MarketplaceOrderCreateInputDto): Promise<MarketplaceOrderPreparedLine> {
    this.validateInput(input);

    // ── 1. Guard: Offer existence + ACTIVE + quantity_available ────
    const offer = await this.offerRepo.findById(input.offer_id);
    if (!offer) {
      throw new NotFoundException('Предложение не найдено.');
    }
    if (offer.coopname !== input.coopname) {
      throw new ForbiddenException('Предложение принадлежит другому кооперативу.');
    }
    if (offer.status !== MarketplaceOfferStatuses.ACTIVE) {
      throw new BadRequestException(
        `Предложение не активно (статус «${offer.status}»). Заказ оформить нельзя.`
      );
    }
    // Эпик 18: разрешаем способ отпуска в базовое количество/цену/упаковку.
    // По мере — quantity как базовое количество; упаковкой — quantity как число
    // упаковок, базовое = число × содержимое, цена — за упаковку.
    const resolved = resolveSaleUnit(offer, input.quantity, input.package_id);
    // Нехватка проверяется по выбранной упаковке, а не по котлу базовых единиц.
    const shortfall = saleUnitShortfall(offer, resolved);
    if (shortfall) {
      throw new BadRequestException(
        `Доступно только ${shortfall.available} ${shortfall.unitLabel}; нельзя заказать ${shortfall.requested}.`
      );
    }
    const packageDelta = packageDeltaOfSaleUnit(resolved);

    // ── 2. Вычисление производных полей Order'а ─────────────────────
    const order_hash =
      input.order_hash ?? computeOrderHash(input.coopname, input.orderer_account, offer.id);
    const offer_hash = this.deriveOfferHash(offer.id);
    // Стоимость: по мере — цена×базовое количество; упаковкой — цена×число упаковок.
    // Считается той же целочисленной формулой, что и на цепи (см. cost.util).
    const total_cost_amount = this.computeTotalCostAmount(resolved, offer.unit_of_measure);
    const unit_price_asset = this.formatAsset(resolved.unitPrice);
    const package_size_asset = toQuantityAsset(resolved.packageSize, offer.unit_of_measure);
    const warranty_period_secs = offer.warranty_days * 86_400;

    // ── 3. Optimistic counter (синхронно ДО chain submit) ──────────
    const offerBeforeBlock = await this.offerCounters.onOrderBlocked(offer.id, resolved.baseQuantity, packageDelta);
    this.logger.debug(
      `MarketplaceOrderCreateService: counter onOrderBlocked OK (offer=${offer.id}, qty=${resolved.baseQuantity}, available=${offerBeforeBlock.quantity_available}, blocked=${offerBeforeBlock.quantity_blocked})`
    );

    return {
      input,
      offer,
      resolved,
      packageDelta,
      order_hash,
      offer_hash,
      total_cost: total_cost_amount,
      warranty_period_secs,
      action: {
        coopname: input.coopname,
        orderer: input.orderer_account,
        order_hash,
        offer_hash,
        offerer: offer.supplier_account,
        delivery_braname: input.delivery_braname,
        quantity: toQuantityAsset(resolved.baseQuantity, offer.unit_of_measure),
        unit_price: unit_price_asset,
        package_size: package_size_asset,
        warranty_period_secs,
        batch_hash: MarketplaceOrderCreateService.ZERO_HASH,
      },
    };
  }

  /** Цепь отказала — бронь счётчика возвращается в каталог. */
  async rollback(prepared: MarketplaceOrderPreparedLine): Promise<void> {
    try {
      await this.offerCounters.onOrderRolledBack(prepared.offer.id, prepared.resolved.baseQuantity, prepared.packageDelta);
    } catch (compErr: any) {
      // Counter rollback fail на compensating-path — критическая
      // несогласованность; alert + manual reconciliation.
      this.logger.error(
        `MarketplaceOrderCreateService: compensating onOrderRolledBack тоже упал (offer=${prepared.offer.id}, qty=${prepared.input.quantity}): ${compErr.message}. РУЧНОЙ ФИКС counter offer!`,
        compErr.stack
      );
    }
  }

  /** Цепь провела заказ — запись в базу со снимком транзакции и уведомление поставщика. */
  async finalize(
    prepared: MarketplaceOrderPreparedLine,
    tx: { tx_hash: string; block_num: number }
  ): Promise<MarketplaceOrderCreateResult> {
    const { input, offer, resolved, order_hash, offer_hash, warranty_period_secs } = prepared;

    // ── 5. Persist PG row Order с tx snapshot ──────────────────────
    const locked_amount = prepared.total_cost;
    const create_tx: MarketplaceOrderCreateTxSnapshot = {
      tx_hash: tx.tx_hash,
      block_num: tx.block_num,
      locked_amount,
      signed_at: new Date().toISOString(),
    };

    const order = await this.orderRepo.persistAfterBlock({
      coopname: input.coopname,
      order_hash,
      orderer_account: input.orderer_account,
      offer_id: offer.id,
      offer_hash,
      supplier_account: offer.supplier_account,
      delivery_braname: input.delivery_braname,
      quantity: resolved.baseQuantity,
      unit_of_measure: offer.unit_of_measure,
      price_per_unit: resolved.unitPrice,
      package_size: resolved.packageSize,
      package_id: resolved.packageId,
      total_cost: locked_amount,
      cycle_id: null,
      checkout_id: input.checkout_id ?? null,
      warranty_period_secs,
      warranty_until: null,
      status: MarketplaceOrderStatuses.ACTIVE,
      blocked_at: new Date(),
      create_tx,
    });

    this.logger.log(
      `MarketplaceOrderCreateService: Order ${order.id} (hash=${order_hash}) создан для ${input.orderer_account}; offer=${offer.id}, qty=${input.quantity}, total=${locked_amount}; tx=${tx.tx_hash}`
    );

    // Карта уведомлений (пробел A): уведомляем поставщика о новом заказе ПОСЛЕ
    // записи в PG (INV-12). Stock-заказ (offerer == сам кооператив) исключаем —
    // некого уведомлять о собственном остатке. Ошибка шины не валит основной
    // flow: emit синхронный, listener сам ловит ошибки Novu в warn.
    if (offer.supplier_account !== input.coopname) {
      const newOrderEvent: MarketplaceNewOrderForSupplierEvent = {
        coopname: input.coopname,
        order_id: order.id,
        order_hash,
        supplier_account: offer.supplier_account,
        orderer_account: input.orderer_account,
        quantity: resolved.baseQuantity,
        total_cost: locked_amount,
      };
      this.eventBus.emit(MARKETPLACE_NEW_ORDER_FOR_SUPPLIER_EVENT, newOrderEvent);
    }

    // Эпик 15: заказ остаётся ACTIVE и копится в группе (offer × КУ). Партия
    // формируется в момент batch-accept поставщиком из выбранных заказов —
    // авто-агрегации/типа поставки больше нет.
    return { order, tx_snapshot: create_tx };
  }

  // ── private ──────────────────────────────────────────────────────

  private validateInput(input: MarketplaceOrderCreateInputDto): void {
    // Единично-зависимая валидация количества (штука — целое, вес/объём —
    // дробное) выполняется после загрузки Offer'а через assertValidQuantity;
    // здесь — только базовая проверка положительности.
    if (!(input.quantity > 0)) {
      throw new BadRequestException('Количество должно быть больше нуля.');
    }
    if (!input.delivery_braname || input.delivery_braname.length === 0) {
      throw new BadRequestException('Не указан ПВЗ получения.');
    }
    if (!input.offer_id) {
      throw new BadRequestException('Не указан offer_id.');
    }
  }

  /**
   * Story 4.1: backend Offer.id = UUID, on-chain offer_hash = checksum256.
   * Реальное связывание двух — Stories 3.x создают Offer'ы с offer_hash
   * (см. PR #382 Story 3.2). Здесь — production deterministic derivation:
   * SHA256(offer_id) (32 байта); on-chain контракт принимает любой 256-bit
   * checksum без верификации источника (FR15 проверяет только сам Offer
   * через get_offer_by_hash). Мерджится с реальным offer.offer_hash в
   * Stories 3.2 follow-up, когда Offer-таблица получит on-chain зеркало.
   */
  private deriveOfferHash(offer_id: string): string {
    return createHash('sha256').update(`offer:${offer_id}`).digest('hex');
  }

  /**
   * Сумма заказа по той же формуле, что и на цепи (`Marketplace::calc_cost`):
   * целочисленно, с округлением половины вверх. Раньше считалось умножением
   * double с `toFixed` — предварительная сумма в БД расходилась с суммой,
   * которую посчитает контракт.
   */
  private computeTotalCostAmount(
    resolved: { unitPrice: string; baseQuantity: number; packageSize: number },
    unit: MarketplaceUnitOfMeasure
  ): string {
    const priceFloat = Number.parseFloat(resolved.unitPrice);
    if (Number.isNaN(priceFloat) || priceFloat <= 0) {
      throw new BadRequestException(`Некорректная цена за единицу: "${resolved.unitPrice}"`);
    }
    const total = calcCostAmount({
      quantity: resolved.baseQuantity,
      unit,
      unitPrice: resolved.unitPrice,
      packageSize: resolved.packageSize,
      decimals: this.assetDecimals,
    });
    // Цена и количество положительны, но при малых величинах произведение
    // способно схлопнуться в ноль — контракт такой заказ отвергнет, и лучше
    // сказать об этом до отправки транзакции.
    if (Number.parseFloat(total) <= 0) {
      throw new BadRequestException(
        'Итоговая сумма заказа получилась нулевой — проверьте количество и цену.'
      );
    }
    return total;
  }

  private formatAsset(price_per_unit: string): string {
    const priceFloat = Number.parseFloat(price_per_unit);
    return `${priceFloat.toFixed(this.assetDecimals)} ${this.assetSymbol}`;
  }
}

export const MARKETPLACE_ORDER_CREATE_SERVICE = Symbol('MARKETPLACE_ORDER_CREATE_SERVICE');
