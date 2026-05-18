import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import {
  MARKETPLACE_SHIPMENT_REPOSITORY,
  type MarketplaceShipmentDomainRepository,
} from '../../domain/repositories/marketplace-shipment.repository';
import {
  MARKETPLACE_INVENTORY_REPOSITORY,
  type MarketplaceInventoryDomainRepository,
} from '../../domain/repositories/marketplace-inventory.repository';
import {
  MarketplaceBarcodeFormats,
  MarketplaceBarcodeStrategies,
  MarketplaceInventoryStatuses,
  type MarketplaceBarcodeFormat,
  type MarketplaceBarcodeStrategy,
} from '../../domain/entities/marketplace-inventory.types';
import type { MarketplaceInventoryDomainEntity } from '../../domain/entities/marketplace-inventory.entity';

export interface MarketplaceLabelInventoryInputDto {
  coopname: string;
  /** Account оператора КУ (из core-сессии). */
  operator_account: string;
  /** Order, на единицы которого наклеивается штрих-код. */
  order_id: string;
  /**
   * Admin-override стратегии маркировки. По умолчанию читается из
   * `Offer.barcode_strategy` (Story 5.5 / техдолг 598-22). Перекрытие
   * — только для исключительных сценариев; в production-UI кассирского/
   * операторского стола не передаётся.
   */
  strategy?: MarketplaceBarcodeStrategy;
  /** Формат штрих-кода. По умолчанию `CODE128` (произвольная длина). */
  format?: MarketplaceBarcodeFormat;
  /**
   * Admin-override размера упаковки для `PER_PACKAGE`. По умолчанию —
   * `Offer.pack_size`. Игнорируется для прочих стратегий.
   */
  pack_size?: number;
}

export interface MarketplaceLabelInventoryResult {
  inventory: MarketplaceInventoryDomainEntity[];
}

export interface MarketplaceLabelShipmentInventoryOverride {
  order_id: string;
  strategy?: MarketplaceBarcodeStrategy;
  pack_size?: number;
}

export interface MarketplaceLabelShipmentInventoryInputDto {
  coopname: string;
  operator_account: string;
  shipment_id: string;
  /** Стратегия по умолчанию для всех Order'ов партии (если override не задан). */
  default_strategy?: MarketplaceBarcodeStrategy;
  format?: MarketplaceBarcodeFormat;
  /** Per-Order перекрытие стратегии (например, смешанные Offer'ы в партии). */
  per_order_overrides?: MarketplaceLabelShipmentInventoryOverride[];
}

export interface MarketplaceLabelShipmentInventoryResult {
  inventory: MarketplaceInventoryDomainEntity[];
  labeled_order_ids: string[];
  skipped_order_ids: string[];
}

/**
 * Story 5.5: маркировка имущества внутренним штрих-кодом оператором КУ.
 *
 * Поведение:
 *   1. Order найден и принадлежит этому coopname.
 *   2. Order проходит фазу приёмки (status ∈ {SUPPLY_PREPARED,
 *      READY_TO_RECEIVE, ACCEPTED_TO_COOP}); маркировку рано до SUPPLY_PREPARED
 *      и поздно после RECEIVED отклоняем.
 *   3. Order ещё не был помечен (по barcode_value) — повторный label по
 *      тому же Order'у в той же стратегии → ConflictException
 *      (повторная маркировка ломает ledger).
 *   4. Найден соответствующий Shipment (через cycle_id + braname из
 *      Order.delivery_braname); если Shipment отсутствует — Story 5.1
 *      не была выполнена → BadRequest.
 *   5. Генерируется уникальный barcode_value согласно strategy + format:
 *      - PER_ORDER → 1 этикетка с quantity_per_label=Order.quantity;
 *      - PER_UNIT  → N этикеток с quantity_per_label=1;
 *      - PER_PACKAGE → ceil(Order.quantity/pack_size) этикеток
 *        с quantity_per_label=pack_size (последняя может быть меньше).
 *   6. Persist Inventory rows + LABELED status.
 *
 * QR-коды запрещены (Story 5.5 спецификация: только Code128/EAN-13 —
 * стандарт маркетплейсов на маркировке имущества).
 */
