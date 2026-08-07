import { Injectable } from '@nestjs/common';
import { InvestsManagementInteractor } from '../use-cases/invests-management.interactor';
import type { CreateProjectInvestInputDTO } from '../dto/invests_management/create-project-invest-input.dto';
import type { CreateProgramInvestInputDTO } from '../dto/invests_management/create-program-invest-input.dto';
import type { AllocateFundsInputDTO } from '../dto/invests_management/allocate-funds.input';
import type { DeallocateFundsInputDTO } from '../dto/invests_management/deallocate-funds.input';
import type {
  DeallocationLimitInputDTO,
  DeallocationLimitOutputDTO,
} from '../dto/invests_management/deallocation-limit.dto';
import { AssetUtils } from '~/shared/utils/asset.utils';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import type { TransactResult } from '@wharfkit/session';
import { InvestOutputDTO } from '../dto/invests_management/invest.dto';
import { InvestFilterInputDTO } from '../dto/invests_management/invest-filter.input';
import { PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import type { PaginationInputDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { GenerateDocumentInputDTO } from '~/application/document/dto/generate-document-input.dto';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import { Cooperative } from 'cooptypes';
import { generateRandomHash } from '~/utils/generate-hash.util';
import { CurrencyValidationUtil } from '~/utils/currency-validation.util';
import { verifySignedDocumentAgainstStoredDraft } from '~/utils/signed-document-draft-verification.util';

/**
 * Сервис уровня приложения для управления инвестициями CAPITAL
 * Обрабатывает запросы от InvestsManagementResolver
 */
@Injectable()
export class InvestsManagementService {
  constructor(
    private readonly investsManagementInteractor: InvestsManagementInteractor,
    private readonly documentInteractor: DocumentInteractor
  ) {}

  /**
   * Инвестирование в проект CAPITAL контракта
   */
  async createProjectInvest(
    data: CreateProjectInvestInputDTO,
    currentUser: MonoAccountDomainInterface
  ): Promise<TransactResult> {
    CurrencyValidationUtil.validateCurrencySymbol(data.amount, 'сумме инвестиции');
    await verifySignedDocumentAgainstStoredDraft(
      (docHash) => this.documentInteractor.getDocumentByHash(docHash),
      data.statement,
      [
        { field: 'amount', expected: data.amount, mode: 'currency_amount' },
        { field: 'project_hash', expected: data.project_hash, mode: 'hex_case_insensitive' },
      ],
    );

    // Генерируем уникальный хэш инвестиции
    const invest_hash = generateRandomHash();

    return await this.investsManagementInteractor.createProjectInvest(
      {
        ...data,
        invest_hash,
      },
      currentUser
    );
  }

  /**
   * Программная денежная инвестиция (createpinv)
   */
  async createProgramInvest(
    data: CreateProgramInvestInputDTO,
    currentUser: MonoAccountDomainInterface
  ): Promise<TransactResult> {
    CurrencyValidationUtil.validateCurrencySymbol(data.amount, 'сумме программной инвестиции');
    await verifySignedDocumentAgainstStoredDraft(
      (docHash) => this.documentInteractor.getDocumentByHash(docHash),
      data.statement,
      [{ field: 'amount', expected: data.amount, mode: 'currency_amount' }],
    );

    const invest_hash = generateRandomHash();

    return await this.investsManagementInteractor.createProgramInvest(
      {
        ...data,
        invest_hash,
      },
      currentUser
    );
  }

  /**
   * Направление средств программы в проект или компонент (allocate)
   */
  async allocateFunds(data: AllocateFundsInputDTO): Promise<TransactResult> {
    CurrencyValidationUtil.validateCurrencySymbol(data.amount, 'сумме направляемых средств');

    return await this.investsManagementInteractor.allocateFunds(data);
  }

  /**
   * Возврат ранее направленных средств из компонента в программу
   */
  async deallocateFunds(data: DeallocateFundsInputDTO): Promise<TransactResult> {
    CurrencyValidationUtil.validateCurrencySymbol(data.amount, 'сумме возвращаемых средств');

    return await this.investsManagementInteractor.deallocateFunds(data);
  }

  /**
   * Предел возврата средств из компонента в программу
   */
  async getDeallocationLimit(data: DeallocationLimitInputDTO): Promise<DeallocationLimitOutputDTO> {
    const limit = await this.investsManagementInteractor.getDeallocationLimit(data);
    const { symbol } = limit;

    return {
      max_amount: AssetUtils.formatAsset(limit.max_amount, symbol),
      program_invest_pool: AssetUtils.formatAsset(limit.program_invest_pool, symbol),
      unspent: AssetUtils.formatAsset(limit.unspent, symbol),
      outstanding_debt: AssetUtils.formatAsset(limit.outstanding_debt, symbol),
      is_allowed_by_status: limit.is_allowed_by_status,
    };
  }

  // ============ МЕТОДЫ ЧТЕНИЯ ДАННЫХ ============

  /**
   * Получение всех инвестиций с фильтрацией
   */
  async getInvests(filter?: InvestFilterInputDTO, options?: PaginationInputDTO): Promise<PaginationResult<InvestOutputDTO>> {
    // Конвертируем параметры пагинации в доменные
    const domainOptions: PaginationInputDomainInterface | undefined = options;

    // Получаем результат с пагинацией из домена
    const result = await this.investsManagementInteractor.getInvests(filter, domainOptions);

    // Конвертируем результат в DTO
    return {
      items: result.items as InvestOutputDTO[],
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  /**
   * Получение инвестиции по ID
   */
  async getInvestById(_id: string): Promise<InvestOutputDTO | null> {
    const invest = await this.investsManagementInteractor.getInvestById(_id);
    return invest as InvestOutputDTO | null;
  }

  // ============ МЕТОДЫ ГЕНЕРАЦИИ ДОКУМЕНТОВ ============

  /**
   * Генерация заявления об инвестировании в благорост
   */
  async generateCapitalizationMoneyInvestStatement(
    data: GenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentInteractor.generateDocument({
      data: {
        ...data,
        registry_id: Cooperative.Registry.CapitalizationMoneyInvestStatement.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }
}
