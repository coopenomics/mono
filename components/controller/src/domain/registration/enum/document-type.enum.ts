/**
 * Типы документов для регистрации кандидата
 */
export enum DocumentType {
  /** Заявление на вступление в кооператив */
  STATEMENT = 'statement',

  /** Соглашение о цифровом кошельке */
  WALLET_AGREEMENT = 'wallet_agreement',

  /** Соглашение о порядке использования электронной подписи */
  SIGNATURE_AGREEMENT = 'signature_agreement',

  /** Политика конфиденциальности */
  PRIVACY_AGREEMENT = 'privacy_agreement',

  /** Пользовательское соглашение */
  USER_AGREEMENT = 'user_agreement',

  /** Соглашение о благороста */
  BLAGOROST_OFFER = 'blagorost_offer',

  /** Оферта по программе генератора */
  GENERATOR_OFFER = 'generator_offer',

  /** Оферта по ЦПП «Стол заказов» (marketplace, program_id=2) */
  MARKETPLACE_OFFER = 'marketplace_offer',
}
