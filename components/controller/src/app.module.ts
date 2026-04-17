// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

// Infrastructure modules
import { DatabaseModule } from './infrastructure/database/database.module';
import { GraphqlModule } from './infrastructure/graphql/graphql.module';
import { MongooseModule } from '@nestjs/mongoose';
import config from '~/config/config';
import { BlockchainModule } from './infrastructure/blockchain/blockchain.module';
import { GeneratorInfrastructureModule } from './infrastructure/generator/generator.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { NovuModule } from './infrastructure/novu/novu.module';
import { EventsInfrastructureModule } from './infrastructure/events/events.module';
import { FreeDecisionInfrastructureModule } from './infrastructure/free-decision/free-decision-infrastructure.module';
import { DecisionTrackingInfrastructureModule } from './infrastructure/decision-tracking/decision-tracking-infrastructure.module';
import { SearchInfrastructureModule } from './infrastructure/search/search-infrastructure.module';

// Domain modules
import { AccountDomainModule } from './domain/account/account-domain.module';
import { AccountInfrastructureModule } from './infrastructure/account/account-infrastructure.module';
import { PaymentMethodInfrastructureModule } from './infrastructure/payment-method/payment-method-infrastructure.module';
import { ExtensionDomainModule } from './domain/extension/extension-domain.module';
import { SystemDomainModule } from './domain/system/system-domain.module';
import { BranchDomainModule } from './domain/branch/branch-domain.module';
import { DocumentDomainModule } from './domain/document/document.module';
import { FreeDecisionDomainModule } from './domain/free-decision/free-decision.module';
import { AgreementDomainModule } from './domain/agreement/agreement-domain.module';
import { ParticipantDomainModule } from './domain/participant/participant-domain.module';
import { AuthDomainModule } from './domain/auth/auth.module';
import { AgendaDomainModule } from './domain/agenda/agenda-domain.module';
import { CooplaceDomainModule } from './domain/cooplace/cooplace.module';
import { DesktopDomainModule } from './domain/desktop/desktop-domain.module';
import { MeetDomainModule } from './domain/meet/meet-domain.module';
import { GatewayDomainModule } from './domain/gateway/gateway-domain.module';
import { VaultDomainModule } from './domain/vault/vault-domain.module';
import { NotificationDomainModule } from './domain/notification/notification-domain.module';
import { LedgerDomainModule } from './domain/ledger/ledger-domain.module';
import { ParserDomainModule } from './domain/parser/parser-domain.module';
import { SettingsInfrastructureModule } from './infrastructure/settings/settings-infrastructure.module';
import { RegistrationDomainModule } from './domain/registration/registration-domain.module';
import { TokenDomainModule } from './domain/token/token-domain.module';
import { MutationLogDomainModule } from './domain/mutation-log/mutation-log-domain.module';

// Application modules
import { AccountModule } from './application/account/account.module';
import { AuthModule } from './application/auth/auth.module';
import { BranchModule } from './application/branch/branch.module';
import { LoggerModule } from './application/logger/logger-app.module';
import { PaymentMethodModule } from './application/payment-method/payment-method.module';
import { SystemModule } from './application/system/system.module';
import { AppStoreModule } from './application/appstore/appstore-app.module';
import { QueueModule } from './application/queue/queue-app.module';
import { DocumentModule } from './application/document/document.module';
import { RedisAppModule } from './application/redis/redis-app.module';
import { DecisionModule } from './application/free-decision/decision.module';
import { AgreementModule } from './application/agreement/agreement.module';
import { ParticipantModule } from './application/participant/participant.module';
import { AgendaModule } from './application/agenda/agenda.module';
import { CooplaceModule } from './application/cooplace/cooplace.module';
import { DesktopModule } from './application/desktop/desktop.module';
import { MeetModule } from './application/meet/meet.module';
import { GatewayModule } from './application/gateway/gateway.module';
import { WalletModule } from './application/wallet/wallet.module';
import { NotificationModule } from './application/notification/notification.module';
import { LedgerModule } from './application/ledger/ledger.module';
import { BlockchainExplorerModule } from './application/blockchain-explorer/blockchain-explorer.module';
import { ProviderModule } from './application/provider/provider.module';
import { UserModule } from './application/user/user.module';
import { TokenApplicationModule } from './application/token/token-application.module';
import { SettingsApplicationModule } from './application/settings/settings.module';
import { RegistrationModule } from './application/registration/registration.module';
import { SearchModule } from './application/search/search.module';
import { MutationLoggingInterceptor } from './application/common/interceptors/mutation-logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Чтобы .env был доступен глобально
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 50,
      },
    ]),
    // Infrastructure modules
    MongooseModule.forRoot(config.mongoose.url),
    DatabaseModule,
    GraphqlModule,
    BlockchainModule,
    GeneratorInfrastructureModule,
    RedisModule,
    NovuModule,
    SearchInfrastructureModule,
    EventsInfrastructureModule,
    FreeDecisionInfrastructureModule,
    DecisionTrackingInfrastructureModule,
    // Domain modules
    AuthDomainModule,
    RegistrationDomainModule,
    AgendaDomainModule,
    AccountDomainModule,
    AccountInfrastructureModule,
    PaymentMethodInfrastructureModule,
    AgreementDomainModule,
    DesktopDomainModule,
    ExtensionDomainModule,
    SystemDomainModule,
    BranchDomainModule,
    DocumentDomainModule,
    FreeDecisionDomainModule,
    ParticipantDomainModule,
    CooplaceDomainModule,
    MeetDomainModule,
    GatewayDomainModule,
    VaultDomainModule,
    NotificationDomainModule,
    LedgerDomainModule,
    ParserDomainModule,
    SettingsInfrastructureModule,
    TokenDomainModule,
    MutationLogDomainModule,
    // Application modules
    AccountModule,
    AgreementModule,
    AgendaModule,
    AppStoreModule,
    AuthModule,
    DesktopModule,
    BranchModule,
    LoggerModule,
    PaymentMethodModule,
    QueueModule,
    RedisAppModule,
    SystemModule,
    DocumentModule,
    DecisionModule,
    ParticipantModule,
    CooplaceModule,
    MeetModule,
    GatewayModule,
    WalletModule,
    NotificationModule,
    LedgerModule,
    BlockchainExplorerModule,
    ProviderModule,
    UserModule,
    TokenApplicationModule,
    SettingsApplicationModule,
    RegistrationModule,
    SearchModule,
  ],
  providers: [
    {
      provide: 'MutationLoggingInterceptor',
      useClass: MutationLoggingInterceptor,
    },
  ],
  exports: [],
})
export class AppModule {}
