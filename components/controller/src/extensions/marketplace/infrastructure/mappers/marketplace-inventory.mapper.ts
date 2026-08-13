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
      shelf: row.shelf,
      cell_id: row.cell_id,
      container_id: row.container_id,
      // Legacy-записи (промаркированы до перехода на приёмочную модель) не имеют
      // received_at/by — берём created_at и оператора маркировки как опору.
      received_at: row.received_at ?? row.created_at,
      received_by_operator_account:
        row.received_by_operator_account ?? row.labeled_by_operator_account ?? '',
      labeled_at: row.labeled_at,
      labeled_by_operator_account: row.labeled_by_operator_account,
      expiry_date: row.expiry_date,
      ownership: row.ownership,
      arrival_price: row.arrival_price,
      package_size: row.package_size,
      unit_of_measure: row.unit_of_measure,
      published_offer_id: row.published_offer_id,
      reserved_order_id: row.reserved_order_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
