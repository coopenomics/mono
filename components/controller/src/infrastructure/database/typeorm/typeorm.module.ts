// infrastructure/database/typeorm/typeorm.module.ts
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule as NestTypeOrmModule } from '@nestjs/typeorm';
import path from 'path';
import config from '~/config/config';
import { EXTENSION_REPOSITORY } from '~/domain/extension/repositories/extension-domain.repository';
import { TypeOrmExtensionDomainRepository } from './repositories/typeorm-extension.repository';
import { ExtensionEntity } from './entities/extension.entity';
import { LogExtensionEntity } from './entities/log-extension.entity';
import { LOG_EXTENSION_REPOSITORY } from '~/domain/extension/repositories/log-extension-domain.repository';
import { TypeOrmLogExtensionDomainRepository } from './repositories/typeorm-log-extension.repository';
import { MeetPreEntity } from './entities/meet-pre.entity';
import { MEET_REPOSITORY } from '~/domain/meet/repositories/meet-pre.repository';
import { TypeOrmMeetRepository } from './repositories/typeorm-meet.repository';
import { MigrationEntity } from './entities/migration.entity';
import { MIGRATION_REPOSITORY } from '~/domain/system/repositories/migration-domain.repository';
import { TypeOrmMigrationRepository } from './repositories/typeorm-migration.repository';
import { CandidateEntity } from './entities/candidate.entity';
import { CANDIDATE_REPOSITORY } from '~/domain/account/repository/candidate.repository';
import { TypeOrmCandidateRepository } from './repositories/typeorm-candidate.repository';
import { MeetProcessedEntity } from './entities/meet-processed.entity';
import { MEET_PROCESSED_REPOSITORY } from '~/domain/meet/repositories/meet-processed.repository';
import { TypeOrmMeetProcessedRepository } from './repositories/typeorm-meet-processed.repository';
import { PaymentEntity } from './entities/payment.entity';
import { PAYMENT_REPOSITORY } from '~/domain/gateway/repositories/payment.repository';
import { TypeOrmPaymentRepository } from './repositories/typeorm-payment.repository';
import { PaymentFileEntity } from './entities/payment-file.entity';
import { PAYMENT_FILE_REPOSITORY } from '~/domain/gateway/repositories/payment-file.repository';
import { TypeormPaymentFileRepository } from './repositories/typeorm-payment-file.repository';
import { WebPushSubscriptionEntity } from './entities/web-push-subscription.entity';
import { NOTIFICATION_SUBSCRIPTION_PORT } from '~/domain/notification/interfaces/web-push-subscription.port';
import { TypeOrmWebPushSubscriptionRepository } from './repositories/typeorm-web-push-subscription.repository';
import { LEDGER_OPERATION_REPOSITORY } from '~/domain/ledger/repositories/ledger-operation.repository';
import { TypeOrmLedgerOperationRepository } from './repositories/typeorm-ledger-operation.repository';
import { LedgerOperationEntity } from './entities/ledger-operation.entity';
import { AgreementTypeormEntity } from './entities/agreement.typeorm-entity';
import { AGREEMENT_REPOSITORY } from '~/domain/agreement/repositories/agreement.repository';
import { AgreementTypeormRepository } from './repositories/agreement.typeorm-repository';
import { AgreementDeltaMapper } from './blockchain/mappers/agreement-delta.mapper';
import { AgreementSyncService } from './blockchain/services/agreement-sync.service';
import { ActionEntity } from './entities/action.entity';
import { DeltaEntity } from './entities/delta.entity';
import { ForkEntity } from './entities/fork.entity';
import { SyncStateEntity } from './entities/sync-state.entity';
import { EntityVersionTypeormEntity } from '~/shared/sync/entities/entity-version.typeorm-entity';
import { EntityVersionRepository } from '~/shared/sync/repositories/entity-version.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import { ACTION_REPOSITORY_PORT } from '~/domain/parser/ports/action-repository.port';
import { DELTA_REPOSITORY_PORT } from '~/domain/parser/ports/delta-repository.port';
import { FORK_REPOSITORY_PORT } from '~/domain/parser/ports/fork-repository.port';
import { SYNC_STATE_REPOSITORY_PORT } from '~/domain/parser/ports/sync-state-repository.port';
import { TypeOrmActionRepository } from './repositories/typeorm-action.repository';
import { TypeOrmDeltaRepository } from './repositories/typeorm-delta.repository';
import { TypeOrmForkRepository } from './repositories/typeorm-fork.repository';
import { TypeOrmSyncStateRepository } from './repositories/typeorm-sync-state.repository';
import { SettingsEntity } from './entities/settings.entity';
import { SETTINGS_REPOSITORY } from '~/domain/settings/repositories/settings.repository';
import { SettingsTypeormRepository } from './repositories/settings.typeorm-repository';
import { TokenEntity } from './entities/token.entity';
import { TOKEN_REPOSITORY } from '~/domain/token/repositories/token.repository';
import { TokenTypeormRepository } from './repositories/token.typeorm-repository';
import { UserEntity } from './entities/user.entity';
import { USER_REPOSITORY } from '~/domain/user/repositories/user.repository';
import { UserTypeormRepository } from './repositories/user.typeorm-repository';
import { VaultEntity } from './entities/vault.entity';
import { VAULT_REPOSITORY } from '~/domain/vault/repositories/vault.repository';
import { VaultTypeormRepository } from './repositories/vault.typeorm-repository';
import { IpnEntity } from './entities/ipn.entity';
import { IPN_REPOSITORY } from '~/domain/gateway/repositories/ipn.repository';
import { TypeormIpnRepository } from './repositories/typeorm-ipn.repository';
import { SystemStatusEntity } from './entities/system-status.entity';
import { PaymentStateEntity } from './entities/payment-state.entity';
import { PAYMENT_STATE_REPOSITORY } from '~/domain/gateway/repositories/payment-state.repository';
import { TypeormPaymentStateRepository } from './repositories/typeorm-payment-state.repository';
import { MutationLogEntity } from './entities/mutation-log.entity';
import { MUTATION_LOG_REPOSITORY } from '~/domain/mutation-log/repositories/mutation-log.repository';
import { MutationLogTypeormRepository } from './repositories/mutation-log.typeorm-repository';
import { ProgramWalletTypeormEntity } from './entities/program-wallet.typeorm-entity';
import { PROGRAM_WALLET_REPOSITORY } from '~/domain/wallet/repositories/program-wallet.repository';
import { ProgramWalletTypeormRepository } from './repositories/program-wallet.typeorm-repository';
import { ProgramWalletDeltaMapper } from './blockchain/mappers/program-wallet-delta.mapper';
import { UserAgreementTypeormEntity } from './entities/user-agreement.typeorm-entity';
import { USER_AGREEMENT_REPOSITORY } from '~/domain/wallet/repositories/user-agreement.repository';
import { UserAgreementTypeormRepository } from './repositories/user-agreement.typeorm-repository';
import { UserAgreementDeltaMapper } from './blockchain/mappers/user-agreement-delta.mapper';
import { UserAgreementSyncService } from './blockchain/services/user-agreement-sync.service';
import { UserWalletTypeormEntity } from './entities/user-wallet.typeorm-entity';
import { USER_WALLET_REPOSITORY } from '~/domain/wallet/repositories/user-wallet.repository';
import { UserWalletTypeormRepository } from './repositories/user-wallet.typeorm-repository';
import { UserWalletDeltaMapper } from './blockchain/mappers/user-wallet-delta.mapper';
import { UserWalletSyncService } from './blockchain/services/user-wallet-sync.service';
import { UserWalletIndexInitializer } from './blockchain/services/user-wallet-index-initializer.service';
import { SignedDocumentEntity } from './entities/signed-document.entity';
import { SIGNED_DOCUMENT_REPOSITORY } from '~/domain/document/repository/signed-document.repository';
import { SignedDocumentTypeormRepository } from './repositories/signed-document.typeorm-repository';
import { NotificationOutboxTypeormEntity } from './entities/notification-outbox.typeorm-entity';
import { NotificationDeliveryTypeormEntity } from './entities/notification-delivery.typeorm-entity';
import { NotificationInboxTypeormEntity } from './entities/notification-inbox.typeorm-entity';

