import { Injectable } from '@nestjs/common';
import type { TransactResult } from '@wharfkit/session';
import { ProgramExpensesManagementInteractor } from '../use-cases/program-expenses-management.interactor';
import type {
  ApproveProgramExpenseInputDTO,
  AuthorizeProgramExpenseInputDTO,
  CreateProgramExpenseInputDTO,
  DeclineProgramExpenseInputDTO,
  PayProgramExpenseInputDTO,
  TopupProgramExpensePoolInputDTO,
} from '../dto/program_expenses_management/inputs.dto';
import type { ProgramExpenseFilterInputDTO } from '../dto/program_expenses_management/program-expense-filter.input';
import type { GetProgramExpenseInputDTO } from '../dto/program_expenses_management/get-program-expense-input.dto';
import { PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import { ProgramExpenseOutputDTO } from '../dto/program_expenses_management/program-expense.dto';
import type { ProgramExpenseDomainEntity } from '../../domain/entities/program-expense.entity';
import { DocumentAggregationService } from '~/domain/document/services/document-aggregation.service';

/**
 * Сервис уровня приложения для расходов программы Благорост (Эпик B).
 *
 * Генерация документов — через общие `capitalGenerateExpenseStatement` /
 * `capitalGenerateExpenseDecision` (registry 1010/1011), см.
 * `ExpensesManagementService`.
 */
@Injectable()
export class ProgramExpensesManagementService {
  constructor(
    private readonly interactor: ProgramExpensesManagementInteractor,
    private readonly documentAggregationService: DocumentAggregationService,
  ) {}

  createProgramExpense(data: CreateProgramExpenseInputDTO): Promise<TransactResult> {
    return this.interactor.createProgramExpense(data);
  }
  approveProgramExpense(data: ApproveProgramExpenseInputDTO): Promise<TransactResult> {
    return this.interactor.approveProgramExpense(data);
  }
  authProgramExpense(data: AuthorizeProgramExpenseInputDTO): Promise<TransactResult> {
    return this.interactor.authProgramExpense(data);
  }
  payProgramExpense(data: PayProgramExpenseInputDTO): Promise<TransactResult> {
    return this.interactor.payProgramExpense(data);
  }
  declineProgramExpense(data: DeclineProgramExpenseInputDTO): Promise<TransactResult> {
    return this.interactor.declineProgramExpense(data);
  }
  topupProgramExpense(data: TopupProgramExpensePoolInputDTO): Promise<TransactResult> {
    return this.interactor.topupProgramExpense(data);
  }

  // ─── read-path ──────────────────────────────────────────────────────────

  async getProgramExpenses(
    filter?: ProgramExpenseFilterInputDTO,
    options?: PaginationInputDTO,
  ): Promise<PaginationResult<ProgramExpenseOutputDTO>> {
    const result = await this.interactor.getProgramExpenses(filter, options);
    const items = await Promise.all(result.items.map((item) => this.mapToOutputDTO(item)));
    return { ...result, items };
  }

  async getProgramExpenseById(data: GetProgramExpenseInputDTO): Promise<ProgramExpenseOutputDTO | null> {
    const entity = await this.interactor.getProgramExpenseById(data._id);
    return entity ? this.mapToOutputDTO(entity) : null;
  }

  private async mapToOutputDTO(entity: ProgramExpenseDomainEntity): Promise<ProgramExpenseOutputDTO> {
    const [expense_statement, approved_statement, authorization] = await Promise.all([
      entity.expense_statement
        ? this.documentAggregationService.buildDocumentAggregate(entity.expense_statement)
        : Promise.resolve(null),
      entity.approved_statement
        ? this.documentAggregationService.buildDocumentAggregate(entity.approved_statement)
        : Promise.resolve(null),
      entity.authorization
        ? this.documentAggregationService.buildDocumentAggregate(entity.authorization)
        : Promise.resolve(null),
    ]);

    return {
      _id: entity._id,
      id: entity.id,
      block_num: entity.block_num,
      present: entity.present,
      status: entity.status,
      expense_hash: entity.expense_hash,
      coopname: entity.coopname,
      username: entity.username,
      fund_id: entity.fund_id as unknown as string,
      blockchain_status: entity.blockchain_status,
      amount: entity.amount,
      description: entity.description,
      spended_at: entity.spended_at,
      expense_statement,
      approved_statement,
      authorization,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };
  }
}
