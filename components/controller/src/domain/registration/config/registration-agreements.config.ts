import { Cooperative } from 'cooptypes';
import type { IRegistrationAgreementsConfig } from './agreement-config.interface';
import { AccountType } from '~/application/account/enum/account-type.enum';
import { AgreementType, AgreementId } from '../enum';

/**
 * Платформенные соглашения, требуемые при регистрации пайщика в любом
 * кооперативе вне зависимости от подключённых расширений.
 *
 * Соглашения, специфичные для конкретных расширений (например, оферты
 * программ Capital — generator/blagorost), регистрируются самими
 * расширениями в `AgreementRegistryService` при инициализации и
 * сливаются с этим списком в `AgreementConfigurationService`.
 *
 * Порядок (order) определяет последовательность отображения галочек
 * на фронтенде. is_blockchain_agreement указывает, нужно ли отправлять
 * sendAgreement в блокчейн. link_to_statement указывает, нужно ли
 * линковать хеш документа в заявление.
 */
export const REGISTRATION_AGREEMENTS_CONFIG: IRegistrationAgreementsConfig = {
  agreements: [
    {
      id: AgreementId.SIGNATURE_AGREEMENT,
      registry_id: Cooperative.Registry.RegulationElectronicSignature.registry_id,
      agreement_type: AgreementType.SIGNATURE,
      title: 'Соглашение о порядке и правилах использования простой электронной подписи',
      checkbox_text: 'Я прочитал и принимаю',
      link_text: 'положение о порядке и правилах использования простой электронной подписи',
      is_blockchain_agreement: true,
      link_to_statement: true,
      applicable_account_types: [AccountType.individual, AccountType.organization, AccountType.entrepreneur],
      order: 1,
    },
    {
      id: AgreementId.WALLET_AGREEMENT,
      registry_id: Cooperative.Registry.WalletAgreement.registry_id,
      agreement_type: AgreementType.WALLET,
      title: 'Соглашение о целевой потребительской программе "Цифровой Кошелёк"',
      checkbox_text: 'Я прочитал и принимаю',
      link_text: 'положение о целевой потребительской программе "Цифровой Кошелёк"',
      is_blockchain_agreement: true,
      link_to_statement: true,
      applicable_account_types: [AccountType.individual, AccountType.organization, AccountType.entrepreneur],
      order: 2,
    },
    {
      id: AgreementId.USER_AGREEMENT,
      registry_id: Cooperative.Registry.UserAgreement.registry_id,
      agreement_type: AgreementType.USER,
      title: 'Пользовательское соглашение',
      checkbox_text: 'Я прочитал и принимаю',
      link_text: 'пользовательское соглашение',
      is_blockchain_agreement: true,
      link_to_statement: true,
      applicable_account_types: [AccountType.individual, AccountType.organization, AccountType.entrepreneur],
      order: 3,
    },
    {
      id: AgreementId.PRIVACY_AGREEMENT,
      registry_id: Cooperative.Registry.PrivacyPolicy.registry_id,
      agreement_type: AgreementType.PRIVACY,
      title: 'Политика конфиденциальности',
      checkbox_text: 'Я прочитал и принимаю',
      link_text: 'политику конфиденциальности',
      is_blockchain_agreement: true,
      link_to_statement: true,
      applicable_account_types: [AccountType.individual, AccountType.organization, AccountType.entrepreneur],
      order: 4,
    },
  ],
};
