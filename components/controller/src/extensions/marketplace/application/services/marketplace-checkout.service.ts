import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Cooperative, type MarketContract } from 'cooptypes';
import { LOGGER_PORT, type ILoggerPort, DOCUMENT_PORT, type IDocumentPort, type InnerGeneratedDocument } from '@coopenomics/innercoop';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import type { MarketplaceCheckoutSignedLineInputDTO } from '../dto/marketplace-checkout.dto';
import { computeOrderHash, computeStockOrderHash } from '../shared/order-hash.util';
import { resolveSaleUnit } from '../shared/packaging.util';
import {
  MARKETPLACE_ECONOMY_SERVICE,
  MarketplaceEconomyService,
} from './marketplace-economy.service';
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

/** Позиция корзины, готовая к оформлению (активна и возится на выбранный КУ). */
interface CheckoutPayableLine {
  offer_id: string;
  /** Упаковка позиции (Эпик 18); пустая строка при отпуске по мере. */
  package_id: string;
  quantity: number;
  offer: MarketplaceOfferDomainEntity;
}

/** Заявление о конвертации к подписи по одной позиции корзины. */
export interface MarketplaceCheckoutSignableLine {
  offer_id: string;
  package_id: string | null;
  order_hash: string;
  amount: string;
  document: InnerGeneratedDocument;
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
    @Inject(MARKETPLACE_ECONOMY_SERVICE)
    private readonly economyService: MarketplaceEconomyService,
    @Inject(DOCUMENT_PORT) private readonly documentPort: IDocumentPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceCheckoutService.name);
  }

  /**
   * Заявления о конвертации паевого взноса к подписи — по одному на каждую
   * оформляемую позицию корзины. order_hash будущего заказа рождается здесь
   * и зашивается в мету заявления; клиент подписывает каждое заявление и
   * возвращает их в `execute` строками `lines` — контракт публикует документ
   * в реестр самостоятельным пакетом при создании заказа.
   */
  async getSignablePayloads(scope: CheckoutScope): Promise<MarketplaceCheckoutSignableLine[]> {
    const cart = await this.cartRepo.getOrCreate(scope.coopname, scope.orderer_account);
    if (cart.is_empty) {
      throw new BadRequestException('Корзина пуста — оформлять нечего.');
    }
    if (!cart.delivery_braname) {
      throw new BadRequestException('Не выбран пункт выдачи (КУ) — выберите КУ перед оформлением.');
    }

    const offers = await this.offerRepo.findByIds(cart.items.map((i) => i.offer_id));
    const { payable } = this.splitCartLines(cart.items, cart.delivery_braname, offers);

    const feePercent = await this.economyService.getMembershipFeeContractPercent(scope.coopname);
    const result: MarketplaceCheckoutSignableLine[] = [];
    for (const line of payable) {
      const order_hash = line.offer.stock_braname
        ? computeStockOrderHash(scope.coopname, scope.orderer_account, line.offer_id)
        : computeOrderHash(scope.coopname, scope.orderer_account, line.offer_id);
      const amount = this.lineAmount(line, feePercent);
      const action: Cooperative.Registry.MarketplaceConvertStatement.Action = {
        registry_id: Cooperative.Registry.MarketplaceConvertStatement.registry_id,
        coopname: scope.coopname,
        username: scope.orderer_account,
        lang: 'ru',
        order_hash,
        amount,
        // Тело сохраняется в стор: реестр документов пересобирает агрегат
        // по doc_hash (rawDocument), preview-режим оставил бы запись пустой.
        skip_save: false,
      };
      const document = await this.documentPort.generate({ data: action });
      result.push({ offer_id: line.offer_id, package_id: line.package_id || null, order_hash, amount, document });
    }
    return result;
  }

  async execute(
    scope: CheckoutScope,
    input: { checkout_id?: string | null; lines?: MarketplaceCheckoutSignedLineInputDTO[] | null }
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
    const { payable, failed } = this.splitCartLines(cart.items, deliveryBraname, offers);

    const feePercent = await this.economyService.getMembershipFeeContractPercent(scope.coopname);

    // Предвалидация баланса под всю оформляемую корзину (без частичного
    // списания) — вместе с членским взносом, как этого требует контракт.
    const totalNeeded = payable.reduce(
      (sum, l) => sum + this.parseAmount(this.lineAmount(l, feePercent)),
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

    // Ключ строки — (offer_id, package_id): один оффер может идти разными
    // упаковками, поэтому offer_id недостаточно (Эпик 18).
    const lineKey = (offer_id: string, package_id: string | null | undefined): string =>
      `${offer_id}|${package_id ?? ''}`;
    const signedByLine = new Map(
      (input.lines ?? []).map((l) => [lineKey(l.offer_id, l.package_id), l])
    );
    const checkoutId = input.checkout_id ?? randomUUID();

    // Построчное оформление: прошедшее остаётся заказанным даже при сбое
    // на последующих строках (без отката заказа целиком).
    const createdDTOs: MarketplaceOrderDTO[] = [];
    const succeededOfferIds: string[] = [];
    for (const line of payable) {
      try {
        // Заявление о конвертации паевого взноса — обязательный спутник
        // каждой строки: контракт требует подписанный документ и публикует
        // его в реестр. Несовпадение суммы/якоря — позиция не оформляется,
        // заявление нужно переподписать (цены могли измениться).
        const signedLine = signedByLine.get(lineKey(line.offer_id, line.package_id));
        if (!signedLine) {
          throw new BadRequestException(
            'Нет подписанного заявления о конвертации паевого взноса — обновите оформление.'
          );
        }
        const meta = signedLine.signed_statement.meta;
        if (
          meta.registry_id !== Cooperative.Registry.MarketplaceConvertStatement.registry_id ||
          meta.order_hash !== signedLine.order_hash
        ) {
          throw new BadRequestException(
            'Заявление о конвертации подписано для другого заказа — обновите оформление.'
          );
        }
        const expectedAmount = this.lineAmount(line, feePercent);
        if (meta.amount !== expectedAmount) {
          throw new BadRequestException(
            `Сумма позиции изменилась (в заявлении ${meta.amount}, к оплате ${expectedAmount}) — обновите оформление.`
          );
        }
        const convert_statement = new SignedDigitalDocumentInputDTO(
          signedLine.signed_statement
        ).toDocument() as MarketContract.Actions.CreateOrder.ICreateOrder['convert_statement'];

        // requirement 76 (remote-докладка): строка с предложением кооператива
        // со склада оформляется заказом из остатка — без цикла поставки,
        // имущество уже на складе выбранного КУ.
        if (line.offer.stock_braname) {
          const res = await this.stockService.createStockOrder({
            coopname: scope.coopname,
            orderer_account: scope.orderer_account,
            offer_id: line.offer_id,
            quantity: line.quantity,
            package_id: line.package_id || null,
            checkout_id: checkoutId,
            order_hash: signedLine.order_hash,
            // Заказ из остатка из членских: паевой конвертируется на сумму строки
            // отдельным действием перед заказом (см. createStockOrder).
            convert_statement,
            convert_amount: expectedAmount,
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
          package_id: line.package_id || null,
          delivery_braname: deliveryBraname,
          checkout_id: checkoutId,
          order_hash: signedLine.order_hash,
          convert_statement,
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

  /**
   * Разделяет позиции корзины на оформляемые (активны + возятся на КУ) и
   * заведомо непрошедшие (неактивны/сняты/не возят) — последние не
   * запускаются, но сообщаются заказчику. Общая логика превью заявлений
   * о конвертации и самого оформления: наборы строк должны совпадать.
   */
  /**
   * Стоимость позиции к оплате (тело + членский взнос) с учётом способа отпуска
   * (Эпик 18): по мере — цена базовой единицы × количество; упаковкой — цена
   * упаковки × число упаковок. Единый расчёт для превью, проверки баланса и
   * оформления — суммы обязаны совпадать.
   */
  private lineAmount(line: CheckoutPayableLine, feePercent: number): string {
    const r = resolveSaleUnit(line.offer, line.quantity, line.package_id || null);
    const saleUnitCount = r.packageSize > 0 ? r.packageCount! : r.baseQuantity;
    return this.economyService.convertAmountForLine(r.unitPrice, saleUnitCount, feePercent);
  }

  private splitCartLines(
    items: ReadonlyArray<{ offer_id: string; package_id: string; quantity: number }>,
    deliveryBraname: string,
    offers: MarketplaceOfferDomainEntity[]
  ): { payable: CheckoutPayableLine[]; failed: MarketplaceCheckoutFailedLineDTO[] } {
    const offerById = new Map(offers.map((o) => [o.id, o]));
    const payable: CheckoutPayableLine[] = [];
    const failed: MarketplaceCheckoutFailedLineDTO[] = [];
    for (const item of items) {
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
      payable.push({ offer_id: item.offer_id, package_id: item.package_id ?? '', quantity: item.quantity, offer });
    }
    return { payable, failed };
  }

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
