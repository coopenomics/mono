import { Injectable, Inject } from '@nestjs/common';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import type { CreateProjectInvestDomainInput } from '../../domain/actions/create-project-invest-domain-input.interface';
import type { CreateProgramInvestDomainInput } from '../../domain/actions/create-program-invest-domain-input.interface';
import type { AllocateFundsInputDTO } from '../dto/invests_management/allocate-funds.input';
import { INVEST_REPOSITORY, InvestRepository } from '../../domain/repositories/invest.repository';
import { APPENDIX_REPOSITORY, AppendixRepository } from '../../domain/repositories/appendix.repository';
import { CONTRIBUTOR_REPOSITORY, ContributorRepository } from '../../domain/repositories/contributor.repository';
import { InvestDomainEntity } from '../../domain/entities/invest.entity';
import type { InvestFilterInputDTO } from '../dto/invests_management/invest-filter.input';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { InvestSyncService } from '../syncers/invest-sync.service';
import { LOGGER_PORT, type ILoggerPort,
  type InnerTransactResult,
} from '@coopenomics/innercoop';
import { GenerationMoneyInvestStatementGenerateDocumentInputDTO } from '../documents-dto/generation-money-invest-statement-document.dto';
import { CurrencyValidationUtil } from '~/utils/currency-validation.util';
import { Cooperative } from 'cooptypes';
import { PROJECT_REPOSITORY, ProjectRepository } from '../../domain/repositories/project.repository';
import { SEGMENT_REPOSITORY, SegmentRepository } from '../../domain/repositories/segment.repository';
import { assertBlockchainProject } from '../../domain/utils/assert-blockchain-project';
import type { DeallocateFundsInputDTO } from '../dto/invests_management/deallocate-funds.input';
import type { DeallocationLimitInputDTO } from '../dto/invests_management/deallocation-limit.dto';
import { calculateDeallocationLimit, type DeallocationLimit } from '../../domain/utils/deallocation-limit';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import { DomainToBlockchainUtils } from '@coopenomics/extension-kit';

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
    @Inject(APPENDIX_REPOSITORY)
    private readonly appendixRepository: AppendixRepository,
    @Inject(CONTRIBUTOR_REPOSITORY)
    private readonly contributorRepository: ContributorRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(SEGMENT_REPOSITORY)
    private readonly segmentRepository: SegmentRepository,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils,
    private readonly investSyncService: InvestSyncService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(InvestsManagementInteractor.name);
  }

  /**
   * Подготавливает данные для генерации заявления об инвестировании в генерацию
   * Находит соглашения пользователя по project_hash и извлекает родительское соглашение
   */
  async prepareGenerationMoneyInvestStatementData(
    data: GenerationMoneyInvestStatementGenerateDocumentInputDTO,
    currentUser: IMonoAccount
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
    _currentUser: IMonoAccount
  ): Promise<InnerTransactResult> {
    const project = await this.projectRepository.findByHash(data.project_hash.toLowerCase());
    assertBlockchainProject(project, 'инвестирование');

    // Преобразовываем доменный документ в формат блокчейна
    const blockchainData = {
      ...data,
      statement: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.statement),
    };

    // Вызываем блокчейн порт
    const transactResult = await this.capitalBlockchainPort.createProjectInvest(blockchainData);

    return transactResult;
  }

  /**
   * Программная денежная инвестиция (createpinv)
   */
  async createProgramInvest(
    data: CreateProgramInvestDomainInput,
    _currentUser: IMonoAccount
  ): Promise<InnerTransactResult> {
    const blockchainData = {
      coopname: data.coopname,
      username: data.username,
      invest_hash: data.invest_hash,
      amount: data.amount,
      statement: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.statement),
    };

    return await this.capitalBlockchainPort.createProgramInvest(blockchainData);
  }

  /**
   * Направление средств программы в проект или компонент (allocate)
   */
  async allocateFunds(data: AllocateFundsInputDTO): Promise<InnerTransactResult> {
    const project_hash = data.project_hash.toLowerCase();
    const project = await this.projectRepository.findByHash(project_hash);
    assertBlockchainProject(project, 'направление средств');

    return await this.capitalBlockchainPort.allocateFunds({
      coopname: data.coopname,
      project_hash,
      amount: data.amount,
    });
  }

  /**
   * Возврат ранее направленных средств из компонента в программу
   */
  async deallocateFunds(data: DeallocateFundsInputDTO): Promise<InnerTransactResult> {
    const project_hash = data.project_hash.toLowerCase();
    const project = await this.projectRepository.findByHash(project_hash);
    assertBlockchainProject(project, 'возврат средств');

    return await this.capitalBlockchainPort.deallocateFunds({
      coopname: data.coopname,
      project_hash,
      amount: data.amount,
    });
  }

  /**
   * Сколько средств можно вернуть из компонента в программу.
   *
   * Предел считается по данным цепи, синхронизированным в базу. Контракт
   * проверяет ту же границу сам — здесь она нужна, чтобы показать председателю
   * потолок до отправки транзакции.
   */
  async getDeallocationLimit(data: DeallocationLimitInputDTO): Promise<DeallocationLimit> {
    const project_hash = data.project_hash.toLowerCase();
    const project = await this.projectRepository.findByHash(project_hash);
    assertBlockchainProject(project, 'расчёт доступного возврата');

    // Без постраничного вывода: предел считается по самому «дорогому» заёмщику,
    // и пропущенный участник дал бы сумму, которую контракт отклонит
    const segments = await this.segmentRepository.findAllByProjectHash(data.coopname, project_hash);

    return calculateDeallocationLimit(
      {
        // Неизвестный цепи статус маппится в UNDEFINED и в разрешённые не попадает —
        // при рассинхроне схемы возврат закрывается, а не открывается наугад
        status: project.status,
        ...(project.fact ?? {}),
      },
      segments
    );
  }

  // ============ МЕТОДЫ ЧТЕНИЯ ДАННЫХ ============

  /**
   * Получение всех инвестиций с фильтрацией и пагинацией
   */
  async getInvests(
    filter?: InvestFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<InvestDomainEntity>> {
    return await this.investRepository.findAllPaginated(filter, options);
  }

  /**
   * Получение инвестиции по ID
   */
  async getInvestById(_id: string): Promise<InvestDomainEntity | null> {
    return await this.investRepository.findById(_id);
  }
}
