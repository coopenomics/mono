/**
 * Переводчик контроллера.
 *
 * Словари: общие из `@coopenomics/i18n` (`common`, `validation`, `errors`),
 * ядра контроллера — `./locales/<язык>/<область>.json` (подключаются здесь
 * явным импортом, чтобы сборка положила их в dist), расширений — регистрирует
 * само расширение (`registerMessages` в своём модуле).
 *
 * Язык — язык текущего запроса (LocaleMiddleware), вне запроса — по умолчанию.
 *   throw DomainError.notFound('DOCUMENT_NOT_FOUND')      — отказ пайщику;
 *   t('payment.status.paid')                               — надпись для интерфейса.
 */
import { registerMessages } from '@coopenomics/i18n/server';
import cooperative from './locales/ru/cooperative.json';
import document from './locales/ru/document.json';
import freeDecision from './locales/ru/free-decision.json';
import accountDictionary from './locales/ru/account.json';
import agendaDictionary from './locales/ru/agenda.json';
import agreementDictionary from './locales/ru/agreement.json';
import appstoreDictionary from './locales/ru/appstore.json';
import authDictionary from './locales/ru/auth.json';
import authV2Dictionary from './locales/ru/authV2.json';
import branchDictionary from './locales/ru/branch.json';
import freeDecisionDictionary from './locales/ru/freeDecision.json';
import gatewayDictionary from './locales/ru/gateway.json';
import ledger2Dictionary from './locales/ru/ledger2.json';
import meetDictionary from './locales/ru/meet.json';
import membershipExitDictionary from './locales/ru/membershipExit.json';
import notificationDictionary from './locales/ru/notification.json';
import notificationCenterDictionary from './locales/ru/notificationCenter.json';
import participationDictionary from './locales/ru/participation.json';
import paymentMethodDictionary from './locales/ru/paymentMethod.json';
import appDictionary from './locales/ru/app.json';
import blockchainDictionary from './locales/ru/blockchain.json';
import databaseDictionary from './locales/ru/database.json';
import decisionTrackingDictionary from './locales/ru/decisionTracking.json';
import documentApprovalDictionary from './locales/ru/documentApproval.json';
import extensionDictionary from './locales/ru/extension.json';
import fileStorageDictionary from './locales/ru/fileStorage.json';
import generatorDictionary from './locales/ru/generator.json';
import graphqlDictionary from './locales/ru/graphql.json';
import ledgerDictionary from './locales/ru/ledger.json';
import onboardingDictionary from './locales/ru/onboarding.json';
import processRegistryDictionary from './locales/ru/processRegistry.json';
import providerDictionary from './locales/ru/provider.json';
import registrationDictionary from './locales/ru/registration.json';
import systemDictionary from './locales/ru/system.json';
import userDictionary from './locales/ru/user.json';
import walletDictionary from './locales/ru/wallet.json';

export {
  currentLocale,
  registerMessages,
  runWithLocale,
  t,
  te,
} from '@coopenomics/i18n/server';
export type { MessageKey } from './keys.generated';

export type DomainErrorParamsLike = Record<string, string | number | boolean | null | undefined>;

// Словари ядра контроллера. Новый файл в ./locales/ru — новая строка здесь;
// гейт `pnpm check:i18n` напомнит, если словарь не подключён.
const CORE_DICTIONARIES: Array<[string, Record<string, any>]> = [
  ['wallet', walletDictionary],
  ['user', userDictionary],
  ['system', systemDictionary],
  ['registration', registrationDictionary],
  ['provider', providerDictionary],
  ['processRegistry', processRegistryDictionary],
  ['onboarding', onboardingDictionary],
  ['ledger', ledgerDictionary],
  ['graphql', graphqlDictionary],
  ['generator', generatorDictionary],
  ['fileStorage', fileStorageDictionary],
  ['extension', extensionDictionary],
  ['documentApproval', documentApprovalDictionary],
  ['decisionTracking', decisionTrackingDictionary],
  ['database', databaseDictionary],
  ['blockchain', blockchainDictionary],
  ['app', appDictionary],
  ['paymentMethod', paymentMethodDictionary],
  ['participation', participationDictionary],
  ['notificationCenter', notificationCenterDictionary],
  ['notification', notificationDictionary],
  ['membershipExit', membershipExitDictionary],
  ['meet', meetDictionary],
  ['ledger2', ledger2Dictionary],
  ['gateway', gatewayDictionary],
  ['freeDecision', freeDecisionDictionary],
  ['branch', branchDictionary],
  ['authV2', authV2Dictionary],
  ['auth', authDictionary],
  ['appstore', appstoreDictionary],
  ['agreement', agreementDictionary],
  ['agenda', agendaDictionary],
  ['account', accountDictionary],
  ['cooperative', cooperative],
  ['document', document],
  ['free-decision', freeDecision],
];

for (const [name, tree] of CORE_DICTIONARIES) registerMessages('ru', tree, `controller:${name}`);
