/**
 * Идентификаторы платформенных соглашений при регистрации.
 *
 * Оферты, специфичные для расширений (capital → 'blagorost_offer',
 * 'generator_offer' и т.п.), не входят в этот enum: расширения сами
 * задают строковые id через AgreementRegistrationPort и являются
 * единственным source-of-truth для этих значений.
 */
export enum AgreementId {
  /** Соглашение о порядке и правилах использования простой электронной подписи */
  SIGNATURE_AGREEMENT = 'signature_agreement',

  /** Соглашение о целевой потребительской программе "Цифровой Кошелёк" */
  WALLET_AGREEMENT = 'wallet_agreement',

  /** Пользовательское соглашение */
  USER_AGREEMENT = 'user_agreement',

  /** Политика конфиденциальности */
  PRIVACY_AGREEMENT = 'privacy_agreement',
}
