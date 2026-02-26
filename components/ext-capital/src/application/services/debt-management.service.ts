import { Injectable } from '@nestjs/common';
import { DebtManagementInteractor } from '../use-cases/debt-management.interactor';
import type { CreateDebtInputDTO } from '../dto/debt_management/create-debt-input.dto';
import type { TransactResult } from '@wharfkit/session';
import { DebtOutputDTO } from '../dto/debt_management/debt.dto';
import { DebtFilterInputDTO } from '../dto/debt_management/debt-filter.input';
import { PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import type { PaginationInputDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { GenerateDocumentInputDTO } from '~/application/document/dto/generate-document-input.dto';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import { Cooperative } from 'cooptypes';

/**
 * Сервис уровня приложения для управления долгами CAPITAL
 * Обрабатывает запросы от DebtManagementResolver
 */
@Injectable()
export class DebtManagementService {
  constructor(
    private readonly debtManagementInteractor: DebtManagementInteractor,
    private readonly documentInteractor: DocumentInteractor
  ) {}

  /**
   * Создание долга в CAPITAL контракте
   */
  async createDebt(data: CreateDebtInputDTO): Promise<TransactResult> {
    return await this.debtManagementInteractor.createDebt(data);
  }

  // ============ МЕТОДЫ ЧТЕНИЯ ДАННЫХ ============

  /**
   * Получение всех долгов с фильтрацией
   */
  async getDebts(filter?: DebtFilterInputDTO, options?: PaginationInputDTO): Promise<PaginationResult<DebtOutputDTO>> {
    // Конвертируем параметры пагинации в доменные
    const domainOptions: PaginationInputDomainInterface | undefined = options;

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
    const document = await this.documentInteractor.generateDocument({
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
    const document = await this.documentInteractor.generateDocument({
      data: {
        ...data,
        registry_id: Cooperative.Registry.GetLoanDecision.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }
}
