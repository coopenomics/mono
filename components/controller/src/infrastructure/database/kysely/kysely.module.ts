// infrastructure/database/kysely/kysely.module.ts
import { Global, Module } from '@nestjs/common';
import { EXTENSION_REPOSITORY, LOG_EXTENSION_REPOSITORY } from '@coopenomics/extension-kit';
import { MAIN_DATABASE } from '@coopenomics/extension-kit';
import { PG_POOL, kyselyProvider, mainDatabaseProvider, pgPoolProvider } from './kysely.provider';
import { KYSELY } from './kysely.tokens';
import { MEMBERSHIP_EXIT_REQUEST_REPOSITORY } from '~/domain/membership-exit/repositories/membership-exit-request.repository';
import { MembershipExitRequestKyselyRepository } from './repositories/membership-exit-request.kysely-repository';
import { ExtensionKyselyRepository } from './repositories/extension.kysely-repository';
import { LogExtensionKyselyRepository } from './repositories/log-extension.kysely-repository';
import { MEET_REPOSITORY } from '~/domain/meet/repositories/meet-pre.repository';
import { MeetPreKyselyRepository } from './repositories/meet-pre.kysely-repository';
import { MIGRATION_REPOSITORY } from '~/domain/system/repositories/migration-domain.repository';
import { MigrationKyselyRepository } from './repositories/migration.kysely-repository';
import { CANDIDATE_REPOSITORY } from '~/domain/account/repository/candidate.repository';
import { CandidateKyselyRepository } from './repositories/candidate.kysely-repository';
import { ChainTextKyselyRepository } from './repositories/chain-text.kysely-repository';
import { CHAIN_TEXT_REPOSITORY } from '~/domain/chain-text/chain-text.repository';
import { ChainTextService } from '~/domain/chain-text/chain-text.service';
import { MEET_PROCESSED_REPOSITORY } from '~/domain/meet/repositories/meet-processed.repository';
import { MeetProcessedKyselyRepository } from './repositories/meet-processed.kysely-repository';
import { PAYMENT_REPOSITORY } from '~/domain/gateway/repositories/payment.repository';
import { PaymentKyselyRepository } from './repositories/payment.kysely-repository';
import { PAYMENT_FILE_REPOSITORY } from '~/domain/gateway/repositories/payment-file.repository';
import { PaymentFileKyselyRepository } from './repositories/payment-file.kysely-repository';
import { ROLE_ASSIGNMENT_REPOSITORY } from '~/domain/access-roles/role-assignment.repository';
import { RoleAssignmentKyselyRepository } from './repositories/role-assignment.kysely-repository';
import { NOTIFICATION_SUBSCRIPTION_PORT } from '~/domain/notification/interfaces/web-push-subscription.port';
import { WebPushSubscriptionKyselyRepository } from './repositories/web-push-subscription.kysely-repository';
import {
  NOTIFICATION_DELIVERY_REPOSITORY,
  NOTIFICATION_INBOX_REPOSITORY,
  NOTIFICATION_OUTBOX_REPOSITORY,
} from '~/domain/notification/repositories/notification-store.repository';
import { NotificationOutboxKyselyRepository } from './repositories/notification-outbox.kysely-repository';
import { NotificationDeliveryKyselyRepository } from './repositories/notification-delivery.kysely-repository';
import { NotificationInboxKyselyRepository } from './repositories/notification-inbox.kysely-repository';
import { LEDGER_OPERATION_REPOSITORY } from '~/domain/ledger/repositories/ledger-operation.repository';
import { LedgerOperationKyselyRepository } from './repositories/ledger-operation.kysely-repository';
import { AGREEMENT_REPOSITORY } from '~/domain/agreement/repositories/agreement.repository';
import { AgreementKyselyRepository } from './repositories/agreement.kysely-repository';
import { AgreementDeltaMapper } from './blockchain/mappers/agreement-delta.mapper';
import { AgreementSyncService } from './blockchain/services/agreement-sync.service';
import { DraftRegistryKyselyRepository } from './repositories/draft-registry.kysely-repository';
import { coreStoreProviders } from './core-stores';
import { ChainVersioningService } from '@coopenomics/extension-kit/sync';
import { ACTION_REPOSITORY_PORT } from '~/domain/parser/ports/action-repository.port';
import { DELTA_REPOSITORY_PORT } from '~/domain/parser/ports/delta-repository.port';
import { FORK_REPOSITORY_PORT } from '~/domain/parser/ports/fork-repository.port';
import { SYNC_STATE_REPOSITORY_PORT } from '~/domain/parser/ports/sync-state-repository.port';
import { BlockchainActionKyselyRepository } from './repositories/blockchain-action.kysely-repository';
import { BlockchainDeltaKyselyRepository } from './repositories/blockchain-delta.kysely-repository';
import { BlockchainForkKyselyRepository } from './repositories/blockchain-fork.kysely-repository';
import { BlockchainSyncStateKyselyRepository } from './repositories/blockchain-sync-state.kysely-repository';
import { CONSUMER_DEDUP_REPOSITORY_PORT } from '~/domain/parser/ports/consumer-dedup-repository.port';
import { ConsumerDedupKyselyRepository } from './repositories/consumer-dedup.kysely-repository';
import { SETTINGS_REPOSITORY } from '~/domain/settings/repositories/settings.repository';
import { SettingsKyselyRepository } from './repositories/settings.kysely-repository';
import { TOKEN_REPOSITORY } from '~/domain/token/repositories/token.repository';
import { TokenKyselyRepository } from './repositories/token.kysely-repository';
import { USER_REPOSITORY } from '~/domain/user/repositories/user.repository';
import { UserKyselyRepository } from './repositories/user.kysely-repository';
import { VAULT_REPOSITORY } from '~/domain/vault/repositories/vault.repository';
import { VaultKyselyRepository } from './repositories/vault.kysely-repository';
import { IPN_REPOSITORY } from '~/domain/gateway/repositories/ipn.repository';
import { IpnKyselyRepository } from './repositories/ipn.kysely-repository';
import { PAYMENT_STATE_REPOSITORY } from '~/domain/gateway/repositories/payment-state.repository';
import { PaymentStateKyselyRepository } from './repositories/payment-state.kysely-repository';
import { MUTATION_LOG_REPOSITORY } from '~/domain/mutation-log/repositories/mutation-log.repository';
import { MutationLogKyselyRepository } from './repositories/mutation-log.kysely-repository';
import { PROGRAM_WALLET_REPOSITORY } from '~/domain/wallet/repositories/program-wallet.repository';
import { ProgramWalletKyselyRepository } from './repositories/program-wallet.kysely-repository';
import { ProgramWalletDeltaMapper } from './blockchain/mappers/program-wallet-delta.mapper';
import { USER_AGREEMENT_REPOSITORY } from '~/domain/wallet/repositories/user-agreement.repository';
import { UserAgreementKyselyRepository } from './repositories/user-agreement.kysely-repository';
import { UserAgreementDeltaMapper } from './blockchain/mappers/user-agreement-delta.mapper';
import { UserAgreementSyncService } from './blockchain/services/user-agreement-sync.service';
import { USER_WALLET_REPOSITORY } from '~/domain/wallet/repositories/user-wallet.repository';
import { UserWalletKyselyRepository } from './repositories/user-wallet.kysely-repository';
import { UserWalletDeltaMapper } from './blockchain/mappers/user-wallet-delta.mapper';
import { UserWalletSyncService } from './blockchain/services/user-wallet-sync.service';
import { SIGNED_DOCUMENT_REPOSITORY } from '~/domain/document/repository/signed-document.repository';
import { SignedDocumentKyselyRepository } from './repositories/signed-document.kysely-repository';

