import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { DebtManagementService } from '../services/debt-management.service';
import { CreateDebtInputDTO } from '../dto/debt_management/create-debt-input.dto';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, createPaginationResult, PaginationInputDTO, PaginationResult, GeneratedDocumentDTO, GenerateDocumentOptionsInputDTO, TransactionDTO, GenerateDocumentInputDTO } from '@coopenomics/extension-kit';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DebtOutputDTO } from '../dto/debt_management/debt.dto';
import { DebtFilterInputDTO } from '../dto/debt_management/debt-filter.input';
import { GetDebtInputDTO } from '../dto/debt_management/get-debt-input.dto';
import {
  CloseDebtInputDTO,
  MarkOverdueDebtsInputDTO,
  RetryDebtPaymentInputDTO,
  SettleDebtInputDTO,
} from '../dto/debt_management/settle-debt-input.dto';
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
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['participant'])
  async createCapitalDebt(
    @Args('data', { type: () => CreateDebtInputDTO }) data: CreateDebtInputDTO
  ): Promise<TransactionDTO> {
    const result = await this.debtManagementService.createDebt(data);
    return result;
  }

  /**
   * Возврат займа деньгами
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalSettleDebt',
    description: 'Вернуть заём деньгами',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async settleCapitalDebt(
    @Args('data', { type: () => SettleDebtInputDTO }) data: SettleDebtInputDTO
  ): Promise<TransactionDTO> {
    return await this.debtManagementService.settleDebt(data);
  }

  /**
   * Повторная отправка платежа после отказа по реквизитам
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalRetryDebtPayment',
    description: 'Отправить платёж по займу повторно после отказа по реквизитам',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async retryCapitalDebtPayment(
    @Args('data', { type: () => RetryDebtPaymentInputDTO }) data: RetryDebtPaymentInputDTO
  ): Promise<TransactionDTO> {
    return await this.debtManagementService.retryDebtPayment(data);
  }

  /**
   * Закрытие невозвращённого займа переходом работы кооперативу
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalCloseDebt',
    description: 'Закрыть невозвращённый заём: работа-обеспечение переходит кооперативу',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async closeCapitalDebt(
    @Args('data', { type: () => CloseDebtInputDTO }) data: CloseDebtInputDTO
  ): Promise<TransactionDTO> {
    return await this.debtManagementService.closeDebt(data);
  }

  /**
   * Перевод займов с истёкшим сроком в просрочку
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalMarkOverdueDebts',
    description: 'Перевести в просрочку займы, срок возврата которых прошёл',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async markOverdueCapitalDebts(
    @Args('data', { type: () => MarkOverdueDebtsInputDTO }) data: MarkOverdueDebtsInputDTO
  ): Promise<TransactionDTO> {
    return await this.debtManagementService.markOverdueDebts(data);
  }

  // ============ ЗАПРОСЫ ДОЛГОВ ============

  /**
   * Получение всех долгов с фильтрацией
   */
  @Query(() => paginatedDebtsResult, {
    name: 'capitalDebts',
    description: 'Получение списка долгов кооператива с фильтрацией',
  })
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
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateGetLoanStatement(
    @Args('data', { type: () => GenerateDocumentInputDTO })
    data: GenerateDocumentInputDTO,
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
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateGetLoanDecision(
    @Args('data', { type: () => GenerateDocumentInputDTO })
    data: GenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.debtManagementService.generateGetLoanDecision(data, options);
  }
}
