import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import type { MarketplaceCheckoutSignedLineInputDTO } from '../dto/marketplace-checkout.dto';
import { computeOrderHash, computeStockOrderHash } from '../shared/order-hash.util';
import { resolveSaleUnit } from '../shared/packaging.util';
import {
  MARKETPLACE_ECONOMY_SERVICE,
  MarketplaceEconomyService,
} from './marketplace-economy.service';
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
import type { InnerGeneratedDocument } from '@coopenomics/innercoop';
import {
  MARKETPLACE_CONVERT_SERVICE,
  MAIN_SHARE_WALLET,
  MARKETPLACE_SHARE_WALLET,
  MarketplaceConvertService,
} from './marketplace-convert.service';

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

/**
 * Строка превью оформления по одной позиции корзины: суммы к списанию и
 * заявление 1110 о переводе паевого взноса в программу на полную сумму с
 * выделением членского взноса — подписывается заказчиком по каждой позиции.
 */
export interface MarketplaceCheckoutSignableLine {
  offer_id: string;
  package_id: string | null;
  order_hash: string;
  /** Стоимость позиции с членским взносом участка, с валютой. */
  amount: string;
  /** Членский взнос участка по позиции, с валютой. */
  membership_fee: string;
  /** Конвертируется из паевого по заявлению (недостающая часть взноса), с валютой. */
  convert_amount: string;
  document: InnerGeneratedDocument | null;
}

