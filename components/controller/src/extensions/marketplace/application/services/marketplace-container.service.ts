import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

/** Потолок на одну партию боксов — защита от опечатки в количестве. */
const MAX_CONTAINERS_PER_BATCH = 200;

/** Попыток перегенерировать коды, если параллельная партия заняла номера. */
const CODE_ALLOCATION_ATTEMPTS = 3;

export interface CreateContainerTypeInput {
  coopname: string;
  name: string;
  length_mm: number;
  width_mm: number;
  height_mm: number;
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
      ['Длина', input.length_mm],
      ['Ширина', input.width_mm],
      ['Высота', input.height_mm],
    ] as const) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new BadRequestException(`${label} должна быть больше нуля.`);
      }
    }
    if (!input.name.trim()) {
      throw new BadRequestException('Укажите название типа боксов.');
    }
    return this.typeRepo.create({
      coopname: input.coopname,
      name: input.name,
      length_mm: input.length_mm,
      width_mm: input.width_mm,
      height_mm: input.height_mm,
      // Объём можно задать вручную — у тары неправильной формы габаритный
      // объём завышен, и для расчёта транспорта важен полезный.
      volume_m3:
        input.volume_m3 ??
        computeVolumeM3(input.length_mm, input.width_mm, input.height_mm),
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
      throw new BadRequestException('Количество боксов задаётся целым числом от 1.');
    }
    if (input.count > MAX_CONTAINERS_PER_BATCH) {
      throw new BadRequestException(
        `За один раз можно завести не больше ${MAX_CONTAINERS_PER_BATCH} боксов (запрошено ${input.count}).`
      );
    }
    const type = await this.typeRepo.findById(input.container_type_id);
    if (!type || type.coopname !== input.coopname) {
      throw new NotFoundException('Тип боксов не найден.');
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
          throw new ConflictException(
            'Не удалось выделить коды боксов — попробуйте ещё раз.'
          );
        }
      }
    }
    // Недостижимо: цикл либо возвращает партию, либо бросает на последней попытке.
    return [];
  }

  async list(
    coopname: string,
    branames: string | string[],
    options?: Omit<MarketplaceContainerListFilter, 'coopname' | 'braname'>
  ): Promise<MarketplaceContainerDomainEntity[]> {
    return this.containerRepo.list({ coopname, braname: branames, ...options });
  }

  async getById(coopname: string, id: string): Promise<MarketplaceContainerDomainEntity> {
    const container = await this.containerRepo.findById(id);
    if (!container || container.coopname !== coopname) {
      throw new NotFoundException('Бокс не найден.');
    }
    return container;
  }

  /** Резолв отсканированного QR. */
  async getByCode(coopname: string, code: string): Promise<MarketplaceContainerDomainEntity> {
    const container = await this.containerRepo.findByCode(coopname, code);
    if (!container) {
      throw new NotFoundException(`Бокс с кодом «${code}» не найден.`);
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
        throw new NotFoundException('Ячейка не найдена.');
      }
      // Бокс и ячейка обязаны быть на одном участке: иначе имущество
      // «переехало» бы между КУ мимо процесса передачи.
      if (cell.braname !== container.braname) {
        throw new ConflictException(
          `Бокс числится за участком ${container.braname}, а ячейка «${cell.code}» — за ${cell.braname}.`
        );
      }
      if (!cell.is_active) {
        throw new ConflictException(`Ячейка «${cell.code}» выведена из оборота.`);
      }
    }

    const updated = await this.containerRepo.update(input.container_id, { cell_id: input.cell_id });
    if (!updated) throw new NotFoundException('Бокс не найден.');
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
        throw new ConflictException(
          `В боксе «${container.code}» лежит имущество (позиций: ${occupied}). Переложите его, прежде чем выводить бокс из оборота.`
        );
      }
    }

    const updated = await this.containerRepo.update(input.container_id, {
      label: input.label,
      is_active: input.is_active,
    });
    if (!updated) throw new NotFoundException('Бокс не найден.');
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
