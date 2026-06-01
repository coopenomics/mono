import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';

import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';

import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceOfferStatuses } from '../../domain/entities/marketplace-offer.types';
import {
  MarketplaceCategoryOfferCountDTO,
  MarketplaceListCatalogInputDTO,
} from '../dto/marketplace-catalog.dto';
import {
  MarketplaceOfferDTO,
  MarketplaceOfferPaginationResultDTO,
  toMarketplaceOfferDTO,
} from '../dto/marketplace-offer.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import { MARKETPLACE_FOOD_CATEGORIES } from '../../domain/entities/marketplace-category.entity';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';

const toOfferDTO = toMarketplaceOfferDTO;

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

  @Query(() => MarketplaceOfferPaginationResultDTO, {
    name: 'marketplaceListCatalog',
    description: 'Каталог активных Offer\'ов (ACTIVE + available, single vitrine MVP)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'read')
  async marketplaceListCatalog(
    @Args('input', { nullable: true }) input?: MarketplaceListCatalogInputDTO
  ): Promise<MarketplaceOfferPaginationResultDTO> {
    const pagination = {
      page: input?.page ?? 1,
      limit: input?.limit ?? 24,
      sortBy: input?.sortBy ?? 'created_at',
      sortOrder: (input?.sortOrder ?? 'DESC') as 'ASC' | 'DESC',
    };
    const result = await this.offerRepo.list(
      {
        coopname: config.coopname,
        status: MarketplaceOfferStatuses.ACTIVE,
        category_id: input?.category_id ?? undefined,
        available_only: true,
      },
      pagination
    );
    return {
      items: result.items.map(toOfferDTO),
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  @Query(() => [MarketplaceCategoryOfferCountDTO], {
    name: 'marketplaceCategoryOfferCounts',
    description: 'Счётчики активных Offer\'ов per category — для фильтр-чипов Story 3.5',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'read')
  async marketplaceCategoryOfferCounts(): Promise<MarketplaceCategoryOfferCountDTO[]> {
    const map = await this.offerRepo.countByCategory(config.coopname);
    return MARKETPLACE_FOOD_CATEGORIES.map(
      (c) =>
        new MarketplaceCategoryOfferCountDTO({
          category_id: c.id,
          count: map.get(c.id) ?? 0,
        })
    );
  }
}
