import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import type { MarketplaceCheckoutSignedLineInputDTO } from '../dto/marketplace-checkout.dto';
import { computeConvertAnchorHash, computeOrderHash, computeStockOrderHash } from '../shared/order-hash.util';
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
  type FundingLinePlan,
} from './marketplace-convert.service';
import type { MarketplaceConvertStatementSignedInputDTO } from '../documents-dto/marketplace-convert-statement-document.dto';
import { rethrowChainError } from '@coopenomics/extension-kit';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';

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

/** Строка превью оформления по одной позиции корзины: суммы к списанию по частям. */
export interface MarketplaceCheckoutSignableLine {
  offer_id: string;
  package_id: string | null;
  order_hash: string;
  /** Стоимость позиции с членским взносом участка, с валютой. */
  amount: string;
  /** Членский взнос участка по позиции, с валютой. */
  membership_fee: string;
  /** Часть позиции (взнос и тело), которая покрывается внутренним членским кошельком, с валютой. */
  from_member: string;
  /** Часть тела позиции с паевого источника, с валютой. */
  from_share: string;
}

/** Заявление 1110 к подписи — только когда внутреннего членского кошелька не хватает. */
export interface MarketplaceConvertPayload {
  /** Недостающая сумма (паевая и членская части вместе), с валютой. */
  amount: string;
  /** Членская часть — переводится в членский кошелёк действием convert, с валютой. */
  membership_fee: string;
  document: InnerGeneratedDocument;
}

export interface MarketplaceCheckoutPreview {
  lines: MarketplaceCheckoutSignableLine[];
  convert: MarketplaceConvertPayload | null;
}

/** Строка оформления с планом фондирования в минимальных единицах валюты. */
interface CheckoutPlannedLine {
  line: CheckoutPayableLine;
  order_hash: string;
  plan: FundingLinePlan;
}

