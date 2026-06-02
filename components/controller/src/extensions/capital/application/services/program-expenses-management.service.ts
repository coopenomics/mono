import { Injectable } from '@nestjs/common';
import { Cooperative } from 'cooptypes';
import type { TransactResult } from '@wharfkit/session';
import { ProgramExpensesManagementInteractor } from '../use-cases/program-expenses-management.interactor';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import { GenerateDocumentInputDTO } from '~/application/document/dto/generate-document-input.dto';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
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
 */
@Injectable()
export class ProgramExpensesManagementService {
  constructor(
    private readonly interactor: ProgramExpensesManagementInteractor,
    private readonly documentInteractor: DocumentInteractor,
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

  async generateProgramExpenseStatement(
    data: GenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO,
  ): Promise<GeneratedDocumentDTO> {
    return (await this.documentInteractor.generateDocument({
      data: { ...data, registry_id: Cooperative.Registry.ExpenseStatement.registry_id },
      options,
    })) as GeneratedDocumentDTO;
  }

  async generateProgramExpenseDecision(
    data: GenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO,
  ): Promise<GeneratedDocumentDTO> {
    return (await this.documentInteractor.generateDocument({
      data: { ...data, registry_id: Cooperative.Registry.ExpenseDecision.registry_id },
      options,
    })) as GeneratedDocumentDTO;
  }
}
