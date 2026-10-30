import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import {
  GqlJwtAuthGuard,
  RequireRight,
  RightsGuard,
  PaginationInputDTO,
  createPaginationResult,
  type PaginationResult,
} from '@coopenomics/extension-kit';
import { ContributionsHistoryService } from '../services/contributions-history.service';
import { ContributionOutputDTO, ContributionsFilterInputDTO } from '../dto/contributions/contribution.dto';

const paginatedContributionsResult = createPaginationResult(ContributionOutputDTO, 'PaginatedCapitalContributions');

/** Страница «Мои взносы»: история паевых взносов пайщика в программы Благороста. */
@Resolver()
export class ContributionsHistoryResolver {
  constructor(private readonly contributionsHistoryService: ContributionsHistoryService) {}

  @Query(() => paginatedContributionsResult, {
    name: 'capitalContributions',
    description: 'История паевых взносов пайщика в программы Благороста: деньгами, имуществом и результатами интеллектуальной деятельности',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Contribution', ['read:own', 'read'], { owner: 'filter.username' })
  async getContributions(
    @Args('filter') filter: ContributionsFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<ContributionOutputDTO>> {
    return await this.contributionsHistoryService.getContributions(filter.username, options);
  }
}
