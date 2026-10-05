import { TableStore, notEqual, oneOf } from '@coopenomics/extension-kit';
import { MARKETPLACE_APL_RECEPTION_STORE } from '../../infrastructure/database/marketplace-stores';
import { Inject, Injectable } from '@nestjs/common';
import { MarketplaceAplReceptionDomainEntity } from '../../domain/entities/marketplace-apl-reception.entity';
import {
  MarketplaceAplReceptionStatuses,
  type MarketplaceAplReceptionStatus,
} from '../../domain/entities/marketplace-apl-reception.types';
import type {
  MarketplaceAplReceptionCreateInput,
  MarketplaceAplReceptionDomainRepository,
  MarketplaceAplReceptionUpdateSignaturesInput,
} from '../../domain/repositories/marketplace-apl-reception.repository';
import { MarketplaceAplReceptionEntity } from '../entities/marketplace-apl-reception.entity';
import { MarketplaceAplReceptionMapper } from '../mappers/marketplace-apl-reception.mapper';

@Injectable()
export class MarketplaceAplReceptionRepositoryAdapter
  implements MarketplaceAplReceptionDomainRepository
{
  constructor(
    @Inject(MARKETPLACE_APL_RECEPTION_STORE)
private readonly repo: TableStore<MarketplaceAplReceptionEntity>,
    private readonly mapper: MarketplaceAplReceptionMapper
  ) {}

  async create(
    input: MarketplaceAplReceptionCreateInput
  ): Promise<MarketplaceAplReceptionDomainEntity> {
    const row = this.repo.create({
      coopname: input.coopname,
      shipment_id: input.shipment_id,
      cycle_id: input.cycle_id,
      braname: input.braname,
      offerer_account: input.offerer_account,
      variant: input.variant,
      status: input.status,
      fact_quantity_per_order: input.fact_quantity_per_order,
      ttn_number: input.ttn_number,
      expeditor_data: input.expeditor_data,
      created_by_operator_account: input.created_by_operator_account,
      total_amount: input.total_amount,
      supplier_signed_at: null,
      supplier_signsupp_tx_hash: null,
      supplier_signed_documents: null,
      chairman_signed_at: null,
      chairman_account: null,
      chairman_signchair_tx_hash: null,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async findById(id: string): Promise<MarketplaceAplReceptionDomainEntity | null> {
    const row = await this.repo.findOne({ id });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByShipmentId(
    coopname: string,
    shipment_id: string
  ): Promise<MarketplaceAplReceptionDomainEntity | null> {
    // Отменённые приёмки (откат черновика оператором) не считаются активными —
    // иначе повторное открытие приёмки по этой партии заблокировалось бы гардом
    // «одна партия — одна активная АПП».
    const row = await this.repo.findOne({ coopname, shipment_id, status: notEqual(MarketplaceAplReceptionStatuses.CANCELLED) });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByTTNNumber(
    coopname: string,
    ttn_number: string
  ): Promise<MarketplaceAplReceptionDomainEntity | null> {
    const row = await this.repo.findOne({ coopname, ttn_number });
    return row ? this.mapper.toDomain(row) : null;
  }

  async listByBraname(
    coopname: string,
    braname: string,
    status?: MarketplaceAplReceptionStatus | MarketplaceAplReceptionStatus[]
  ): Promise<MarketplaceAplReceptionDomainEntity[]> {
    const where: Record<string, unknown> = { coopname, braname };
    if (status) where.status = Array.isArray(status) ? oneOf(status) : status;
    const rows = await this.repo.find(where, { order: { created_at: 'DESC' } });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async listByOfferer(
    coopname: string,
    offerer_account: string,
    status?: MarketplaceAplReceptionStatus | MarketplaceAplReceptionStatus[]
  ): Promise<MarketplaceAplReceptionDomainEntity[]> {
    const where: Record<string, unknown> = { coopname, offerer_account };
    if (status) where.status = Array.isArray(status) ? oneOf(status) : status;
    const rows = await this.repo.find(where, { order: { created_at: 'DESC' } });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async applySignatures(
    id: string,
    patch: MarketplaceAplReceptionUpdateSignaturesInput
  ): Promise<MarketplaceAplReceptionDomainEntity> {
    const data: Partial<MarketplaceAplReceptionEntity> = {};
    if (patch.supplier_signed_at !== undefined) data.supplier_signed_at = patch.supplier_signed_at;
    if (patch.supplier_signsupp_tx_hash !== undefined) {
      data.supplier_signsupp_tx_hash = patch.supplier_signsupp_tx_hash;
    }
    if (patch.supplier_signed_documents !== undefined) {
      data.supplier_signed_documents = patch.supplier_signed_documents;
    }
    if (patch.chairman_signed_at !== undefined) data.chairman_signed_at = patch.chairman_signed_at;
    if (patch.chairman_account !== undefined) data.chairman_account = patch.chairman_account;
    if (patch.chairman_signchair_tx_hash !== undefined) {
      data.chairman_signchair_tx_hash = patch.chairman_signchair_tx_hash;
    }
    if (patch.status !== undefined) data.status = patch.status;
    await this.repo.update({ id }, data);
    const row = await this.repo.findOneOrFail({ id });
    return this.mapper.toDomain(row);
  }
}
