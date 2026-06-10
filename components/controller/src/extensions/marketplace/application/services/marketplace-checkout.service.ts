import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  USER_WALLET_REPOSITORY,
  type UserWalletRepository,
} from '~/domain/wallet/repositories/user-wallet.repository';
import {
  MARKETPLACE_CART_REPOSITORY,
  type MarketplaceCartDomainRepository,
} from '../../domain/repositories/marketplace-cart.repository';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import { MarketplaceOfferStatuses } from '../../domain/entities/marketplace-offer.types';
import {
  MarketplaceStockService,
  MARKETPLACE_STOCK_SERVICE,
} from './marketplace-stock.service';
import {
  MARKETPLACE_ASSET_CONFIG,
  type MarketplaceAssetConfig,
} from './marketplace-asset.config';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';
import {
  MARKETPLACE_ORDER_CREATE_SERVICE,
  MarketplaceOrderCreateService,
} from './marketplace-order-create.service';
import {
  MARKETPLACE_CART_SERVICE,
  MarketplaceCartService,
} from './marketplace-cart.service';
import { MarketplaceOrderDTO, toMarketplaceOrderDTO } from '../dto/marketplace-order.dto';
import {
  MarketplaceCheckoutFailedLineDTO,
  MarketplaceCheckoutResultDTO,
} from '../dto/marketplace-checkout.dto';

export const MARKETPLACE_CHECKOUT_SERVICE = Symbol('MARKETPLACE_CHECKOUT_SERVICE');

interface CheckoutScope {
  coopname: string;
  orderer_account: string;
}

/** Кошельки, из которых createorder тянет средства под резерв заказа. */
const SPENDABLE_WALLETS: ReadonlyArray<string> = ['w.wal.share', 'w.wal.member'];

/**
 * Эпик 16 (Story 16.2): оформление заказа из корзины.
 *
 * Решение 2026-06-02: НЕ одна блокчейн-транзакция (лимит времени вычисления
 * блока не вместит большую корзину; ёмкость плавает от нагрузки сети).
 * Поэтому:
 *   1. backend предвалидирует достаточность баланса под всю корзину —
 *      при недостатке заказ не запускается (без частичного списания);
 *   2. при достаточном балансе позиции проводятся ПОСТРОЧНО (существующая
 *      логика Order + блокировки Эпика 4) с общим `checkout_id` и КУ;
 *   3. частичный сбой НЕ откатывает заказ целиком — прошедшие позиции
 *      заказаны и убираются из корзины; непрошедший остаток остаётся в
 *      корзине, повтор — в рамках того же `checkout_id`.
 *
 * Надёжный ретрай блокчейн-транзакций до завершения — общая системная
 * задача кооператива, вне scope (см. issue эпика).
 */
