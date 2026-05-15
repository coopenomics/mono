import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';

import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import {
  MarketplaceOfferDTO,
  MarketplaceOfferPaginationResultDTO,
} from '../dto/marketplace-offer.dto';
import {
  MarketplaceApproveOfferInputDTO,
  MarketplaceListPendingOffersInputDTO,
  MarketplaceModerationLogEntryDTO,
  MarketplaceRejectOfferInputDTO,
} from '../dto/marketplace-moderation.dto';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import {
  MARKETPLACE_MODERATION_SERVICE,
  MarketplaceModerationService,
} from '../services/marketplace-moderation.service';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';

function toOfferDTO(o: MarketplaceOfferDomainEntity): MarketplaceOfferDTO {
  return new MarketplaceOfferDTO({
    id: o.id,
    coopname: o.coopname,
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
 * Story 3.3: модерация Offer'ов админом (Chairman marketplace-role admin).
 *
 * Все 3 операции под `@RequireMarketplaceAccess('Offer','moderate')` —
 * матрица отдаёт это только admin.
 */
@Resolver()
@Injectable()
export class MarketplaceModerationResolver {
  constructor(
    @Inject(MARKETPLACE_MODERATION_SERVICE)
    private readonly service: MarketplaceModerationService
  ) {}

  @Query(() => MarketplaceOfferPaginationResultDTO, {
    name: 'marketplaceListPendingOffers',
    description: 'Список Offer\'ов на модерации (admin)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'moderate')
  async marketplaceListPendingOffers(
    @Args('input', { nullable: true }) input?: MarketplaceListPendingOffersInputDTO
  ): Promise<MarketplaceOfferPaginationResultDTO> {
    const pagination = {
      page: input?.page ?? 1,
      limit: input?.limit ?? 50,
      sortBy: input?.sortBy ?? 'created_at',
      sortOrder: (input?.sortOrder ?? 'DESC') as 'ASC' | 'DESC',
    };
    const result = await this.service.listPending(config.coopname, pagination);
    return {
      items: result.items.map(toOfferDTO),
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  @Mutation(() => MarketplaceOfferDTO, {
    name: 'marketplaceApproveOffer',
    description: 'Одобрить Offer (status → ACTIVE) (admin)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'moderate')
  async marketplaceApproveOffer(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceApproveOfferInputDTO
  ): Promise<MarketplaceOfferDTO> {
    const offer = await this.service.approve(input.offer_id, member.username);
    return toOfferDTO(offer);
  }

  @Mutation(() => MarketplaceOfferDTO, {
    name: 'marketplaceRejectOffer',
    description: 'Отклонить Offer с причиной (status → REJECTED) (admin)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'moderate')
  async marketplaceRejectOffer(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceRejectOfferInputDTO
  ): Promise<MarketplaceOfferDTO> {
    const offer = await this.service.reject(input.offer_id, member.username, input.reason);
    return toOfferDTO(offer);
  }

  @Query(() => [MarketplaceModerationLogEntryDTO], {
    name: 'marketplaceListModerationLog',
    description: 'История решений модерации по Offer\'у (admin)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'moderate')
  async marketplaceListModerationLog(
    @Args('offer_id') offer_id: string
  ): Promise<MarketplaceModerationLogEntryDTO[]> {
    const entries = await this.service.listLog(offer_id);
    return entries.map(
      (e) =>
        new MarketplaceModerationLogEntryDTO({
          id: e.id,
          offer_id: e.offer_id,
          action: e.action,
          by_account: e.by_account,
          reason: e.reason,
          created_at: e.created_at,
        })
    );
  }
}
