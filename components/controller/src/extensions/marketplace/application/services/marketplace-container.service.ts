import { Inject, Injectable } from '@nestjs/common';
import type {
  MarketplaceContainerDomainEntity,
  MarketplaceContainerTypeDomainEntity,
} from '../../domain/entities/marketplace-container.entity';
import {
  buildContainerCode,
  computeVolumeM3,
} from '../../domain/entities/marketplace-container.types';
import {
  MARKETPLACE_CONTAINER_REPOSITORY,
  MARKETPLACE_CONTAINER_TYPE_REPOSITORY,
  type MarketplaceContainerCreateInput,
  type MarketplaceContainerDomainRepository,
  type MarketplaceContainerListFilter,
  type MarketplaceContainerTypeDomainRepository,
} from '../../domain/repositories/marketplace-container.repository';
import {
  MARKETPLACE_INVENTORY_REPOSITORY,
  type MarketplaceInventoryDomainRepository,
} from '../../domain/repositories/marketplace-inventory.repository';
import {
  MARKETPLACE_STORAGE_CELL_REPOSITORY,
  type MarketplaceStorageCellDomainRepository,
} from '../../domain/repositories/marketplace-storage-cell.repository';
import { t as i18nT } from '../../i18n';
import { DomainError } from '@coopenomics/extension-kit';

/** Потолок на одну партию боксов — защита от опечатки в количестве. */
const MAX_CONTAINERS_PER_BATCH = 200;

/** Попыток перегенерировать коды, если параллельная партия заняла номера. */
const CODE_ALLOCATION_ATTEMPTS = 3;

export interface CreateContainerTypeInput {
  coopname: string;
  name: string;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  volume_m3?: string | null;
  max_weight_kg?: string | null;
}

export interface CreateContainersInput {
  coopname: string;
  braname: string;
  container_type_id: string;
  count: number;
  label?: string | null;
}

export interface MoveContainerInput {
  coopname: string;
  container_id: string;
  /** Ячейка назначения; NULL — снять бокс с адреса. */
  cell_id: string | null;
}

export interface UpdateContainerInput {
  coopname: string;
  container_id: string;
  label?: string | null;
  is_active?: boolean;
}

/**
 * Реестр боксов кооперативного участка и справочник их типов.
 *
 * Скоупинг по участку («свои КУ») делает вызывающий resolver — сервис работает
 * с уже разрешёнными branames, как и остальные сервисы расширения.
 */
@Injectable()
export class MarketplaceContainerService {
  constructor(
    @Inject(MARKETPLACE_CONTAINER_REPOSITORY)
    private readonly containerRepo: MarketplaceContainerDomainRepository,
    @Inject(MARKETPLACE_CONTAINER_TYPE_REPOSITORY)
    private readonly typeRepo: MarketplaceContainerTypeDomainRepository,
    @Inject(MARKETPLACE_STORAGE_CELL_REPOSITORY)
    private readonly cellRepo: MarketplaceStorageCellDomainRepository,
    @Inject(MARKETPLACE_INVENTORY_REPOSITORY)
    private readonly inventoryRepo: MarketplaceInventoryDomainRepository
  ) {}

  // ── Типы боксов ───────────────────────────────────────────────────────

  async createType(input: CreateContainerTypeInput): Promise<MarketplaceContainerTypeDomainEntity> {
    for (const [label, value] of [
      [i18nT('marketplace.container.lengthLabel'), input.length_cm],
      [i18nT('marketplace.container.widthLabel'), input.width_cm],
      [i18nT('marketplace.container.heightLabel'), input.height_cm],
    ] as const) {
      if (!Number.isFinite(value) || value <= 0) {
        throw DomainError.badRequest('MARKETPLACE_CONTAINER_DIMENSION_MUST_BE_POSITIVE', { label });
      }
    }
    if (!input.name.trim()) {
      throw DomainError.badRequest('MARKETPLACE_CONTAINER_TYPE_NAME_REQUIRED');
    }
    return this.typeRepo.create({
      coopname: input.coopname,
      name: input.name,
      length_cm: input.length_cm,
      width_cm: input.width_cm,
      height_cm: input.height_cm,
      // Объём можно задать вручную — у тары неправильной формы габаритный
      // объём завышен, и для расчёта транспорта важен полезный.
      volume_m3:
        input.volume_m3 ??
        computeVolumeM3(input.length_cm, input.width_cm, input.height_cm),
      max_weight_kg: input.max_weight_kg ?? null,
    });
  }

  async listTypes(coopname: string, is_active?: boolean): Promise<MarketplaceContainerTypeDomainEntity[]> {
    return this.typeRepo.list(coopname, is_active);
  }

  // ── Боксы ─────────────────────────────────────────────────────────────