/** Строка оформления с посчитанными суммами в минимальных единицах валюты. */
interface CheckoutPlannedLine {
  line: CheckoutPayableLine;
  order_hash: string;
  body_units: bigint;
  fee_units: bigint;
  convert_units: bigint;
}

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
    @Inject(MARKETPLACE_ECONOMY_SERVICE)
    private readonly economyService: MarketplaceEconomyService,
    @Inject(MARKETPLACE_CONVERT_SERVICE)
    private readonly convertService: MarketplaceConvertService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceCheckoutService.name);
  }

  /**
   * Превью оформления — по одной строке на каждую оформляемую позицию
   * корзины. order_hash будущего заказа рождается здесь. Паевая модель:
   * заявление 1110 — на полную сумму перевода в программу с выделением
   * членского взноса участка; по кошелькам тело идёт паевыми кошельками
   * (резерв под заказ), взнос — членскими: с членского кошелька программы, а
   * недостающая часть переводится из паевого в членский. Клиент подписывает
   * заявление по каждой строке и возвращает в `execute` строками `lines`;
   * контракт публикует документ в реестр самостоятельным пакетом.
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
    const planned = await this.planLines(scope, payable, feePercent);
    const result: MarketplaceCheckoutSignableLine[] = [];
    for (const p of planned) {
      const document = await this.convertService.generateStatement({
        coopname: scope.coopname,
        username: scope.orderer_account,
        order_hash: p.order_hash,
        body_units: p.body_units,
        fee_units: p.fee_units,
        convert_units: p.convert_units,
        fee_contract_percent: feePercent,
        source: p.line.offer.stock_braname ? 'market' : 'wallet',
      });
      result.push({
        offer_id: p.line.offer_id,
        package_id: p.line.package_id || null,
        order_hash: p.order_hash,
        amount: this.economyService.unitsToAsset(p.body_units + p.fee_units),
        membership_fee: this.economyService.unitsToAsset(p.fee_units),
        convert_amount: this.economyService.unitsToAsset(p.convert_units),
        document,
      });
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
    // План по свежему балансу членского кошелька: суммы конвертации обязаны
    // совпасть с подписанными заявлениями, иначе оформление повторяется.
    const planned = await this.planLines(scope, payable, feePercent);

    // Предвалидация баланса под всю оформляемую корзину (без частичного
    // списания): с паевого уходит тело заказа и недостающая часть взноса.
    // Обычный заказ — с главного паевого, заказ из остатка — со свободного
    // паевого «Стола заказов»; остаток членского кошелька уже зачтён в плане.
    if (planned.length > 0) {
      await this.assertSpendable(scope, planned, MAIN_SHARE_WALLET, (p) => !p.line.offer.stock_braname, 'главном паевом кошельке');
      await this.assertSpendable(scope, planned, MARKETPLACE_SHARE_WALLET, (p) => !!p.line.offer.stock_braname, 'свободном паевом «Стола заказов»');
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
    for (const p of planned) {
      const line = p.line;
      try {
        // Заявление 1110 из превью: на этот заказ, на ту же полную сумму и на ту
        // же часть перевода в членский, что вышла по свежему балансу кошелька.
        const signedLine = signedByLine.get(lineKey(line.offer_id, line.package_id));
        const order_hash = p.order_hash;
        if (signedLine && signedLine.order_hash !== order_hash) {
          throw new BadRequestException('Строка оформления относится к другому заказу — обновите оформление.');
        }
        const convert_statement = this.convertService.verifySigned(
          signedLine?.signed_statement,
          { order_hash, body_units: p.body_units, fee_units: p.fee_units, convert_units: p.convert_units },
          scope.orderer_account
        );

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
            order_hash,
            convert_statement,
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
          order_hash,
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
   * запускаются, но сообщаются заказчику. Общая логика превью и самого
   * оформления: наборы строк должны совпадать.
   */
  /**
   * План оформления по строкам: тело позиции с учётом способа отпуска
   * (Эпик 18: по мере — цена базовой единицы × количество; упаковкой — цена
   * упаковки × число упаковок), членский взнос участка той же формулой, что
   * контракт, и недостающая до взноса часть членского кошелька программы —
   * строки идут в порядке проведения, остаток кошелька зачитывается
   * последовательно. Единый расчёт для превью, проверки баланса и
   * оформления — суммы обязаны совпадать побитово.
   */
  private async planLines(
    scope: CheckoutScope,
    payable: CheckoutPayableLine[],
    feePercent: number
  ): Promise<CheckoutPlannedLine[]> {
    const bodies = payable.map((line) => {
      const r = resolveSaleUnit(line.offer, line.quantity, line.package_id || null);
      const saleUnitCount = r.packageSize > 0 ? r.packageCount! : r.baseQuantity;
      return this.economyService.lineBodyUnits(r.unitPrice, saleUnitCount);
    });
    const fees = bodies.map((body) => this.economyService.membershipFeeUnits(body, feePercent));
    const memberAvailable =
      payable.length > 0 ? await this.convertService.memberAvailableUnits(scope.coopname, scope.orderer_account) : 0n;
    const plan = this.convertService.planConversions(memberAvailable, fees);
    return payable.map((line, i) => ({
      line,
      order_hash: line.offer.stock_braname
        ? computeStockOrderHash(scope.coopname, scope.orderer_account, line.offer_id)
        : computeOrderHash(scope.coopname, scope.orderer_account, line.offer_id),
      body_units: bodies[i]!,
      fee_units: plan[i]!.fee_units,
      convert_units: plan[i]!.convert_units,
    }));
  }

  /** Достаточность паевого кошелька под тело и конвертацию по отобранным строкам. */
  private async assertSpendable(
    scope: CheckoutScope,
    planned: CheckoutPlannedLine[],
    wallet_name: string,
    pick: (p: CheckoutPlannedLine) => boolean,
    walletLabel: string
  ): Promise<void> {
    const needed = planned.filter(pick).reduce((sum, p) => sum + p.body_units + p.convert_units, 0n);
    if (needed <= 0n) return;
    const available = await this.convertService.availableUnits(scope.coopname, scope.orderer_account, wallet_name);
    if (needed > available) {
      throw new BadRequestException(
        `Недостаточно средств на ${walletLabel} для оформления: нужно ${this.economyService.unitsToAsset(needed)}, доступно ${this.economyService.unitsToAsset(available)}. ` +
          'Заказ не запущен — пополните паевой взнос или уберите часть позиций.'
      );
    }
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

}
