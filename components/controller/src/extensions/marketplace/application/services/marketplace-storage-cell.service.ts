import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConflictException } from '@nestjs/common';
import type { MarketplaceStorageCellDomainEntity } from '../../domain/entities/marketplace-storage-cell.entity';
import { buildStorageCellCode } from '../../domain/entities/marketplace-storage-cell.types';
import {
  MARKETPLACE_INVENTORY_REPOSITORY,
  type MarketplaceInventoryDomainRepository,
} from '../../domain/repositories/marketplace-inventory.repository';
import {
  MARKETPLACE_CONTAINER_REPOSITORY,
  type MarketplaceContainerDomainRepository,
} from '../../domain/repositories/marketplace-container.repository';
import {
  MARKETPLACE_STORAGE_CELL_REPOSITORY,
  type MarketplaceStorageCellCreateInput,
  type MarketplaceStorageCellDomainRepository,
} from '../../domain/repositories/marketplace-storage-cell.repository';

export const MARKETPLACE_STORAGE_CELL_SERVICE = Symbol('MARKETPLACE_STORAGE_CELL_SERVICE');

/** Потолок на одну генерацию сетки — защита от опечатки «ярусы 1..10000». */
const MAX_GRID_CELLS_PER_CALL = 500;

export interface CreateStorageCellGridInput {
  coopname: string;
  braname: string;
  /** Секции-столбцы: «A», «B», «Холодильник». */
  sections: readonly string[];
  /** Ярусы с первого по последний включительно. */
  level_from: number;
  level_to: number;
}

export interface CreateStorageCellInput {
  coopname: string;
  braname: string;
  section: string;
  level: number;
  label?: string | null;
}

export interface UpdateStorageCellInput {
  coopname: string;
  id: string;
  label?: string | null;
  is_active?: boolean;
}

/**
 * Топология склада КУ: заведение и правка ячеек хранения.
 *
 * Скоупинг по участку («свои КУ») делается вызывающим resolver'ом — сервис
 * оперирует уже разрешёнными branames, как и остальные сервисы расширения.
 */
@Injectable()
export class MarketplaceStorageCellService {
  constructor(
    @Inject(MARKETPLACE_STORAGE_CELL_REPOSITORY)
    private readonly cellRepo: MarketplaceStorageCellDomainRepository,
    @Inject(MARKETPLACE_INVENTORY_REPOSITORY)
    private readonly inventoryRepo: MarketplaceInventoryDomainRepository,
    @Inject(MARKETPLACE_CONTAINER_REPOSITORY)
    private readonly containerRepo: MarketplaceContainerDomainRepository
  ) {}

  async createCell(input: CreateStorageCellInput): Promise<MarketplaceStorageCellDomainEntity> {
    this.assertCoordinates(input.section, input.level);
    return this.cellRepo.create({
      coopname: input.coopname,
      braname: input.braname,
      section: input.section.trim(),
      level: input.level,
      label: input.label ?? null,
    });
  }

  /**
   * Заводит прямоугольную сетку «секции × ярусы» одним действием. Уже
   * существующие координаты пропускаются — «добавить ярус к стеллажу»
   * повторяет тот же вызов с расширенным диапазоном, и это не ошибка.
   */
  async createGrid(input: CreateStorageCellGridInput): Promise<MarketplaceStorageCellDomainEntity[]> {
    const sections = input.sections.map((s) => s.trim()).filter((s) => s.length > 0);
    if (sections.length === 0) {
      throw new BadRequestException('Укажите хотя бы одну секцию.');
    }
    if (new Set(sections).size !== sections.length) {
      throw new BadRequestException('Секции в сетке не должны повторяться.');
    }
    if (!Number.isInteger(input.level_from) || !Number.isInteger(input.level_to)) {
      throw new BadRequestException('Ярусы задаются целыми числами.');
    }
    if (input.level_from < 1 || input.level_to < input.level_from) {
      throw new BadRequestException('Диапазон ярусов должен начинаться с 1 и возрастать.');
    }

    const levelsCount = input.level_to - input.level_from + 1;
    const total = sections.length * levelsCount;
    if (total > MAX_GRID_CELLS_PER_CALL) {
      throw new BadRequestException(
        `За один раз можно завести не больше ${MAX_GRID_CELLS_PER_CALL} ячеек (запрошено ${total}).`
      );
    }

    const inputs: MarketplaceStorageCellCreateInput[] = [];
    for (const section of sections) {
      for (let level = input.level_from; level <= input.level_to; level++) {
        inputs.push({
          coopname: input.coopname,
          braname: input.braname,
          section,
          level,
          code: buildStorageCellCode(section, level),
        });
      }
    }
    return this.cellRepo.createGrid(inputs);
  }

  async list(
    coopname: string,
    branames: string | string[],
    options?: { is_active?: boolean }
  ): Promise<MarketplaceStorageCellDomainEntity[]> {
    return this.cellRepo.list({ coopname, braname: branames, is_active: options?.is_active });
  }

  async getById(coopname: string, id: string): Promise<MarketplaceStorageCellDomainEntity> {
    const cell = await this.cellRepo.findById(id);
    if (!cell || cell.coopname !== coopname) {
      throw new NotFoundException('Ячейка не найдена.');
    }
    return cell;
  }

  async update(input: UpdateStorageCellInput): Promise<MarketplaceStorageCellDomainEntity> {
    const cell = await this.getById(input.coopname, input.id);

    // Вывести из оборота можно только пустую ячейку: иначе имущество осталось бы
    // числиться в месте, которого для оператора больше нет.
    if (input.is_active === false && cell.is_active) {
      await this.assertCellIsEmpty(cell);
    }

    const updated = await this.cellRepo.update(input.id, {
      label: input.label,
      is_active: input.is_active,
    });
    if (!updated) {
      throw new NotFoundException('Ячейка не найдена.');
    }
    return updated;
  }

  /**
   * Ячейка пуста, если в ней нет ни имущества, лежащего напрямую, ни боксов.
   * Обе занятости равнозначны: вывести адрес из оборота, оставив там что-то
   * физически стоящее, значит потерять это для оператора.
   */
  private async assertCellIsEmpty(cell: MarketplaceStorageCellDomainEntity): Promise<void> {
    const [items, containers] = await Promise.all([
      this.inventoryRepo.countOnWarehouseByCell(cell.coopname, cell.id),
      this.containerRepo.countByCell(cell.coopname, cell.id),
    ]);
    if (containers > 0) {
      throw new ConflictException(
        `В ячейке «${cell.code}» стоят боксы (${containers}). Переставьте их, прежде чем выводить ячейку из оборота.`
      );
    }
    if (items > 0) {
      throw new ConflictException(
        `В ячейке «${cell.code}» лежит имущество (позиций: ${items}). Переложите его, прежде чем выводить ячейку из оборота.`
      );
    }
  }

  private assertCoordinates(section: string, level: number): void {
    if (!section.trim()) {
      throw new BadRequestException('Укажите секцию.');
    }
    if (!Number.isInteger(level) || level < 1) {
      throw new BadRequestException('Ярус задаётся целым числом от 1.');
    }
  }
}
