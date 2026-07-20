import { Injectable, Inject, Logger, forwardRef, Optional } from '@nestjs/common';
import { AgreementConfigurationService, AGREEMENT_CONFIGURATION_SERVICE } from './agreement-configuration.service';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import { UdataDocumentParametersPort, UDATA_DOCUMENT_PARAMETERS_PORT } from '~/domain/common/ports/udata-document-parameters.port';
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
 * ВАЖНО: Использует опциональную инъекцию UdataDocumentParametersPort.
 * Если расширение, предоставляющее реализацию порта (например, Capital), установлено,
 * то параметры документов будут генерироваться автоматически.
 * Если расширение не установлено, генерация документов продолжит работать без параметров.
 */
@Injectable()
export class RegistrationDocumentsService {
  private readonly logger = new Logger(RegistrationDocumentsService.name);

  constructor(
    @Inject(AGREEMENT_CONFIGURATION_SERVICE)
    private readonly agreementConfigService: AgreementConfigurationService,
    @Inject(forwardRef(() => DocumentInteractor))
    private readonly documentInteractor: DocumentInteractor,
    @Optional()
    @Inject(UDATA_DOCUMENT_PARAMETERS_PORT)
    private readonly udataDocumentParametersPort?: UdataDocumentParametersPort
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
   * ВАЖНО: Использует опциональный порт UdataDocumentParametersPort.
   * Если расширение, предоставляющее реализацию (например, Capital), не установлено,
   * метод просто пропустит генерацию параметров.
   */
  private async generateDocumentParameters(
    coopname: string,
    username: string,
    program_key?: string
  ): Promise<void> {
    // Проверяем наличие реализации порта
    if (!this.udataDocumentParametersPort) {
      this.logger.warn(
        `UdataDocumentParametersPort не доступен. Пропуск генерации параметров документов для ${username}. ` +
        `Убедитесь, что установлено соответствующее расширение (например, Capital).`
      );
      return;
    }

    if (!program_key) {
      this.logger.warn(`Программа не выбрана для ${username}, параметры документов не генерируются`);
      return;
    }

    switch (program_key) {
      case ProgramKey.CAPITALIZATION:
        // Путь Благороста: генерируем параметры для оферты Благорост
        await this.udataDocumentParametersPort.generateBlagorostOfferParameters(coopname, username);
        break;

      case ProgramKey.GENERATION:
        // Путь Генератора: генерируем параметры для оферты Генератор
        await this.udataDocumentParametersPort.generateGeneratorOfferParameters(coopname, username);
        break;

      default:
        this.logger.warn(`Неизвестный ключ программы: ${program_key}`);
    }
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
