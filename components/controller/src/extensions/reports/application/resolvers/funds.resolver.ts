import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CurrentUser,
  GqlJwtAuthGuard,
  PaginationInputDTO,
  RequireRight,
  RightsGuard,
  type PaginationResult,
} from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { FundsService } from '../services/funds.service';
import {
  ReportsEditFundInputDTO,
  ReportsFundDTO,
  ReportsFundHistoryInputDTO,
  ReportsFundHistoryPaginationResult,
  ReportsFundMovementDTO,
  ReportsFundsInputDTO,
  ReportsFundsRegistryDTO,
} from '../dto/funds.dto';

/**
 * Фонды кооператива на столе бухгалтера (задача 99D-24): реестр с остатками и
 * оборотами, история движений фонда, правка процентов председателем совета.
 */
@Resolver()
@UseGuards(GqlJwtAuthGuard, RightsGuard)
export class FundsResolver {
  constructor(private readonly funds: FundsService) {}

  @Query(() => ReportsFundsRegistryDTO, {
    name: 'reportsFunds',
    description: 'Стол бухгалтера: фонды кооператива с остатками кошельков и оборотами за период',
  })
  @RequireRight('Registry', 'read')
  async reportsFunds(@Args('input', { type: () => ReportsFundsInputDTO }) input: ReportsFundsInputDTO): Promise<ReportsFundsRegistryDTO> {
    return this.funds.registryView(input);
  }

  @Query(() => ReportsFundHistoryPaginationResult, {
    name: 'reportsFundHistory',
    description: 'Стол бухгалтера: движения по фонду за период, по страницам',
  })
  @RequireRight('Registry', 'read')
  async reportsFundHistory(
    @Args('input', { type: () => ReportsFundHistoryInputDTO }) input: ReportsFundHistoryInputDTO,
    @Args('options', { type: () => PaginationInputDTO, nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<ReportsFundMovementDTO>> {
    return this.funds.history(input, options);
  }

  @Mutation(() => ReportsFundDTO, {
    name: 'reportsEditFund',
    description: 'Председатель совета меняет описание и процент отчислений фонда; правила проверяются до обращения в цепь',
  })
  @RequireRight('FundSettings', 'manage')
  async reportsEditFund(
    @Args('input', { type: () => ReportsEditFundInputDTO }) input: ReportsEditFundInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<ReportsFundDTO> {
    return this.funds.editFund(input, currentUser.username);
  }
}
