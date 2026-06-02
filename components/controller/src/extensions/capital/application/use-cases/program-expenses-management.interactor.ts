import { Inject, Injectable } from '@nestjs/common';
import { CAPITAL_BLOCKCHAIN_PORT, CapitalBlockchainPort } from '../../domain/interfaces/capital-blockchain.port';
import type { TransactResult } from '@wharfkit/session';
import type {
  ApproveProgramExpenseInputDTO,
  AuthorizeProgramExpenseInputDTO,
  CreateProgramExpenseInputDTO,
  DeclineProgramExpenseInputDTO,
  PayProgramExpenseInputDTO,
  TopupProgramExpensePoolInputDTO,
} from '../dto/program_expenses_management/inputs.dto';
import {
  PROGRAM_EXPENSE_REPOSITORY,
  type ProgramExpenseRepository,
} from '../../domain/repositories/program-expense.repository';
import { ProgramExpenseDomainEntity } from '../../domain/entities/program-expense.entity';
import type { ProgramExpenseFilterInputDTO } from '../dto/program_expenses_management/program-expense-filter.input';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';

/**
 * Интерактор расходов программы Благорост (Эпик B).
 * Расходы программы — траты средств программы вне аллокации в конкретный проект
 * (зарплата команды, общие услуги программы и т.п.). Пул `program_expense_pool`
 * наполняется chairman-action `topupprogexp` из BLAGOROST_POOL.
 */
@Injectable()
export class ProgramExpensesManagementInteractor {
  constructor(
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort,
    @Inject(PROGRAM_EXPENSE_REPOSITORY)
    private readonly programExpenseRepository: ProgramExpenseRepository,
  ) {}

  async createProgramExpense(data: CreateProgramExpenseInputDTO): Promise<TransactResult> {
    return this.capitalBlockchainPort.createProgramExpense(data as never);
  }

  async approveProgramExpense(data: ApproveProgramExpenseInputDTO): Promise<TransactResult> {
    return this.capitalBlockchainPort.approveProgramExpense(data as never);
  }

  async authProgramExpense(data: AuthorizeProgramExpenseInputDTO): Promise<TransactResult> {
    return this.capitalBlockchainPort.authProgramExpense(data as never);
  }

  async payProgramExpense(data: PayProgramExpenseInputDTO): Promise<TransactResult> {
    return this.capitalBlockchainPort.payProgramExpense(data as never);
  }

  async declineProgramExpense(data: DeclineProgramExpenseInputDTO): Promise<TransactResult> {
    return this.capitalBlockchainPort.declineProgramExpense(data as never);
  }

  async topupProgramExpense(data: TopupProgramExpensePoolInputDTO): Promise<TransactResult> {
    return this.capitalBlockchainPort.topupProgramExpense(data as never);
  }

  // ─── read-path ──────────────────────────────────────────────────────────

  async getProgramExpenses(
    filter?: ProgramExpenseFilterInputDTO,
    options?: PaginationInputDomainInterface,
  ): Promise<PaginationResultDomainInterface<ProgramExpenseDomainEntity>> {
    return this.programExpenseRepository.findAllPaginated(filter, options);
  }

  async getProgramExpenseById(_id: string): Promise<ProgramExpenseDomainEntity | null> {
    return this.programExpenseRepository.findById(_id);
  }
}
