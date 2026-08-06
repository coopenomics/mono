import type {
  MarketplaceContainerDomainEntity,
  MarketplaceContainerTypeDomainEntity,
} from '../entities/marketplace-container.entity';

export const MARKETPLACE_CONTAINER_REPOSITORY = Symbol('MARKETPLACE_CONTAINER_REPOSITORY');
export const MARKETPLACE_CONTAINER_TYPE_REPOSITORY = Symbol('MARKETPLACE_CONTAINER_TYPE_REPOSITORY');

export interface MarketplaceContainerTypeCreateInput {
  coopname: string;
  name: string;
  length_mm: number;
  width_mm: number;
  height_mm: number;
  /** Полезный объём; не задан — считается из габаритов. */
  volume_liters?: string;
  max_weight_kg?: string | null;
}

export interface MarketplaceContainerTypePatch {
  name?: string;
  volume_liters?: string;
  max_weight_kg?: string | null;
  is_active?: boolean;
}

export interface MarketplaceContainerTypeDomainRepository {
  create(input: MarketplaceContainerTypeCreateInput): Promise<MarketplaceContainerTypeDomainEntity>;
  findById(id: string): Promise<MarketplaceContainerTypeDomainEntity | null>;
  list(coopname: string, is_active?: boolean): Promise<MarketplaceContainerTypeDomainEntity[]>;
  update(id: string, patch: MarketplaceContainerTypePatch): Promise<MarketplaceContainerTypeDomainEntity | null>;
}

export interface MarketplaceContainerCreateInput {
  coopname: string;
  braname: string;
  code: string;
  label?: string | null;
  container_type_id: string;
  cell_id?: string | null;
}

export interface MarketplaceContainerListFilter {
  coopname: string;
  /** Массив branames — для скоупинга оператора по своим КУ. */
  braname?: string | string[];
  is_active?: boolean;
  container_type_id?: string;
  cell_id?: string;
  /** Только боксы без адреса (`cell_id IS NULL`). */
  unplaced_only?: boolean;
}

export interface MarketplaceContainerPatch {
  label?: string | null;
  is_active?: boolean;
  cell_id?: string | null;
}

export interface MarketplaceContainerDomainRepository {
  createBatch(inputs: readonly MarketplaceContainerCreateInput[]): Promise<MarketplaceContainerDomainEntity[]>;

  findById(id: string): Promise<MarketplaceContainerDomainEntity | null>;

  /** Резолв отсканированного QR: код уникален в пределах кооператива. */
  findByCode(coopname: string, code: string): Promise<MarketplaceContainerDomainEntity | null>;

  list(filter: MarketplaceContainerListFilter): Promise<MarketplaceContainerDomainEntity[]>;

  update(id: string, patch: MarketplaceContainerPatch): Promise<MarketplaceContainerDomainEntity | null>;

  /** Сколько боксов стоит в ячейке — опора гарда «непустую не выводить». */
  countByCell(coopname: string, cell_id: string): Promise<number>;

  /**
   * Наибольший занятый порядковый номер в кодах боксов кооператива — опора
   * генерации следующей партии кодов. 0, если боксов ещё нет.
   */
  maxCodeSequence(coopname: string): Promise<number>;
}
