import { Global, Module, Scope } from '@nestjs/common';
import {
  CHATCOOP_CALENDAR_PORT,
  ACCOUNT_PORT,
  COOPERATIVE_VARS_PORT,
  DECISION_TRACKING_PORT,
  DOCUMENT_PORT,
  EXPENSE_CHASSIS_PORT,
  FREE_DECISION_PORT,
  LEDGER2_HISTORY_PORT,
  LOGGER_PORT,
  MATRIX_ROOM_MESSAGING_PORT,
  MEET_PORT,
  MESSAGE_CHANNEL_PORT,
  NOTIFICATION_PORT,
  PAYMENT_PORT,
  INDIVIDUAL_PORT,
  ORGANIZATION_PORT,
  PAYMENT_DESK_PORT,
  PAYMENT_METHOD_PORT,
  PAYMENT_NOTICE_LOG_PORT,
  PAYMENT_POLLING_STATE_PORT,
  PAYMENT_PROVIDER_REGISTRY_PORT,
  PROGRAM_WALLET_PORT,
  PROJECT_CAPITAL_CLEARANCE_PORT,
  USER_DATA_PORT,
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
import {
  OrganizationInnercoopAdapter,
  IndividualInnercoopAdapter,
} from '~/infrastructure/innercoop/party-card-innercoop.adapter';
import { GatewayInfrastructureModule } from '~/infrastructure/gateway/gateway-infrastructure.module';
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
    WalletModule,
    VaultDomainModule,
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
    ORGANIZATION_PORT,
    INDIVIDUAL_PORT,
  ],
})
export class InnercoopBridgeModule {}
