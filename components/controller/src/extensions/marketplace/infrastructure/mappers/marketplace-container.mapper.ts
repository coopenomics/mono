import { Injectable } from '@nestjs/common';
import {
  MarketplaceContainerDomainEntity,
  MarketplaceContainerTypeDomainEntity,
} from '../../domain/entities/marketplace-container.entity';
import {
  MarketplaceContainerEntity,
  MarketplaceContainerTypeEntity,
} from '../entities/marketplace-container.entity';

@Injectable()
export class MarketplaceContainerTypeMapper {
  toDomain(row: MarketplaceContainerTypeEntity): MarketplaceContainerTypeDomainEntity {
    return new MarketplaceContainerTypeDomainEntity({
      id: row.id,
      coopname: row.coopname,
      name: row.name,
      length_mm: row.length_mm,
      width_mm: row.width_mm,
      height_mm: row.height_mm,
      volume_liters: row.volume_liters,
      max_weight_kg: row.max_weight_kg,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}

@Injectable()
export class MarketplaceContainerMapper {
  toDomain(row: MarketplaceContainerEntity): MarketplaceContainerDomainEntity {
    return new MarketplaceContainerDomainEntity({
      id: row.id,
      coopname: row.coopname,
      braname: row.braname,
      code: row.code,
      label: row.label,
      container_type_id: row.container_type_id,
      cell_id: row.cell_id,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
