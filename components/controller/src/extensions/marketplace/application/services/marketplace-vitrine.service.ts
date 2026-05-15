import { Inject, Injectable } from '@nestjs/common';
import {
  MARKETPLACE_VITRINE_REPOSITORY,
  type MarketplaceVitrineDomainRepository,
} from '../../domain/repositories/marketplace-vitrine.repository';
import type { MarketplaceVitrineDomainEntity } from '../../domain/entities/marketplace-vitrine.entity';

export const MARKETPLACE_VITRINE_SERVICE = Symbol('MARKETPLACE_VITRINE_SERVICE');

/**
 * Story 3.1: чтение конфигурации витрины.
 *
 * Запись (ensureDefault) выполняется только в bootstrap-v3 afterMigrate;
 * через GraphQL пользователю недоступно создавать/переименовывать витрины
 * в MVP (конструктор кастомных витрин — Phase 2).
 */
@Injectable()
export class MarketplaceVitrineService {
  constructor(
    @Inject(MARKETPLACE_VITRINE_REPOSITORY)
    private readonly repo: MarketplaceVitrineDomainRepository
  ) {}

  async getDefault(coopname: string): Promise<MarketplaceVitrineDomainEntity | null> {
    return this.repo.findDefault(coopname);
  }

  async list(coopname: string): Promise<MarketplaceVitrineDomainEntity[]> {
    return this.repo.list(coopname);
  }
}
