import { TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import type {
  MarketplaceHandoffCodeDomainRepository,
  MarketplaceHandoffCodeRecord,
} from '../../domain/repositories/marketplace-handoff-code.repository';
import { MARKETPLACE_HANDOFF_CODE_STORE } from '../database/marketplace-stores';
import { MarketplaceHandoffCodeEntity } from '../entities/marketplace-handoff-code.entity';

@Injectable()
export class MarketplaceHandoffCodeRepositoryAdapter implements MarketplaceHandoffCodeDomainRepository {
  constructor(
    @Inject(MARKETPLACE_HANDOFF_CODE_STORE)
    private readonly repo: TableStore<MarketplaceHandoffCodeEntity>
  ) {}

  async findByToken(coopname: string, token: string): Promise<MarketplaceHandoffCodeRecord | null> {
    return this.repo.findOne({ coopname, token });
  }

  async findLiveByAccount(coopname: string, account: string, now: Date): Promise<MarketplaceHandoffCodeRecord | null> {
    // Последний выданный код: у записи один действующий код, но сверяем срок явно.
    const rows = await this.repo.find({ coopname, account }, { order: { issued_at: 'DESC' }, limit: 1 });
    const last = rows[0];
    return last && last.expires_at.getTime() > now.getTime() ? last : null;
  }

  async create(input: { coopname: string; account: string; token: string; expires_at: Date }): Promise<MarketplaceHandoffCodeRecord> {
    return this.repo.insert(input);
  }
}
