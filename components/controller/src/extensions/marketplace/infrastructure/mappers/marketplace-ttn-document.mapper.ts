import { Injectable } from '@nestjs/common';
import { MarketplaceTtnDocumentDomainEntity } from '../../domain/entities/marketplace-ttn-document.entity';
import { MarketplaceTtnDocumentEntity } from '../entities/marketplace-ttn-document.entity';

@Injectable()
export class MarketplaceTtnDocumentMapper {
  toDomain(row: MarketplaceTtnDocumentEntity): MarketplaceTtnDocumentDomainEntity {
    return new MarketplaceTtnDocumentDomainEntity({
      id: row.id,
      coopname: row.coopname,
      shipment_id: row.shipment_id,
      ttn_number: row.ttn_number,
      registry_id: row.registry_id,
      document_hash: row.document_hash,
      content_html: row.content_html,
      meta: row.meta,
      supplier_account: row.supplier_account,
      accept_braname: row.accept_braname,
      total_amount: row.total_amount,
      currency: row.currency,
      ttn_data: row.ttn_data,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
