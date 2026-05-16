import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { PaginationInputDTO } from '~/application/common/dto/pagination.dto';

import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceConsolidatedRequestDTO,
  MarketplaceConsolidatedRequestPaginationResultDTO,
  toMarketplaceConsolidatedRequestDTO,
} from '../dto/marketplace-consolidated-request.dto';
import {
  MarketplaceListConsolidatedRequestsInputDTO,
  MarketplaceTriggerOpenSubscriptionInputDTO,
} from '../dto/marketplace-trigger-open-subscription-input.dto';
import {
  MARKETPLACE_CYCLE_AGGREGATOR_SERVICE,
  MarketplaceCycleAggregatorService,
} from '../services/marketplace-cycle-aggregator.service';
import {
  MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY,
  type MarketplaceConsolidatedRequestDomainRepository,
} from '../../domain/repositories/marketplace-consolidated-request.repository';

const toDTO = toMarketplaceConsolidatedRequestDTO;

@Resolver()
@Injectable()
export class MarketplaceCycleResolver {
  constructor(
    @Inject(MARKETPLACE_CYCLE_AGGREGATOR_SERVICE)
    private readonly aggregator: MarketplaceCycleAggregatorService,
    @Inject(MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY)
    private readonly cycleRepo: MarketplaceConsolidatedRequestDomainRepository
  ) {}

  @Mutation(() => MarketplaceConsolidatedRequestDTO, {
    name: 'marketplaceTriggerOpenSubscription',
    description:
      'Поставщик запускает поставку по предложению с открытой подпиской: формируется сводная заявка, заказы в её пуле принимаются.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'update:own')
  async marketplaceTriggerOpenSubscription(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceTriggerOpenSubscriptionInputDTO
  ): Promise<MarketplaceConsolidatedRequestDTO> {
    const cycle = await this.aggregator.triggerOpenSubscription(
      config.coopname,
      input.offer_id,
      member.username
    );
    return toDTO(cycle);
  }

  @Query(() => MarketplaceConsolidatedRequestPaginationResultDTO, {
    name: 'marketplaceListConsolidatedRequests',
    description:
      'Постраничный список сводных заявок поставщика — для стола поставщика и для прослеживания состояния заказов.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'read')
  async marketplaceListConsolidatedRequests(
    @Args('input', { nullable: true }) input?: MarketplaceListConsolidatedRequestsInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<MarketplaceConsolidatedRequestPaginationResultDTO> {
    const pagination: PaginationInputDTO = {
      page: options?.page ?? 1,
      limit: options?.limit ?? 50,
      sortBy: options?.sortBy ?? 'updated_at',
      sortOrder: options?.sortOrder ?? 'DESC',
    };
    const result = await this.cycleRepo.list(
      {
        coopname: config.coopname,
        offer_id: input?.offer_id,
        status: input?.status,
      },
      pagination
    );
    const dto = new MarketplaceConsolidatedRequestPaginationResultDTO();
    dto.items = result.items.map(toDTO);
    dto.totalCount = result.totalCount;
    dto.totalPages = result.totalPages;
    dto.currentPage = result.currentPage;
    return dto;
  }
}