interface CheckoutPlan {
  lines: CheckoutPlannedLine[];
  /** Членская часть перевода — параметр действия convert. */
  fee_convert_units: bigint;
  /** Недостающая сумма с Цифрового кошелька: тела обычных строк с паевого + переводы в членский. */
  transfer_units: bigint;
  /** Паевая часть тел строк со склада — со свободного паевого «Стола заказов». */
  stock_share_units: bigint;
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
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceCheckoutService.name);
  }

  /**
   * Превью оформления. Паевая модель: внутренний членский кошелёк «Стола
   * заказов» расходуется первым — на взнос участка и на тело каждой позиции;
   * остаток тела — с паевого (главный паевой у обычных позиций, свободный
   * паевой программы у позиций со склада). Если кошелька не хватает, к превью
   * прикладывается заявление 1110 на недостающую сумму — клиент подписывает
   * его один раз на всё оформление; хватает — заявления нет.
   */
  async getSignablePayloads(scope: CheckoutScope): Promise<MarketplaceCheckoutPreview> {
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
    const planned = await this.planLines(scope, payable, feePercent, null);
    const lines = planned.lines.map((p) => ({
      offer_id: p.line.offer_id,
      package_id: p.line.package_id || null,
      order_hash: p.order_hash,
      amount: this.economyService.unitsToAsset(p.plan.body_units + p.plan.fee_units),
      membership_fee: this.economyService.unitsToAsset(p.plan.fee_units),
      from_member: this.economyService.unitsToAsset(p.plan.fee_units - p.plan.fee_convert_units + p.plan.body_member_units),
      from_share: this.economyService.unitsToAsset(p.plan.body_share_units),
    }));
    const convert =
      planned.transfer_units > 0n
        ? {
            amount: this.economyService.unitsToAsset(planned.transfer_units),
            membership_fee: this.economyService.unitsToAsset(planned.fee_convert_units),
            document: await this.convertService.generateStatement({
              coopname: scope.coopname,
              username: scope.orderer_account,
              anchor_hash: this.convertAnchor(scope, cart.id),
              amount_units: planned.transfer_units,
              fee_units: planned.fee_convert_units,
              source: 'wallet',
            }),
          }
        : null;
    return { lines, convert };
  }

  async execute(
    scope: CheckoutScope,
    input: {
      checkout_id?: string | null;
      lines?: MarketplaceCheckoutSignedLineInputDTO[] | null;
      signed_convert?: MarketplaceConvertStatementSignedInputDTO | null;
    }
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

    // Ключ строки — (offer_id, package_id): один оффер может идти разными
    // упаковками, поэтому offer_id недостаточно (Эпик 18).
    const lineKey = (offer_id: string, package_id: string | null | undefined): string =>
      `${offer_id}|${package_id ?? ''}`;
    const orderHashByLine = new Map(
      (input.lines ?? []).map((l) => [lineKey(l.offer_id, l.package_id), l.order_hash])
    );

    const feePercent = await this.economyService.getMembershipFeeContractPercent(scope.coopname);
    // План по свежему балансу членского кошелька: недостающая сумма обязана
    // совпасть с подписанным заявлением, иначе оформление повторяется.
    const planned = await this.planLines(scope, payable, feePercent, orderHashByLine);

    // Предвалидация баланса под всю оформляемую корзину (без частичного
    // списания): с Цифрового кошелька — недостающая сумма (тела обычных строк с
    // паевого и перевод в членский), со свободного паевого — тела строк со склада.
    if (planned.lines.length > 0) {
      await this.assertSpendable(scope, MAIN_SHARE_WALLET, planned.transfer_units, 'главном паевом кошельке');
      await this.assertSpendable(scope, MARKETPLACE_SHARE_WALLET, planned.stock_share_units, 'свободном паевом «Стола заказов»');
    }

    // ── Заявление 1110 и перевод в членский кошелёк — одной транзакцией до заказов ──
    if (planned.transfer_units > 0n) {
      const convert_statement = this.convertService.verifySigned(
        input.signed_convert,
        { anchor_hash: this.convertAnchor(scope, cart.id), amount_units: planned.transfer_units, fee_units: planned.fee_convert_units },
        scope.orderer_account
      );
      try {
        await this.chainPort.convert({
          coopname: scope.coopname,
          orderer: scope.orderer_account,
          amount: this.economyService.unitsToAsset(planned.fee_convert_units),
          from_market: false,
          convert_statement,
        });
      } catch (e) {
        rethrowChainError(e);
      }
    }

    const checkoutId = input.checkout_id ?? randomUUID();

    // Построчное оформление: прошедшее остаётся заказанным даже при сбое
    // на последующих строках (без отката заказа целиком).
    const createdDTOs: MarketplaceOrderDTO[] = [];
    const succeededOfferIds: string[] = [];
    for (const p of planned.lines) {
      const line = p.line;
      try {
        const order_hash = p.order_hash;

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
  /** Якорь заявления 1110 оформления корзины — по корзине, без nonce. */
  private convertAnchor(scope: CheckoutScope, cartId: string): string {
    return computeConvertAnchorHash(scope.coopname, scope.orderer_account, `cart:${cartId}`);
  }

  /**
   * План оформления по строкам: тело позиции с учётом способа отпуска
   * (Эпик 18: по мере — цена базовой единицы × количество; упаковкой — цена
   * упаковки × число упаковок), членский взнос участка той же формулой, что
   * контракт, и раскладка по кошелькам в порядке проведения — внутренний
   * членский кошелёк первым (взнос, затем тело), остаток тела с паевого.
   * order_hash берётся из строк превью (в нём случайный nonce), иначе
   * рождается здесь. Единый расчёт для превью, проверки баланса и
   * оформления — суммы обязаны совпадать побитово.
   */
  private async planLines(
    scope: CheckoutScope,
    payable: CheckoutPayableLine[],
    feePercent: number,
    orderHashByLine: Map<string, string> | null
  ): Promise<CheckoutPlan> {
    const inputs = payable.map((line) => {
      const r = resolveSaleUnit(line.offer, line.quantity, line.package_id || null);
      const saleUnitCount = r.packageSize > 0 ? r.packageCount! : r.baseQuantity;
      const body_units = this.economyService.lineBodyUnits(r.unitPrice, saleUnitCount);
      return { body_units, fee_units: this.economyService.membershipFeeUnits(body_units, feePercent) };
    });
    const memberAvailable =
      payable.length > 0 ? await this.convertService.memberAvailableUnits(scope.coopname, scope.orderer_account) : 0n;
    const funding = this.convertService.planFunding(memberAvailable, inputs);
    const lines: CheckoutPlannedLine[] = payable.map((line, i) => ({
      line,
      order_hash:
        orderHashByLine?.get(`${line.offer_id}|${line.package_id || ''}`) ??
        (line.offer.stock_braname
          ? computeStockOrderHash(scope.coopname, scope.orderer_account, line.offer_id)
          : computeOrderHash(scope.coopname, scope.orderer_account, line.offer_id)),
      plan: funding.lines[i]!,
    }));
    // Тела строк со склада идут со свободного паевого программы и в заявление
    // о переводе с Цифрового кошелька не входят.
    const stock_share_units = lines
      .filter((l) => !!l.line.offer.stock_braname)
      .reduce((sum, l) => sum + l.plan.body_share_units, 0n);
    return {
      lines,
      fee_convert_units: funding.fee_convert_units,
      transfer_units: funding.transfer_units - stock_share_units,
      stock_share_units,
    };
  }

  /** Достаточность паевого кошелька под сумму. */
  private async assertSpendable(scope: CheckoutScope, wallet_name: string, needed: bigint, walletLabel: string): Promise<void> {
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
