import { Injectable, Inject } from '@nestjs/common';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import type { CreateProjectInvestDomainInput } from '../../domain/actions/create-project-invest-domain-input.interface';
import type { TransactResult } from '@wharfkit/session';
import { INVEST_REPOSITORY, InvestRepository } from '../../domain/repositories/invest.repository';
import { PROGRAM_INVEST_REPOSITORY, ProgramInvestRepository } from '../../domain/repositories/program-invest.repository';
import { APPENDIX_REPOSITORY, AppendixRepository } from '../../domain/repositories/appendix.repository';
import { CONTRIBUTOR_REPOSITORY, ContributorRepository } from '../../domain/repositories/contributor.repository';
import { InvestDomainEntity } from '../../domain/entities/invest.entity';
import { ProgramInvestDomainEntity } from '../../domain/entities/program-invest.entity';
import type { InvestFilterInputDTO } from '../dto/invests_management/invest-filter.input';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { InvestSyncService } from '../syncers/invest-sync.service';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { GenerationMoneyInvestStatementGenerateDocumentInputDTO } from '~/application/document/documents-dto/generation-money-invest-statement-document.dto';
import { CurrencyValidationUtil } from '~/utils/currency-validation.util';
import { Cooperative } from 'cooptypes';

/**
 * Интерактор домена для управления инвестициями CAPITAL контракта
 * Обрабатывает действия связанные с инвестициями в проекты
 */
@Injectable()
export class InvestsManagementInteractor {
  constructor(
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort,
    @Inject(INVEST_REPOSITORY)
    private readonly investRepository: InvestRepository,
    @Inject(PROGRAM_INVEST_REPOSITORY)
    private readonly programInvestRepository: ProgramInvestRepository,
    @Inject(APPENDIX_REPOSITORY)
    private readonly appendixRepository: AppendixRepository,
    @Inject(CONTRIBUTOR_REPOSITORY)
    private readonly contributorRepository: ContributorRepository,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils,
    private readonly investSyncService: InvestSyncService,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(InvestsManagementInteractor.name);
  }

  /**
   * Подготавливает данные для генерации заявления об инвестировании в генерацию
   * Находит соглашения пользователя по project_hash и извлекает родительское соглашение
   */
  async prepareGenerationMoneyInvestStatementData(
    data: GenerationMoneyInvestStatementGenerateDocumentInputDTO,
    currentUser: MonoAccountDomainInterface
  ): Promise<Cooperative.Registry.GenerationMoneyInvestStatement.Action> {
    const projectHash = data.project_hash;
    if (!projectHash) {
      throw new Error('project_hash обязателен для генерации заявления об инвестировании');
    }

    // 1. Находим подтвержденное приложение пользователя по project_hash
    const userAppendix = await this.appendixRepository.findConfirmedByUsernameAndProjectHash(
      currentUser.username,
      projectHash
    );

    if (!userAppendix) {
      throw new Error(`Не найдено подтвержденное соглашение пользователя ${currentUser.username} для проекта ${projectHash}`);
    }

    // 2. Получаем contributor_hash и contributor_created_at из приложения к проекту
    const contributorHash = userAppendix.appendix?.meta?.contributor_hash;
    const contributorCreatedAt = userAppendix.appendix?.meta?.contributor_created_at;

    if (!contributorHash || !contributorCreatedAt) {
      throw new Error('Не найдены данные участника в приложении к проекту');
    }
    console.log('userAppendix.appendix?.meta', userAppendix.appendix?.meta)
    // 3. Получаем parent_hash из метаданных документа приложения к проекту
    const parentAppendixHash = userAppendix.appendix?.meta?.parent_appendix_hash;

    if (!parentAppendixHash) {
      throw new Error('Не найден parent_appendix_hash в метаданных приложения к проекту');
    }

    // 4. Находим родительское приложение по parent_appendix_hash
    const parentAppendix = await this.appendixRepository.findByAppendixHash(parentAppendixHash);

    if (!parentAppendix) {
      throw new Error(`Не найдено родительское соглашение с hash ${parentAppendixHash}`);
    }

    // 5. Получаем created_at из метаданных родительского документа
    const appendixCreatedAt = parentAppendix.appendix?.meta?.created_at;

    if (!appendixCreatedAt) {
      throw new Error('Не найдена дата создания родительского соглашения');
    }

    // Проверяем, что amount содержит правильный символ валюты
    CurrencyValidationUtil.validateCurrencySymbol(data.amount, 'сумме инвестирования');

    // 6. Возвращаем enriched data с данными родительского соглашения
    return {
      ...data,
      appendix_hash: parentAppendix.appendix_hash,
      appendix_created_at: appendixCreatedAt,
      contributor_hash: contributorHash,
      contributor_created_at: contributorCreatedAt,
      project_hash: projectHash,
    };
  }

  /**
   * Инвестирование в проект CAPITAL контракта
   */
  async createProjectInvest(
    data: CreateProjectInvestDomainInput,
    _currentUser: MonoAccountDomainInterface
  ): Promise<TransactResult> {
    // Преобразовываем доменный документ в формат блокчейна
    const blockchainData = {
      ...data,
      statement: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.statement),
    };

    // Вызываем блокчейн порт
    const transactResult = await this.capitalBlockchainPort.createProjectInvest(blockchainData);

    return transactResult;
  }


  // ============ МЕТОДЫ ЧТЕНИЯ ДАННЫХ ============

  /**
   * Получение всех инвестиций с фильтрацией и пагинацией
   */
  async getInvests(
    filter?: InvestFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<InvestDomainEntity>> {
    return await this.investRepository.findAllPaginated(filter, options);
  }

  /**
   * Получение всех программных инвестиций
   */
  async getProgramInvests(
    filter?: InvestFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<ProgramInvestDomainEntity>> {
    return await this.programInvestRepository.findAllPaginated(filter, options);
  }

  /**
   * Получение инвестиции по ID
   */
  async getInvestById(_id: string): Promise<InvestDomainEntity | null> {
    return await this.investRepository.findById(_id);
  }

  /**
   * Получение программной инвестиции по ID
   */
  async getProgramInvestById(_id: string): Promise<ProgramInvestDomainEntity | null> {
    return await this.programInvestRepository.findById(_id);
  }
}
