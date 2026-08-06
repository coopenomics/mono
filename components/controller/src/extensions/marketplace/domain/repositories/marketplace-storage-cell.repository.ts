import type { MarketplaceStorageCellDomainEntity } from '../entities/marketplace-storage-cell.entity';

export const MARKETPLACE_STORAGE_CELL_REPOSITORY = Symbol('MARKETPLACE_STORAGE_CELL_REPOSITORY');

export interface MarketplaceStorageCellCreateInput {
  coopname: string;
  braname: string;
  section: string;
  level: number;
  /** Адрес ячейки; если не задан — выводится из координат. */
  code?: string;
  label?: string | null;
}

export interface MarketplaceStorageCellListFilter {
  coopname: string;
  /** Массив branames — для скоупинга оператора по своим КУ. */
  braname?: string | string[];
  /** Только действующие ячейки (по умолчанию отдаются все). */
  is_active?: boolean;
  section?: string;
}

export interface MarketplaceStorageCellPatch {
  label?: string | null;
  is_active?: boolean;
}

export interface MarketplaceStorageCellDomainRepository {
  /**
   * Заводит ячейку. Конфликт координат или адреса в пределах участка —
   * ConflictException: на одном складе не может быть двух ячеек с одним адресом.
   */
  create(input: MarketplaceStorageCellCreateInput): Promise<MarketplaceStorageCellDomainEntity>;

  /**
   * Заводит сетку ячеек пачкой. Уже существующие координаты пропускаются, а не
   * роняют операцию: «добавить ярус к стеллажу» — обычная повторяющаяся
   * операция, и оператор не должен вычитать вручную, чего ещё нет.
   * Возвращает только реально созданные ячейки.
   */
  createGrid(
    inputs: readonly MarketplaceStorageCellCreateInput[]
  ): Promise<MarketplaceStorageCellDomainEntity[]>;

  findById(id: string): Promise<MarketplaceStorageCellDomainEntity | null>;

  findByCode(
    coopname: string,
    braname: string,
    code: string
  ): Promise<MarketplaceStorageCellDomainEntity | null>;

  list(filter: MarketplaceStorageCellListFilter): Promise<MarketplaceStorageCellDomainEntity[]>;

  update(
    id: string,
    patch: MarketplaceStorageCellPatch
  ): Promise<MarketplaceStorageCellDomainEntity | null>;
}
