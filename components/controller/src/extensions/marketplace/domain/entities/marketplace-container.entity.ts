import type {
  MarketplaceContainerProps,
  MarketplaceContainerTypeProps,
} from './marketplace-container.types';

/** Тип тары кооператива: габариты и объём, общие для всей закупленной партии. */
export class MarketplaceContainerTypeDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly name: string;
  public readonly length_mm: number;
  public readonly width_mm: number;
  public readonly height_mm: number;
  public readonly volume_liters: string;
  public readonly max_weight_kg: string | null;
  public readonly is_active: boolean;
  public readonly created_at: Date;
  public readonly updated_at: Date;

  constructor(props: MarketplaceContainerTypeProps) {
    if (!props.name.trim()) {
      throw new Error('MarketplaceContainerTypeDomainEntity: название типа не может быть пустым.');
    }
    for (const [label, value] of [
      ['длина', props.length_mm],
      ['ширина', props.width_mm],
      ['высота', props.height_mm],
    ] as const) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`MarketplaceContainerTypeDomainEntity: ${label} должна быть положительной.`);
      }
    }
    this.id = props.id;
    this.coopname = props.coopname;
    this.name = props.name;
    this.length_mm = props.length_mm;
    this.width_mm = props.width_mm;
    this.height_mm = props.height_mm;
    this.volume_liters = props.volume_liters;
    this.max_weight_kg = props.max_weight_kg ?? null;
    this.is_active = props.is_active;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }
}

/**
 * Бокс кооперативного участка. Размещение необязательно: `cell_id === null`
 * означает «наполнен и стоит без адреса», а не «операция не доведена».
 */
export class MarketplaceContainerDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly braname: string;
  public readonly code: string;
  public readonly label: string | null;
  public readonly container_type_id: string;
  public readonly cell_id: string | null;
  public readonly is_active: boolean;
  public readonly created_at: Date;
  public readonly updated_at: Date;

  constructor(props: MarketplaceContainerProps) {
    if (!props.code.trim()) {
      throw new Error('MarketplaceContainerDomainEntity: код бокса не может быть пустым.');
    }
    this.id = props.id;
    this.coopname = props.coopname;
    this.braname = props.braname;
    this.code = props.code;
    this.label = props.label ?? null;
    this.container_type_id = props.container_type_id;
    this.cell_id = props.cell_id ?? null;
    this.is_active = props.is_active;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }
}
