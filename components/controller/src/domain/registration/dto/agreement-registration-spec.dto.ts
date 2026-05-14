import type { AccountType } from '~/application/account/enum/account-type.enum';

/**
 * Спецификация одной оферты, которую расширение регистрирует в платформе
 * через AgreementRegistrationPort на этапе initialize(config).
 *
 * Используется ядром (RegistrationDomain) для построения UI SignUp,
 * генерации документов фабрикой по registry_id и отправки sendAgreement
 * в блокчейн под валидным agreement_type.
 */
export interface AgreementRegistrationSpec {
  /**
   * Уникальный идентификатор оферты в рамках платформы.
   * Строка, потому что расширение само определяет своё пространство имён
   * (например, 'blagorost_offer', 'generator_offer', 'order_table_offer').
   */
  id: string;

  /**
   * registry_id шаблона документа на фабрике — авторитативный источник
   * содержимого оферты. Платформа НЕ хранит type-string параллельно,
   * см. feedback agreements + document registry_id.
   */
  registry_id: number;

  /**
   * Тип соглашения для on-chain `agreements` (sendAgreement action).
   * Расширение предоставляет своё значение (например 'capital' для capital,
   * 'order_table' для Стола заказов).
   */
  agreement_type: string;

  /** Человекочитаемое название оферты для UI */
  title: string;

  /** Текст для галочки на фронтенде */
  checkbox_text: string;

  /** Текст ссылки для открытия диалога чтения */
  link_text: string;

  /**
   * Типы аккаунтов, для которых эта оферта применима.
   * Пустой массив = «оферта программно сцепляется с программой, не показывается
   * как самостоятельный чекбокс в SignUp» (исторически так у GENERATOR_OFFER).
   */
  applicable_account_types: AccountType[];

  /** Порядок отображения относительно других оферт расширения */
  order: number;

  /**
   * Имя расширения, зарегистрировавшего оферту.
   * Используется для tear-down: при EXTENSION_APP_TERMINATE_EVENT
   * реестр удаляет все записи с этим extension_name.
   */
  extension_name: string;
}
