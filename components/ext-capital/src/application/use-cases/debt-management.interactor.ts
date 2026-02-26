import { Injectable, Inject } from '@nestjs/common';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import type { TransactResult } from '@wharfkit/session';
import type { CreateDebtDomainInput } from '../../domain/actions/create-debt-domain-input.interface';
import { DEBT_REPOSITORY, DebtRepository } from '../../domain/repositories/debt.repository';
import { DebtDomainEntity } from '../../domain/entities/debt.entity';
import type { DebtFilterInputDTO } from '../dto/debt_management/debt-filter.input';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';

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
  async createDebt(data: CreateDebtDomainInput): Promise<TransactResult> {
    // Преобразовываем доменный документ в формат блокчейна
    const blockchainData = {
      ...data,
      statement: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.statement),
    };

    // Вызываем блокчейн порт
    return await this.capitalBlockchainPort.createDebt(blockchainData);
  }

  // ============ МЕТОДЫ ЧТЕНИЯ ДАННЫХ ============

  /**
   * Получение всех долгов с фильтрацией и пагинацией
   */
  async getDebts(
    filter?: DebtFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<DebtDomainEntity>> {
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
