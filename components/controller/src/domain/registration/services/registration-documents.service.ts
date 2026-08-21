import { Injectable, Inject, Logger } from '@nestjs/common';
import { AgreementConfigurationService, AGREEMENT_CONFIGURATION_SERVICE } from './agreement-configuration.service';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import type { IProgramDocumentParametersHook } from '@coopenomics/innercoop';
import { RegistrationDocumentParametersRegistry } from './registration-document-parameters.registry';
import type { IAgreementConfigItem } from '../config/agreement-config.interface';
import type {
  IGenerateRegistrationDocumentsInput,
  IGenerateRegistrationDocumentsOutput,
  IGeneratedRegistrationDocument,
} from '../interfaces/registration-documents.interface';
import type { AccountType } from '~/application/account/enum/account-type.enum';
import { ProgramKey } from '../enum';

export const REGISTRATION_DOCUMENTS_SERVICE = Symbol('RegistrationDocumentsService');

/**
 * Сервис для генерации пакета документов при регистрации пайщика
 *
 * ВАЖНО: параметры оферт берутся из `RegistrationDocumentParametersRegistry` —
 * туда их кладёт само расширение при запуске. Слот может быть пуст: расширения
 * (Благорост, Стол заказов) может не быть в кооперативе, и это нормальный
 * случай — генерация продолжается без параметров.
 */
@Injectable()
export class RegistrationDocumentsService {
  private readonly logger = new Logger(RegistrationDocumentsService.name);

  constructor(
    @Inject(AGREEMENT_CONFIGURATION_SERVICE)
    private readonly agreementConfigService: AgreementConfigurationService,
    @Inject(DocumentInteractor)
    private readonly documentInteractor: DocumentInteractor,
    private readonly parametersRegistry: RegistrationDocumentParametersRegistry
  ) {}

  /**
   * Генерирует пакет документов для регистрации пайщика
   * @param input - входные данные для генерации
   * @returns пакет сгенерированных документов с метаданными
   */
  async generateRegistrationDocuments(
    input: IGenerateRegistrationDocumentsInput
  ): Promise<IGenerateRegistrationDocumentsOutput> {
    const { coopname, username, account_type, program_key } = input;

    this.logger.log(
      `Начало генерации документов для регистрации: username=${username}, account_type=${account_type}, program_key=${program_key || 'не указан'}`
    );

    // ВАЖНО: Проверяем, что запрашиваемый тип аккаунта совпадает с типом зарегистрированного кандидата
    // Эта проверка делается на уровне сервиса для ранней валидации
    // (дополнительная проверка также будет в registerParticipant)

    // Получаем список соглашений для данного типа аккаунта и выбранной программы
    const agreementsConfig = this.agreementConfigService.getAgreementsForAccountType(
      account_type,
      coopname,
      program_key
    );

    this.logger.log(`Найдено ${agreementsConfig.length} соглашений для типа ${account_type} (кооператив: ${coopname})`);

    // ВАЖНО: Сначала генерируем параметры документов в Udata для оферт
    // Это необходимо сделать ДО генерации самих документов
    await this.generateDocumentParameters(coopname, username, program_key);

    // Параллельно генерируем все документы
    const generationPromises = agreementsConfig.map((config) => this.generateSingleDocument(coopname, username, config));

    const documents = await Promise.all(generationPromises);

    this.logger.log(`Успешно сгенерировано ${documents.length} документов для ${username}`);

    return {
      documents,
      account_type,
      username,
    };
  }

