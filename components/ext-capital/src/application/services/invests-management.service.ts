import { Injectable } from '@nestjs/common';
import { InvestsManagementInteractor } from '../use-cases/invests-management.interactor';
import type { CreateProjectInvestInputDTO } from '../dto/invests_management/create-project-invest-input.dto';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import type { TransactResult } from '@wharfkit/session';
import { InvestOutputDTO } from '../dto/invests_management/invest.dto';
import { ProgramInvestOutputDTO } from '../dto/invests_management/program-invest.dto';
import { InvestFilterInputDTO } from '../dto/invests_management/invest-filter.input';
import { PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import type { PaginationInputDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { GenerateDocumentInputDTO } from '~/application/document/dto/generate-document-input.dto';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import { Cooperative } from 'cooptypes';
import { generateRandomHash } from '~/utils/generate-hash.util';

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

  /**
   * Получение всех программных инвестиций
   */
  async getProgramInvests(
    filter?: InvestFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<ProgramInvestOutputDTO>> {
    // Конвертируем параметры пагинации в доменные
    const domainOptions: PaginationInputDomainInterface | undefined = options;

    // Получаем результат с пагинацией из домена
    const result = await this.investsManagementInteractor.getProgramInvests(filter, domainOptions);

    // Конвертируем результат в DTO
    return {
      items: result.items as ProgramInvestOutputDTO[],
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  /**
   * Получение программной инвестиции по ID
   */
  async getProgramInvestById(_id: string): Promise<ProgramInvestOutputDTO | null> {
    const programInvest = await this.investsManagementInteractor.getProgramInvestById(_id);
    return programInvest as ProgramInvestOutputDTO | null;
  }

  // ============ МЕТОДЫ ГЕНЕРАЦИИ ДОКУМЕНТОВ ============

  /**
   * Генерация заявления об инвестировании в капитализацию
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