@Injectable()
export class MarketplaceInventoryLabelService {
  constructor(
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_SHIPMENT_REPOSITORY)
    private readonly shipmentRepo: MarketplaceShipmentDomainRepository,
    @Inject(MARKETPLACE_INVENTORY_REPOSITORY)
    private readonly inventoryRepo: MarketplaceInventoryDomainRepository,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceInventoryLabelService.name);
  }

  /**
   * Массовая маркировка имущества всех Order'ов одной партии поставки.
   *
   * Идемпотентна: если часть Order'ов уже промаркированы — они пропускаются
   * без ошибки; обычный execute() кидает ConflictException, что в batch
   * сценарии превращает каждый повторный показ страницы во fatal.
   *
   * Поведение:
   *   1. Shipment найден и принадлежит coopname.
   *   2. Загружаются все Order'ы цикла, фильтруются по delivery_braname партии.
   *   3. Каждому Order'у применяется execute() — единый источник правил маркировки.
   *   4. Уже промаркированные пропускаются (idempotency через ConflictException
   *      от execute(): обрабатывается как «skipped»).
   *   5. Результат — собранные этикетки всех Order'ов + per-Order статус.
   */
  async labelShipment(
    input: MarketplaceLabelShipmentInventoryInputDto
  ): Promise<MarketplaceLabelShipmentInventoryResult> {
    if (!input.shipment_id) {
      throw new BadRequestException('Не указан shipment_id.');
    }

    const shipment = await this.shipmentRepo.findById(input.shipment_id);
    if (!shipment || shipment.coopname !== input.coopname) {
      throw new NotFoundException('Партия поставки не найдена.');
    }

    const allCycleOrders = await this.orderRepo.findByCycleId(
      shipment.coopname,
      shipment.cycle_id
    );
    const shipmentOrders = allCycleOrders.filter(
      (o) => o.delivery_braname === shipment.braname
    );

    if (shipmentOrders.length === 0) {
      throw new BadRequestException(
        'В партии нет заказов для маркировки — состав партии пуст.'
      );
    }

    const overrideByOrder = new Map(
      (input.per_order_overrides ?? []).map((o) => [
        o.order_id,
        { strategy: o.strategy, pack_size: o.pack_size },
      ])
    );

    const inventory: MarketplaceInventoryDomainEntity[] = [];
    const skipped: string[] = [];
    const labeled: string[] = [];

    for (const order of shipmentOrders) {
      const override = overrideByOrder.get(order.id);
      try {
        const result = await this.execute({
          coopname: input.coopname,
          operator_account: input.operator_account,
          order_id: order.id,
          strategy: override?.strategy ?? input.default_strategy,
          format: input.format,
          pack_size: override?.pack_size,
        });
        inventory.push(...result.inventory);
        labeled.push(order.id);
      } catch (e) {
        if (e instanceof ConflictException) {
          skipped.push(order.id);
          continue;
        }
        throw e;
      }
    }

    this.logger.log(
      `Inventory: партия ${shipment.id} — маркировано ${labeled.length} заказов, пропущено ${skipped.length} (уже промаркированы).`
    );

    return { inventory, labeled_order_ids: labeled, skipped_order_ids: skipped };
  }

  async execute(
    input: MarketplaceLabelInventoryInputDto
  ): Promise<MarketplaceLabelInventoryResult> {
    if (!input.order_id) {
      throw new BadRequestException('Не указан order_id.');
    }

    const order = await this.orderRepo.findById(input.order_id);
    if (!order || order.coopname !== input.coopname) {
      throw new NotFoundException('Заказ не найден.');
    }

    if (
      order.status !== 'SUPPLY_PREPARED' &&
      order.status !== 'READY_TO_RECEIVE' &&
      order.status !== 'ACCEPTED_TO_COOP'
    ) {
      throw new BadRequestException(
        `Маркировка возможна только после приёмки на КУ (статус «${order.status}» вне допустимого окна).`
      );
    }

    if (!order.cycle_id) {
      throw new BadRequestException(
        'Заказ не привязан к консолидированной заявке — невозможно сопоставить с партией поставки.'
      );
    }

    const shipment = await this.shipmentRepo.findByCycleAndKU(
      order.coopname,
      order.cycle_id,
      order.delivery_braname
    );
    if (!shipment) {
      throw new BadRequestException(
        `Партия поставки для КУ "${order.delivery_braname}" не сформирована — выполните Подготовку поставки.`
      );
    }

    // Если уже промаркировано — конфликт (защита от двойной маркировки).
    const existingCount = await this.inventoryRepo.countByOrder(order.coopname, order.id);
    if (existingCount > 0) {
      throw new ConflictException(
        `Заказ уже промаркирован (${existingCount} этикеток); повторная маркировка запрещена.`
      );
    }

    const offer = await this.offerRepo.findById(order.offer_id);
    if (!offer || offer.coopname !== order.coopname) {
      throw new NotFoundException('Предложение по заказу не найдено.');
    }

    // Источник истины по стратегии — Offer (598-22). Per-call параметр
    // оставлен только для admin-override (мне-сейчас-нужно перекрыть),
    // в обычном flow столы оператора не передают strategy/pack_size.
    const strategy = input.strategy ?? offer.barcode_strategy;
    const pack_size =
      input.pack_size !== undefined ? input.pack_size : offer.pack_size ?? undefined;
    const format = input.format ?? MarketplaceBarcodeFormats.CODE128;

    const labelsPlan = this.planLabels(order.quantity, strategy, pack_size);
    if (labelsPlan.length === 0) {
      throw new BadRequestException('Не удалось рассчитать набор этикеток.');
    }

    const inventory: MarketplaceInventoryDomainEntity[] = [];
    const labeledAt = new Date();
    // Story 8.3 (Эпик 8): срок годности позиции. Берётся из Offer.warranty_days
    // (если задан) — это становится опорой для крон-сканера, который раз в
    // месяц подбирает кандидатов для проекта списания.
    const warrantyDays = offer.warranty_days ?? 0;
    const expiryDate: Date | null =
      warrantyDays > 0 ? new Date(labeledAt.getTime() + warrantyDays * 86_400_000) : null;
    for (let i = 0; i < labelsPlan.length; i++) {
      const quantity_per_label = labelsPlan[i];
      const barcode_value = await this.generateUniqueBarcode(
        order.coopname,
        format,
        order.id,
        i
      );
      const row = await this.inventoryRepo.create({
        coopname: order.coopname,
        barcode_value,
        barcode_format: format,
        order_id: order.id,
        shipment_id: shipment.id,
        braname: shipment.braname,
        status: MarketplaceInventoryStatuses.LABELED,
        product_name_snapshot: offer.product_name ?? '',
        quantity_per_label,
        orderer_account_snapshot: order.orderer_account,
        labeled_at: labeledAt,
        labeled_by_operator_account: input.operator_account,
        expiry_date: expiryDate,
      });
      inventory.push(row);
    }

    this.logger.log(
      `Inventory: ${inventory.length} этикеток сгенерировано для Order ${order.id} (стратегия=${strategy}, формат=${format})`
    );

    return { inventory };
  }

  // ── private ──

  private planLabels(
    quantity: number,
    strategy: MarketplaceBarcodeStrategy,
    pack_size?: number
  ): number[] {
    if (strategy === MarketplaceBarcodeStrategies.PER_ORDER) {
      return [quantity];
    }
    if (strategy === MarketplaceBarcodeStrategies.PER_UNIT) {
      return new Array(quantity).fill(1);
    }
    if (strategy === MarketplaceBarcodeStrategies.PER_PACKAGE) {
      if (!pack_size || pack_size <= 0) {
        throw new BadRequestException('Для стратегии PER_PACKAGE нужен размер упаковки.');
      }
      if (pack_size > quantity) {
        return [quantity];
      }
      const labels: number[] = [];
      let remaining = quantity;
      while (remaining > 0) {
        const chunk = Math.min(pack_size, remaining);
        labels.push(chunk);
        remaining -= chunk;
      }
      return labels;
    }
    throw new BadRequestException(`Неизвестная стратегия маркировки: ${String(strategy)}`);
  }

  /**
   * Генерация уникального штрих-кода. CODE128 — буквенно-цифровая строка,
   * EAN-13 — 12 базовых цифр + checksum digit.
   *
   * Гарантия уникальности — на уровне unique-индекса БД с retry-loop на
   * случай редкой коллизии (вероятность ~10⁻¹⁰ для 16 hex-байт).
   */
  private async generateUniqueBarcode(
    coopname: string,
    format: MarketplaceBarcodeFormat,
    order_id: string,
    index: number
  ): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate =
        format === MarketplaceBarcodeFormats.EAN13
          ? this.makeEAN13(order_id, index, attempt)
          : this.makeCode128(coopname, order_id, index, attempt);
      const conflict = await this.inventoryRepo.findByBarcode(coopname, candidate);
      if (!conflict) return candidate;
    }
    throw new ConflictException('Не удалось сгенерировать уникальный штрих-код за 5 попыток.');
  }

  private makeCode128(
    coopname: string,
    order_id: string,
    index: number,
    attempt: number
  ): string {
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    const orderShort = order_id.replace(/-/g, '').slice(0, 8).toUpperCase();
    return `${coopname.toUpperCase().slice(0, 4)}${orderShort}${index.toString().padStart(3, '0')}${suffix}${attempt}`;
  }

  private makeEAN13(order_id: string, index: number, attempt: number): string {
    const numeric = order_id.replace(/[^0-9]/g, '').slice(0, 6).padStart(6, '0');
    const tail = (Date.now() + attempt * 1_000 + index)
      .toString()
      .slice(-6)
      .padStart(6, '0');
    const base12 = `${numeric}${tail}`.slice(0, 12).padEnd(12, '0');
    const check = this.calcEAN13Checksum(base12);
    return `${base12}${check}`;
  }

  private calcEAN13Checksum(base12: string): number {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const d = Number(base12[i]);
      sum += i % 2 === 0 ? d : d * 3;
    }
    return (10 - (sum % 10)) % 10;
  }
}

export const MARKETPLACE_INVENTORY_LABEL_SERVICE = Symbol(
  'MARKETPLACE_INVENTORY_LABEL_SERVICE'
);
