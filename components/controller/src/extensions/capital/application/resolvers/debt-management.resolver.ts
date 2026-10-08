import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { DebtManagementService } from '../services/debt-management.service';
import { CreateDebtInputDTO } from '../dto/debt_management/create-debt-input.dto';
import {
  GqlJwtAuthGuard,
  createPaginationResult,
  PaginationInputDTO,
  PaginationResult,
  GeneratedDocumentDTO,
  GenerateDocumentOptionsInputDTO,
  TransactionDTO,
  RequireRight,
  RightsGuard,
} from '@coopenomics/extension-kit';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DebtOutputDTO } from '../dto/debt_management/debt.dto';
import { DebtFilterInputDTO } from '../dto/debt_management/debt-filter.input';
import { GetDebtInputDTO } from '../dto/debt_management/get-debt-input.dto';
import {
  CapitalDebtRefInputDTO,
  CapitalLoanContractGenerateInputDTO,
  CapitalLoanDecisionGenerateInputDTO,
  CapitalLoanStatementGenerateInputDTO,
} from '../dto/debt_management/loan-document-input.dto';
// Пагинированные результаты
const paginatedDebtsResult = createPaginationResult(DebtOutputDTO, 'PaginatedCapitalDebts');

/**
 * GraphQL резолвер для действий управления долгами CAPITAL контракта
 */
@Resolver()
export class DebtManagementResolver {
  constructor(private readonly debtManagementService: DebtManagementService) {}

  /**
   * Мутация для получения ссуды в CAPITAL контракте
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalCreateDebt',
    description: 'Получение ссуды в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Debt', 'create:own', { owner: 'data.username' })
  async createCapitalDebt(
    @Args('data', { type: () => CreateDebtInputDTO }) data: CreateDebtInputDTO
  ): Promise<TransactionDTO> {
    const result = await this.debtManagementService.createDebt(data);
    return result;
  }

  // ============ ЗАПРОСЫ ДОЛГОВ ============

  /**
   * Получение всех долгов с фильтрацией
   */
  @Query(() => paginatedDebtsResult, {
    name: 'capitalDebts',
    description: 'Получение списка долгов кооператива с фильтрацией',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Debt', ['read:own', 'read'], { owner: 'filter.username' })
  async getDebts(
    @Args('filter', { nullable: true }) filter?: DebtFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<DebtOutputDTO>> {
    return await this.debtManagementService.getDebts(filter, options);
  }

  /**
   * Получение долга по ID
   */
  @Query(() => DebtOutputDTO, {
    name: 'capitalDebt',
    description: 'Получение долга по внутреннему ID базы данных',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Debt', 'read')
  async getDebt(@Args('data') data: GetDebtInputDTO): Promise<DebtOutputDTO | null> {
    return await this.debtManagementService.getDebtById(data._id);
  }

  // ============ ГЕНЕРАЦИЯ ДОКУМЕНТОВ ============

  /**
   * Мутация для генерации заявления о получении займа
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateGetLoanStatement',
    description: 'Сгенерировать заявление о получении займа',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Debt', ['generate:own', 'generate'], { owner: 'data.username' })
  async generateGetLoanStatement(
    @Args('data', { type: () => CapitalLoanStatementGenerateInputDTO })
    data: CapitalLoanStatementGenerateInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.debtManagementService.generateGetLoanStatement(data, options);
  }

  /**
   * Мутация для генерации решения о получении займа
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateGetLoanDecision',
    description: 'Сгенерировать решение о получении займа',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Debt', 'generate')
  async generateGetLoanDecision(
    @Args('data', { type: () => CapitalLoanDecisionGenerateInputDTO })
    data: CapitalLoanDecisionGenerateInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.debtManagementService.generateGetLoanDecision(data, options);
  }

  /**
   * Мутация для генерации договора займа под обеспечение имуществом
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateLoanContract',
    description: 'Сгенерировать договор займа под обеспечение имуществом на ответственном хранении',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Debt', ['generate:own', 'generate'], { owner: 'data.username' })
  async generateLoanContract(
    @Args('data', { type: () => CapitalLoanContractGenerateInputDTO })
    data: CapitalLoanContractGenerateInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.debtManagementService.generateLoanContract(data, options);
  }

  /**
   * Мутация повтора платежа по займу после отказа кассира
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalRetryDebtPayment',
    description: 'Повторно передать заём кассиру после отказа платежа по реквизитам',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Debt', 'retry-pay')
  async retryDebtPayment(
    @Args('data', { type: () => CapitalDebtRefInputDTO }) data: CapitalDebtRefInputDTO
  ): Promise<TransactionDTO> {
    return this.debtManagementService.retryDebtPayment(data);
  }
}