@Global()
@Module({
  imports: [
    NestTypeOrmModule.forRoot({
      type: 'postgres',
      host: config.postgres.host,
      port: Number(config.postgres.port),
      username: config.postgres.username,
      password: config.postgres.password,
      database: config.postgres.database,
      entities: [
        'src/infrastructure/**/entities/*entity.{ts,js}',
        'src/extensions/**/entities/*entity.{ts,js}',
        'src/shared/**/entities/*entity.{ts,js}',
      ],
      //      synchronize: config.env === 'development', // Используем миграции для production
      synchronize: true, // Временно всегда синхронизируем
      logging: false,
    }),
    NestTypeOrmModule.forFeature([
      ExtensionEntity,
      LogExtensionEntity,
      MeetPreEntity,
      MeetProcessedEntity,
      MigrationEntity,
      CandidateEntity,
      PaymentEntity,
      PaymentFileEntity,
      WebPushSubscriptionEntity,
      LedgerOperationEntity,
      AgreementTypeormEntity,
      ActionEntity,
      DeltaEntity,
      ForkEntity,
      SyncStateEntity,
      EntityVersionTypeormEntity,
      SettingsEntity,
      TokenEntity,
      UserEntity,
      VaultEntity,
      IpnEntity,
      SystemStatusEntity,
      PaymentStateEntity,
      MutationLogEntity,
      ProgramWalletTypeormEntity,
      UserAgreementTypeormEntity,
      UserWalletTypeormEntity,
      SignedDocumentEntity,
      NotificationOutboxTypeormEntity,
      NotificationDeliveryTypeormEntity,
      NotificationInboxTypeormEntity,
    ]),
  ],
  providers: [
    {
      provide: EXTENSION_REPOSITORY,
      useClass: TypeOrmExtensionDomainRepository,
    },
    {
      provide: LOG_EXTENSION_REPOSITORY,
      useClass: TypeOrmLogExtensionDomainRepository,
    },
    {
      provide: MEET_REPOSITORY,
      useClass: TypeOrmMeetRepository,
    },
    {
      provide: MEET_PROCESSED_REPOSITORY,
      useClass: TypeOrmMeetProcessedRepository,
    },
    {
      provide: MIGRATION_REPOSITORY,
      useClass: TypeOrmMigrationRepository,
    },
    {
      provide: CANDIDATE_REPOSITORY,
      useClass: TypeOrmCandidateRepository,
    },
    {
      provide: PAYMENT_REPOSITORY,
      useClass: TypeOrmPaymentRepository,
    },
    {
      provide: PAYMENT_FILE_REPOSITORY,
      useClass: TypeormPaymentFileRepository,
    },
    {
      provide: NOTIFICATION_SUBSCRIPTION_PORT,
      useClass: TypeOrmWebPushSubscriptionRepository,
    },
    {
      provide: LEDGER_OPERATION_REPOSITORY,
      useClass: TypeOrmLedgerOperationRepository,
    },
    // Agreement компоненты
    {
      provide: AGREEMENT_REPOSITORY,
      useClass: AgreementTypeormRepository,
    },
    AgreementTypeormRepository,
    AgreementDeltaMapper,
    AgreementSyncService,
    {
      provide: ACTION_REPOSITORY_PORT,
      useClass: TypeOrmActionRepository,
    },
    {
      provide: DELTA_REPOSITORY_PORT,
      useClass: TypeOrmDeltaRepository,
    },
    {
      provide: FORK_REPOSITORY_PORT,
      useClass: TypeOrmForkRepository,
    },
    {
      provide: SYNC_STATE_REPOSITORY_PORT,
      useClass: TypeOrmSyncStateRepository,
    },
    {
      provide: SETTINGS_REPOSITORY,
      useClass: SettingsTypeormRepository,
    },
    {
      provide: TOKEN_REPOSITORY,
      useClass: TokenTypeormRepository,
    },
    {
      provide: USER_REPOSITORY,
      useClass: UserTypeormRepository,
    },
    {
      provide: VAULT_REPOSITORY,
      useClass: VaultTypeormRepository,
    },
    {
      provide: IPN_REPOSITORY,
      useClass: TypeormIpnRepository,
    },
    {
      provide: PAYMENT_STATE_REPOSITORY,
      useClass: TypeormPaymentStateRepository,
    },
    {
      provide: MUTATION_LOG_REPOSITORY,
      useClass: MutationLogTypeormRepository,
    },
    // ProgramWallet компоненты
    {
      provide: PROGRAM_WALLET_REPOSITORY,
      useClass: ProgramWalletTypeormRepository,
    },
    ProgramWalletTypeormRepository,
    ProgramWalletDeltaMapper,
    // UserAgreement компоненты (wallet::users, Эпик 2)
    {
      provide: USER_AGREEMENT_REPOSITORY,
      useClass: UserAgreementTypeormRepository,
    },
    UserAgreementTypeormRepository,
    UserAgreementDeltaMapper,
    UserAgreementSyncService,
    // UserWallet компоненты (ledger2::userwallets, Эпик 3)
    {
      provide: USER_WALLET_REPOSITORY,
      useClass: UserWalletTypeormRepository,
    },
    UserWalletTypeormRepository,
    UserWalletDeltaMapper,
    UserWalletSyncService,
    UserWalletIndexInitializer,
    // Реестр подписанных документов (Postgres-проекция, C28-21)
    {
      provide: SIGNED_DOCUMENT_REPOSITORY,
      useClass: SignedDocumentTypeormRepository,
    },
    EntityVersionRepository,
    EntityVersioningService,
  ],
  exports: [
    NestTypeOrmModule,
    EXTENSION_REPOSITORY,
    LOG_EXTENSION_REPOSITORY,
    MEET_REPOSITORY,
    MEET_PROCESSED_REPOSITORY,
    MIGRATION_REPOSITORY,
    CANDIDATE_REPOSITORY,
    PAYMENT_REPOSITORY,
    PAYMENT_FILE_REPOSITORY,
    NOTIFICATION_SUBSCRIPTION_PORT,
    LEDGER_OPERATION_REPOSITORY,
    AGREEMENT_REPOSITORY,
    AgreementSyncService,
    ACTION_REPOSITORY_PORT,
    DELTA_REPOSITORY_PORT,
    FORK_REPOSITORY_PORT,
    SYNC_STATE_REPOSITORY_PORT,
    SETTINGS_REPOSITORY,
    TOKEN_REPOSITORY,
    USER_REPOSITORY,
    VAULT_REPOSITORY,
    IPN_REPOSITORY,
    PAYMENT_STATE_REPOSITORY,
    MUTATION_LOG_REPOSITORY,
    PROGRAM_WALLET_REPOSITORY,
    ProgramWalletDeltaMapper,
    USER_AGREEMENT_REPOSITORY,
    UserAgreementDeltaMapper,
    UserAgreementSyncService,
    USER_WALLET_REPOSITORY,
    UserWalletDeltaMapper,
    UserWalletSyncService,
    SIGNED_DOCUMENT_REPOSITORY,
    EntityVersionRepository,
    EntityVersioningService,
  ],
})
export class TypeOrmModule {}