@Injectable()
export class MarketplaceCheckoutService {
  constructor(
    @Inject(MARKETPLACE_CART_REPOSITORY)
    private readonly cartRepo: MarketplaceCartDomainRepository,
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_ORDER_CREATE_SERVICE)
    private readonly orderCreateService: MarketplaceOrderCreateService,
    @Inject(MARKETPLACE_STOCK_SERVICE)
    private readonly stockService: MarketplaceStockService,
    @Inject(MARKETPLACE_CART_SERVICE)
    private readonly cartService: MarketplaceCartService,
    @Inject(USER_WALLET_REPOSITORY)
    private readonly walletRepo: UserWalletRepository,
    @Inject(MARKETPLACE_ASSET_CONFIG)
    private readonly assetConfig: MarketplaceAssetConfig,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceCheckoutService.name);
  }

  async execute(
    scope: CheckoutScope,
    input: { checkout_id?: string | null }
  ): Promise<MarketplaceCheckoutResultDTO> {
    const cart = await this.cartRepo.getOrCreate(scope.coopname, scope.orderer_account);
    if (cart.is_empty) {
      throw new BadRequestException('Корзина пуста — оформлять нечего.');
    }
    if (!cart.delivery_braname) {
      throw new BadRequestException('Не выбран пункт выдачи (КУ) — выберите КУ перед оформлением.');
    }
    const deliveryBraname = cart.delivery_braname;

    const offers = await this.offerRepo.findByIds(cart.items.map((i) => i.offer_id));
    const offerById = new Map(offers.map((o) => [o.id, o]));

    // Разделяем позиции на оформляемые (активны + возятся на КУ) и заведомо
    // непрошедшие (неактивны/сняты/не возят на этот КУ) — последние не
    // запускаем, но сообщаем заказчику.
    const payable: Array<{ offer_id: string; quantity: number; offer: MarketplaceOfferDomainEntity }> = [];
    const failed: MarketplaceCheckoutFailedLineDTO[] = [];
    for (const item of cart.items) {
      const offer = offerById.get(item.offer_id) ?? null;
      if (!offer || offer.status !== MarketplaceOfferStatuses.ACTIVE) {
        failed.push(
          new MarketplaceCheckoutFailedLineDTO({
            offer_id: item.offer_id,
            product_name: offer?.product_name ?? null,
            quantity: item.quantity,
            reason: 'Предложение больше не активно.',
          })
        );
        continue;
      }
      if (!offer.delivery_points.some((dp) => dp.braname === deliveryBraname)) {
        failed.push(
          new MarketplaceCheckoutFailedLineDTO({
            offer_id: item.offer_id,
            product_name: offer.product_name,
            quantity: item.quantity,
            reason: 'Товар не возят на выбранный пункт выдачи.',
          })
        );
        continue;
      }
      payable.push({ offer_id: item.offer_id, quantity: item.quantity, offer });
    }

    // Предвалидация баланса под всю оформляемую корзину (без частичного списания).
    const totalNeeded = payable.reduce(
      (sum, l) => sum + this.parseAmount(l.offer.price_per_unit) * l.quantity,
      0
    );
    if (payable.length > 0) {
      const available = await this.spendableBalance(scope.coopname, scope.orderer_account);
      if (totalNeeded - available > 1e-6) {
        throw new BadRequestException(
          `Недостаточно средств для оформления: нужно ${this.formatAsset(totalNeeded)}, доступно ${this.formatAsset(available)}. ` +
            'Заказ не запущен — пополните счёт или уберите часть позиций.'
        );
      }
    }

    const checkoutId = input.checkout_id ?? randomUUID();

    // Построчное оформление: прошедшее остаётся заказанным даже при сбое
    // на последующих строках (без отката заказа целиком).
    const createdDTOs: MarketplaceOrderDTO[] = [];
    const succeededOfferIds: string[] = [];
    for (const line of payable) {
      try {
        // requirement 76 (remote-докладка): строка с предложением кооператива
        // со склада оформляется заказом из остатка — без цикла поставки,
        // имущество уже на складе выбранного КУ.
        if (line.offer.stock_braname) {
          const res = await this.stockService.createStockOrder({
            coopname: scope.coopname,
            orderer_account: scope.orderer_account,
            offer_id: line.offer_id,
            quantity: line.quantity,
            checkout_id: checkoutId,
          });
          createdDTOs.push(toMarketplaceOrderDTO(res.order));
          succeededOfferIds.push(line.offer_id);
          continue;
        }
        const res = await this.orderCreateService.execute({
          coopname: scope.coopname,
          orderer_account: scope.orderer_account,
          offer_id: line.offer_id,
          quantity: line.quantity,
          delivery_braname: deliveryBraname,
          checkout_id: checkoutId,
        });
        createdDTOs.push(toMarketplaceOrderDTO(res.order));
        succeededOfferIds.push(line.offer_id);
      } catch (error: any) {
        this.logger.warn(
          `MarketplaceCheckoutService: строка не оформлена (offer=${line.offer_id}, qty=${line.quantity}, checkout=${checkoutId}): ${error.message}`
        );
        failed.push(
          new MarketplaceCheckoutFailedLineDTO({
            offer_id: line.offer_id,
            product_name: line.offer.product_name,
            quantity: line.quantity,
            reason: error?.message ?? 'Не удалось оформить позицию.',
          })
        );
      }
    }

    if (succeededOfferIds.length > 0) {
      await this.cartRepo.removeItems(cart.id, succeededOfferIds);
    }

    const cartAfter = await this.cartService.getCart(scope);

    this.logger.log(
      `MarketplaceCheckoutService: checkout=${checkoutId} КУ=${deliveryBraname}; оформлено ${createdDTOs.length}, не прошло ${failed.length}`
    );

    return new MarketplaceCheckoutResultDTO({
      checkout_id: checkoutId,
      delivery_braname: deliveryBraname,
      created_orders: createdDTOs,
      failed_lines: failed,
      fully_completed: failed.length === 0,
      cart: cartAfter,
    });
  }

  // ── private ──

  /** Доступно к расходу = available(w.wal.share) + available(w.wal.member). */
  private async spendableBalance(coopname: string, username: string): Promise<number> {
    const rows = await this.walletRepo.findByUsername(coopname, username);
    return SPENDABLE_WALLETS.reduce((sum, name) => {
      const row = rows.find((r) => r.wallet_name === name);
      return sum + this.parseAmount(row?.available);
    }, 0);
  }

  /** asset-строка («1000.0000 RUB») или число → float; пусто/невалид → 0. */
  private parseAmount(value: string | null | undefined): number {
    if (!value) return 0;
    const n = Number.parseFloat(value);
    return Number.isNaN(n) ? 0 : n;
  }

  /**
   * Число → asset-строка с символом валюты («300.0000 RUB»). Символ обязателен:
   * фронт переформатирует суммы в тексте ошибки только при наличии тикера
   * (regex `\d+\.\d{3,}\s+[A-Z]{3,7}` → «300,00 RUB»). Без символа сумма
   * показалась бы сырой.
   */
  private formatAsset(value: number): string {
    return `${value.toFixed(this.assetConfig.decimals)} ${this.assetConfig.symbol}`;
  }
}