  /**
   * Заводит партию боксов одного типа с последовательными кодами. Коды
   * выделяются от текущего максимума; при гонке с параллельной партией
   * уникальный индекс отбивает вставку, и мы перевыделяем номера.
   */
  async createContainers(input: CreateContainersInput): Promise<MarketplaceContainerDomainEntity[]> {
    if (!Number.isInteger(input.count) || input.count < 1) {
      throw DomainError.badRequest('MARKETPLACE_CONTAINER_COUNT_INVALID');
    }
    if (input.count > MAX_CONTAINERS_PER_BATCH) {
      throw DomainError.badRequest('MARKETPLACE_CONTAINER_BATCH_LIMIT_EXCEEDED', { maxPerBatch: MAX_CONTAINERS_PER_BATCH, requestedCount: input.count });
    }
    const type = await this.typeRepo.findById(input.container_type_id);
    if (!type || type.coopname !== input.coopname) {
      throw DomainError.notFound('MARKETPLACE_CONTAINER_TYPE_NOT_FOUND');
    }

    for (let attempt = 1; attempt <= CODE_ALLOCATION_ATTEMPTS; attempt++) {
      const startFrom = (await this.containerRepo.maxCodeSequence(input.coopname)) + 1;
      const batch: MarketplaceContainerCreateInput[] = [];
      for (let i = 0; i < input.count; i++) {
        batch.push({
          coopname: input.coopname,
          braname: input.braname,
          code: buildContainerCode(startFrom + i),
          label: input.label ?? null,
          container_type_id: input.container_type_id,
          cell_id: null,
        });
      }
      try {
        return await this.containerRepo.createBatch(batch);
      } catch (error) {
        if (attempt === CODE_ALLOCATION_ATTEMPTS) {
          throw DomainError.conflict('MARKETPLACE_CONTAINER_CODE_ALLOCATION_FAILED');
        }
      }
    }
    // Недостижимо: цикл либо возвращает партию, либо бросает на последней попытке.
    return [];
  }

  /**
   * Боксы кооператива. `branames` не задан — без ограничения по участкам (так
   * реестр стола администратора видит тару всего кооператива).
   */
  async list(
    coopname: string,
    branames?: string | string[],
    options?: Omit<MarketplaceContainerListFilter, 'coopname' | 'braname'>
  ): Promise<MarketplaceContainerDomainEntity[]> {
    return this.containerRepo.list({ coopname, braname: branames, ...options });
  }

  async getById(coopname: string, id: string): Promise<MarketplaceContainerDomainEntity> {
    const container = await this.containerRepo.findById(id);
    if (!container || container.coopname !== coopname) {
      throw DomainError.notFound('MARKETPLACE_CONTAINER_NOT_FOUND');
    }
    return container;
  }

  /** Резолв отсканированного QR. */
  async getByCode(coopname: string, code: string): Promise<MarketplaceContainerDomainEntity> {
    const container = await this.containerRepo.findByCode(coopname, code);
    if (!container) {
      throw DomainError.notFound('MARKETPLACE_CONTAINER_NOT_FOUND_BY_CODE', { code });
    }
    return container;
  }

  /**
   * Ставит бокс в ячейку или снимает с адреса. Бокс без адреса — штатное
   * состояние: наполнил и поставил в угол.
   */
  async moveToCell(input: MoveContainerInput): Promise<MarketplaceContainerDomainEntity> {
    const container = await this.getById(input.coopname, input.container_id);

    if (input.cell_id !== null) {
      const cell = await this.cellRepo.findById(input.cell_id);
      if (!cell || cell.coopname !== input.coopname) {
        throw DomainError.notFound('MARKETPLACE_CELL_NOT_FOUND');
      }
      // Бокс и ячейка обязаны быть на одном участке: иначе имущество
      // «переехало» бы между КУ мимо процесса передачи.
      if (cell.braname !== container.braname) {
        throw DomainError.conflict('MARKETPLACE_CONTAINER_CELL_BRANCH_MISMATCH', { containerBranch: container.braname, cellCode: cell.code, cellBranch: cell.braname });
      }
      if (!cell.is_active) {
        throw DomainError.conflict('MARKETPLACE_CELL_DECOMMISSIONED', { cellCode: cell.code });
      }
    }

    const updated = await this.containerRepo.update(input.container_id, { cell_id: input.cell_id });
    if (!updated) throw DomainError.notFound('MARKETPLACE_CONTAINER_NOT_FOUND');
    return updated;
  }

  async update(input: UpdateContainerInput): Promise<MarketplaceContainerDomainEntity> {
    const container = await this.getById(input.coopname, input.container_id);

    // Вывести из оборота можно только пустой бокс: иначе имущество осталось бы
    // числиться в таре, которой для оператора больше нет.
    if (input.is_active === false && container.is_active) {
      const occupied = await this.inventoryRepo.countOnWarehouseByContainer(
        input.coopname,
        container.id
      );
      if (occupied > 0) {
        throw DomainError.conflict('MARKETPLACE_CONTAINER_NOT_EMPTY', { containerCode: container.code, occupiedCount: occupied });
      }
    }

    const updated = await this.containerRepo.update(input.container_id, {
      label: input.label,
      is_active: input.is_active,
    });
    if (!updated) throw DomainError.notFound('MARKETPLACE_CONTAINER_NOT_FOUND');
    return updated;
  }

  /**
   * Суммарный объём выборки боксов в кубометрах — опора расчёта потребного объёма
   * транспорта при передаче боксов между участками.
   */
  async sumVolumeM3(
    coopname: string,
    containers: readonly MarketplaceContainerDomainEntity[]
  ): Promise<string> {
    if (containers.length === 0) return '0.000';
    const types = await this.typeRepo.list(coopname);
    const volumeByType = new Map(types.map((t) => [t.id, Number(t.volume_m3)]));
    const total = containers.reduce(
      (sum, container) => sum + (volumeByType.get(container.container_type_id) ?? 0),
      0
    );
    return total.toFixed(3);
  }
}
