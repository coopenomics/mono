import { Injectable } from '@nestjs/common';
import { ParticipationManagementInteractor } from '../use-cases/participation-management.interactor';
import { ProjectManagementInteractor } from '../use-cases/project-management.interactor';
import type { ImportContributorInputDTO } from '../dto/participation_management/import-contributor-input.dto';
import type { RegisterContributorInputDTO } from '../dto/participation_management/register-contributor-input.dto';
import type { EditContributorInputDTO } from '../dto/participation_management/edit-contributor-input.dto';
import type { MakeClearanceInputDTO } from '../dto/participation_management/make-clearance-input.dto';
import type { TransactResult } from '@wharfkit/session';
import { ContributorOutputDTO } from '../dto/participation_management/contributor.dto';
import { ContributorFilterInputDTO } from '../dto/participation_management/contributor-filter.input';
import { PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import type { PaginationInputDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { GenerateDocumentInputDTO } from '~/application/document/dto/generate-document-input.dto';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import { ContributorMapperService } from './contributor-mapper.service';
import { ContributorSyncService } from '../syncers/contributor-sync.service';
import { Cooperative } from 'cooptypes';
import { GenerationContractGenerateDocumentInputDTO } from '~/application/document/documents-dto/generation-agreement-document.dto';
import { ProjectGenerationContractGenerateDocumentInputDTO } from '~/application/document/documents-dto/project-generation-agreement-document.dto';
import { ComponentGenerationContractGenerateDocumentInputDTO } from '~/application/document/documents-dto/component-generation-agreement-document.dto';
import type { GenerateCapitalRegistrationDocumentsDomainInput } from '../../domain/actions/generate-capital-registration-documents-domain-input.interface';
import type { GenerateCapitalRegistrationDocumentsDomainOutput } from '../../domain/actions/generate-capital-registration-documents-domain-output.interface';
import type { CompleteCapitalRegistrationDomainInput } from '../../domain/actions/complete-capital-registration-domain-input.interface';

/**
 * Сервис уровня приложения для управления участием в CAPITAL
 * Обрабатывает запросы от ParticipationManagementResolver
 */
@Injectable()
export class ParticipationManagementService {
  constructor(
    private readonly participationManagementInteractor: ParticipationManagementInteractor,
    private readonly projectManagementInteractor: ProjectManagementInteractor,
    private readonly contributorMapperService: ContributorMapperService,
    private readonly contributorSyncService: ContributorSyncService,
    private readonly documentInteractor: DocumentInteractor
  ) { }

  /**
   * Импорт участника в CAPITAL контракт
   */
  async importContributor(data: ImportContributorInputDTO): Promise<TransactResult> {
    return await this.participationManagementInteractor.importContributor(data);
  }

  /**
   * Регистрация участника в CAPITAL контракте
   */
  async registerContributor(data: RegisterContributorInputDTO): Promise<TransactResult> {
    const result = await this.participationManagementInteractor.registerContributor(data);
    return result;
  }

  /**
   * Генерация документа приложения к договору участия для проекта (1002)
   */
  async generateProjectGenerationContract(
    data: ProjectGenerationContractGenerateDocumentInputDTO,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return await this.participationManagementInteractor.generateProjectGenerationContract(data, options);
  }

  /**
   * Генерация документа дополнения к приложению для компонента (1003)
   */
  async generateComponentGenerationContract(
    data: ComponentGenerationContractGenerateDocumentInputDTO,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return await this.participationManagementInteractor.generateComponentGenerationContract(data, options);
  }

  /**
   * Генерация пачки документов для завершения регистрации в Capital
   */
  async generateCapitalRegistrationDocuments(
    data: GenerateCapitalRegistrationDocumentsDomainInput
  ): Promise<GenerateCapitalRegistrationDocumentsDomainOutput> {
    return await this.participationManagementInteractor.generateCapitalRegistrationDocuments(data);
  }

  /**
   * Завершение регистрации в Capital через отправку документов в блокчейн
   */
  async completeCapitalRegistration(data: CompleteCapitalRegistrationDomainInput): Promise<TransactResult> {
    const transactResult = await this.participationManagementInteractor.completeCapitalRegistration(data);

    // Синхронизируем данные участника из блокчейна
    await this.contributorSyncService.syncContributor(data.coopname, data.username, transactResult);

    return transactResult;
  }

  /**
   * Подписание приложения в CAPITAL контракте
   * Теперь принимает минимальный набор данных и подписанный документ
   */
  async makeClearance(data: MakeClearanceInputDTO): Promise<TransactResult> {
    return await this.participationManagementInteractor.makeClearance(data);
  }

  /**
   * Редактирование участника в CAPITAL контракте
   */
  async editContributor(data: EditContributorInputDTO): Promise<ContributorOutputDTO> {
    // Выполняем транзакцию редактирования
    const transactResult = await this.participationManagementInteractor.editContributor(data);

    // Синхронизируем данные из блокчейна
    const syncedContributor = await this.contributorSyncService.syncContributor(
      data.coopname,
      data.username,
      transactResult
    );

    if (!syncedContributor) {
      throw new Error('Не удалось синхронизировать данные участника после редактирования');
    }

    // Возвращаем отмапленного участника
    return await this.contributorMapperService.mapContributorToOutputDTO(syncedContributor);
  }

  // ============ МЕТОДЫ ЧТЕНИЯ ДАННЫХ ============

  /**
   * Получение всех участников с фильтрацией
   */
  async getContributors(
    filter?: ContributorFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<ContributorOutputDTO>> {
    // Конвертируем параметры пагинации в доменные
    const domainOptions: PaginationInputDomainInterface | undefined = options;

    // Получаем результат с пагинацией из домена
    const result = await this.participationManagementInteractor.getContributors(filter, domainOptions);

    // Асинхронная обработка каждого элемента с использованием маппера
    const items = await Promise.all(
      result.items.map((item) => this.contributorMapperService.mapContributorToOutputDTO(item))
    );

    // Конвертируем результат в DTO
    return {
      items,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  /**
   * Получение участника по ID
   */
  async getContributorById(_id: string): Promise<ContributorOutputDTO | null> {
    const contributor = await this.participationManagementInteractor.getContributorById(_id);
    return contributor ? await this.contributorMapperService.mapContributorToOutputDTO(contributor) : null;
  }

  /**
   * Получение участника по критериям поиска
   */
  async getContributorByCriteria(criteria: {
    _id?: string;
    username?: string;
    contributor_hash?: string;
  }): Promise<ContributorOutputDTO | null> {
    const contributor = await this.participationManagementInteractor.getContributorByCriteria(criteria);
    return contributor ? await this.contributorMapperService.mapContributorToOutputDTO(contributor) : null;
  }

  // ============ МЕТОДЫ ГЕНЕРАЦИИ ДОКУМЕНТОВ ============

  /**
   * Генерация соглашения о капитализации
   */
  async generateCapitalizationAgreement(
    data: GenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentInteractor.generateDocument({
      data: {
        ...data,
        registry_id: Cooperative.Registry.BlagorostOffer.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

  /**
   * Генерация генерационного соглашения
   */
  async generateGenerationContract(
    data: GenerationContractGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentInteractor.generateDocument({
      data: {
        ...data,
        registry_id: Cooperative.Registry.GenerationContract.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }
}
