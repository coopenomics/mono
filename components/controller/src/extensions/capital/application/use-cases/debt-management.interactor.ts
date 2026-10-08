import { Injectable, Inject } from '@nestjs/common';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import type { CreateDebtDomainInput } from '../../domain/actions/create-debt-domain-input.interface';
import { DEBT_REPOSITORY, DebtRepository } from '../../domain/repositories/debt.repository';
import { DebtDomainEntity } from '../../domain/entities/debt.entity';
import type { DebtFilterInputDTO } from '../dto/debt_management/debt-filter.input';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
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
    // Договор уходит отдельным действием той же транзакции (debtcontract).
    const { contract: _contract, ...statementData } = data;
    const blockchainData = {
      ...statementData,
      statement: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.statement),
    };

    // Вызываем блокчейн порт
    return await this.capitalBlockchainPort.createDebt(blockchainData, {
      coopname: data.coopname,
      username: data.username,
      debt_hash: data.debt_hash,
      contract: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.contract),
    });
  }

  // ============ МЕТОДЫ ЧТЕНИЯ ДАННЫХ ============

  /**
   * Получение всех долгов с фильтрацией и пагинацией
   */
  /** Повтор платежа по займу после отказа кассира. */
  async retryDebtPayment(coopname: string, debt_hash: string): Promise<InnerTransactResult> {
    return await this.capitalBlockchainPort.retryDebtPayment({ coopname, debt_hash });
  }

  async getDebts(
    filter?: DebtFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<DebtDomainEntity>> {
    return await this.debtRepository.findAllPaginated(filter, options);
  }

  /**
   * Получение долга по ID
   */
  async getDebtById(_id: string): Promise<DebtDomainEntity | null> {
    return await this.debtRepository.findById(_id);
  }
}
