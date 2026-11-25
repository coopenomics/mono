import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import {
  GqlJwtAuthGuard,
  createPaginationResult,
  PaginationInputDTO,
  RightsGuard,
  type PaginationResult,
  platformSettings,
  RequireRight,
} from '@coopenomics/extension-kit';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MARKETPLACE_ECONOMY_SERVICE, MarketplaceEconomyService } from '../services/marketplace-economy.service';
import { MarketplaceBranchSummaryService } from '../services/marketplace-branch-summary.service';
import {
  MarketplaceBranchSummaryDTO,
  MarketplaceBranchSummaryMovementDTO,
  toMarketplaceBranchSummaryDTO,
  toMarketplaceBranchSummaryMovementDTO,
} from '../dto/marketplace-branch-summary.dto';

const paginatedBranchSummaryMovements = createPaginationResult(
  MarketplaceBranchSummaryMovementDTO,
  'MarketplaceBranchSummaryMovements'
);

/**
 * Сводка участка для пайщика — данные вкладки «Стол заказов» на странице
 * кооперативного участка. Читает её каждый пайщик кооператива по любому
 * участку (право `BranchSummary:read`): деньги участка открыты, документы и
 * получатели остаются у председателя и доверенных лиц участка.
 */
@Resolver()
@Injectable()
export class MarketplaceBranchSummaryResolver {
  constructor(
    private readonly summary: MarketplaceBranchSummaryService,
    @Inject(MARKETPLACE_ECONOMY_SERVICE) private readonly economyService: MarketplaceEconomyService
  ) {}

  private readonly toAsset = (units: bigint): string => this.economyService.unitsToAsset(units);

  @Query(() => MarketplaceBranchSummaryDTO, {
    name: 'marketplaceGetBranchSummary',
    description:
      'Сводка кооперативного участка для пайщика: пункт выдачи заказов с режимом работы, остатки кошельков участка и итоги взносов инициаторов. Доступна каждому пайщику кооператива.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('BranchSummary', 'read')
  async marketplaceGetBranchSummary(@Args('braname') braname: string): Promise<MarketplaceBranchSummaryDTO> {
    return toMarketplaceBranchSummaryDTO(await this.summary.getSummary(platformSettings().coopname, braname), this.toAsset);
  }

  @Query(() => paginatedBranchSummaryMovements, {
    name: 'marketplaceGetBranchSummaryMovements',
    description:
      'Движения по общему кошельку кооперативного участка для пайщика: дата, операция и сумма, без получателей и заказов. Новые первыми.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('BranchSummary', 'read')
  async marketplaceGetBranchSummaryMovements(
    @Args('braname') braname: string,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<MarketplaceBranchSummaryMovementDTO>> {
    const result = await this.summary.getMovements(platformSettings().coopname, braname, options);
    return { ...result, items: result.items.map(toMarketplaceBranchSummaryMovementDTO) };
  }
}
