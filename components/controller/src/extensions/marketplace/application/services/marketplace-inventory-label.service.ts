import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  MARKETPLACE_INVENTORY_REPOSITORY,
  type MarketplaceInventoryDomainRepository,
} from '../../domain/repositories/marketplace-inventory.repository';
import {
  MarketplaceBarcodeFormats,
  MarketplaceInventoryStatuses,
  type MarketplaceBarcodeFormat,
} from '../../domain/entities/marketplace-inventory.types';
import type { MarketplaceInventoryDomainEntity } from '../../domain/entities/marketplace-inventory.entity';

export interface MarketplaceGenerateInventoryLabelInputDto {
  coopname: string;
  /** Account оператора КУ (из core-сессии). */
  operator_account: string;
  /** Позиция склада, на которую наклеивается штрих-код. */
  inventory_id: string;
  /** Формат штрих-кода. По умолчанию `EAN13` — стандарт маркировки маркетплейса. */
  format?: MarketplaceBarcodeFormat;
}

export interface MarketplaceAssignInventoryShelfInputDto {
  coopname: string;
  operator_account: string;
  inventory_id: string;
  /** Полка/ячейка склада (свободная строка). Пустая строка → очистить полку. */
  shelf: string | null;
}

export interface MarketplaceInventorySplitEntry {
  quantity: number;
  shelf?: string | null;
}

export interface MarketplaceSplitInventoryInputDto {
  coopname: string;
  operator_account: string;
  inventory_id: string;
  /** Доли разбиения; сумма quantity обязана равняться количеству позиции. */
  splits: MarketplaceInventorySplitEntry[];
}

export interface MarketplaceInventoryMutationResult {
  inventory: MarketplaceInventoryDomainEntity[];
}

/**
 * Стол раскладки/маркировки склада КУ. Позиции склада рождаются на приёмке
 * (RECEIVED); этот сервис помогает оператору организовать склад:
 *
 *   - `assignShelf` — назначить/сменить/очистить полку (свободная строка);
 *   - `splitInventory` — разложить одну принятую позицию по нескольким полкам,
 *      разбив её на отдельные записи (например, 100 л на полки A и B);
 *   - `generateLabel` — наклеить внутренний штрих-код (Code128/EAN-13) на
 *      позицию для быстрого поиска на полке (RECEIVED → LABELED).
 *
 * Штрих-код в MVP опционален и служит лишь способом быстро найти позицию —
 * склад работает и без него (один холодильник = маркировка не нужна).
 * QR-коды на имущество запрещены: стандарт маркетплейсов — линейные штрих-коды.
 */
