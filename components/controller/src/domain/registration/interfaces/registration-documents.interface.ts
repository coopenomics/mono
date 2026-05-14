import type { AccountType } from '~/application/account/enum/account-type.enum';
import type { GeneratedDocumentDomainInterface } from '~/domain/document/interfaces/generated-document-domain.interface';

/**
 * Входные данные для генерации пакета документов при регистрации
 */
export interface IGenerateRegistrationDocumentsInput {
  /** Имя кооператива */
  coopname: string;
  /** Имя пользователя (аккаунт) */
  username: string;
  /** Тип аккаунта пайщика */
  account_type: AccountType;
  /**
   * Ключ выбранной программы регистрации (опционально).
   * Строка, потому что значение задаёт расширение через
   * AgreementRegistrationPort.registerProgram.
   */
  program_key?: string;
}

/**
 * Сгенерированный документ регистрации с метаданными из конфигурации.
 *
 * Поля `id`/`agreement_type` — строки, потому что значения могут
 * приходить как из платформенного AgreementId/AgreementType, так и из
 * расширений (например 'blagorost_offer' от capital).
 */
export interface IGeneratedRegistrationDocument {
  /** Идентификатор соглашения */
  id: string;
  /** Тип соглашения для блокчейна */
  agreement_type: string;
  /** Название документа */
  title: string;
  /** Текст для галочки на фронте */
  checkbox_text: string;
  /** Текст ссылки для открытия диалога чтения */
  link_text: string;
  /** Сгенерированный документ */
  document: GeneratedDocumentDomainInterface;
  /** Нужно ли отправлять в блокчейн как agreement */
  is_blockchain_agreement: boolean;
  /** Нужно ли линковать в заявление */
  link_to_statement: boolean;
  /** Порядок отображения */
  order: number;
}

/**
 * Результат генерации пакета документов при регистрации
 */
export interface IGenerateRegistrationDocumentsOutput {
  /** Массив сгенерированных документов с метаданными */
  documents: IGeneratedRegistrationDocument[];
  /** Тип аккаунта, для которого сгенерированы документы */
  account_type: AccountType;
  /** Имя пользователя */
  username: string;
}
