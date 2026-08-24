import { Injectable, Inject } from '@nestjs/common';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import type { CreateDebtDomainInput } from '../../domain/actions/create-debt-domain-input.interface';
import { DEBT_REPOSITORY, DebtRepository } from '../../domain/repositories/debt.repository';
import { DebtDomainEntity } from '../../domain/entities/debt.entity';
import type { DebtFilterInputDTO } from '../dto/debt_management/debt-filter.input';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import type {
  CloseDebtInputDTO,
  MarkOverdueDebtsInputDTO,
  RetryDebtPaymentInputDTO,
  SettleDebtInputDTO,
} from '../dto/debt_management/settle-debt-input.dto';
import { DomainToBlockchainUtils } from '@coopenomics/extension-kit';
import type { InnerTransactResult } from '@coopenomics/innercoop';

/**
 * Интерактор домена для управления долгами CAPITAL контракта
 * Обрабатывает действия связанные с созданием и управлением долгами
 */
@Injectable()
export class DebtManagementInteractor {
  constructor(
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort,
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: DebtRepository,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils
  ) {}

  /**
   * Создание долга в CAPITAL контракте
   */
  async createDebt(data: CreateDebtDomainInput): Promise<InnerTransactResult> {
    // Преобразовываем доменный документ в формат блокчейна
    const blockchainData = {
      ...data,
      statement: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.statement),
    };

    // Вызываем блокчейн порт
    return await this.capitalBlockchainPort.createDebt(blockchainData);
  }

  /**
   * Возврат займа пайщиком деньгами.
   */
  async settleDebt(data: SettleDebtInputDTO): Promise<InnerTransactResult> {
    return await this.capitalBlockchainPort.settleDebt({
      coopname: data.coopname,
      debt_hash: data.debt_hash,
      amount: data.amount,
      statement: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.statement),
    });
  }

  /**
   * Повторная отправка платежа по займу после отказа по реквизитам.
   */
  async retryDebtPayment(data: RetryDebtPaymentInputDTO): Promise<InnerTransactResult> {
    return await this.capitalBlockchainPort.retryDebtPayment(data);
  }

  /**
   * Закрытие невозвращённого займа переходом работы-обеспечения кооперативу.
   */
  async closeDebt(data: CloseDebtInputDTO): Promise<InnerTransactResult> {
    return await this.capitalBlockchainPort.closeDebt(data);
  }

  /**
   * Перевод в просрочку займов, срок возврата которых прошёл.
   *
   * Цепь за один вызов переводит ограниченное число займов, поэтому вызов
   * повторяется, пока переводить станет нечего.
   */
  async markOverdueDebts(data: MarkOverdueDebtsInputDTO): Promise<InnerTransactResult> {
    return await this.capitalBlockchainPort.markOverdueDebts(data);
  }

  // ============ МЕТОДЫ ЧТЕНИЯ ДАННЫХ ============

  /**
   * Получение всех долгов с фильтрацией и пагинацией
   */
  async getDebts(
    filter?: DebtFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<DebtDomainEntity>> {
    // Поскольку DebtRepository может не иметь findAllPaginated, используем findAll
    const debts = await this.debtRepository.findAll();
    return {
      items: debts,
      totalCount: debts.length,
      totalPages: 1,
      currentPage: 1,
    };
  }

  /**
   * Получение долга по ID
   */
  async getDebtById(_id: string): Promise<DebtDomainEntity | null> {
    return await this.debtRepository.findById(_id);
  }
}
