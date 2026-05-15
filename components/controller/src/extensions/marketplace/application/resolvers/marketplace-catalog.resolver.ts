import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';

import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';

import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import {
  MarketplaceCategoryOfferCountDTO,
  MarketplaceListCatalogInputDTO,
} from '../dto/marketplace-catalog.dto';
import { MarketplaceOfferDTO, MarketplaceOfferPageDTO } from '../dto/marketplace-offer.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';

function toOfferDTO(o: MarketplaceOfferDomainEntity): MarketplaceOfferDTO {
  return new MarketplaceOfferDTO({
    id: o.id,
    cooperative_id: o.cooperative_id,
    supplier_account: o.supplier_account,
    vitrine_id: o.vitrine_id,
    product_name: o.product_name,
    description: o.description,
    category_id: o.category_id,
    price_per_unit: o.price_per_unit,
    unit_of_measure: o.unit_of_measure,
    quantity_available: o.quantity_available,
    quantity_blocked: o.quantity_blocked,
    quantity_consumed: o.quantity_consumed,
    unlimited_flag: o.unlimited_flag,
    cycle_type: o.cycle_type,
    cycle_days: o.cycle_days,
    target_volume: o.target_volume,
    max_wait_days: o.max_wait_days,
    min_threshold: o.min_threshold,
    warranty_days: o.warranty_days,
    status: o.status,
    approved_by: o.approved_by,
    approved_at: o.approved_at,
    rejected_by: o.rejected_by,
    rejected_at: o.rejected_at,
    reject_reason: o.reject_reason,
    created_at: o.created_at,
    updated_at: o.updated_at,
  });
}

/**
 * Story 3.5: каталог активных Offer'ов с фильтром по 10 кооп-категориям.
 *
 * `marketplaceListCatalog` — только ACTIVE + (unlimited OR available>0),
 * фильтр по category_id, сортировка (default created_at DESC, опции по
 * цене). Доступ — `Offer:read` всем marketplace-ролям (orderer/offerer/
 * operator/admin).
 *
 * `marketplaceCategoryOfferCounts` — кол-во активных Offer'ов в каждой
 * категории (для счётчиков фильтр-чипов).
 */
@Resolver()
@Injectable()
export class MarketplaceCatalogResolver {
  constructor(
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository
  ) {}

  @Query(() => MarketplaceOfferPageDTO, {
    name: 'marketplaceListCatalog',
    description: 'Каталог активных Offer\'ов (ACTIVE + available, single vitrine MVP)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'read')
  async marketplaceListCatalog(
    @Args('input', { nullable: true }) input?: MarketplaceListCatalogInputDTO
  ): Promise<MarketplaceOfferPageDTO> {
    const page = await this.offerRepo.list(
      {
        cooperative_id: config.coopname,
        status: 'ACTIVE',
        category_id: input?.category_id ?? undefined,
        available_only: true,
      },
      {
        limit: input?.limit ?? 24,
        offset: input?.offset ?? 0,
        sort: input?.sort ?? 'created_at_desc',
      }
    );
    return new MarketplaceOfferPageDTO({
      total: page.total,
      items: page.items.map(toOfferDTO),
    });
  }

  @Query(() => [MarketplaceCategoryOfferCountDTO], {
    name: 'marketplaceCategoryOfferCounts',
    description: 'Счётчики активных Offer\'ов per category — для фильтр-чипов Story 3.5',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'read')
  async marketplaceCategoryOfferCounts(): Promise<MarketplaceCategoryOfferCountDTO[]> {
    const map = await this.offerRepo.countByCategory(config.coopname);
    // Гарантируем 10 категорий в ответе (даже с count=0) — UX-DR10
    // фильтр-чипы рисуются по полному baseline.
    const result: MarketplaceCategoryOfferCountDTO[] = [];
    for (let id = 1; id <= 10; id++) {
      result.push(
        new MarketplaceCategoryOfferCountDTO({
          category_id: id,
          count: map.get(id) ?? 0,
        })
      );
    }
    return result;
  }
}
