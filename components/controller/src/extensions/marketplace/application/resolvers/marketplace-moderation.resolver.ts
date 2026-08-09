import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlJwtAuthGuard, platformSettings } from '@coopenomics/extension-kit';

import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import {
  MarketplaceOfferDTO,
  MarketplaceOfferPaginationResultDTO,
  toMarketplaceOfferDTO,
} from '../dto/marketplace-offer.dto';
import {
  MarketplaceApproveOfferInputDTO,
  MarketplaceListPendingOffersInputDTO,
  MarketplaceModerationLogEntryDTO,
  MarketplaceRejectOfferInputDTO,
  MarketplaceSetOfferWarrantyInputDTO,
} from '../dto/marketplace-moderation.dto';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import {
  MARKETPLACE_MODERATION_SERVICE,
  MarketplaceModerationService,
} from '../services/marketplace-moderation.service';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';

const toOfferDTO = toMarketplaceOfferDTO;

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
      // FIFO: первой берётся самая старая заявка — модератор не должен
      // пропускать давно ждущие офферы из-за свежих.
      sortOrder: (input?.sortOrder ?? 'ASC') as 'ASC' | 'DESC',
    };
    const result = await this.service.listPending(platformSettings().coopname, pagination);
    return {
      items: result.items.map(toOfferDTO),
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  @Mutation(() => MarketplaceOfferDTO, {
    name: 'marketplaceApproveOffer',
    description:
      'Одобрить Offer (status → ACTIVE) и установить гарантийный срок возврата (admin)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'moderate')
  async marketplaceApproveOffer(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceApproveOfferInputDTO
  ): Promise<MarketplaceOfferDTO> {
    const offer = await this.service.approve(input.offer_id, member.username, input.warranty_days);
    return toOfferDTO(offer);
  }

  @Mutation(() => MarketplaceOfferDTO, {
    name: 'marketplaceSetOfferWarranty',
    description: 'Изменить гарантийный срок возврата предложения (admin)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'moderate')
  async marketplaceSetOfferWarranty(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceSetOfferWarrantyInputDTO
  ): Promise<MarketplaceOfferDTO> {
    const offer = await this.service.setWarranty(input.offer_id, member.username, input.warranty_days);
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
