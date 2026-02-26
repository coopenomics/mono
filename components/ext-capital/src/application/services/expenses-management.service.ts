import { Injectable } from '@nestjs/common';
import { ExpensesManagementInteractor } from '../use-cases/expenses-management.interactor';
import type { TransactResult } from '@wharfkit/session';
import type { CreateExpenseInputDTO } from '../dto/expenses_management/create-expense-input.dto';
import type { ExpenseFilterInputDTO } from '../dto/expenses_management/expense-filter.input';
import type { GetExpenseInputDTO } from '../dto/expenses_management/get-expense-input.dto';
import { PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import { ExpenseOutputDTO } from '../dto/expenses_management/expense.dto';
import type { ExpenseDomainEntity } from '../../domain/entities/expense.entity';
import { DocumentAggregationService } from '~/domain/document/services/document-aggregation.service';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { GenerateDocumentInputDTO } from '~/application/document/dto/generate-document-input.dto';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import { Cooperative } from 'cooptypes';

/**
 * Сервис уровня приложения для управления расходами CAPITAL
 * Обрабатывает запросы от ExpensesManagementResolver
 */
@Injectable()
export class ExpensesManagementService {
  constructor(
    private readonly expensesManagementInteractor: ExpensesManagementInteractor,
    private readonly documentAggregationService: DocumentAggregationService,
    private readonly documentInteractor: DocumentInteractor
  ) {}

  /**
   * Создание расхода в CAPITAL контракте
   */
  async createExpense(data: CreateExpenseInputDTO): Promise<TransactResult> {
    return await this.expensesManagementInteractor.createExpense(data);
  }

  /**
   * Получение расходов с пагинацией
   */
  async getExpenses(
    filter?: ExpenseFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<ExpenseOutputDTO>> {
    const result = await this.expensesManagementInteractor.getExpenses(filter, options);

    // Асинхронная обработка каждого элемента
    const items = await Promise.all(result.items.map((item) => this.mapExpenseToOutputDTO(item)));

    return {
      ...result,
      items,
    };
  }

  /**
   * Получение расхода по ID
   */
  async getExpenseById(data: GetExpenseInputDTO): Promise<ExpenseOutputDTO | null> {
    const expense = await this.expensesManagementInteractor.getExpenseById(data._id);
    return expense ? await this.mapExpenseToOutputDTO(expense) : null;
  }

  /**
   * Маппинг доменной сущности в DTO
   */
  private async mapExpenseToOutputDTO(expense: ExpenseDomainEntity): Promise<ExpenseOutputDTO> {
    // Асинхронная обработка документов с использованием DocumentAggregationService
    const [expense_statement, approved_statement, authorization] = await Promise.all([
      expense.expense_statement
        ? this.documentAggregationService.buildDocumentAggregate(expense.expense_statement)
        : Promise.resolve(null),
      expense.approved_statement
        ? this.documentAggregationService.buildDocumentAggregate(expense.approved_statement)
        : Promise.resolve(null),
      expense.authorization
        ? this.documentAggregationService.buildDocumentAggregate(expense.authorization)
        : Promise.resolve(null),
    ]);

    return {
      _id: expense._id,
      id: expense.id,
      block_num: expense.block_num,
      present: expense.present,
      status: expense.status,
      expense_hash: expense.expense_hash,
      coopname: expense.coopname,
      username: expense.username,
      project_hash: expense.project_hash,
      fund_id: Number(expense.fund_id),
      blockchain_status: expense.blockchain_status,
      amount: expense.amount,
      description: expense.description,
      spended_at: expense.spended_at,
      expense_statement,
      approved_statement,
      authorization,
      _created_at: expense._created_at,
      _updated_at: expense._updated_at,
    };
  }

  // ============ МЕТОДЫ ГЕНЕРАЦИИ ДОКУМЕНТОВ ============

  /**
   * Генерация заявления о расходе
   */
  async generateExpenseStatement(
    data: GenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentInteractor.generateDocument({
      data: {
        ...data,
        registry_id: Cooperative.Registry.ExpenseStatement.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

  /**
   * Генерация решения о расходе
   */
  async generateExpenseDecision(
    data: GenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentInteractor.generateDocument({
      data: {
        ...data,
        registry_id: Cooperative.Registry.ExpenseDecision.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }
}
