import { Global, Module, Scope } from '@nestjs/common';
import {
  CANDIDATE_PORT,
  CHAIN_PORT,
  CHAIN_RESOURCES_PORT,
  CHATCOOP_CALENDAR_PORT,
  ACCOUNT_PORT,
  AGREEMENT_CATALOG_PORT,
  BRANCH_PORT,
  COOPERATIVE_VARS_PORT,
  COUNCIL_PORT,
  DECISION_TRACKING_PORT,
  DESKTOP_GRANTS_REGISTRY_PORT,
  DESKTOP_GRANTS_FILTER_REGISTRY_PORT,
  REGISTRATION_OFFER_FILTER_REGISTRY_PORT,
  DOCUMENT_PORT,
  EXPENSE_CHASSIS_PORT,
  EXTENSION_CONFIG_PORT,
  FREE_DECISION_PORT,
  LEDGER2_HISTORY_PORT,
  LOGGER_PORT,
  MATRIX_ROOM_MESSAGING_PORT,
  MEET_PORT,
  MESSAGE_CHANNEL_PORT,
  MUTATION_LOG_PORT,
  ONBOARDING_STEP_REGISTRY_PORT,
  NOTIFICATION_PORT,
  PAYMENT_PORT,
  INDIVIDUAL_PORT,
  INTEGRATION_SETTINGS_PORT,
  EXTENSION_DATABASE_PORT,
  ORGANIZATION_PORT,
  PAYMENT_DESK_PORT,
  PAYMENT_METHOD_PORT,
  PAYMENT_NOTICE_LOG_PORT,
  PAYMENT_POLLING_STATE_PORT,
  PAYMENT_PROVIDER_REGISTRY_PORT,
  PROGRAM_AGREEMENT_PORT,
  PROGRAM_WALLET_PORT,
  PROJECT_CAPITAL_CLEARANCE_PORT,
  REALTIME_CHANNEL_PORT,
  REGISTRATION_REGISTRY_PORT,
  REGISTRATION_DOCUMENT_PARAMETERS_REGISTRY_PORT,
  SECRET_CIPHER_PORT,
  USER_DATA_PORT,
  USER_CERTIFICATE_PORT,
  VERIFICATION_PORT,
  USER_DIRECTORY_PORT,
  USER_WALLET_PORT,
  VAULT_PORT,
  PROJECT_COMMUNICATION_ARTIFACTS_PORT,
} from '@coopenomics/innercoop';
import { RedisModule } from '~/infrastructure/redis/redis.module';
import { RedisService } from '~/infrastructure/redis/redis.service';
import { SystemDomainModule } from '~/domain/system/system-domain.module';
import { CooperativeVarsInnercoopAdapter } from '~/infrastructure/innercoop/cooperative-vars-innercoop.adapter';
import { DocumentInnercoopAdapter } from '~/infrastructure/innercoop/document-innercoop.adapter';
import { AccountInnercoopAdapter } from '~/infrastructure/innercoop/account-innercoop.adapter';
import { AccountInfrastructureModule } from '~/infrastructure/account/account-infrastructure.module';
import { NotificationCenterModule } from '~/application/notification-center/notification-center.module';
import { MeetInfrastructureModule } from '~/infrastructure/meet/meet-infrastructure.module';
import { MeetDataAdapter } from '~/infrastructure/meet/meet-data.adapter';
import { DecisionTrackingInfrastructureModule } from '~/infrastructure/decision-tracking/decision-tracking-infrastructure.module';
import { DecisionTrackingAdapter } from '~/infrastructure/decision-tracking/adapters/decision-tracking.adapter';
import { FreeDecisionInfrastructureModule } from '~/infrastructure/free-decision/free-decision-infrastructure.module';
import { FreeDecisionAdapter } from '~/infrastructure/free-decision/free-decision.adapter';
import { NotificationInnercoopAdapter } from '~/infrastructure/innercoop/notification-innercoop.adapter';
import { PaymentInnercoopAdapter } from '~/infrastructure/innercoop/payment-innercoop.adapter';
import { PaymentProviderRegistryInnercoopAdapter } from '~/infrastructure/innercoop/payment-provider-registry-innercoop.adapter';
import { PaymentPollingStateInnercoopAdapter } from '~/infrastructure/innercoop/payment-polling-state-innercoop.adapter';
import { PaymentNoticeLogInnercoopAdapter } from '~/infrastructure/innercoop/payment-notice-log-innercoop.adapter';
import { PaymentMethodInnercoopAdapter } from '~/infrastructure/innercoop/payment-method-innercoop.adapter';
import { UserDataInnercoopAdapter } from '~/infrastructure/innercoop/user-data-innercoop.adapter';
import { PaymentDeskInnercoopAdapter } from '~/infrastructure/innercoop/payment-desk-innercoop.adapter';
import {
  ProgramWalletInnercoopAdapter,
  UserWalletInnercoopAdapter,
} from '~/infrastructure/innercoop/wallet-innercoop.adapter';
import { WalletModule } from '~/application/wallet/wallet.module';
import { VaultInnercoopAdapter } from '~/infrastructure/innercoop/vault-innercoop.adapter';
import { VaultDomainModule } from '~/domain/vault/vault-domain.module';
import { OnboardingStepsRegistryService } from '~/domain/onboarding/services/onboarding-steps-registry.service';
import { BranchInnercoopAdapter } from '~/infrastructure/innercoop/branch-innercoop.adapter';
import { ChainInnercoopAdapter } from '~/infrastructure/innercoop/chain-innercoop.adapter';
import { SecretCipherInnercoopAdapter } from '~/infrastructure/innercoop/secret-cipher-innercoop.adapter';
import { IntegrationSettingsInnercoopAdapter } from '~/infrastructure/innercoop/integration-settings-innercoop.adapter';
import { ExtensionDatabaseInnercoopAdapter } from '~/infrastructure/innercoop/extension-database-innercoop.adapter';
import { RealtimeChannelInnercoopAdapter } from '~/infrastructure/innercoop/realtime-channel-innercoop.adapter';
import { CouncilInnercoopAdapter } from '~/infrastructure/innercoop/council-innercoop.adapter';
import { UserDirectoryInnercoopAdapter } from '~/infrastructure/innercoop/user-directory-innercoop.adapter';
import { ProgramAgreementInnercoopAdapter } from '~/infrastructure/innercoop/program-agreement-innercoop.adapter';
import { MutationLogInnercoopAdapter } from '~/infrastructure/innercoop/mutation-log-innercoop.adapter';
import { CandidateInnercoopAdapter } from '~/infrastructure/innercoop/candidate-innercoop.adapter';
import { UserCertificateInnercoopAdapter } from '~/infrastructure/innercoop/user-certificate-innercoop.adapter';
import { VerificationInnercoopAdapter } from '~/infrastructure/innercoop/verification-innercoop.adapter';
import { AuthV2Module } from '~/application/auth-v2/auth-v2.module';
import { AgreementCatalogInnercoopAdapter } from '~/infrastructure/innercoop/agreement-catalog-innercoop.adapter';
import { ExtensionConfigInnercoopAdapter } from '~/infrastructure/innercoop/extension-config-innercoop.adapter';
import { ChainResourcesInnercoopAdapter } from '~/infrastructure/innercoop/chain-resources-innercoop.adapter';
import { UserModule } from '~/application/user/user.module';
import { RegistrationModule } from '~/application/registration/registration.module';
import { ExtensionGrantsRegistry } from '~/application/desktop/extension-grants.registry';
import { ExtensionGrantsFilterRegistry } from '~/application/desktop/extension-grants-filter.registry';
import { ExtensionOfferFilterRegistry } from '~/domain/registration/services/extension-offer-filter.registry';
import { PubSubModule } from '~/infrastructure/pubsub/pubsub.module';
import { AgreementRegistryService } from '~/domain/registration/services/agreement-registry.service';
import { RegistrationDocumentParametersRegistry } from '~/domain/registration/services/registration-document-parameters.registry';
import {
  OrganizationInnercoopAdapter,
  IndividualInnercoopAdapter,
} from '~/infrastructure/innercoop/party-card-innercoop.adapter';
import { GatewayInfrastructureModule } from '~/infrastructure/gateway/gateway-infrastructure.module';
import { GatewayModule } from '~/application/gateway/gateway.module';
import { NotificationModule } from '~/application/notification/notification.module';
import { DocumentDomainModule } from '~/domain/document/document.module';
import { DocumentModule } from '~/application/document/document.module';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { ChatCoopExtensionModule } from './chatcoop/chatcoop-extension.module';
import { CapitalExtensionModule } from './capital/capital-extension.module';
import { ExpensesExtensionModule } from './expenses/expenses-extension.module';
import { Ledger2Module } from '~/application/ledger2/ledger2.module';
import { ChatcoopInnercoopProjectCommunicationArtifactsAdapter } from './chatcoop/infrastructure/innercoop/chatcoop-innercoop-project-communication-artifacts.adapter';
import { ChatcoopInnercoopMatrixRoomMessagingAdapter } from './chatcoop/infrastructure/innercoop/chatcoop-innercoop-matrix-room-messaging.adapter';
import { ChatcoopInnercoopChatCoopCalendarAdapter } from './chatcoop/infrastructure/innercoop/chatcoop-innercoop-chatcoop-calendar.adapter';
import { CapitalInnercoopProjectCapitalClearanceAdapter } from './capital/infrastructure/innercoop/capital-innercoop-project-capital-clearance.adapter';
import { ExpensesInnercoopExpenseChassisAdapter } from './expenses/infrastructure/innercoop/expenses-innercoop-expense-chassis.adapter';
import { Ledger2InnercoopHistoryAdapter } from '~/application/ledger2/infrastructure/innercoop/ledger2-innercoop-history.adapter';

