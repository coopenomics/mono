import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import type { MarketContract } from 'cooptypes';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { computeOrderHash } from '../shared/order-hash.util';
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
import {
  MarketplaceOrderStatuses,
  type MarketplaceOrderCreateTxSnapshot,
} from '../../domain/entities/marketplace-order.types';
import { MarketplaceOfferStatuses } from '../../domain/entities/marketplace-offer.types';
import { rethrowChainError } from '../shared/chain-tx.util';

export interface MarketplaceOrderCreateInputDto {
  /** coopname кооператива. Берётся из core-сессии в resolver'е. */
  coopname: string;
  /** Пайщик-заказчик (eosio::name). Из core-сессии в resolver'е. */
  orderer_account: string;
  /** ID Offer'а из marketplace_offer. */
  offer_id: string;
  /** Кол-во единиц (целое, >= 1, <= Offer.quantity_available для non-unlimited). */
  quantity: number;
  /** ПВЗ получения (branch.name). Story 2.3 валидирует existence в C++. */
  delivery_braname: string;
  /**
   * Грань «заказ заказчика» (Эпик 16): общий id всех строк одного
   * оформления корзины на один КУ. Штампуется checkout-сервисом; для
   * legacy покарточного заказа — не передаётся (null).
   */
  checkout_id?: string | null;
  /**
   * Предвычисленный order_hash из подписываемого заявления о конвертации:
   * заявление подписывается клиентом ДО chain submit и несёт order_hash в
   * мете, поэтому hash рождается на этапе превью (checkout signable
   * payloads), а не здесь. Без него генерируется на месте.
   */
  order_hash?: string;
  /**
   * Подписанное заказчиком заявление о конвертации паевого взноса в
   * членский (registry 1110) — обязательный параметр
   * `marketplace::createorder`; контракт публикует его в реестр документов.
   */
  convert_statement: MarketContract.Actions.CreateOrder.ICreateOrder['convert_statement'];
}