@Global()
@Module({
  providers: [
    // Пул основной базы (при подключении применяет миграции схемы) и Kysely поверх него.
    pgPoolProvider,
    mainDatabaseProvider,
    kyselyProvider,
    { provide: MEMBERSHIP_EXIT_REQUEST_REPOSITORY, useClass: MembershipExitRequestKyselyRepository },
    { provide: NOTIFICATION_OUTBOX_REPOSITORY, useClass: NotificationOutboxKyselyRepository },
    { provide: NOTIFICATION_DELIVERY_REPOSITORY, useClass: NotificationDeliveryKyselyRepository },
    { provide: NOTIFICATION_INBOX_REPOSITORY, useClass: NotificationInboxKyselyRepository },
    {
      provide: EXTENSION_REPOSITORY,
      useClass: ExtensionKyselyRepository,
    },
    {
      provide: LOG_EXTENSION_REPOSITORY,
      useClass: LogExtensionKyselyRepository,
    },
    {
      provide: MEET_REPOSITORY,
      useClass: MeetPreKyselyRepository,
    },
    {
      provide: MEET_PROCESSED_REPOSITORY,
      useClass: MeetProcessedKyselyRepository,
    },
    {
      provide: CHAIN_TEXT_REPOSITORY,
      useClass: ChainTextKyselyRepository,
    },
    ChainTextService,
    {
      provide: MIGRATION_REPOSITORY,
      useClass: MigrationKyselyRepository,
    },
    {
      provide: CANDIDATE_REPOSITORY,
      useClass: CandidateKyselyRepository,
    },
    {
      provide: PAYMENT_REPOSITORY,
      useClass: PaymentKyselyRepository,
    },
    {
      provide: PAYMENT_FILE_REPOSITORY,
      useClass: PaymentFileKyselyRepository,
    },
    {
      provide: ROLE_ASSIGNMENT_REPOSITORY,
      useClass: RoleAssignmentKyselyRepository,
    },
    {
      provide: NOTIFICATION_SUBSCRIPTION_PORT,
      useClass: WebPushSubscriptionKyselyRepository,
    },
    {
      provide: LEDGER_OPERATION_REPOSITORY,
      useClass: LedgerOperationKyselyRepository,
    },
    // Agreement компоненты
    {
      provide: AGREEMENT_REPOSITORY,
      useClass: AgreementKyselyRepository,
    },
    AgreementKyselyRepository,
    AgreementDeltaMapper,
    AgreementSyncService,
    DraftRegistryKyselyRepository,
    {
      provide: ACTION_REPOSITORY_PORT,
      useClass: BlockchainActionKyselyRepository,
    },
    {
      provide: DELTA_REPOSITORY_PORT,
      useClass: BlockchainDeltaKyselyRepository,
    },
    {
      provide: FORK_REPOSITORY_PORT,
      useClass: BlockchainForkKyselyRepository,
    },
    {
      provide: SYNC_STATE_REPOSITORY_PORT,
      useClass: BlockchainSyncStateKyselyRepository,
    },
    {
      provide: CONSUMER_DEDUP_REPOSITORY_PORT,
      useClass: ConsumerDedupKyselyRepository,
    },
    {
      provide: SETTINGS_REPOSITORY,
      useClass: SettingsKyselyRepository,
    },
    {
      provide: TOKEN_REPOSITORY,
      useClass: TokenKyselyRepository,
    },
    {
      provide: USER_REPOSITORY,
      useClass: UserKyselyRepository,
    },
    {
      provide: VAULT_REPOSITORY,
      useClass: VaultKyselyRepository,
    },
    {
      provide: IPN_REPOSITORY,
      useClass: IpnKyselyRepository,
    },
    {
      provide: PAYMENT_STATE_REPOSITORY,
      useClass: PaymentStateKyselyRepository,
    },
    {
      provide: MUTATION_LOG_REPOSITORY,
      useClass: MutationLogKyselyRepository,
    },
    // ProgramWallet компоненты
    {
      provide: PROGRAM_WALLET_REPOSITORY,
      useClass: ProgramWalletKyselyRepository,
    },
    ProgramWalletKyselyRepository,
    ProgramWalletDeltaMapper,
    // UserAgreement компоненты (wallet::users, Эпик 2)
    {
      provide: USER_AGREEMENT_REPOSITORY,
      useClass: UserAgreementKyselyRepository,
    },
    UserAgreementKyselyRepository,
    UserAgreementDeltaMapper,
    UserAgreementSyncService,
    // UserWallet компоненты (ledger2::userwallets, Эпик 3)
    {
      provide: USER_WALLET_REPOSITORY,
      useClass: UserWalletKyselyRepository,
    },
    UserWalletKyselyRepository,
    UserWalletDeltaMapper,
    UserWalletSyncService,
    // Реестр подписанных документов (Postgres-проекция, C28-21)
    {
      provide: SIGNED_DOCUMENT_REPOSITORY,
      useClass: SignedDocumentKyselyRepository,
    },
    // Версии и архив форка для зеркал, переведённых на Kysely (C28-81).
    ChainVersioningService,
    // Шлюзы таблиц зеркал ядра: кошельки и соглашения.
    ...coreStoreProviders,
  ],
  exports: [
    ChainVersioningService,
    ...coreStoreProviders,
    PG_POOL,
    MAIN_DATABASE,
    KYSELY,
    MEMBERSHIP_EXIT_REQUEST_REPOSITORY,
    NOTIFICATION_OUTBOX_REPOSITORY,
    NOTIFICATION_DELIVERY_REPOSITORY,
    NOTIFICATION_INBOX_REPOSITORY,
    DraftRegistryKyselyRepository,
    EXTENSION_REPOSITORY,
    LOG_EXTENSION_REPOSITORY,
    MEET_REPOSITORY,
    MEET_PROCESSED_REPOSITORY,
    CHAIN_TEXT_REPOSITORY,
    ChainTextService,
    MIGRATION_REPOSITORY,
    CANDIDATE_REPOSITORY,
    PAYMENT_REPOSITORY,
    PAYMENT_FILE_REPOSITORY,
    ROLE_ASSIGNMENT_REPOSITORY,
    NOTIFICATION_SUBSCRIPTION_PORT,
    LEDGER_OPERATION_REPOSITORY,
    AGREEMENT_REPOSITORY,
    AgreementSyncService,
    ACTION_REPOSITORY_PORT,
    DELTA_REPOSITORY_PORT,
    FORK_REPOSITORY_PORT,
    SYNC_STATE_REPOSITORY_PORT,
    CONSUMER_DEDUP_REPOSITORY_PORT,
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
  ],
})
export class KyselyModule {}
