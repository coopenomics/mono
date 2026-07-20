import { Injectable } from '@nestjs/common';
import { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';
import { MarketplaceOfferEntity } from '../entities/marketplace-offer.entity';

@Injectable()
export class MarketplaceOfferMapper {
  toDomain(row: MarketplaceOfferEntity): MarketplaceOfferDomainEntity {
    return new MarketplaceOfferDomainEntity({
      id: row.id,
      coopname: row.coopname,
      supplier_account: row.supplier_account,
      vitrine_id: row.vitrine_id,
      product_name: row.product_name,
      description: row.description,
      category_id: row.category_id,
      price_per_unit: row.price_per_unit,
      unit_of_measure: row.unit_of_measure,
      quantity_available: row.quantity_available,
      quantity_blocked: row.quantity_blocked,
      quantity_consumed: row.quantity_consumed,
      unlimited_flag: row.unlimited_flag,
      delivery_points: row.delivery_points ?? [],
      warranty_days: row.warranty_days,
      barcode_strategy: row.barcode_strategy,
      pack_size: row.pack_size,
      images: row.images ?? [],
      stock_braname: row.stock_braname,
      stock_origin_offer_id: row.stock_origin_offer_id,
      status: row.status,
      approved_by: row.approved_by,
      approved_at: row.approved_at,
      rejected_by: row.rejected_by,
      rejected_at: row.rejected_at,
      reject_reason: row.reject_reason,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
