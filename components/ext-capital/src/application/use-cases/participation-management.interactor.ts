import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  CapitalBlockchainPort,
  CAPITAL_BLOCKCHAIN_PORT,
} from '../../domain/interfaces/capital-blockchain.port';
import type { ImportContributorDomainInput } from '../../domain/actions/import-contributor-domain-input.interface';
import type { RegisterContributorDomainInput } from '../../domain/actions/register-contributor-domain-input.interface';
import type { EditContributorDomainInput } from '../../domain/actions/edit-contributor-domain-input.interface';
import type { MakeClearanceDomainInput } from '../../domain/actions/make-clearance-domain-input.interface';
import type { IAppendixDatabaseData } from '../../domain/interfaces/appendix-database.interface';
import type { TransactResult } from '@wharfkit/session';
import {
  CONTRIBUTOR_REPOSITORY,
  ContributorRepository,
} from '../../domain/repositories/contributor.repository';
import {
  APPENDIX_REPOSITORY,
  AppendixRepository,
} from '../../domain/repositories/appendix.repository';
import { ContributorDomainEntity } from '../../domain/entities/contributor.entity';
import { AppendixDomainEntity } from '../../domain/entities/appendix.entity';
import { ContributorStatus } from '../../domain/enums/contributor-status.enum';
import { AppendixStatus } from '../../domain/enums/appendix-status.enum';
import type { ContributorFilterInputDTO } from '../dto/participation_management/contributor-filter.input';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { ProjectGenerationContractGenerateDocumentInputDTO } from '~/application/document/documents-dto/project-generation-agreement-document.dto';
import type { ComponentGenerationContractGenerateDocumentInputDTO } from '~/application/document/documents-dto/component-generation-agreement-document.dto';
import type { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import type { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import {
  AccountDataPort,
  ACCOUNT_DATA_PORT,
} from '~/domain/account/ports/account-data.port';
import { config } from '~/config';
import { HttpApiError } from '~/utils/httpApiError';
import httpStatus from 'http-status';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import { Cooperative } from 'cooptypes';
import { EMPTY_HASH } from '~/shared/utils/constants';
import { ProjectManagementInteractor } from '../use-cases/project-management.interactor';
import { generateRandomHash, generateUniqueHash } from '~/utils/generate-hash.util';
import type { MakeClearanceInputDTO } from '../dto/participation_management/make-clearance-input.dto';
import { CANDIDATE_REPOSITORY, CandidateRepository } from '~/domain/account/repository/candidate.repository';
import { UdataDocumentParametersService, UDATA_DOCUMENT_PARAMETERS_SERVICE } from '../../domain/services/udata-document-parameters.service';
import { ProgramKey } from '~/domain/registration/enum';
import type { GenerateCapitalRegistrationDocumentsDomainInput } from '../../domain/actions/generate-capital-registration-documents-domain-input.interface';
import type { GenerateCapitalRegistrationDocumentsDomainOutput } from '../../domain/actions/generate-capital-registration-documents-domain-output.interface';
import type { CompleteCapitalRegistrationDomainInput } from '../../domain/actions/complete-capital-registration-domain-input.interface';

/**
 * Интерактор домена для управления участием в CAPITAL контракте
 * Обрабатывает действия связанные с участниками и их регистрацией
 */
@Injectable()
export class ParticipationManagementInteractor {
  private readonly logger = new Logger(ParticipationManagementInteractor.name);

  constructor(
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort,
    @Inject(CONTRIBUTOR_REPOSITORY)
    private readonly contributorRepository: ContributorRepository,
    @Inject(APPENDIX_REPOSITORY)
    private readonly appendixRepository: AppendixRepository,
    @Inject(ACCOUNT_DATA_PORT)
    private readonly accountDataPort: AccountDataPort,
    @Inject(CANDIDATE_REPOSITORY)
    private readonly candidateRepository: CandidateRepository,
    @Inject(UDATA_DOCUMENT_PARAMETERS_SERVICE)
    private readonly udataDocumentParametersService: UdataDocumentParametersService,
    private readonly projectManagementInteractor: ProjectManagementInteractor,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils,
    private readonly documentInteractor: DocumentInteractor,
  ) { }

  /**
   * Получение отображаемого имени из аккаунта через порт расширения
   */
  private async getDisplayNameFromAccount(username: string): Promise<string> {
    return await this.accountDataPort.getDisplayName(username);
  }

  /**
   * Импорт участника в CAPITAL контракт
   */
  async importContributor(
    data: ImportContributorDomainInput
  ): Promise<TransactResult> {
    // Проверяем, не существует ли уже участник с указанным username
    const existingContributor = await this.contributorRepository.findByUsername(data.username);

    if (existingContributor) {
      throw new HttpApiError(
        httpStatus.CONFLICT,
        `Участник с именем пользователя ${data.username} уже зарегистрирован в программе`
      );
    }

    // Генерируем уникальный contributor_hash автоматически
    const contributor_hash = generateRandomHash();

    // Получаем отображаемое имя из аккаунта
    const displayName = await this.getDisplayNameFromAccount(data.username);

    // Создаем участника в репозитории (данные базы данных)
    const contributor = new ContributorDomainEntity({
      _id: '', // будет сгенерирован автоматически
      block_num: 0,
      present: true,
      coopname: config.coopname,
      username: data.username,
      contributor_hash: contributor_hash,
      status: ContributorStatus.PENDING,
      _created_at: new Date(),
      _updated_at: new Date(),
      display_name: displayName,
      about: '',
      program_key: undefined,
      blagorost_offer_hash: undefined,
      generator_offer_hash: undefined,
      generation_contract_hash: undefined,
      storage_agreement_hash: undefined,
      blagorost_agreement_hash: undefined,
    });

    // Подготавливаем данные для блокчейна с сгенерированным хешем
    const blockchainData = {
      ...data,
      contributor_hash: contributor_hash,
      memo: data.memo ?? '',
    };

    // Вызываем блокчейн порт
    const result = await this.capitalBlockchainPort.importContributor(blockchainData);

    // Создаем участника в репозитории
    await this.contributorRepository.create(contributor);

    // Сохраняем параметры договора в UData через публичный метод сервиса
    await this.udataDocumentParametersService.saveContributorContractParameters(
      data.coopname,
      data.username,
      data.contributor_contract_number,
      data.contributor_contract_created_at
    );

    // Синхронизация автоматически обновит данные из блокчейна
    return result;
  }

  /**
   * Регистрация участника в CAPITAL контракте
   */
  async registerContributor(
    data: RegisterContributorDomainInput
  ): Promise<TransactResult> {
    // Извлекаем документ из базы данных для верификации
    const document = await this.documentInteractor.getDocumentByHash(
      data.contract.doc_hash
    );

    if (!document) {
      throw new HttpApiError(
        httpStatus.BAD_REQUEST,
        `Документ с хэшем ${data.contract.doc_hash} не найден`
      );
    }

    // Проверяем, что username в документе совпадает с переданным
    if (document.meta.username !== data.username) {
      throw new HttpApiError(
        httpStatus.BAD_REQUEST,
        `Username в документе (${document.meta.username}) не совпадает с переданным (${data.username})`
      );
    }

    // Проверяем, что contributor_hash в документе совпадает с переданным
    if (document.meta.contributor_hash !== data.contributor_hash) {
      throw new HttpApiError(
        httpStatus.BAD_REQUEST,
        `Contributor hash в документе (${document.meta.contributor_hash}) не совпадает с переданным (${data.contributor_hash})`
      );
    }

    // Получаем отображаемое имя из аккаунта
    const displayName = await this.getDisplayNameFromAccount(data.username);

    // Получаем candidate для извлечения program_key и хешей оферт
    const candidate = await this.candidateRepository.findByUsername(data.username);

    // Определяем хеш оферты на основе выбранной программы
    let blagorostOfferHash: string | undefined;
    let generatorOfferHash: string | undefined;

    if (candidate) {
      if (candidate.documents?.blagorost_offer) {
        blagorostOfferHash = candidate.documents.blagorost_offer.doc_hash;
      }
      if (candidate.documents?.generator_offer) {
        generatorOfferHash = candidate.documents.generator_offer.doc_hash;
      }
    }

    // Используем contributor_hash из документа
    const databaseData = {
      _id: '', // будет сгенерирован автоматически
      block_num: 0,
      present: false,
      coopname: data.coopname,
      username: data.username,
      contributor_hash: data.contributor_hash,
      status: ContributorStatus.PENDING,
      about: data.about ?? '',
      _created_at: new Date(),
      _updated_at: new Date(),
      display_name: displayName,
      program_key: candidate?.program_key, // Сохраняем выбранную программу
      blagorost_offer_hash: blagorostOfferHash, // Хеш оферты Благорост (если была выбрана)
      generator_offer_hash: generatorOfferHash, // Хеш оферты Генератор (если была выбрана)
      generation_contract_hash: data.contract.doc_hash, // Сохраняем хеш договора УХД
      storage_agreement_hash: undefined, // Соглашение о хранении еще не создано
      blagorost_agreement_hash: undefined, // Соглашение Благорост еще не создано
    };

    // Создаем пустой документ для случаев когда соглашения еще не готовы
    const createEmptyDocument = () => ({
      version: '1.0',
      hash: EMPTY_HASH,
      doc_hash: EMPTY_HASH,
      meta_hash: EMPTY_HASH,
      meta: '',
      signatures: [],
    });

    // Преобразовываем доменный документ в формат блокчейна
    const blockchainAction = {
      ...data,
      contributor_hash: data.contributor_hash,
      rate_per_hour:
        data.rate_per_hour ?? '0.0000 ' + config.blockchain.root_govern_symbol,
      hours_per_day: data.hours_per_day ?? 0,
      is_external_contract: false,
      contract:
        this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(
          data.contract
        ),
      // В основной регистрации соглашения еще не готовы, передаем пустые документы
      storage_agreement: createEmptyDocument(),
      blagorost_agreement: createEmptyDocument(),
    };

    // Вызываем блокчейн порт для регистрации - получаем транзакцию
    const result = await this.capitalBlockchainPort.registerContributor(
      blockchainAction
    );

    // Получаем данные участника из блокчейна после регистрации
    const blockchainData = await this.capitalBlockchainPort.getContributor(
      data.coopname,
      data.username
    );

    if (!blockchainData) {
      throw new HttpApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Не удалось получить данные участника ${databaseData.contributor_hash} из блокчейна после регистрации`
      );
    }

    // Создаем полный объект участника, объединяя данные базы и блокчейна
    const fullContributor = new ContributorDomainEntity(
      databaseData,
      blockchainData
    );

    // Сохраняем полный объект в репозиторий
    await this.contributorRepository.create(fullContributor);

    return result;
  }

  /**
   * Подписание приложения в CAPITAL контракте
   * Теперь принимает минимальный набор данных и подписанный документ
   */
  async makeClearance(data: MakeClearanceInputDTO): Promise<TransactResult> {
    console.log('data', data)
    // Извлекаем документ из базы данных для верификации
    const document = await this.documentInteractor.getDocumentByHash(
      data.document.doc_hash
    );

    if (!document) {
      throw new HttpApiError(
        httpStatus.BAD_REQUEST,
        `Документ с хэшем ${data.document.doc_hash.toUpperCase()} не найден`
      );
    }

    // Извлекаем appendix_hash из метаданных документа
    const appendix_hash = (document.meta as any).appendix_hash;

    //TODO: адаптировать или документ или код ниже к parent_appendix_hash
    if (!appendix_hash) {
      throw new HttpApiError(
        httpStatus.BAD_REQUEST,
        'В документе отсутствует appendix_hash'
      );
    }

    // Проверяем, есть ли уже запрос на рассмотрении для данного пользователя и проекта
    const existingAppendix =
      await this.appendixRepository.findCreatedByUsernameAndProjectHash(
        data.username,
        data.project_hash
      );

    if (existingAppendix) {
      throw new HttpApiError(
        httpStatus.CONFLICT,
        'Подождите, ваш запрос на рассмотрении'
      );
    }

    // Проверяем, что username в документе совпадает с переданным
    if (document.meta.username !== data.username) {
      throw new HttpApiError(
        httpStatus.BAD_REQUEST,
        `Username в документе (${document.meta.username}) не совпадает с переданным (${data.username})`
      );
    }

    // Формируем доменный input с полными данными
    const domainInput: MakeClearanceDomainInput = {
      coopname: data.coopname,
      username: data.username,
      project_hash: data.project_hash,
      appendix_hash,
      document: data.document,
      contribution: data.contribution,
    };

    return await this.makeClearanceDomain(domainInput);
  }

  /**
   * Доменная логика подписания приложения в CAPITAL контракте
   */
  private async makeClearanceDomain(
    data: MakeClearanceDomainInput
  ): Promise<TransactResult> {
    // Создаем базовые данные appendix для базы данных
    const databaseData: IAppendixDatabaseData = {
      _id: '',
      block_num: undefined,
      present: false, // Важно: изначально present = false
      appendix_hash: data.appendix_hash, // Используем переданный хэш
      status: AppendixStatus.CREATED,
      blockchain_status: undefined,
      contribution: data.contribution,
      _created_at: new Date(),
      _updated_at: new Date(),
    };

    // ШАГ 1: Частичное сохранение в базу данных
    const partialAppendix = new AppendixDomainEntity(databaseData);
    const savedAppendix = await this.appendixRepository.save(partialAppendix);

    // ШАГ 2: Вызываем блокчейн порт для makeClearance
    const result = await this.capitalBlockchainPort.makeClearance({
      coopname: data.coopname,
      username: data.username,
      project_hash: data.project_hash,
      appendix_hash: partialAppendix.appendix_hash,
      document:
        this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(
          data.document
        ),
    });

    // ШАГ 3: Получаем данные appendix из блокчейна после makeClearance
    const blockchainData = await this.capitalBlockchainPort.getAppendix(
      data.coopname,
      partialAppendix.appendix_hash
    );

    if (!blockchainData) {
      throw new HttpApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Не удалось получить данные appendix ${partialAppendix.appendix_hash} из блокчейна после makeClearance`
      );
    }
    // ШАГ 4: Обновляем существующую запись полными данными
    savedAppendix.updateFromBlockchain(
      blockchainData,
      Number(result.transaction?.ref_block_num) ?? 0,
      true
    );
    await this.appendixRepository.save(savedAppendix);

    return result;
  }

  /**
   * Редактирование участника в CAPITAL контракте
   */
  async editContributor(
    data: EditContributorDomainInput
  ): Promise<TransactResult> {
    // Находим участника в базе данных для обновления поля about
    const contributor = await this.getContributorByCriteria({
      username: data.username,
    });

    if (!contributor) {
      throw new HttpApiError(
        httpStatus.NOT_FOUND,
        `Участник ${data.username} не найден в кооперативе ${data.coopname}`
      );
    }

    // Обновляем поле about в базе данных, если оно передано
    if (data.about !== undefined) {
      contributor.about = data.about;
      await this.contributorRepository.update(contributor);
    }

    // Отправляем в блокчейн только параметры для редактирования (rate_per_hour и hours_per_day)
    const blockchainData = {
      coopname: data.coopname,
      username: data.username,
      rate_per_hour:
        data.rate_per_hour ?? '0.0000 ' + config.blockchain.root_govern_symbol,
      hours_per_day: data.hours_per_day ?? 0,
    };

    // Вызываем блокчейн порт для редактирования участника
    const result = await this.capitalBlockchainPort.editContributor(
      blockchainData
    );

    // Синхронизация автоматически обновит данные из блокчейна
    return result;
  }

  /**
   * Генерация документа приложения к договору участия для проекта (1002)
   */
  async generateProjectGenerationContract(
    data: ProjectGenerationContractGenerateDocumentInputDTO,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    // 1. Получаем данные участника
    const contributor = await this.getContributorByCriteria({
      username: data.username,
    });

    if (!contributor) {
      throw new HttpApiError(
        httpStatus.NOT_FOUND,
        `Участник ${data.username} не найден`
      );
    }

    // 2. Получаем данные проекта
    const project = await this.projectManagementInteractor.getProjectByHash(
      data.project_hash
    );

    if (!project) {
      throw new HttpApiError(
        httpStatus.NOT_FOUND,
        `Проект с хэшем ${data.project_hash} не найден`
      );
    }

    // 3. Проверяем, что проект не является компонентом
    const isComponent = Boolean(
      project.parent_hash && project.parent_hash !== EMPTY_HASH
    );

    if (isComponent) {
      throw new HttpApiError(
        httpStatus.BAD_REQUEST,
        `Проект ${data.project_hash} является компонентом. Используйте generateComponentGenerationContract`
      );
    }

    // 4. Генерируем уникальный хэш для приложения
    const appendix_hash = generateUniqueHash();

    // 5. Формируем данные для генерации документа
    const documentData = {
      coopname: data.coopname,
      username: data.username,
      lang: data.lang || 'ru',
      registry_id: Cooperative.Registry.ProjectGenerationContract.registry_id,
      appendix_hash,
      contributor_hash: contributor.contributor_hash,
      contributor_created_at: contributor.created_at,
      project_name: project.title || project.data || '',
      project_hash: project.project_hash,
    };

    // 6. Генерируем документ
    const document = await this.documentInteractor.generateDocument({
      data: documentData,
      options: options || {},
    });

    return document as GeneratedDocumentDTO;
  }

  /**
   * Генерация документа дополнения к приложению для компонента (1003)
   */
  async generateComponentGenerationContract(
    data: ComponentGenerationContractGenerateDocumentInputDTO,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    // 1. Получаем данные участника
    const contributor = await this.getContributorByCriteria({
      username: data.username,
    });

    if (!contributor) {
      throw new HttpApiError(
        httpStatus.NOT_FOUND,
        `Участник ${data.username} не найден`
      );
    }

    // 2. Получаем данные компонента
    const component = await this.projectManagementInteractor.getProjectByHash(
      data.component_hash
    );

    if (!component) {
      throw new HttpApiError(
        httpStatus.NOT_FOUND,
        `Компонент с хэшем ${data.component_hash} не найден`
      );
    }

    // 3. Проверяем, что это действительно компонент
    const isComponent = Boolean(
      component.parent_hash && component.parent_hash !== EMPTY_HASH
    );

    if (!isComponent) {
      throw new HttpApiError(
        httpStatus.BAD_REQUEST,
        `Проект ${data.component_hash} не является компонентом. Используйте generateProjectGenerationContract`
      );
    }

    // 4. Получаем родительский проект
    const parentProject = await this.projectManagementInteractor.getProjectByHash(
      data.parent_project_hash
    );

    if (!parentProject) {
      throw new HttpApiError(
        httpStatus.NOT_FOUND,
        `Родительский проект с хэшем ${data.parent_project_hash} не найден`
      );
    }

    // 5. Проверяем, что component действительно дочерний для parent_project
    if (component.parent_hash !== parentProject.project_hash) {
      throw new HttpApiError(
        httpStatus.BAD_REQUEST,
        `Компонент ${data.component_hash} не является дочерним для проекта ${data.parent_project_hash}`
      );
    }

    // 6. Находим родительское приложение (appendix) к родительскому проекту
    const parentAppendix = await this.appendixRepository.findCreatedByUsernameAndProjectHash(
      data.username,
      parentProject.project_hash
    );

    if (!parentAppendix) {
      throw new HttpApiError(
        httpStatus.NOT_FOUND,
        `Не найдено приложение к родительскому проекту ${parentProject.project_hash} для пользователя ${data.username}`
      );
    }

    // 7. Генерируем уникальный хэш для дополнения к приложению
    const appendix_hash = generateUniqueHash();

    // 8. Формируем данные для генерации документа
    const documentData = {
      coopname: data.coopname,
      username: data.username,
      lang: data.lang || 'ru',
      registry_id: Cooperative.Registry.ComponentGenerationContract.registry_id,
      appendix_hash,
      parent_appendix_hash: parentAppendix.appendix_hash,
      contributor_hash: contributor.contributor_hash,
      contributor_created_at: contributor.created_at,
      component_name: component.title || component.data || '',
      component_hash: component.project_hash,
      project_name: parentProject.title || parentProject.data || '',
      project_hash: parentProject.project_hash,
    };

    // 9. Генерируем документ
    const document = await this.documentInteractor.generateDocument({
      data: documentData,
      options: options || {},
    });

    return document as GeneratedDocumentDTO;
  }

  // ============ МЕТОДЫ ЧТЕНИЯ ДАННЫХ ============

  /**
   * Получение всех участников с фильтрацией и пагинацией
   */
  async getContributors(
    filter?: ContributorFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<ContributorDomainEntity>> {
    return await this.contributorRepository.findAllPaginated(filter, options);
  }

  /**
   * Получение участника по ID
   */
  async getContributorById(
    _id: string
  ): Promise<ContributorDomainEntity | null> {
    return await this.contributorRepository.findById(_id);
  }

  /**
   * Получение участника по критериям поиска
   * Ищет по _id, username или contributor_hash
   */
  async getContributorByCriteria(criteria: {
    _id?: string;
    username?: string;
    contributor_hash?: string;
  }): Promise<ContributorDomainEntity | null> {
    return await this.contributorRepository.findOne(criteria);
  }

  /**
   * Генерация пачки документов для завершения регистрации в Capital
   *
   * Генерирует документы на основе наличия их хэшей в Contributor:
   * 1. GenerationContract (договор УХД) - если НЕ внешний контракт и нет хэша
   * 2. StorageAgreement (соглашение о хранении) - если нет хэша
   * 3. BlagorostAgreement (соглашение Благорост) - если нет хэша
   * 4. GeneratorOffer (соглашение Генератор) - если нет хэша
   *
   * Такая логика покрывает все случаи:
   * - Полная регистрация нового участника (генерирует только недостающий документ)
   * - Импортированный участник с внешним контрактом (генерирует оба соглашения)
   * - Повторная генерация (пропускает уже подписанные документы)
   */
  async generateCapitalRegistrationDocuments(
    data: GenerateCapitalRegistrationDocumentsDomainInput
  ): Promise<GenerateCapitalRegistrationDocumentsDomainOutput> {
    // Получаем данные участника
    let contributor = await this.contributorRepository.findOne({ username: data.username });

    // Если Contributor не найден, создаем его с пустыми хэшами
    // Это нужно для обратной совместимости с существующими пользователями
    if (!contributor) {
      this.logger.log(`Contributor для пользователя ${data.username} не найден, создаем новый`);

      // Получаем display_name через порт расширения
      const displayName = await this.accountDataPort.getDisplayName(data.username);

      const contributorData = {
        _id: '',
        present: false,
        username: data.username,
        coopname: data.coopname,
        display_name: displayName,
        program_key: ProgramKey.GENERATION, // Дефолтная программа для новых участников
        status: ContributorStatus.PENDING,
        contributor_hash: generateRandomHash(),
        blagorost_offer_hash: undefined,
        generator_offer_hash: undefined,
        generation_contract_hash: undefined,
        storage_agreement_hash: undefined,
        blagorost_agreement_hash: undefined,
      };

      contributor = new ContributorDomainEntity(contributorData);
      await this.contributorRepository.create(contributor);

      this.logger.log(`Создан Contributor для пользователя ${data.username}`);
    }

    const lang = data.lang || 'ru';

    // 1. GenerationContract (договор УХД) - генерируем только если НЕ внешний контракт И нет хэша
    let generationContract: GeneratedDocumentDTO | undefined;
    const needGenerationContract = !contributor.is_external_contract && !contributor.generation_contract_hash;

    if (needGenerationContract) {
      this.logger.log(`Генерация договора УХД для ${data.username}`);

      // Генерируем параметры для договора УХД
      await this.udataDocumentParametersService.generateGenerationContractParametersIfNotExist(data.coopname, data.username);

      generationContract = await this.documentInteractor.generateDocument({
        data: {
          coopname: data.coopname,
          username: data.username,
          lang,
          registry_id: Cooperative.Registry.GenerationContract.registry_id,
        },
        options: { skip_save: false },
      });
    } else {
      this.logger.log(`Пропуск генерации договора УХД для ${data.username}: ${contributor.is_external_contract ? 'внешний контракт' : 'уже подписан'}`);
    }

    // 2. StorageAgreement (соглашение о хранении) - генерируем если нет хэша
    let storageAgreement: GeneratedDocumentDTO | undefined;
    const needStorageAgreement = !contributor.storage_agreement_hash;

    if (needStorageAgreement) {
      this.logger.log(`Генерация соглашения о хранении для ${data.username}`);

      // Генерируем параметры для соглашения о хранении
      await this.udataDocumentParametersService.generateStorageAgreementParametersIfNotExist(data.coopname, data.username);
      // Для StorageAgreement также нужны параметры GeneratorOffer
      await this.udataDocumentParametersService.generateGeneratorOfferParametersIfNotExist(data.coopname, data.username);

      storageAgreement = await this.documentInteractor.generateDocument({
        data: {
          coopname: data.coopname,
          username: data.username,
          lang,
          registry_id: Cooperative.Registry.StorageAgreement.registry_id,
        },
        options: { skip_save: false },
      });
    } else {
      this.logger.log(`Пропуск генерации соглашения о хранении для ${data.username}: уже подписано`);
    }

    // 3. BlagorostAgreement (соглашение Благорост) - генерируем если нет ни agreement, ни offer хэша
    // (оферта Благорост тоже считается соглашением, повторно генерировать не надо)
    let blagorostAgreement: GeneratedDocumentDTO | undefined;
    const needBlagorostAgreement = !contributor.blagorost_agreement_hash && !contributor.blagorost_offer_hash;

    if (needBlagorostAgreement) {
      this.logger.log(`Генерация соглашения Благорост для ${data.username}`);

      // Генерируем параметры для соглашения Благорост
      await this.udataDocumentParametersService.generateBlagorostAgreementParametersIfNotExist(data.coopname, data.username);

      blagorostAgreement = await this.documentInteractor.generateDocument({
        data: {
          coopname: data.coopname,
          username: data.username,
          lang,
          registry_id: Cooperative.Registry.BlagorostAgreement.registry_id,
        },
        options: { skip_save: false },
      });
    } else {
      this.logger.log(`Пропуск генерации соглашения Благорост для ${data.username}: ${contributor.blagorost_offer_hash ? 'оферта уже подписана' : 'уже подписано'}`);
    }

    // 4. GeneratorOffer (оферта Генератор) - генерируем если нет хэша
    let generatorOffer: GeneratedDocumentDTO | undefined;
    const needGeneratorOffer = !contributor.generator_offer_hash;

    if (needGeneratorOffer) {
      this.logger.log(`Генерация оферты Генератор для ${data.username}`);

      // Генерируем параметры для оферты Генератор
      await this.udataDocumentParametersService.generateGeneratorOfferParametersIfNotExist(data.coopname, data.username);

      generatorOffer = await this.documentInteractor.generateDocument({
        data: {
          coopname: data.coopname,
          username: data.username,
          lang,
          registry_id: Cooperative.Registry.GeneratorOffer.registry_id,
        },
        options: { skip_save: false },
      });
    } else {
      this.logger.log(`Пропуск генерации оферты Генератор для ${data.username}: уже подписана`);
    }

    return {
      generation_contract: generationContract,
      storage_agreement: storageAgreement,
      blagorost_agreement: blagorostAgreement,
      generator_offer: generatorOffer,
    };
  }

  /**
   * Завершение регистрации в Capital через отправку документов в блокчейн
   * Отправляет документы через regcontrib с учетом выбранной программы
   */
  async completeCapitalRegistration(data: CompleteCapitalRegistrationDomainInput): Promise<TransactResult> {
    // Получаем или создаем Contributor для участника
    let contributor = await this.contributorRepository.findByUsername(data.username);

    if (!contributor) {
      // Создаем нового Contributor, если он не существует
      const displayName = await this.accountDataPort.getDisplayName(data.username);

      const contributorData = {
        _id: '',
        present: false,
        username: data.username,
        coopname: config.coopname,
        display_name: displayName,
        program_key: ProgramKey.UNDEFINED, // Для пользователей, регистрирующихся только в Capital, program_key не указан
        status: ContributorStatus.PENDING,
        contributor_hash: generateRandomHash(),
        blagorost_offer_hash: undefined,
        generator_offer_hash: undefined,
        generation_contract_hash: undefined,
        storage_agreement_hash: undefined,
        blagorost_agreement_hash: undefined,
      };

      contributor = new ContributorDomainEntity(contributorData);
      await this.contributorRepository.create(contributor);

      this.logger.log(`Создан новый Contributor для участника ${data.username} при регистрации в Capital расширении`);
    }

    // Валидация документов из базы данных
    const documentsToValidate: Array<{ hash: string; name: string }> = [
      { hash: data.storage_agreement.doc_hash, name: 'StorageAgreement' },
    ];

    // Добавляем GenerationContract только если НЕ внешний контракт
    if (!contributor.is_external_contract && data.generation_contract) {
      documentsToValidate.push({
        hash: data.generation_contract.doc_hash,
        name: 'GenerationContract'
      });
    }

    if (data.blagorost_agreement) {
      documentsToValidate.push({
        hash: data.blagorost_agreement.doc_hash,
        name: 'BlagorostAgreement'
      });
    }

    if (data.generator_offer) {
      documentsToValidate.push({
        hash: data.generator_offer.doc_hash,
        name: 'GeneratorOffer'
      });
    }

    for (const doc of documentsToValidate) {
      const document = await this.documentInteractor.getDocumentByHash(doc.hash);
      if (!document) {
        throw new HttpApiError(
          httpStatus.BAD_REQUEST,
          `Документ ${doc.name} с хэшем ${doc.hash} не найден в базе данных`
        );
      }

      if (document.meta.username !== data.username) {
        throw new HttpApiError(
          httpStatus.BAD_REQUEST,
          `Username в документе ${doc.name} не совпадает с переданным`
        );
      }
    }

    // Преобразуем документы в формат блокчейна
    const blockchainContract = data.generation_contract
      ? this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.generation_contract)
      : undefined;
    const blockchainStorageAgreement =
      this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.storage_agreement);
    const blockchainBlagorostAgreement = data.blagorost_agreement
      ? this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.blagorost_agreement)
      : undefined;
    const blockchainGeneratorAgreement = data.generator_offer
      ? this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.generator_offer)
      : undefined;

    // Форматируем rate_per_hour в asset строку
    let formattedRatePerHour: string;
    if (data.rate_per_hour) {
      formattedRatePerHour = this.domainToBlockchainUtils.formatNumericStringToAssetString(
        data.rate_per_hour,
        config.blockchain.root_govern_precision,
        config.blockchain.root_govern_symbol
      );
    } else {
      formattedRatePerHour = '0.0000 ' + config.blockchain.root_govern_symbol;
    }

    // Отправляем в блокчейн через regcontrib
    const result = await this.capitalBlockchainPort.registerContributorWithAgreements({
      coopname: data.coopname,
      username: data.username,
      contributor_hash: contributor.contributor_hash,
      rate_per_hour: formattedRatePerHour,
      hours_per_day: data.hours_per_day || 0,
      is_external_contract: contributor.is_external_contract || false,
      contract: blockchainContract,
      storage_agreement: blockchainStorageAgreement,
      blagorost_agreement: blockchainBlagorostAgreement,
      generator_agreement: blockchainGeneratorAgreement,
    });

    // Обновляем Contributor с хешами документов и данными формы
    // GenerationContract обновляем только если он был предоставлен
    if (data.generation_contract) {
      contributor.generation_contract_hash = data.generation_contract.doc_hash;
    }
    contributor.storage_agreement_hash = data.storage_agreement.doc_hash;
    if (data.blagorost_agreement) {
      contributor.blagorost_agreement_hash = data.blagorost_agreement.doc_hash;
    }
    if (data.generator_offer) {
      contributor.generator_offer_hash = data.generator_offer.doc_hash;
    }

    // Обновляем данные из формы регистрации
    if (data.about !== undefined) {
      contributor.about = data.about;
    }
    if (data.rate_per_hour !== undefined) {
      contributor.rate_per_hour = data.rate_per_hour;
    }
    if (data.hours_per_day !== undefined) {
      contributor.hours_per_day = data.hours_per_day;
    }

    await this.contributorRepository.update(contributor);

    return result;
  }
}
