import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';

import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import {
  MarketplaceCategoryDTO,
  MarketplaceOfferDTO,
  MarketplaceOfferPaginationResultDTO,
  toMarketplaceOfferDTO,
} from '../dto/marketplace-offer.dto';
import {
  MarketplaceCreateOfferInputDTO,
  MarketplaceListMyOffersInputDTO,
  MarketplaceRepublishOfferInputDTO,
  MarketplaceUpdateOfferInputDTO,
  MarketplaceWithdrawOfferInputDTO,
} from '../dto/marketplace-offer-input.dto';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import {
  MARKETPLACE_OFFER_SERVICE,
  MarketplaceOfferService,
} from '../services/marketplace-offer.service';
import {
  MARKETPLACE_CATEGORY_SERVICE,
  MarketplaceCategoryService,
} from '../services/marketplace-category.service';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';

const toDTO = toMarketplaceOfferDTO;

/**
 * Story 3.2 + 3.5: GraphQL для Offer'ов и категорий.
 *
 * Story 3.2 операции — capability `Offer:create:own/update:own/delete:own`
 * (offerer); ownership проверяется в `MarketplaceOfferService` (supplier_account
 * == currentMember.username).
 *
 * `marketplaceListCategories` — `Offer:read` всем marketplace-ролям
 * (категорий справочник нужен и заказчику для фильтра-чипов Story 3.5).
 */
@Resolver()
@Injectable()
export class MarketplaceOfferResolver {
  constructor(
    @Inject(MARKETPLACE_OFFER_SERVICE)
    private readonly offerService: MarketplaceOfferService,
    @Inject(MARKETPLACE_CATEGORY_SERVICE)
    private readonly categoryService: MarketplaceCategoryService
  ) {}

  @Query(() => [MarketplaceCategoryDTO], {
    name: 'marketplaceListCategories',
    description: 'Baseline-категории Стола заказов (Story 3.2/3.5) — 8 продовольственных + «Прочее»',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'read')
  async marketplaceListCategories(): Promise<MarketplaceCategoryDTO[]> {
    const cats = await this.categoryService.listBaseline();
    return cats.map(
      (c) =>
        new MarketplaceCategoryDTO({
          id: c.id,
          display_name: c.display_name,
          sort_order: c.sort_order,
          mvp_baseline: c.mvp_baseline,
        })
    );
  }

  @Mutation(() => MarketplaceOfferDTO, {
    name: 'marketplaceCreateOffer',
    description: 'Поставщик публикует Offer (статус → PENDING_MODERATION)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'create:own')
  async marketplaceCreateOffer(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceCreateOfferInputDTO
  ): Promise<MarketplaceOfferDTO> {
    const offer = await this.offerService.create({
      coopname: config.coopname,
      supplier_account: member.username,
      vitrine_id: 'default',
      product_name: input.product_name,
      description: input.description ?? null,
      category_id: input.category_id,
      price_per_unit: input.price_per_unit,
      unit_of_measure: input.unit_of_measure,
      quantity_available: input.quantity_available ?? null,
      unlimited_flag: input.unlimited_flag,
      cycle_type: input.cycle_type,
      cycle_days: input.cycle_days ?? null,
      target_volume: input.target_volume ?? null,
      max_wait_days: input.max_wait_days ?? null,
      min_threshold: input.min_threshold ?? null,
      warranty_days: input.warranty_days,
      barcode_strategy: input.barcode_strategy ?? null,
      pack_size: input.pack_size ?? null,
      images: input.images ?? null,
    });
    return toDTO(offer);
  }

  @Mutation(() => MarketplaceOfferDTO, {
    name: 'marketplaceUpdateOffer',
    description: 'Поставщик правит свой Offer — статус сбрасывается в PENDING_MODERATION',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'update:own')
  async marketplaceUpdateOffer(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceUpdateOfferInputDTO
  ): Promise<MarketplaceOfferDTO> {
    const { id, images, ...patch } = input;
    const offer = await this.offerService.update(id, member.username, patch, images);
    return toDTO(offer);
  }

  @Mutation(() => MarketplaceOfferDTO, {
    name: 'marketplaceWithdrawOffer',
    description: 'Поставщик снимает свой Offer (статус → WITHDRAWN)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'delete:own')
  async marketplaceWithdrawOffer(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceWithdrawOfferInputDTO
  ): Promise<MarketplaceOfferDTO> {
    const offer = await this.offerService.withdraw(input.id, member.username);
    return toDTO(offer);
  }

  @Mutation(() => MarketplaceOfferDTO, {
    name: 'marketplaceRepublishOffer',
    description: 'Поставщик возвращает снятый Offer на публикацию (статус → PENDING_MODERATION)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'update:own')
  async marketplaceRepublishOffer(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceRepublishOfferInputDTO
  ): Promise<MarketplaceOfferDTO> {
    const offer = await this.offerService.republish(input.id, member.username);
    return toDTO(offer);
  }

  @Query(() => MarketplaceOfferPaginationResultDTO, {
    name: 'marketplaceListMyOffers',
    description: 'Список собственных Offer\'ов поставщика (любой статус)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'create:own')
  async marketplaceListMyOffers(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input', { nullable: true }) input?: MarketplaceListMyOffersInputDTO
  ): Promise<MarketplaceOfferPaginationResultDTO> {
    const pagination = {
      page: input?.page ?? 1,
      limit: input?.limit ?? 50,
      sortBy: input?.sortBy ?? 'created_at',
      sortOrder: (input?.sortOrder ?? 'DESC') as 'ASC' | 'DESC',
    };
    const result = await this.offerService.listMine(
      config.coopname,
      member.username,
      pagination
    );
    return {
      items: result.items.map(toDTO),
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }
}
