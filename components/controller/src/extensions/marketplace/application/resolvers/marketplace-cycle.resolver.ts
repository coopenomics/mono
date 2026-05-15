import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';

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
import type {
  MarketplaceConsolidatedRequestStatus,
} from '../../domain/entities/marketplace-consolidated-request.types';

const toDTO = toMarketplaceConsolidatedRequestDTO;

/**
 * Story 4.2: GraphQL для консолидированной заявки.
 *
 * - `marketplaceTriggerOpenSubscription` — поставщик жмёт «Запустить
 *   поставку сейчас» по open_subscription Offer'у (Order'ы сразу ACCEPTED).
 * - `marketplaceListConsolidatedRequests` — список заявок для offerer-стола
 *   (Story 4.5 UI accept/decline по batch).
 *
 * Access-matrix: trigger требует `Offer:update:own` (поставщик-владелец);
 * list — `Offer:read` (видят все marketplace-роли в рамках кооператива).
 */
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
      'Story 4.2: поставщик жмёт «Запустить поставку сейчас» по open_subscription Offer\'у. Создаёт consolidated_request status=ACCEPTED, Order\'ы пула → ACCEPTED.',
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
      'Story 4.2/4.5: список консолидированных заявок (для offerer-стола per-status и orderer-стола трассировки).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'read')
  async marketplaceListConsolidatedRequests(
    @Args('input', { nullable: true }) input?: MarketplaceListConsolidatedRequestsInputDTO
  ): Promise<MarketplaceConsolidatedRequestPaginationResultDTO> {
    const pagination = {
      page: input?.page ?? 1,
      limit: input?.limit ?? 50,
      sortBy: 'updated_at',
      sortOrder: (input?.sortOrder ?? 'DESC') as 'ASC' | 'DESC',
    };
    const result = await this.cycleRepo.list(
      {
        coopname: config.coopname,
        offer_id: input?.offer_id,
        status: input?.status as MarketplaceConsolidatedRequestStatus | undefined,
      },
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
