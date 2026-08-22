import { Injectable } from '@nestjs/common';
import { MarketplaceStorageCellDomainEntity } from '../../domain/entities/marketplace-storage-cell.entity';
import { MarketplaceStorageCellEntity } from '../entities/marketplace-storage-cell.entity';

@Injectable()
export class MarketplaceStorageCellMapper {
  toDomain(row: MarketplaceStorageCellEntity): MarketplaceStorageCellDomainEntity {
    return new MarketplaceStorageCellDomainEntity({
      id: row.id,
      coopname: row.coopname,
      braname: row.braname,
      section: row.section,
      level: row.level,
      code: row.code,
      label: row.label,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
