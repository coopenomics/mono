import { Injectable } from '@nestjs/common';
import { MarketplaceInventoryDomainEntity } from '../../domain/entities/marketplace-inventory.entity';
import { MarketplaceInventoryEntity } from '../entities/marketplace-inventory.entity';

@Injectable()
export class MarketplaceInventoryMapper {
  toDomain(row: MarketplaceInventoryEntity): MarketplaceInventoryDomainEntity {
    return new MarketplaceInventoryDomainEntity({
      id: row.id,
      coopname: row.coopname,
      barcode_value: row.barcode_value,
      barcode_format: row.barcode_format,
      order_id: row.order_id,
      shipment_id: row.shipment_id,
      braname: row.braname,
      status: row.status,
      product_name_snapshot: row.product_name_snapshot,
      quantity_per_label: row.quantity_per_label,
      orderer_account_snapshot: row.orderer_account_snapshot,
      labeled_at: row.labeled_at,
      labeled_by_operator_account: row.labeled_by_operator_account,
      expiry_date: row.expiry_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
