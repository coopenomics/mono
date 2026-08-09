import type {
  MarketplaceContainerProps,
  MarketplaceContainerTypeProps,
} from './marketplace-container.types';

/** Тип тары кооператива: габариты и объём, общие для всей закупленной партии. */
export class MarketplaceContainerTypeDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly name: string;
  public readonly length_cm: number;
  public readonly width_cm: number;
  public readonly height_cm: number;
  public readonly volume_m3: string;
  public readonly max_weight_kg: string | null;
  public readonly is_active: boolean;
  public readonly created_at: Date;
  public readonly updated_at: Date;

  constructor(props: MarketplaceContainerTypeProps) {
    if (!props.name.trim()) {
      throw new Error('MarketplaceContainerTypeDomainEntity: название типа не может быть пустым.');
    }
    for (const [label, value] of [
      ['длина', props.length_cm],
      ['ширина', props.width_cm],
      ['высота', props.height_cm],
    ] as const) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`MarketplaceContainerTypeDomainEntity: ${label} должна быть положительной.`);
      }
    }
    this.id = props.id;
    this.coopname = props.coopname;
    this.name = props.name;
    this.length_cm = props.length_cm;
    this.width_cm = props.width_cm;
    this.height_cm = props.height_cm;
    this.volume_m3 = props.volume_m3;
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
