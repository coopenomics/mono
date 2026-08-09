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
  MARKETPLACE_CONTAINER_REPOSITORY,
  type MarketplaceContainerDomainRepository,
} from '../../domain/repositories/marketplace-container.repository';
import {
  MARKETPLACE_STORAGE_CELL_REPOSITORY,
  type MarketplaceStorageCellDomainRepository,
} from '../../domain/repositories/marketplace-storage-cell.repository';
import {
  MARKETPLACE_INVENTORY_REPOSITORY,
  type MarketplaceInventoryDomainRepository,
} from '../../domain/repositories/marketplace-inventory.repository';
import {
  MarketplaceBarcodeFormats,
  MarketplaceInventoryStatuses,
  type MarketplaceBarcodeFormat,
  type MarketplaceInventoryPlacement,
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

export interface MarketplaceBindInventoryBarcodeInputDto {
  coopname: string;
  /** Account оператора КУ (из core-сессии). */
  operator_account: string;
  /** Позиция склада, на которую наклеивается штрих-код. */
  inventory_id: string;
  /** Значение штрих-кода с заранее напечатанной этикетки (сканер/ручной ввод). */
  barcode_value: string;
  /** Формат штрих-кода. По умолчанию `EAN13`. */
  format?: MarketplaceBarcodeFormat;
}

export interface MarketplaceAssignInventoryPlacementInputDto {
  coopname: string;
  operator_account: string;
  inventory_id: string;
  /** Бокс, в который кладут позицию. */
  container_id?: string | null;
  /** Ячейка, если позиция кладётся напрямую (негабарит). */
  cell_id?: string | null;
}

export interface MarketplaceInventorySplitEntry {
  quantity: number;
  container_id?: string | null;
  cell_id?: string | null;
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
 *   - `assignPlacement` — положить позицию в бокс либо в ячейку, снять с места;
 *   - `splitInventory` — разложить одну принятую позицию по нескольким местам,
 *      разбив её на отдельные записи (например, 100 л в два бокса);
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
    @Inject(MARKETPLACE_CONTAINER_REPOSITORY)
    private readonly containerRepo: MarketplaceContainerDomainRepository,
    @Inject(MARKETPLACE_STORAGE_CELL_REPOSITORY)
    private readonly cellRepo: MarketplaceStorageCellDomainRepository,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceInventoryLabelService.name);
  }

  /**
   * Положить позицию в бокс либо в ячейку, или снять с места. Оба адреса
   * пустые — позиция возвращается в «без места».
   */
  async assignPlacement(
    input: MarketplaceAssignInventoryPlacementInputDto
  ): Promise<MarketplaceInventoryMutationResult> {
    const item = await this.loadOwned(input.coopname, input.inventory_id);
    const placement = await this.resolvePlacement(input.coopname, item.braname, {
      container_id: input.container_id ?? null,
      cell_id: input.cell_id ?? null,
    });
    const updated = await this.inventoryRepo.assignPlacement(item.id, placement);
    return { inventory: [updated] };
  }

  /**
   * Проверяет и нормализует место: ровно один адрес из двух, цель существует,
   * в обороте и на том же участке, что и сама позиция. Разные участки развели
   * бы учёт с физикой — имущество «переехало» бы мимо процесса передачи.
   */
  private async resolvePlacement(
    coopname: string,
    braname: string,
    requested: MarketplaceInventoryPlacement
  ): Promise<MarketplaceInventoryPlacement> {
    const container_id = requested.container_id ?? null;
    const cell_id = requested.cell_id ?? null;

    if (container_id && cell_id) {
      throw new BadRequestException(
        'Укажите одно место: либо бокс, либо ячейку. Ячейка бокса определяется по самому боксу.'
      );
    }
    if (!container_id && !cell_id) {
      return { container_id: null, cell_id: null };
    }

    if (container_id) {
      const container = await this.containerRepo.findById(container_id);
      if (!container || container.coopname !== coopname) {
        throw new NotFoundException('Бокс не найден.');
      }
      if (!container.is_active) {
        throw new ConflictException(`Бокс «${container.code}» выведен из оборота.`);
      }
      if (container.braname !== braname) {
        throw new ConflictException(
          `Бокс «${container.code}» числится за участком ${container.braname}, а имущество — за ${braname}.`
        );
      }
      return { container_id, cell_id: null };
    }

    const cell = await this.cellRepo.findById(cell_id as string);
    if (!cell || cell.coopname !== coopname) {
      throw new NotFoundException('Ячейка не найдена.');
    }
    if (!cell.is_active) {
      throw new ConflictException(`Ячейка «${cell.code}» выведена из оборота.`);
    }
    if (cell.braname !== braname) {
      throw new ConflictException(
        `Ячейка «${cell.code}» относится к участку ${cell.braname}, а имущество — к ${braname}.`
      );
    }
    return { container_id: null, cell_id };
  }

  /**
   * Перераскладка непромаркированного остатка заказа по полкам. Операция
   * перераспределяет ВЕСЬ непромаркированный RECEIVED-пул заказа (а не только
   * переданную позицию): это позволяет «собрать с полок обратно и разложить
   * иначе» — merge, повторный split и перенос полок в одном действии.
   *
   * Промаркированные куски (штрих-код = конкретная физическая единица) в пул не
   * входят и не трогаются: дробить/схлопывать промаркированное запрещено.
   * Сумма долей == суммарное количество непромаркированного пула.
   */
  async splitInventory(
    input: MarketplaceSplitInventoryInputDto
  ): Promise<MarketplaceInventoryMutationResult> {
    const target = await this.loadOwned(input.coopname, input.inventory_id);
    if (target.status !== MarketplaceInventoryStatuses.RECEIVED || target.barcode_value) {
      throw new ConflictException(
        'Перераскладывать можно только непромаркированную позицию (на складе, без штрих-кода).'
      );
    }
    if (!input.splits.length) {
      throw new BadRequestException('Не указаны доли раскладки.');
    }
    const quantities = input.splits.map((s) => Math.trunc(s.quantity));
    if (quantities.some((q) => q <= 0)) {
      throw new BadRequestException('Количество в каждой доле должно быть положительным целым.');
    }

    // Пул перераскладки — все непромаркированные RECEIVED-куски того же заказа.
    const pool = (
      await this.inventoryRepo.list({
        coopname: target.coopname,
        order_id: target.order_id,
        status: MarketplaceInventoryStatuses.RECEIVED,
      })
    ).filter((p) => !p.barcode_value);
    const poolTotal = pool.reduce((a, p) => a + p.quantity_per_label, 0);

    const sum = quantities.reduce((a, q) => a + q, 0);
    if (sum !== poolTotal) {
      throw new BadRequestException(
        `Сумма долей (${sum}) не равна количеству позиции (${poolTotal}).`
      );
    }

    const result: MarketplaceInventoryDomainEntity[] = [];
    // target переиспользуем под первую долю (сохраняем id/историю), остальные
    // куски пула удаляем (схлопываем), затем создаём новые доли с тем же снапшотом.
    const first = input.splits[0];
    const firstPlacement = await this.resolvePlacement(target.coopname, target.braname, {
      container_id: first.container_id ?? null,
      cell_id: first.cell_id ?? null,
    });
    result.push(await this.inventoryRepo.resize(target.id, quantities[0], firstPlacement));
    for (const piece of pool) {
      if (piece.id !== target.id) await this.inventoryRepo.deleteById(piece.id);
    }
    for (let i = 1; i < input.splits.length; i++) {
      const piece = input.splits[i];
      const piecePlacement = await this.resolvePlacement(target.coopname, target.braname, {
        container_id: piece.container_id ?? null,
        cell_id: piece.cell_id ?? null,
      });
      const created = await this.inventoryRepo.create({
        coopname: target.coopname,
        order_id: target.order_id,
        shipment_id: target.shipment_id,
        braname: target.braname,
        status: MarketplaceInventoryStatuses.RECEIVED,
        product_name_snapshot: target.product_name_snapshot,
        quantity_per_label: quantities[i],
        orderer_account_snapshot: target.orderer_account_snapshot,
        cell_id: piecePlacement.cell_id,
        container_id: piecePlacement.container_id,
        received_at: target.received_at,
        received_by_operator_account: target.received_by_operator_account,
        barcode_value: null,
        barcode_format: null,
        labeled_at: null,
        labeled_by_operator_account: null,
        expiry_date: target.expiry_date,
      });
      result.push(created);
    }

    this.logger.log(
      `Inventory: заказ ${target.order_id} перераскладкой собран из ${pool.length} в ${result.length} мест(а).`
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

  /**
   * Привязать к позиции штрих-код с заранее напечатанной этикетки. В отличие от
   * `generateLabel` (сервер сам генерирует значение) здесь значение приходит
   * извне — оператор сканирует наклеенный физический штрих-код. Уникальность
   * штрих-кода в пределах кооператива проверяется до записи.
   */
  async bindLabel(
    input: MarketplaceBindInventoryBarcodeInputDto
  ): Promise<MarketplaceInventoryMutationResult> {
    const barcode_value = input.barcode_value?.trim();
    if (!barcode_value) {
      throw new BadRequestException('Не указано значение штрих-кода.');
    }
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
    const conflict = await this.inventoryRepo.findByBarcode(item.coopname, barcode_value);
    if (conflict) {
      throw new ConflictException('Этот штрих-код уже привязан к другой позиции склада.');
    }
    const format = input.format ?? MarketplaceBarcodeFormats.EAN13;
    const updated = await this.inventoryRepo.applyLabel(item.id, {
      barcode_value,
      barcode_format: format,
      labeled_at: new Date(),
      labeled_by_operator_account: input.operator_account,
    });
    this.logger.log(
      `Inventory: позиция ${item.id} промаркирована сканированным штрих-кодом (${format}).`
    );
    return { inventory: [updated] };
  }

  /** Снять штрих-код для переклейки (LABELED → RECEIVED, значение и метки маркировки очищаются). */
  async clearLabel(
    input: { coopname: string; operator_account: string; inventory_id: string }
  ): Promise<MarketplaceInventoryMutationResult> {
    const item = await this.loadOwned(input.coopname, input.inventory_id);
    if (!item.barcode_value) {
      throw new ConflictException('У позиции нет штрих-кода — снимать нечего.');
    }
    if (item.status !== MarketplaceInventoryStatuses.LABELED) {
      throw new ConflictException(
        `Снять штрих-код можно только с промаркированной позиции (статус «${item.status}»).`
      );
    }
    const updated = await this.inventoryRepo.clearLabel(item.id);
    this.logger.log(`Inventory: штрих-код снят с позиции ${item.id} (переклейка).`);
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