/**
 * Глобальная привязка портов @coopenomics/innercoop к их реализациям-расширениям.
 * Consumer-extension'ы (capital, marketplace, EMP) инжектят токен без знания
 * о конкретной реализации.
 *
 * Единственный легитимный способ обратиться из расширения к чужому
 * сервису/ядру — через порт отсюда. Прямой импорт сервиса другого
 * расширения (или ядрового модуля вроде `Ledger2Service`) в consumer-коде —
 * архитектурное нарушение; если контракта ещё нет — сперва добавить порт
 * в `@coopenomics/innercoop`, потом реализацию/биндинг здесь.
 */
@Global()
@Module({
  imports: [
    CapitalExtensionModule,
    ChatCoopExtensionModule,
    ExpensesExtensionModule,
    Ledger2Module,
    RedisModule,
    SystemDomainModule,
    DocumentDomainModule,
    DocumentModule,
    AccountInfrastructureModule,
    NotificationCenterModule,
    NotificationModule,
    MeetInfrastructureModule,
    DecisionTrackingInfrastructureModule,
    FreeDecisionInfrastructureModule,
    GatewayInfrastructureModule,
    // Кассирский стол расширений опирается на сценарии платежей.
    GatewayModule,
    WalletModule,
    VaultDomainModule,
    // Шина подписок объявлена глобальной, но глобальность не загружает модуль:
    // раньше его тянул к себе marketplace, теперь — composition root.
    PubSubModule,
    // Отсюда берётся доступ к заявкам на вступление для порта кандидатов.
    RegistrationModule,
    // Отсюда берётся сборка сертификата подписанта для порта.
    UserModule,
    // Отсюда берутся уровни верификации и правила их применения для порта.
    AuthV2Module,
  ],
  providers: [
    CooperativeVarsInnercoopAdapter,
    DocumentInnercoopAdapter,
    AccountInnercoopAdapter,
    NotificationInnercoopAdapter,
    PaymentInnercoopAdapter,
    PaymentProviderRegistryInnercoopAdapter,
    PaymentPollingStateInnercoopAdapter,
    PaymentNoticeLogInnercoopAdapter,
    PaymentMethodInnercoopAdapter,
    UserDataInnercoopAdapter,
    PaymentDeskInnercoopAdapter,
    ProgramWalletInnercoopAdapter,
    UserWalletInnercoopAdapter,
    VaultInnercoopAdapter,
    BranchInnercoopAdapter,
    ChainInnercoopAdapter,
    SecretCipherInnercoopAdapter,
    IntegrationSettingsInnercoopAdapter,
    ExtensionDatabaseInnercoopAdapter,
    RealtimeChannelInnercoopAdapter,
    CouncilInnercoopAdapter,
    UserDirectoryInnercoopAdapter,
    ProgramAgreementInnercoopAdapter,
    MutationLogInnercoopAdapter,
    CandidateInnercoopAdapter,
    UserCertificateInnercoopAdapter,
    VerificationInnercoopAdapter,
    AgreementCatalogInnercoopAdapter,
    ExtensionConfigInnercoopAdapter,
    ChainResourcesInnercoopAdapter,
    OrganizationInnercoopAdapter,
    IndividualInnercoopAdapter,
    {
      provide: PROJECT_COMMUNICATION_ARTIFACTS_PORT,
      useExisting: ChatcoopInnercoopProjectCommunicationArtifactsAdapter,
    },
    {
      provide: MATRIX_ROOM_MESSAGING_PORT,
      useExisting: ChatcoopInnercoopMatrixRoomMessagingAdapter,
    },
    {
      provide: CHATCOOP_CALENDAR_PORT,
      useExisting: ChatcoopInnercoopChatCoopCalendarAdapter,
    },
    {
      provide: PROJECT_CAPITAL_CLEARANCE_PORT,
      useExisting: CapitalInnercoopProjectCapitalClearanceAdapter,
    },
    {
      provide: EXPENSE_CHASSIS_PORT,
      useExisting: ExpensesInnercoopExpenseChassisAdapter,
    },
    {
      provide: LEDGER2_HISTORY_PORT,
      useExisting: Ledger2InnercoopHistoryAdapter,
    },
    {
      // Единственный порт здесь, привязанный `useClass`, а не `useExisting`.
      // `setContext` мутирует логгер, поэтому `WinstonLoggerService` объявлен
      // транзиентным — каждый потребитель обязан получить свой инстанс.
      // Алиас через `useExisting` разрешался бы по самому алиасу, а не по
      // потребителю, и все 106 инжекторов делили бы один контекст: строки
      // приписывались бы чужим классам, причём молча. `useClass` с явным
      // Scope.TRANSIENT воспроизводит исходную семантику точно.
      provide: LOGGER_PORT,
      useClass: WinstonLoggerService,
      scope: Scope.TRANSIENT,
    },
    {
      // Тот же singleton `RedisService`, что раздаёт `RedisModule` ядру, —
      // но розданный глобально. Раньше yookassa и sberpoll импортировали
      // `RedisModule` к себе в модуль, то есть расширение знало инфраструктуру
      // ядра по пути. Теперь знает только токен.
      provide: MESSAGE_CHANNEL_PORT,
      useExisting: RedisService,
    },
    {
      provide: COOPERATIVE_VARS_PORT,
      useExisting: CooperativeVarsInnercoopAdapter,
    },
    {
      provide: DOCUMENT_PORT,
      useExisting: DocumentInnercoopAdapter,
    },
    {
      provide: ACCOUNT_PORT,
      useExisting: AccountInnercoopAdapter,
    },
    {
      provide: NOTIFICATION_PORT,
      useExisting: NotificationInnercoopAdapter,
    },
    {
      provide: MEET_PORT,
      useExisting: MeetDataAdapter,
    },
    {
      provide: DECISION_TRACKING_PORT,
      useExisting: DecisionTrackingAdapter,
    },
    {
      provide: FREE_DECISION_PORT,
      useExisting: FreeDecisionAdapter,
    },
    {
      provide: PAYMENT_PORT,
      useExisting: PaymentInnercoopAdapter,
    },
    {
      provide: PAYMENT_PROVIDER_REGISTRY_PORT,
      useExisting: PaymentProviderRegistryInnercoopAdapter,
    },
    {
      provide: PAYMENT_POLLING_STATE_PORT,
      useExisting: PaymentPollingStateInnercoopAdapter,
    },
    {
      provide: PAYMENT_NOTICE_LOG_PORT,
      useExisting: PaymentNoticeLogInnercoopAdapter,
    },
    {
      provide: PAYMENT_METHOD_PORT,
      useExisting: PaymentMethodInnercoopAdapter,
    },
    {
      provide: USER_DATA_PORT,
      useExisting: UserDataInnercoopAdapter,
    },
    {
      provide: PAYMENT_DESK_PORT,
      useExisting: PaymentDeskInnercoopAdapter,
    },
    {
      provide: PROGRAM_WALLET_PORT,
      useExisting: ProgramWalletInnercoopAdapter,
    },
    {
      provide: USER_WALLET_PORT,
      useExisting: UserWalletInnercoopAdapter,
    },
    {
      provide: VAULT_PORT,
      useExisting: VaultInnercoopAdapter,
    },
    {
      provide: BRANCH_PORT,
      useExisting: BranchInnercoopAdapter,
    },
    {
      provide: CHAIN_PORT,
      useExisting: ChainInnercoopAdapter,
    },
    {
      provide: SECRET_CIPHER_PORT,
      useExisting: SecretCipherInnercoopAdapter,
    },
    {
      provide: INTEGRATION_SETTINGS_PORT,
      useExisting: IntegrationSettingsInnercoopAdapter,
    },
    {
      provide: EXTENSION_DATABASE_PORT,
      useExisting: ExtensionDatabaseInnercoopAdapter,
    },
    {
      provide: REALTIME_CHANNEL_PORT,
      useExisting: RealtimeChannelInnercoopAdapter,
    },
    {
      provide: COUNCIL_PORT,
      useExisting: CouncilInnercoopAdapter,
    },
    {
      provide: USER_DIRECTORY_PORT,
      useExisting: UserDirectoryInnercoopAdapter,
    },
    {
      provide: PROGRAM_AGREEMENT_PORT,
      useExisting: ProgramAgreementInnercoopAdapter,
    },
    {
      provide: MUTATION_LOG_PORT,
      useExisting: MutationLogInnercoopAdapter,
    },
    {
      provide: CANDIDATE_PORT,
      useExisting: CandidateInnercoopAdapter,
    },
    {
      provide: USER_CERTIFICATE_PORT,
      useExisting: UserCertificateInnercoopAdapter,
    },
    {
      provide: VERIFICATION_PORT,
      useExisting: VerificationInnercoopAdapter,
    },
    {
      provide: AGREEMENT_CATALOG_PORT,
      useExisting: AgreementCatalogInnercoopAdapter,
    },
    {
      provide: EXTENSION_CONFIG_PORT,
      useExisting: ExtensionConfigInnercoopAdapter,
    },
    {
      provide: CHAIN_RESOURCES_PORT,
      useExisting: ChainResourcesInnercoopAdapter,
    },
    {
      // Реестр ядра совпадает с портом по форме: расширение только кладёт себя.
      provide: DESKTOP_GRANTS_REGISTRY_PORT,
      useExisting: ExtensionGrantsRegistry,
    },
    {
      // Сужающие политики чужих столов: расширение кладёт фильтр, ядро пересекает.
      provide: DESKTOP_GRANTS_FILTER_REGISTRY_PORT,
      useExisting: ExtensionGrantsFilterRegistry,
    },
    {
      // Сужающие политики витрины вступления — та же дисциплина.
      provide: REGISTRATION_OFFER_FILTER_REGISTRY_PORT,
      useExisting: ExtensionOfferFilterRegistry,
    },
    {
      // Реестр оферт ядра совпадает с портом по форме, промежуточный адаптер
      // ничего бы не добавил; `RegistrationDomainModule` глобальный.
      provide: REGISTRATION_REGISTRY_PORT,
      useExisting: AgreementRegistryService,
    },
    {
      // Реестр параметров оферт — там же и по той же причине: расширение
      // кладёт свой хук само, ядро вызывает его в потоке вступления.
      provide: REGISTRATION_DOCUMENT_PARAMETERS_REGISTRY_PORT,
      useExisting: RegistrationDocumentParametersRegistry,
    },
    {
      // Без промежуточного адаптера: реестр шагов ядра и порт совпадают по
      // форме, а `OnboardingDomainModule` глобальный — сервис виден отсюда.
      provide: ONBOARDING_STEP_REGISTRY_PORT,
      useExisting: OnboardingStepsRegistryService,
    },
    {
      provide: ORGANIZATION_PORT,
      useExisting: OrganizationInnercoopAdapter,
    },
    {
      provide: INDIVIDUAL_PORT,
      useExisting: IndividualInnercoopAdapter,
    },
  ],
  exports: [
    PROJECT_COMMUNICATION_ARTIFACTS_PORT,
    MATRIX_ROOM_MESSAGING_PORT,
    CHATCOOP_CALENDAR_PORT,
    PROJECT_CAPITAL_CLEARANCE_PORT,
    EXPENSE_CHASSIS_PORT,
      LEDGER2_HISTORY_PORT,
    LOGGER_PORT,
    MESSAGE_CHANNEL_PORT,
    COOPERATIVE_VARS_PORT,
    DOCUMENT_PORT,
    ACCOUNT_PORT,
    NOTIFICATION_PORT,
    MEET_PORT,
    DECISION_TRACKING_PORT,
    FREE_DECISION_PORT,
    PAYMENT_PORT,
    PAYMENT_PROVIDER_REGISTRY_PORT,
    PAYMENT_POLLING_STATE_PORT,
    PAYMENT_NOTICE_LOG_PORT,
    PAYMENT_METHOD_PORT,
    USER_DATA_PORT,
    PAYMENT_DESK_PORT,
    PROGRAM_WALLET_PORT,
    USER_WALLET_PORT,
    VAULT_PORT,
    BRANCH_PORT,
    CHAIN_PORT,
    SECRET_CIPHER_PORT,
    INTEGRATION_SETTINGS_PORT,
    EXTENSION_DATABASE_PORT,
    REALTIME_CHANNEL_PORT,
    COUNCIL_PORT,
    USER_DIRECTORY_PORT,
    PROGRAM_AGREEMENT_PORT,
    MUTATION_LOG_PORT,
    CANDIDATE_PORT,
    USER_CERTIFICATE_PORT,
    VERIFICATION_PORT,
    AGREEMENT_CATALOG_PORT,
    EXTENSION_CONFIG_PORT,
    CHAIN_RESOURCES_PORT,
    DESKTOP_GRANTS_REGISTRY_PORT,
    DESKTOP_GRANTS_FILTER_REGISTRY_PORT,
    REGISTRATION_OFFER_FILTER_REGISTRY_PORT,
    REGISTRATION_REGISTRY_PORT,
    REGISTRATION_DOCUMENT_PARAMETERS_REGISTRY_PORT,
    ONBOARDING_STEP_REGISTRY_PORT,
    ORGANIZATION_PORT,
    INDIVIDUAL_PORT,
  ],
})
export class InnercoopBridgeModule {}
