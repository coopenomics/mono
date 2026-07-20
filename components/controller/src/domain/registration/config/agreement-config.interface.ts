import type { AccountType } from '~/application/account/enum/account-type.enum';

/**
 * Конфигурация одного соглашения при регистрации.
 *
 * Платформенные оферты (signature/wallet/user/privacy) хранят значения
 * `id`/`agreement_type` из ядерных enum'ов AgreementId/AgreementType
 * как строки. Оферты, поставляемые расширениями через
 * AgreementRegistrationPort, используют собственные строковые значения
 * (например 'blagorost_offer' от capital). Поэтому типы — `string`,
 * а не enum: ядро не знает значений, заданных расширениями.
 */
export interface IAgreementConfigItem {
  /**
   * Уникальный идентификатор типа соглашения
   */
  id: string;

  /**
   * registry_id для генерации документа на фабрике документов
   */
  registry_id: number;

  /**
   * Тип соглашения для блокчейна
   */
  agreement_type: string;

  /**
   * Человекочитаемое название документа
   */
  title: string;

  /**
   * Текст для галочки на фронтенде
   */
  checkbox_text: string;

  /**
   * Текст ссылки для открытия диалога чтения соглашения
   */
  link_text: string;

  /**
   * Нужно ли отправлять в блокчейн как agreement через sendAgreement action
   */
  is_blockchain_agreement: boolean;

  /**
   * Нужно ли линковать хеш документа в заявление на вступление
   */
  link_to_statement: boolean;

  /**
   * Условия применения - для каких типов аккаунтов требуется это соглашение
   */
  applicable_account_types: AccountType[];

  /**
   * Порядок отображения на фронтенде (сортировка)
   */
  order: number;

  /**
   * Резолвер hash'а приватных данных документа (doc_data_hash), если шаблон
   * оферты на фабрике требует PrivateData. Заполняется только для
   * extension-оферт из AgreementRegistrationSpec; платформенные соглашения
   * его не имеют. В GraphQL DTO не попадает (поля мапятся декораторами).
   */
  resolve_doc_data_hash?: () => Promise<string | undefined>;
}

/**
 * Конфигурация всех соглашений при регистрации
 */
export interface IRegistrationAgreementsConfig {
  /**
   * Массив конфигураций соглашений
   */
  agreements: IAgreementConfigItem[];
}

/**
 * Описание программы регистрации с её соглашениями
 */
export interface IRegistrationProgram {
  /**
   * Уникальный ключ программы. Расширения сами определяют пространство
   * имён ключей (например 'GENERATION'/'CAPITALIZATION' от capital).
   */
  key: string;

  /** Название программы для отображения */
  title: string;

  /** Описание программы */
  description: string;

  /** URL изображения (опционально) */
  image_url?: string;

  /** Минимальные требования для участия */
  requirements?: string;

  /** Для каких типов аккаунтов доступна эта программа */
  applicable_account_types: AccountType[];

  /** Список ID соглашений, которые требуются для этой программы */
  agreement_ids: string[];

  /** Порядок отображения */
  order: number;
}

