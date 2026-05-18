import { Injectable } from '@nestjs/common';
import { MarketplaceShipmentDomainEntity } from '../../domain/entities/marketplace-shipment.entity';
import { MarketplaceShipmentEntity } from '../entities/marketplace-shipment.entity';

/**
 * Row → domain для Shipment'а. PG-only сущность.
 */
@Injectable()
export class MarketplaceShipmentMapper {
  toDomain(row: MarketplaceShipmentEntity): MarketplaceShipmentDomainEntity {
    return new MarketplaceShipmentDomainEntity({
      id: row.id,
      coopname: row.coopname,
      cycle_id: row.cycle_id,
      offerer_account: row.offerer_account,
      braname: row.braname,
      delivery_variant: row.delivery_variant,
      total_amount: row.total_amount,
      ttn_number: row.ttn_number,
      ttn_data: row.ttn_data,
      ttn_document_id: row.ttn_document_id,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
