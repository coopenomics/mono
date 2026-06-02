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

/**
 * Сервис уровня приложения для расходов программы Благорост (Эпик B).
 *
 * Генерация документов — через общие `capitalGenerateExpenseStatement` /
 * `capitalGenerateExpenseDecision` (registry 1010/1011), см.
 * `ExpensesManagementService`.
 */
@Injectable()
export class ProgramExpensesManagementService {
  constructor(private readonly interactor: ProgramExpensesManagementInteractor) {}

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
}
