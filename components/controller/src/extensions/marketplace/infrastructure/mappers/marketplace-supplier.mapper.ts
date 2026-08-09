import { Injectable } from '@nestjs/common';
import { MarketplaceSupplierDomainEntity } from '../../domain/entities/marketplace-supplier.entity';
import {
  MarketplaceSupplierModel,
  MarketplaceSupplierStatus,
} from '../../domain/entities/marketplace-supplier.types';
import { MarketplaceSupplierEntity } from '../entities/marketplace-supplier.entity';

@Injectable()
export class MarketplaceSupplierMapper {
  toDomain(row: MarketplaceSupplierEntity): MarketplaceSupplierDomainEntity {
    return new MarketplaceSupplierDomainEntity({
      id: row.id,
      coopname: row.coopname,
      member_account: row.member_account,
      model: row.model as MarketplaceSupplierModel,
      status: row.status as MarketplaceSupplierStatus,
      contract_number: row.contract_number,
      contract_date: row.contract_date,
      contract_document_url: row.contract_document_url,
      requested_by: row.requested_by,
      requested_at: row.requested_at,
      reviewed_by: row.reviewed_by,
      reviewed_at: row.reviewed_at,
    });
  }
}
