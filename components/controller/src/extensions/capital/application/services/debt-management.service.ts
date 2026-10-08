import { Inject, Injectable } from '@nestjs/common';
import { DebtManagementInteractor } from '../use-cases/debt-management.interactor';
import type { CreateDebtInputDTO } from '../dto/debt_management/create-debt-input.dto';
import { DebtOutputDTO } from '../dto/debt_management/debt.dto';
import { DebtFilterInputDTO } from '../dto/debt_management/debt-filter.input';
import { DomainError, PaginationInputDTO, PaginationResult, GenerateDocumentOptionsInputDTO, GeneratedDocumentDTO } from '@coopenomics/extension-kit';
import httpStatus from 'http-status';
import type {
  CapitalDebtRefInputDTO,
  CapitalLoanContractGenerateInputDTO,
  CapitalLoanDecisionGenerateInputDTO,
  CapitalLoanStatementGenerateInputDTO,
} from '../dto/debt_management/loan-document-input.dto';
import { Cooperative } from 'cooptypes';
import {
  DOCUMENT_PORT,
  USER_DATA_PORT,
  type IDocumentPort,
  type IUserDataPort,
  type InnerTransactResult,
} from '@coopenomics/innercoop';

/**
 * Сервис уровня приложения для управления долгами CAPITAL
 * Обрабатывает запросы от DebtManagementResolver
 */
@Injectable()
export class DebtManagementService {
  constructor(
    private readonly debtManagementInteractor: DebtManagementInteractor,
    @Inject(DOCUMENT_PORT) private readonly documentPort: IDocumentPort,
    @Inject(USER_DATA_PORT) private readonly userData: IUserDataPort
  ) {}

  /**
   * Создание долга в CAPITAL контракте
   */
  async createDebt(data: CreateDebtInputDTO): Promise<InnerTransactResult> {
    return await this.debtManagementInteractor.createDebt(data);
  }

  // ============ МЕТОДЫ ЧТЕНИЯ ДАННЫХ ============

  /**
   * Получение всех долгов с фильтрацией
   */
  async getDebts(filter?: DebtFilterInputDTO, options?: PaginationInputDTO): Promise<PaginationResult<DebtOutputDTO>> {
    // Конвертируем параметры пагинации в доменные
    const domainOptions: PaginationInputDTO | undefined = options;

    // Получаем результат с пагинацией из домена
    const result = await this.debtManagementInteractor.getDebts(filter, domainOptions);

    // Конвертируем результат в DTO
    return {
      items: result.items as DebtOutputDTO[],
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  /**
   * Получение долга по ID
   */
  async getDebtById(_id: string): Promise<DebtOutputDTO | null> {
    const debt = await this.debtManagementInteractor.getDebtById(_id);
    return debt as DebtOutputDTO | null;
  }

  /** Повтор платежа по займу после отказа кассира. */
  async retryDebtPayment(data: CapitalDebtRefInputDTO): Promise<InnerTransactResult> {
    return await this.debtManagementInteractor.retryDebtPayment(data.coopname, data.debt_hash);
  }

  // ============ МЕТОДЫ ГЕНЕРАЦИИ ДОКУМЕНТОВ ============

  /**
   * Заём под коммиты оформляется на основании договора об участии, обеспечение —
   * имущество на ответственном хранении по приложению к этому договору. Номер
   * приложения берётся из сведений пайщика, записанных при регистрации в программе.
   */
  private async loanBasis(coopname: string, username: string, known?: string): Promise<Record<string, string>> {
    const number =
      known ||
      (await this.userData.get(coopname, username, Cooperative.Model.UdataKey.BLAGOROST_STORAGE_AGREEMENT_NUMBER))?.value;
    if (!number) {
      throw new DomainError('CAPITAL_LOAN_STORAGE_APPENDIX_NOT_FOUND', { username }, httpStatus.CONFLICT);
    }
    return { basis_type: 'uhd', storage_appendix_number: String(number) };
  }

  /** Заявление о получении займа под коммиты. */
  async generateGetLoanStatement(
    data: CapitalLoanStatementGenerateInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentPort.generate({
      data: {
        ...data,
        ...(await this.loanBasis(data.coopname, data.username)),
        registry_id: Cooperative.Registry.GetLoanStatement.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

  /** Договор займа под обеспечение имуществом на ответственном хранении. */
  async generateLoanContract(
    data: CapitalLoanContractGenerateInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentPort.generate({
      data: {
        ...data,
        ...(await this.loanBasis(data.coopname, data.username)),
        registry_id: Cooperative.Registry.LoanContractProperty.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

  /** Протокол решения совета о предоставлении займа под коммиты. */
  async generateGetLoanDecision(
    data: CapitalLoanDecisionGenerateInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const { storage_appendix_number, ...rest } = data;
    const document = await this.documentPort.generate({
      data: {
        ...rest,
        ...(await this.loanBasis(data.coopname, data.username, storage_appendix_number)),
        registry_id: Cooperative.Registry.GetLoanDecision.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }
}