@Injectable()
export class MarketplaceInventoryLabelService {
  constructor(
    @Inject(MARKETPLACE_INVENTORY_REPOSITORY)
    private readonly inventoryRepo: MarketplaceInventoryDomainRepository,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceInventoryLabelService.name);
  }

  /** Назначить/сменить/очистить полку склада для позиции. */
  async assignShelf(
    input: MarketplaceAssignInventoryShelfInputDto
  ): Promise<MarketplaceInventoryMutationResult> {
    const item = await this.loadOwned(input.coopname, input.inventory_id);
    const shelf = input.shelf?.trim() ? input.shelf.trim() : null;
    const updated = await this.inventoryRepo.assignShelf(item.id, shelf);
    return { inventory: [updated] };
  }

  /**
   * Разложить позицию по нескольким полкам. Разрешено только до маркировки
   * (RECEIVED): штрих-код относится к конкретной физической единице, дробить
   * уже промаркированную позицию запрещено. Сумма долей == количество позиции.
   */
  async splitInventory(
    input: MarketplaceSplitInventoryInputDto
  ): Promise<MarketplaceInventoryMutationResult> {
    const item = await this.loadOwned(input.coopname, input.inventory_id);
    if (item.status !== MarketplaceInventoryStatuses.RECEIVED) {
      throw new ConflictException(
        'Разложить по полкам можно только непромаркированную позицию (на складе, без штрих-кода).'
      );
    }
    if (!input.splits.length) {
      throw new BadRequestException('Не указаны доли разбиения.');
    }
    const quantities = input.splits.map((s) => Math.trunc(s.quantity));
    if (quantities.some((q) => q <= 0)) {
      throw new BadRequestException('Количество в каждой доле должно быть положительным целым.');
    }
    const sum = quantities.reduce((a, q) => a + q, 0);
    if (sum !== item.quantity_per_label) {
      throw new BadRequestException(
        `Сумма долей (${sum}) не равна количеству позиции (${item.quantity_per_label}).`
      );
    }

    const result: MarketplaceInventoryDomainEntity[] = [];
    // Первая доля переиспользует исходную запись (сохраняем её id/историю),
    // остальные — новые позиции с теми же снапшотами.
    const first = input.splits[0];
    result.push(
      await this.inventoryRepo.resize(
        item.id,
        quantities[0],
        first.shelf?.trim() ? first.shelf.trim() : item.shelf
      )
    );
    for (let i = 1; i < input.splits.length; i++) {
      const piece = input.splits[i];
      const created = await this.inventoryRepo.create({
        coopname: item.coopname,
        order_id: item.order_id,
        shipment_id: item.shipment_id,
        braname: item.braname,
        status: MarketplaceInventoryStatuses.RECEIVED,
        product_name_snapshot: item.product_name_snapshot,
        quantity_per_label: quantities[i],
        orderer_account_snapshot: item.orderer_account_snapshot,
        shelf: piece.shelf?.trim() ? piece.shelf.trim() : null,
        received_at: item.received_at,
        received_by_operator_account: item.received_by_operator_account,
        barcode_value: null,
        barcode_format: null,
        labeled_at: null,
        labeled_by_operator_account: null,
        expiry_date: item.expiry_date,
      });
      result.push(created);
    }

    this.logger.log(
      `Inventory: позиция ${item.id} разложена на ${result.length} полок(и) (Order ${item.order_id}).`
    );
    return { inventory: result };
  }

  /** Наклеить штрих-код на позицию склада (RECEIVED → LABELED). */
  async generateLabel(
    input: MarketplaceGenerateInventoryLabelInputDto
  ): Promise<MarketplaceInventoryMutationResult> {
    const item = await this.loadOwned(input.coopname, input.inventory_id);
    if (item.barcode_value) {
      throw new ConflictException('Позиция уже промаркирована штрих-кодом.');
    }
    if (
      item.status !== MarketplaceInventoryStatuses.RECEIVED &&
      item.status !== MarketplaceInventoryStatuses.LABELED
    ) {
      throw new ConflictException(
        `Маркировка недоступна для позиции в статусе «${item.status}».`
      );
    }
    const format = input.format ?? MarketplaceBarcodeFormats.EAN13;
    const barcode_value = await this.generateUniqueBarcode(
      item.coopname,
      format,
      item.order_id,
      0
    );
    const updated = await this.inventoryRepo.applyLabel(item.id, {
      barcode_value,
      barcode_format: format,
      labeled_at: new Date(),
      labeled_by_operator_account: input.operator_account,
    });
    this.logger.log(
      `Inventory: позиция ${item.id} промаркирована (${format}, Order ${item.order_id}).`
    );
    return { inventory: [updated] };
  }

  // ── private ──

  private async loadOwned(
    coopname: string,
    inventory_id: string
  ): Promise<MarketplaceInventoryDomainEntity> {
    if (!inventory_id) {
      throw new BadRequestException('Не указана позиция склада.');
    }
    const item = await this.inventoryRepo.findById(inventory_id);
    if (!item || item.coopname !== coopname) {
      throw new NotFoundException('Позиция склада не найдена.');
    }
    return item;
  }

  /**
   * Генерация уникального штрих-кода. CODE128 — буквенно-цифровая строка,
   * EAN-13 — 12 базовых цифр + checksum digit. Уникальность — на уровне
   * unique-индекса БД с retry-loop на случай редкой коллизии.
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
    const randTail = (randomBytes(4).readUInt32BE(0) + attempt + index)
      .toString()
      .slice(-6)
      .padStart(6, '0');
    const base12 = `${numeric}${randTail}`.slice(0, 12).padEnd(12, '0');
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
