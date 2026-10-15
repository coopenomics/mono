import { Inject, Injectable, NotFoundException } from '@nestjs/common';
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
import { t } from '../../i18n';
import { DomainError } from '@coopenomics/extension-kit';

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

export interface RenameStorageSectionInput {
  coopname: string;
  braname: string;
  /** Секция, которую переименовывают. */
  section: string;
  /** Новое название секции. */
  new_section: string;
}

export interface RetireStorageCellsInput {
  coopname: string;
  braname: string;
  /** Секция целиком — столбец карты склада. */
  section?: string | null;
  /** Ярус целиком — строка карты склада. */
  level?: number | null;
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
      throw DomainError.badRequest('MARKETPLACE_STORAGE_CELL_SECTION_REQUIRED');
    }
    if (new Set(sections).size !== sections.length) {
      throw DomainError.badRequest('MARKETPLACE_STORAGE_CELL_SECTIONS_DUPLICATE');
    }
    if (!Number.isInteger(input.level_from) || !Number.isInteger(input.level_to)) {
      throw DomainError.badRequest('MARKETPLACE_STORAGE_CELL_LEVELS_MUST_BE_INTEGERS');
    }
    if (input.level_from < 1 || input.level_to < input.level_from) {
      throw DomainError.badRequest('MARKETPLACE_STORAGE_CELL_LEVEL_RANGE_INVALID');
    }

    const levelsCount = input.level_to - input.level_from + 1;
    const total = sections.length * levelsCount;
    if (total > MAX_GRID_CELLS_PER_CALL) {
      throw DomainError.badRequest('MARKETPLACE_STORAGE_CELL_BATCH_LIMIT', { maxCells: MAX_GRID_CELLS_PER_CALL, total });
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

  /**
   * Ячейки склада. `branames` не задан — без ограничения по участкам (так
   * реестр стола администратора видит сетку всего кооператива).
   */
  async list(
    coopname: string,
    branames?: string | string[],
    options?: { is_active?: boolean }
  ): Promise<MarketplaceStorageCellDomainEntity[]> {
    return this.cellRepo.list({ coopname, braname: branames, is_active: options?.is_active });
  }

  async getById(coopname: string, id: string): Promise<MarketplaceStorageCellDomainEntity> {
    const cell = await this.cellRepo.findById(id);
    if (!cell || cell.coopname !== coopname) {
      throw DomainError.notFound('MARKETPLACE_STORAGE_CELL_NOT_FOUND');
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
      throw DomainError.notFound('MARKETPLACE_STORAGE_CELL_NOT_FOUND');
    }
    return updated;
  }

  /**
   * Переименовывает секцию склада: «A» → «Холодильник». Адреса всех её ячеек
   * пересобираются («A-02» → «Холодильник-02»).
   *
   * Склад описывают по месту, и имя секции часто становится известно позже
   * координаты: сначала ставят стеллаж, потом понимают, что это холодильник.
   */
  async renameSection(input: RenameStorageSectionInput): Promise<MarketplaceStorageCellDomainEntity[]> {
    const from = input.section.trim();
    const to = input.new_section.trim();
    if (!from) {
      throw DomainError.badRequest('MARKETPLACE_STORAGE_CELL_RENAME_SECTION_REQUIRED');
    }
    if (!to) {
      throw DomainError.badRequest('MARKETPLACE_STORAGE_CELL_SECTION_NAME_EMPTY');
    }
    if (from === to) {
      return this.cellRepo.list({
        coopname: input.coopname,
        braname: input.braname,
        section: from,
      });
    }

    // Слияние секций запрещено: у ячеек совпали бы адреса, и склад потерял бы
    // однозначность — по «Холодильник-02» нашлось бы два разных места.
    const occupied = await this.cellRepo.list({
      coopname: input.coopname,
      braname: input.braname,
      section: to,
    });
    if (occupied.length > 0) {
      throw DomainError.conflict('MARKETPLACE_STORAGE_CELL_SECTION_NAME_TAKEN', { to });
    }

    const renamed = await this.cellRepo.renameSection({
      coopname: input.coopname,
      braname: input.braname,
      section: from,
      new_section: to,
    });
    if (renamed.length === 0) {
      throw DomainError.notFound('MARKETPLACE_STORAGE_CELL_SECTION_NOT_FOUND', { from });
    }
    return renamed;
  }

  /**
   * Выводит из оборота целую секцию (столбец) или целый ярус (строку).
   *
   * Сетку склада перебирают: стеллаж убрали, ярус разобрали. Поячеечный вывод
   * заставлял бы щёлкать по каждому адресу, поэтому операция принимает
   * координату целиком — но правило прежнее: выводится только пустое.
   */
  async retireCells(input: RetireStorageCellsInput): Promise<MarketplaceStorageCellDomainEntity[]> {
    const section = input.section?.trim();
    const hasSection = Boolean(section);
    const hasLevel = input.level !== undefined && input.level !== null;
    if (hasSection === hasLevel) {
      throw DomainError.badRequest('MARKETPLACE_STORAGE_CELL_SECTION_OR_LEVEL_ONLY');
    }

    const cells = await this.cellRepo.list({
      coopname: input.coopname,
      braname: input.braname,
      is_active: true,
      ...(hasSection ? { section } : {}),
    });
    const target = hasSection ? cells : cells.filter((c) => c.level === input.level);
    if (target.length === 0) {
      throw new NotFoundException(
        hasSection
          ? t('marketplace.storageCell.sectionNotFoundMessage', { section })
          : t('marketplace.storageCell.levelNotFoundMessage', { level: input.level })
      );
    }

    // Занятость проверяется до вывода, чтобы не оставить сетку наполовину
    // разобранной: либо уходит вся координата, либо ничего.
    const occupied: string[] = [];
    await Promise.all(
      target.map(async (cell) => {
        const [items, containers] = await Promise.all([
          this.inventoryRepo.countOnWarehouseByCell(cell.coopname, cell.id),
          this.containerRepo.countByCell(cell.coopname, cell.id),
        ]);
        if (items > 0 || containers > 0) occupied.push(cell.code);
      })
    );
    if (occupied.length > 0) {
      throw DomainError.conflict('MARKETPLACE_STORAGE_CELL_OCCUPIED_MUST_FREE', { occupiedList: occupied.sort().join(', ') });
    }

    return this.cellRepo.retireMany(target.map((c) => c.id));
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
      throw DomainError.conflict('MARKETPLACE_STORAGE_CELL_HAS_CONTAINERS', { cellCode: cell.code, containers });
    }
    if (items > 0) {
      throw DomainError.conflict('MARKETPLACE_STORAGE_CELL_HAS_ITEMS', { cellCode: cell.code, items });
    }
  }

  private assertCoordinates(section: string, level: number): void {
    if (!section.trim()) {
      throw DomainError.badRequest('MARKETPLACE_STORAGE_CELL_SECTION_REQUIRED_SIMPLE');
    }
    if (!Number.isInteger(level) || level < 1) {
      throw DomainError.badRequest('MARKETPLACE_STORAGE_CELL_LEVEL_INVALID');
    }
  }
}
