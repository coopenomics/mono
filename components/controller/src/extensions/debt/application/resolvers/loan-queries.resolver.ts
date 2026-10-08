import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  GqlJwtAuthGuard,
  GrantedScope,
  type IGrantedScope,
  PaginationInputDTO,
  type PaginationResult,
  RequireRight,
  RightsGuard,
  SELF,
} from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { LoansService } from '../services/loans.service';
import { LoanOutputDTO, PaginatedLoansResult } from '../dto/loan.output';
import { LoanFilterInputDTO } from '../dto/loan-filter.input';
import { CollateralOptionDTO } from '../dto/collateral-option.output';

/** Чтение займов: свои — пайщику, все — совету; виды обеспечения — пайщику. */
@Resolver()
export class LoanQueriesResolver {
  constructor(private readonly loans: LoansService) {}

  @Query(() => PaginatedLoansResult, {
    name: 'debtLoans',
    description: 'Займы кооператива с отбором по пайщику, состоянию и источнику. Пайщик видит только свои.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Loan', ['read:all', 'read:own'], { list: null })
  async debtLoans(
    @CurrentUser() user: IMonoAccount,
    @GrantedScope() scope: IGrantedScope,
    @Args('filter', { type: () => LoanFilterInputDTO }) filter: LoanFilterInputDTO,
    @Args('options', { type: () => PaginationInputDTO, nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<LoanOutputDTO>> {
    // Право на весь кооператив — отбор как в запросе; только «своё» — займы вошедшего.
    const own = !scope.scopes.includes('all');
    return this.loans.listPaginated({ ...filter, username: own ? user.username : filter.username }, options);
  }

  @Query(() => LoanOutputDTO, { name: 'debtLoan', description: 'Заём по хэшу.' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Loan', ['read:all', 'read:own'], { of: 'Loan', id: 'debt_hash' })
  async debtLoan(@Args('debt_hash', { type: () => String }) debtHash: string): Promise<LoanOutputDTO> {
    return this.loans.getByHashOutput(debtHash);
  }

  @Query(() => String, {
    name: 'debtRepayAvailable',
    description: 'Свободный остаток пайщика на главном кошельке — предел суммы возврата займа.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('LoanCollateral', 'read:own', SELF)
  async debtRepayAvailable(
    @CurrentUser() user: IMonoAccount,
    @Args('coopname', { type: () => String }) coopname: string
  ): Promise<string> {
    return this.loans.repayAvailable(coopname, user.username);
  }

  @Query(() => [CollateralOptionDTO], {
    name: 'debtCollateralOptions',
    description: 'Виды обеспечения из реестра контракта с остатком пайщика и признаком подписанного договора-основания.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('LoanCollateral', 'read:own', SELF)
  async debtCollateralOptions(
    @CurrentUser() user: IMonoAccount,
    @Args('coopname', { type: () => String }) coopname: string
  ): Promise<CollateralOptionDTO[]> {
    return this.loans.collateralOptions(coopname, user.username);
  }
}
