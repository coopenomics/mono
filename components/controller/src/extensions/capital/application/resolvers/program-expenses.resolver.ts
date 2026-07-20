import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { TransactionDTO } from '~/application/common/dto/transaction-result-response.dto';
import {
  createPaginationResult,
  PaginationInputDTO,
  PaginationResult,
} from '~/application/common/dto/pagination.dto';
import { ProgramExpensesManagementService } from '../services/program-expenses-management.service';
import { CreateProgramExpenseInputDTO } from '../dto/program_expenses/create-program-expense.input';
import { TopupProgramExpenseInputDTO } from '../dto/program_expenses/topup-program-expense.input';
import { ProgramExpenseOutputDTO } from '../dto/program_expenses/program-expense.output';

const paginatedProgramExpensesResult = createPaginationResult(
  ProgramExpenseOutputDTO,
  'PaginatedCapitalProgramExpenses',
);

/**
 * GraphQL-резолвер программных расходов капитала. Председатель/совет.
 * Write → on-chain capital; read → шасси через inter-порт.
 */
@Resolver()
export class ProgramExpensesResolver {
  constructor(private readonly service: ProgramExpensesManagementService) {}

  @Mutation(() => TransactionDTO, {
    name: 'capitalCreateProgramExpense',
    description: 'Создание программного расхода капитала через шасси expense.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async createProgramExpense(
    @Args('data', { type: () => CreateProgramExpenseInputDTO }) data: CreateProgramExpenseInputDTO,
  ): Promise<TransactionDTO> {
    return this.service.createProgramExpense(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalTopupProgramExpensePool',
    description: 'Пополнение пула программных расходов капитала из инвестиционного пула.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async topupProgramExpense(
    @Args('data', { type: () => TopupProgramExpenseInputDTO }) data: TopupProgramExpenseInputDTO,
  ): Promise<TransactionDTO> {
    return this.service.topupProgramExpense(data);
  }

  @Query(() => paginatedProgramExpensesResult, {
    name: 'capitalProgramExpenses',
    description: 'Список программных расходов капитала (через шасси expense).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async listProgramExpenses(
    @Args('coopname', { type: () => String }) coopname: string,
    @Args('options', { type: () => PaginationInputDTO, nullable: true }) options?: PaginationInputDTO,
  ): Promise<PaginationResult<ProgramExpenseOutputDTO>> {
    return this.service.listProgramExpenses(coopname, options);
  }

  @Query(() => ProgramExpenseOutputDTO, {
    name: 'capitalProgramExpense',
    description: 'Программный расход по expense_hash.',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async getProgramExpense(
    @Args('coopname') coopname: string,
    @Args('expense_hash') expenseHash: string,
  ): Promise<ProgramExpenseOutputDTO | null> {
    return this.service.getProgramExpense(coopname, expenseHash);
  }
}
