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
} from '../dto/marketplace-trigger-collective-supply-input.dto';
import {
  MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY,
  type MarketplaceConsolidatedRequestDomainRepository,
} from '../../domain/repositories/marketplace-consolidated-request.repository';

const toDTO = toMarketplaceConsolidatedRequestDTO;

@Resolver()
@Injectable()
export class MarketplaceCycleResolver {
  constructor(
    @Inject(MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY)
    private readonly cycleRepo: MarketplaceConsolidatedRequestDomainRepository
  ) {}

  @Query(() => MarketplaceConsolidatedRequestPaginationResultDTO, {
    name: 'marketplaceListConsolidatedRequests',
    description:
      'Постраничный список сводных заявок поставщика — для стола поставщика и для прослеживания состояния заказов.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'read')
  async marketplaceListConsolidatedRequests(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
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
        // Поставщик видит только свои сводные заявки (read:to-self).
        // Без этого фильтра любой пайщик-поставщик получал весь
        // список консолидированных заявок кооператива.
        supplier_account: member.username,
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