  /**
   * Генерирует параметры документов в Udata на основе выбранной программы
   * 
   * ВАЖНО: реализацию берём из реестра — её кладёт туда само расширение при
   * запуске. Если расширения (например, Capital) в кооперативе нет, слот пуст
   * и метод просто пропускает генерацию параметров.
   */
  private async generateDocumentParameters(
    coopname: string,
    username: string,
    program_key?: string
  ): Promise<void> {
    if (!program_key) {
      this.logger.warn(`Программа не выбрана для ${username}, параметры документов не генерируются`);
      return;
    }

    switch (program_key) {
      case ProgramKey.CAPITALIZATION: {
        // Путь Благороста: генерируем параметры для оферты Благорост
        const capitalPort = this.requireCapitalPort(username);
        if (!capitalPort) return;
        await capitalPort.generateBlagorostOfferParameters(coopname, username);
        break;
      }

      case ProgramKey.GENERATION: {
        // Путь Генератора: генерируем параметры для оферты Генератор
        const capitalPort = this.requireCapitalPort(username);
        if (!capitalPort) return;
        await capitalPort.generateGeneratorOfferParameters(coopname, username);
        break;
      }

      case ProgramKey.MARKETPLACE:
        // Путь ЦПП «Стол заказов»: персональный номер+дата оферты пайщика в Udata,
        // которые читает фабрика инстанса оферты (registry 1102). Отдельный порт,
        // т.к. marketplace независим от capital.
        const marketplaceParameters = this.parametersRegistry.marketplaceParameters();
        if (!marketplaceParameters) {
          this.logger.warn(
            `Хук параметров оферты «Стол заказов» не зарегистрирован. Пропуск генерации для ${username}. ` +
            `Убедитесь, что установлено расширение marketplace.`
          );
          return;
        }
        await marketplaceParameters.generateMarketplaceOfferParameters(coopname, username);
        break;

      default: {
        // Общий путь: расширение зарегистрировало хук под ключом своей программы.
        const offerParameters = this.parametersRegistry.programOfferParameters(program_key);
        if (!offerParameters) {
          this.logger.warn(`Хук параметров оферт программы ${program_key} не зарегистрирован — генерация параметров для ${username} пропущена`);
          return;
        }
        await offerParameters.generateOfferParameters(coopname, username);
      }
    }
  }

  /**
   * Capital-порт обязателен для путей Благороста/Генератора. Если расширение не
   * установлено — параметры не сгенерировать; логируем и возвращаем undefined
   * (вызывающий пропускает генерацию, как раньше).
   */
  private requireCapitalPort(username: string): IProgramDocumentParametersHook | undefined {
    const programParameters = this.parametersRegistry.programParameters();
    if (!programParameters) {
      this.logger.warn(
        `Хук параметров программных оферт не зарегистрирован. Пропуск генерации параметров документов для ${username}. ` +
        `Убедитесь, что установлено соответствующее расширение (например, Capital).`
      );
      return undefined;
    }
    return programParameters;
  }

  /**
   * Генерирует один документ на основе конфигурации
   */
  private async generateSingleDocument(
    coopname: string,
    username: string,
    config: IAgreementConfigItem
  ): Promise<IGeneratedRegistrationDocument> {
    this.logger.debug(`Генерация документа: ${config.id} (registry_id=${config.registry_id})`);

    // Если шаблон оферты требует PrivateData, расширение-владелец предоставило
    // резолвер hash'а в спеке регистрации — ядро не знает ни источника значения,
    // ни того, какие registry_id этого требуют.
    const doc_data_hash = config.resolve_doc_data_hash ? await config.resolve_doc_data_hash() : undefined;

    const document = await this.documentInteractor.generateDocument({
      data: {
        coopname,
        username,
        registry_id: config.registry_id,
        ...(doc_data_hash ? { doc_data_hash } : {}),
      },
      options: {
        skip_save: false, // Сохраняем документ в базу для последующей сверки
      },
    });

    return {
      id: config.id,
      agreement_type: config.agreement_type,
      title: config.title,
      checkbox_text: config.checkbox_text,
      link_text: config.link_text,
      document: {
        full_title: document.full_title,
        html: document.html,
        hash: document.hash,
        meta: document.meta,
        binary: document.binary,
      },
      is_blockchain_agreement: config.is_blockchain_agreement,
      link_to_statement: config.link_to_statement,
      order: config.order,
    };
  }

  /**
   * Получить список идентификаторов документов, которые нужно линковать в заявление
   * @param accountType - тип аккаунта
   * @param coopname - название кооператива (для временного исключения blagorost_offer)
   * @param programKey - ключ выбранной программы регистрации
   * @returns массив id документов для линковки
   */
  getLinkedDocumentIds(accountType: AccountType, coopname?: string, programKey?: ProgramKey): string[] {
    return this.agreementConfigService.getLinkedAgreements(accountType, coopname, programKey).map((a) => a.id);
  }

  /**
   * Получить список идентификаторов документов, которые нужно отправить в блокчейн
   * @param accountType - тип аккаунта
   * @param coopname - название кооператива (для временного исключения blagorost_offer)
   * @param programKey - ключ выбранной программы регистрации
   * @returns массив id документов для отправки в блокчейн
   */
  getBlockchainDocumentIds(accountType: AccountType, coopname?: string, programKey?: ProgramKey): string[] {
    return this.agreementConfigService.getBlockchainAgreements(accountType, coopname, programKey).map((a) => a.id);
  }
}
