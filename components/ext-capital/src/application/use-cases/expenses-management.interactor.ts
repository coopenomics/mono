import { Injectable, Inject } from '@nestjs/common';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import { ExpenseRepository, EXPENSE_REPOSITORY } from '../../domain/repositories/expense.repository';
import type { TransactResult } from '@wharfkit/session';
import type { CreateExpenseDomainInput } from '../../domain/actions/create-expense-domain-input.interface';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import type { ExpenseFilterInputDTO } from '../dto/expenses_management/expense-filter.input';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { ExpenseDomainEntity } from '../../domain/entities/expense.entity';

/**
 * Интерактор домена для управления расходами CAPITAL контракта
 * Обрабатывает действия связанные с жизненным циклом расходов
 */
@Injectable()
export class ExpensesManagementInteractor {
  constructor(
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort,
    @Inject(EXPENSE_REPOSITORY)
    private readonly expenseRepository: ExpenseRepository,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils
  ) {}

  /**
   * Создание расхода в CAPITAL контракте
   */
  async createExpense(data: CreateExpenseDomainInput): Promise<TransactResult> {
    // Преобразовываем доменный документ в формат блокчейна
    const blockchainData = {
      ...data,
      statement: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.statement),
    };

    // Вызываем блокчейн порт
    return await this.capitalBlockchainPort.createExpense(blockchainData);
  }

  /**
   * Получение расходов с пагинацией
   */
  async getExpenses(
    filter?: ExpenseFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<ExpenseDomainEntity>> {
    return await this.expenseRepository.findAllPaginated(filter, options);
  }

  /**
   * Получение расхода по ID
   */
  async getExpenseById(_id: string): Promise<ExpenseDomainEntity | null> {
    return await this.expenseRepository.findById(_id);
  }
}
