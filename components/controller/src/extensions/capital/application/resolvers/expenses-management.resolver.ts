import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { ExpensesManagementService } from '../services/expenses-management.service';
import { CreateExpenseInputDTO } from '../dto/expenses_management/create-expense-input.dto';
import { ExpenseFilterInputDTO } from '../dto/expenses_management/expense-filter.input';
import { GetExpenseInputDTO } from '../dto/expenses_management/get-expense-input.dto';
import {
  GqlJwtAuthGuard,
  createPaginationResult,
  PaginationInputDTO,
  PaginationResult,
  GeneratedDocumentDTO,
  GenerateDocumentOptionsInputDTO,
  TransactionDTO,
  GenerateDocumentInputDTO,
  RequireRight,
  RightsGuard,
} from '@coopenomics/extension-kit';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ExpenseOutputDTO } from '../dto/expenses_management/expense.dto';
// Пагинированные результаты
const paginatedExpensesResult = createPaginationResult(ExpenseOutputDTO, 'PaginatedCapitalExpenses');

/**
 * GraphQL резолвер для действий управления расходами CAPITAL контракта
 */
@Resolver()
export class ExpensesManagementResolver {
  constructor(private readonly expensesManagementService: ExpensesManagementService) {}

  /**
   * Мутация для создания расхода в CAPITAL контракте
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalCreateExpense',
    description: 'Создание расхода в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('CapitalExpense', 'create')
  async createCapitalExpense(
    @Args('data', { type: () => CreateExpenseInputDTO }) data: CreateExpenseInputDTO
  ): Promise<TransactionDTO> {
    const result = await this.expensesManagementService.createExpense(data);
    return result;
  }

  // ============ ЗАПРОСЫ РАСХОДОВ ============

  /**
   * Получение всех расходов с фильтрацией
   */
  @Query(() => paginatedExpensesResult, {
    name: 'capitalExpenses',
    description: 'Получение списка расходов кооператива с фильтрацией',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('CapitalExpense', ['read:own', 'read'], { owner: 'filter.username' })
  async getExpenses(
    @Args('filter', { nullable: true }) filter?: ExpenseFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<ExpenseOutputDTO>> {
    return await this.expensesManagementService.getExpenses(filter, options);
  }

  /**
   * Получение расхода по ID
   */
  @Query(() => ExpenseOutputDTO, {
    name: 'capitalExpense',
    description: 'Получение расхода по внутреннему ID базы данных',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('CapitalExpense', 'read')
  async getExpense(@Args('data') data: GetExpenseInputDTO): Promise<ExpenseOutputDTO | null> {
    return await this.expensesManagementService.getExpenseById(data);
  }

  // ============ ГЕНЕРАЦИЯ ДОКУМЕНТОВ ============

  /**
   * Мутация для генерации заявления о расходе
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateExpenseStatement',
    description: 'Сгенерировать заявление о расходе',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('CapitalExpense', ['generate:own', 'generate'], { owner: 'data.username' })
  async generateExpenseStatement(
    @Args('data', { type: () => GenerateDocumentInputDTO })
    data: GenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.expensesManagementService.generateExpenseStatement(data, options);
  }

  /**
   * Мутация для генерации решения о расходе
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateExpenseDecision',
    description: 'Сгенерировать решение о расходе',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('CapitalExpense', ['generate:own', 'generate'], { owner: 'data.username' })
  async generateExpenseDecision(
    @Args('data', { type: () => GenerateDocumentInputDTO })
    data: GenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.expensesManagementService.generateExpenseDecision(data, options);
  }
}