export interface MarketplaceOrderCreateResult {
  order: MarketplaceOrderDomainEntity;
  tx_snapshot: MarketplaceOrderCreateTxSnapshot;
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
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceOrderCreateService.name);
  }

  async execute(input: MarketplaceOrderCreateInputDto): Promise<MarketplaceOrderCreateResult> {
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
    if (!offer.unlimited_flag && offer.quantity_available < input.quantity) {
      throw new BadRequestException(
        `Доступно только ${offer.quantity_available} ед.; нельзя заказать ${input.quantity}.`
      );
    }

    // ── 2. Вычисление производных полей Order'а ─────────────────────
    const order_hash =
      input.order_hash ?? computeOrderHash(input.coopname, input.orderer_account, offer.id);
    const offer_hash = this.deriveOfferHash(offer.id);
    const total_cost_amount = this.computeTotalCostAmount(offer.price_per_unit, input.quantity);
    const unit_price_asset = this.formatAsset(offer.price_per_unit);
    const warranty_period_secs = offer.warranty_days * 86_400;

    // ── 3. Optimistic counter (синхронно ДО chain submit) ──────────
    const offerBeforeBlock = await this.offerCounters.onOrderBlocked(offer.id, input.quantity);
    this.logger.debug(
      `MarketplaceOrderCreateService: counter onOrderBlocked OK (offer=${offer.id}, qty=${input.quantity}, available=${offerBeforeBlock.quantity_available}, blocked=${offerBeforeBlock.quantity_blocked})`
    );

    // ── 4. Chain submit createorder с compensating-rollback ────────
    let txHash: string;
    let appliedBlock: number;
    try {
      const tx = await this.chainPort.createOrder({
        coopname: input.coopname,
        orderer: input.orderer_account,
        order_hash,
        offer_hash,
        offerer: offer.supplier_account,
        delivery_braname: input.delivery_braname,
        quantity: input.quantity,
        unit_price: unit_price_asset,
        warranty_period_secs,
        batch_hash: MarketplaceOrderCreateService.ZERO_HASH,
        convert_statement: input.convert_statement,
      });
      const result = this.normalizeTxResult(tx);
      txHash = result.tx_hash;
      appliedBlock = result.block_num;
    } catch (error: any) {
      this.logger.error(
        `MarketplaceOrderCreateService: chain submit createorder fail (compensating rollback counter) — ${error.message}`,
        error.stack
      );
      try {
        await this.offerCounters.onOrderRolledBack(offer.id, input.quantity);
      } catch (compErr: any) {
        // Counter rollback fail на compensating-path — критическая
        // несогласованность; alert + manual reconciliation.
        this.logger.error(
          `MarketplaceOrderCreateService: compensating onOrderRolledBack тоже упал (offer=${offer.id}, qty=${input.quantity}): ${compErr.message}. РУЧНОЙ ФИКС counter offer!`,
          compErr.stack
        );
      }
      rethrowChainError(error);
    }

    // ── 5. Persist PG row Order с tx snapshot ──────────────────────
    const locked_amount = total_cost_amount;
    const create_tx: MarketplaceOrderCreateTxSnapshot = {
      tx_hash: txHash!,
      block_num: appliedBlock!,
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
      quantity: input.quantity,
      price_per_unit: offer.price_per_unit,
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
      `MarketplaceOrderCreateService: Order ${order.id} (hash=${order_hash}) создан для ${input.orderer_account}; offer=${offer.id}, qty=${input.quantity}, total=${locked_amount}; tx=${txHash}`
    );

    // Эпик 15: заказ остаётся ACTIVE и копится в группе (offer × КУ). Партия
    // формируется в момент batch-accept поставщиком из выбранных заказов —
    // авто-агрегации/типа поставки больше нет.
    return { order, tx_snapshot: create_tx };
  }

  // ── private ──────────────────────────────────────────────────────

  private validateInput(input: MarketplaceOrderCreateInputDto): void {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('Количество должно быть целым числом больше нуля.');
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

  private computeTotalCostAmount(price_per_unit: string, quantity: number): string {
    // price_per_unit как numeric(18,4) приходит как string e.g. "150.0000".
    const priceFloat = Number.parseFloat(price_per_unit);
    if (Number.isNaN(priceFloat) || priceFloat <= 0) {
      throw new BadRequestException(`Некорректная цена за единицу: "${price_per_unit}"`);
    }
    const total = priceFloat * quantity;
    return total.toFixed(this.assetDecimals);
  }

  private formatAsset(price_per_unit: string): string {
    const priceFloat = Number.parseFloat(price_per_unit);
    return `${priceFloat.toFixed(this.assetDecimals)} ${this.assetSymbol}`;
  }

  private normalizeTxResult(tx: unknown): { tx_hash: string; block_num: number } {
    // wharfkit @1.6.x TransactResult: после `session.transact(..., { broadcast: true })`
    // nodeos JSON-ответ лежит в `tx.response.transaction_id` (не в
    // `.transaction.id` — это `ResolvedTransaction` без `.id`-поля).
    // Fallback'и для совместимости с другими версиями session-API:
    // `.resolved.transaction.id` и плоский `.transaction.id` (см. также
    // `extractTxHash` в apl-reception / return-claim / issuance сервисах).
    const t = tx as {
      response?: { transaction_id?: string; processed?: { id?: string; block_num?: number } };
      resolved?: { transaction?: { id?: string | { toString?: () => string } } };
      transaction?: { id?: string | { toString?: () => string } };
    };
    const stringifyId = (v?: string | { toString?: () => string }): string | undefined => {
      if (typeof v === 'string') return v;
      if (typeof v?.toString === 'function') {
        const s = v.toString();
        return s && s !== '[object Object]' ? s : undefined;
      }
      return undefined;
    };
    const tx_hash =
      t?.response?.transaction_id ??
      t?.response?.processed?.id ??
      stringifyId(t?.resolved?.transaction?.id) ??
      stringifyId(t?.transaction?.id);
    if (!tx_hash) {
      // fail-fast: цепь приняла createorder, но не вернула tx_hash —
      // запись Order в БД без tx_hash сделает audit-trail фантомным.
      throw new BadRequestException(
        'Создание заказа: цепь не вернула tx_hash. Повторите попытку.'
      );
    }
    const block_num = t?.response?.processed?.block_num ?? 0;
    return { tx_hash, block_num };
  }
}

export const MARKETPLACE_ORDER_CREATE_SERVICE = Symbol('MARKETPLACE_ORDER_CREATE_SERVICE');
