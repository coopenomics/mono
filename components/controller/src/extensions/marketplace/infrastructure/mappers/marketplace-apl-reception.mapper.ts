import { Injectable } from '@nestjs/common';
import { MarketplaceAplReceptionDomainEntity } from '../../domain/entities/marketplace-apl-reception.entity';
import { MarketplaceAplReceptionEntity } from '../entities/marketplace-apl-reception.entity';

@Injectable()
export class MarketplaceAplReceptionMapper {
  toDomain(row: MarketplaceAplReceptionEntity): MarketplaceAplReceptionDomainEntity {
    return new MarketplaceAplReceptionDomainEntity({
      id: row.id,
      coopname: row.coopname,
      shipment_id: row.shipment_id,
      cycle_id: row.cycle_id,
      braname: row.braname,
      offerer_account: row.offerer_account,
      variant: row.variant,
      status: row.status,
      fact_quantity_per_order: row.fact_quantity_per_order,
      ttn_number: row.ttn_number,
      expeditor_data: row.expeditor_data,
      created_by_operator_account: row.created_by_operator_account,
      supplier_signed_at: row.supplier_signed_at,
      supplier_signsupp_tx_hash: row.supplier_signsupp_tx_hash,
      supplier_signed_documents: row.supplier_signed_documents,
      chairman_signed_at: row.chairman_signed_at,
      chairman_account: row.chairman_account,
      chairman_signchair_tx_hash: row.chairman_signchair_tx_hash,
      total_amount: row.total_amount,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
