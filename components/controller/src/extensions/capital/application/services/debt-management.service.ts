import { Inject, Injectable } from '@nestjs/common';
import { DebtManagementInteractor } from '../use-cases/debt-management.interactor';
import type { CreateDebtInputDTO } from '../dto/debt_management/create-debt-input.dto';
import type {
  CloseDebtInputDTO,
  MarkOverdueDebtsInputDTO,
  RetryDebtPaymentInputDTO,
  SettleDebtInputDTO,
} from '../dto/debt_management/settle-debt-input.dto';
import { DebtOutputDTO } from '../dto/debt_management/debt.dto';
import { DebtFilterInputDTO } from '../dto/debt_management/debt-filter.input';
import { PaginationInputDTO, PaginationResult, GenerateDocumentOptionsInputDTO, GeneratedDocumentDTO, GenerateDocumentInputDTO } from '@coopenomics/extension-kit';
import { Cooperative } from 'cooptypes';
import { DOCUMENT_PORT, type IDocumentPort,
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
    @Inject(DOCUMENT_PORT) private readonly documentPort: IDocumentPort
  ) {}

  /**
   * Создание долга в CAPITAL контракте
   */
  async createDebt(data: CreateDebtInputDTO): Promise<InnerTransactResult> {
    return await this.debtManagementInteractor.createDebt(data);
  }

  /**
   * Возврат займа пайщиком деньгами
   */
  async settleDebt(data: SettleDebtInputDTO): Promise<InnerTransactResult> {
    return await this.debtManagementInteractor.settleDebt(data);
  }

  /**
   * Повторная отправка платежа по займу после отказа по реквизитам
   */
  async retryDebtPayment(data: RetryDebtPaymentInputDTO): Promise<InnerTransactResult> {
    return await this.debtManagementInteractor.retryDebtPayment(data);
  }

  /**
   * Закрытие невозвращённого займа переходом работы-обеспечения кооперативу
   */
  async closeDebt(data: CloseDebtInputDTO): Promise<InnerTransactResult> {
    return await this.debtManagementInteractor.closeDebt(data);
  }

  /**
   * Перевод в просрочку займов, срок возврата которых прошёл
   */
  async markOverdueDebts(data: MarkOverdueDebtsInputDTO): Promise<InnerTransactResult> {
    return await this.debtManagementInteractor.markOverdueDebts(data);
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

  // ============ МЕТОДЫ ГЕНЕРАЦИИ ДОКУМЕНТОВ ============

  /**
   * Генерация заявления о получении займа
   */
  async generateGetLoanStatement(
    data: GenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentPort.generate({
      data: {
        ...data,
        registry_id: Cooperative.Registry.GetLoanStatement.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

  /**
   * Генерация решения о получении займа
   */
  async generateGetLoanDecision(
    data: GenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentPort.generate({
      data: {
        ...data,
        registry_id: Cooperative.Registry.GetLoanDecision.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }
}
